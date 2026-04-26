import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertCircle, ArrowLeft, CheckCircle, Clock, Copy, FileText, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { InvoiceView, type InvoiceData } from '@/components/invoice/InvoiceView';
import { presentFeedbackSuccess } from '@/lib/feedbackModal';
import { orderService } from '@/services/orderService';
import { patientMetadataService } from '@/services/patientMetadataService';
import {
  CheckOrderPaymentStatusResponse,
  CheckSampleAddPaymentStatusResponse,
  InitiatePaymentResponse,
  paymentService,
} from '@/services/paymentService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';
import { uploadImageToCloudinary } from '@/utils/cloudinary';

const POLLING_INTERVAL = 3000;

type PaymentStep = 'loading' | 'qr' | 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId: string;
    orderName: string;
    amount: string;
    specifyId?: string;
    sampleAddId?: string;
    allOrderIds?: string;
    allSpecifyIds?: string;
    returnPath?: string;
  }>();

  const { orderId, orderName, amount, specifyId, sampleAddId, allOrderIds, allSpecifyIds, returnPath } = params;

  const [step, setStep] = useState<PaymentStep>('loading');
  const [paymentInfo, setPaymentInfo] = useState<InitiatePaymentResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    CheckOrderPaymentStatusResponse | CheckSampleAddPaymentStatusResponse | null
  >(null);
  const [invoiceLink, setInvoiceLink] = useState<string | null>(null);
  const [invoiceDataForCapture, setInvoiceDataForCapture] = useState<InvoiceData | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(15 * 60);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const invoiceViewRef = useRef<View>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const isInitializedRef = useRef<boolean>(false);
  const paymentIdRef = useRef<string | null>(null);
  const paymentSyncedRef = useRef<boolean>(false);

  const parseIds = useCallback((raw?: string) => {
    return String(raw || '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }, []);

  const syncAcceptedStateAfterPayment = useCallback(async () => {
    if (paymentSyncedRef.current) return;
    paymentSyncedRef.current = true;
    try {
      const orderIds = Array.from(new Set([orderId, ...parseIds(allOrderIds)]));
      const specifyIds = Array.from(new Set([specifyId, ...parseIds(allSpecifyIds)].filter(Boolean) as string[]));
      await Promise.all(
        orderIds.map(async oid => {
          await orderService.updateStatus(oid, 'accepted').catch(() => { });
        })
      );

      await Promise.all(
        specifyIds.map(async sid => {
          await specifyVoteTestService.updateStatus(sid, 'accepted').catch(() => { });
        })
      );

      await Promise.all(
        specifyIds.map(async sid => {
          const res = await patientMetadataService.getBySpecifyId(sid).catch(() => null);
          const rows = res?.success && Array.isArray(res.data) ? res.data : [];
          await Promise.all(
            rows.map(async pm => {
              if (pm.labcode) {
                await patientMetadataService.updateStatus(pm.labcode, 'accepted').catch(() => { });
              }
            })
          );
        })
      );
    } catch {
      // Keep payment-success UX stable even if sync is partially unavailable.
    }
  }, [allOrderIds, allSpecifyIds, orderId, parseIds, specifyId]);

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    presentFeedbackSuccess({
      title: 'Đã sao chép',
      message: `${label} đã được sao chép vào clipboard`,
    });
  };

  const checkPaymentStatus = useCallback(async () => {
    if (!orderId) return;

    try {
      const isSampleAddPayment = Boolean(String(sampleAddId || '').trim());
      const result = isSampleAddPayment
        ? await paymentService.checkSampleAddPaymentStatus(String(sampleAddId))
        : await paymentService.checkOrderPaymentStatus(orderId);
      if (result.success && result.data) {
        const status = result.data;
        setPaymentStatus(status);

        if (status.paymentStatus === 'COMPLETED') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }

          setStep('processing');

          if (!isSampleAddPayment) {
            await syncAcceptedStateAfterPayment();
          }
          let specifyData: any = null;
          let effectiveSpecifyId = specifyId;
          if (!isSampleAddPayment && !effectiveSpecifyId && orderId) {
            try {
              const orderRes = await orderService.getById(orderId);
              const ord = orderRes.success && orderRes.data ? (orderRes.data as any) : null;
              effectiveSpecifyId = ord?.specifyId?.specifyVoteID || ord?.specifyId?.specifyVoteId;
            } catch (e) {
              console.error('Error fetching order for specifyId:', e);
            }
          }
          if (!isSampleAddPayment && effectiveSpecifyId) {
            try {
              const specifyRes = await specifyVoteTestService.getById(effectiveSpecifyId);
              specifyData = specifyRes.success && specifyRes.data ? specifyRes.data : null;
            } catch (e) {
              console.error('Error fetching specify for invoice:', e);
            }
          }
          const invData: InvoiceData = {
            orderId: (status as any).orderId || orderId,
            orderName: orderName || undefined,
            transactionId: (status as any).transactionId,
            transactionDate: (status as any).transactionDate,
            genomeTest: specifyData?.genomeTest
              ? {
                testId: specifyData.genomeTest.testId,
                testName: specifyData.genomeTest.testName,
                code: specifyData.genomeTest.code,
                price: specifyData.genomeTest.price,
                taxRate: specifyData.genomeTest.taxRate ?? 10,
                finalPrice: specifyData.genomeTest.finalPrice,
              }
              : undefined,
            patient: specifyData?.patient
              ? {
                patientId: specifyData.patient.patientId,
                patientName: specifyData.patient.patientName,
                patientPhone: specifyData.patient.patientPhone,
                patientDob: specifyData.patient.patientDob,
                gender: specifyData.patient.gender,
                patientAddress: specifyData.patient.patientAddress,
              }
              : undefined,
            amountPaid: (status as any).amountIn ?? (status as any).paymentAmount ?? (amount ? parseFloat(amount) : undefined),
          };
          if (!isSampleAddPayment) {
            setInvoiceDataForCapture(invData);
          }

          setStep('success');
        } else if (status.paymentStatus === 'FAILED') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          setStep('failed');
        }
      }
    } catch (err) {
      console.error('Error checking payment status:', err);
    }
  }, [allOrderIds, allSpecifyIds, orderId, sampleAddId, specifyId, syncAcceptedStateAfterPayment]);

  // Capture invoice, upload to Cloudinary, update order
  useEffect(() => {
    if (!invoiceDataForCapture || !orderId) return;
    setInvoiceError(null);
    const timer = setTimeout(async () => {
      if (!invoiceViewRef.current) {
        setInvoiceDataForCapture(null);
        setInvoiceError('Không thể tạo hóa đơn');
        return;
      }
      try {
        const uri = await captureRef(invoiceViewRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: 600,
          height: 1400,
        });
        const result = await uploadImageToCloudinary(uri, { folder: 'invoice' });
        if (result.secureUrl) {
          await orderService.updateInvoiceLink(orderId, result.secureUrl);
          setInvoiceLink(result.secureUrl);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Lỗi tạo hóa đơn';
        console.error('Error generating invoice:', e);
        setInvoiceError(msg);
      } finally {
        setInvoiceDataForCapture(null);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [invoiceDataForCapture, orderId]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initPayment = async () => {
      if (!orderId || !amount) {
        setError('Thiếu thông tin thanh toán');
        setStep('failed');
        return;
      }

      try {
        const result = await paymentService.initiatePayment({
          orderId,
          amount: parseFloat(amount),
          description: orderName || undefined,
          returnUrl: 'htgenmobile://payment/success',
          cancelUrl: 'htgenmobile://payment/cancel',
          ...(sampleAddId ? { sampleAddId: String(sampleAddId) } : {}),
        });

        if (result.success && result.data) {
          const paymentData = result.data;

          paymentIdRef.current = paymentData.paymentId;
          setPaymentInfo(paymentData);
          setStep('qr');
          startTimeRef.current = Date.now();

          pollingRef.current = setInterval(checkPaymentStatus, POLLING_INTERVAL);

          const timeUntilExpiry = paymentData.expiresAt - Date.now();
          timeoutRef.current = setTimeout(
            () => {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
              }
              setStep('timeout');
            },
            Math.max(timeUntilExpiry, 0)
          );

          setCountdown(Math.floor(timeUntilExpiry / 1000));
          countdownRef.current = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                if (countdownRef.current) {
                  clearInterval(countdownRef.current);
                  countdownRef.current = null;
                }
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          setError(result.error || 'Không thể khởi tạo thanh toán');
          setStep('failed');
        }
      } catch (err) {
        console.error('Error initializing payment:', err);
        setError('Đã xảy ra lỗi khi khởi tạo thanh toán');
        setStep('failed');
      }
    };

    initPayment();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [orderId, amount, orderName, sampleAddId, checkPaymentStatus]);

  const handleCancel = async () => {
    Alert.alert('Hủy thanh toán', 'Bạn có chắc chắn muốn hủy thanh toán?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Có, hủy thanh toán',
        style: 'destructive',
        onPress: async () => {
          if (paymentIdRef.current) {
            try {
              await paymentService.cancelPayment(paymentIdRef.current);
            } catch (err) {
              console.error('Error cancelling payment:', err);
            }
          }

          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);

          setStep('cancelled');
        },
      },
    ]);
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleDone = () => {
    if (returnPath && typeof returnPath === 'string') {
      router.replace(returnPath as never);
      return;
    }
    router.replace('/staff/orders');
  };

  if (step === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0891b2" />
          <Text className="mt-4 text-slate-600">Đang khởi tạo thanh toán...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'qr' && paymentInfo) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <Stack.Screen options={{ headerShown: false }} />
        <View className="bg-cyan-600 px-4 py-4">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={handleCancel} className="p-2 -ml-2">
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View className="flex-1 ml-2">
              <Text className="text-white text-lg font-semibold">Thanh toán đơn hàng</Text>
              <Text className="text-cyan-100 text-sm">{paymentInfo.orderId}</Text>
            </View>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <Text className="text-slate-500 text-center text-sm">Số tiền cần thanh toán</Text>
            <Text className="text-cyan-600 text-center text-2xl font-bold mt-1">
              {formatCurrency(paymentInfo.amount)}
            </Text>
          </View>

          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm items-center">
            <View className="border-2 border-slate-200 rounded-xl p-3">
              <Image
                source={{ uri: paymentInfo.qrCodeUrl }}
                style={{ width: 220, height: 220 }}
                resizeMode="contain"
              />
            </View>
          </View>
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <Text className="text-slate-700 font-semibold mb-3">Thông tin chuyển khoản</Text>

            <View className="space-y-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-slate-500 text-sm">Ngân hàng:</Text>
                <Text className="font-medium text-slate-700">{paymentInfo.bankName}</Text>
              </View>

              <View className="flex-row justify-between items-center">
                <Text className="text-slate-500 text-sm">Số tài khoản:</Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(paymentInfo.accountNumber, 'Số tài khoản')}
                  className="flex-row items-center"
                >
                  <Text className="font-medium text-slate-700 font-mono mr-2">
                    {paymentInfo.accountNumber}
                  </Text>
                  <Copy size={16} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-between items-center">
                <Text className="text-slate-500 text-sm">Chủ tài khoản:</Text>
                <Text className="font-medium text-slate-700">{paymentInfo.accountName}</Text>
              </View>

              <View className="flex-row justify-between items-start">
                <Text className="text-slate-500 text-sm">Nội dung CK:</Text>
                <TouchableOpacity
                  onPress={() =>
                    copyToClipboard(paymentInfo.transactionContent, 'Nội dung chuyển khoản')
                  }
                  className="flex-row items-center flex-1 ml-3 justify-end"
                >
                  <Text className="font-medium text-cyan-600 text-right mr-2">
                    {paymentInfo.transactionContent}
                  </Text>
                  <Copy size={16} color="#0891b2" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View className="bg-amber-50 rounded-xl p-3 mb-4 flex-row items-center justify-center">
            <Clock size={18} color="#d97706" />
            <Text className="text-amber-700 ml-2">
              Thời gian còn lại: <Text className="font-bold">{formatTime(countdown)}</Text>
            </Text>
          </View>

          {/* Instructions */}
          <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <Text className="text-blue-800 font-semibold mb-2">Hướng dẫn thanh toán</Text>
            <View className="space-y-1">
              <Text className="text-blue-700 text-sm">1. Mở app ngân hàng và quét mã QR</Text>
              <Text className="text-blue-700 text-sm">
                2. Kiểm tra thông tin và xác nhận chuyển khoản
              </Text>
              <Text className="text-blue-700 text-sm">
                3. Đợi hệ thống xác nhận thanh toán (tự động)
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-center mb-4">
            <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
            <Text className="text-slate-500 text-sm">Đang chờ thanh toán...</Text>
          </View>
          <TouchableOpacity
            onPress={handleCancel}
            className="bg-white border border-slate-300 rounded-xl py-3 px-6 flex-row items-center justify-center"
          >
            <ArrowLeft size={18} color="#475569" />
            <Text className="text-slate-700 font-medium ml-2">Hủy thanh toán</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'processing') {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center p-6">
          <ActivityIndicator size="large" color="#0891b2" />
          <Text className="mt-4 text-slate-600 text-center">
            Đang xử lý thanh toán...{'\n'}Vui lòng đợi trong giây lát
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'success') {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <Stack.Screen options={{ headerShown: false }} />
        {invoiceDataForCapture && (
          <View
            ref={invoiceViewRef}
            style={{ position: 'absolute', left: -9999, top: 0, opacity: 0 }}
            collapsable={false}
          >
            <InvoiceView data={invoiceDataForCapture} collapsable={false} />
          </View>
        )}
        <View className="flex-1 justify-center items-center p-6">
          <View className="bg-green-100 rounded-full p-6 mb-6">
            <CheckCircle size={64} color="#16a34a" />
          </View>
          <Text className="text-2xl font-bold text-slate-800 mb-2">Thanh toán thành công!</Text>
          <Text className="text-slate-600 text-center mb-2">{orderName}</Text>
          {paymentStatus && (
            <Text className="text-cyan-600 font-bold text-xl mb-4">
              {formatCurrency((paymentStatus as any).paymentAmount || (paymentStatus as any).amountIn || 0)}
            </Text>
          )}
          {invoiceLink && (
            <TouchableOpacity
              onPress={() => WebBrowser.openBrowserAsync(invoiceLink)}
              className="mb-4 flex-row items-center bg-white border border-slate-200 rounded-xl py-3 px-6"
            >
              <FileText size={20} color="#0284c7" />
              <Text className="text-sky-600 font-semibold ml-2">Xem hóa đơn</Text>
            </TouchableOpacity>
          )}
          {invoiceDataForCapture && !invoiceLink && !invoiceError && (
            <Text className="text-slate-500 text-sm mb-4">Đang tạo hóa đơn...</Text>
          )}
          {invoiceError && (
            <Text className="text-amber-600 text-sm mb-4">{invoiceError}</Text>
          )}
          <TouchableOpacity onPress={handleDone} className="bg-cyan-600 rounded-xl py-3 px-8">
            <Text className="text-white font-semibold text-lg">Hoàn tất</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'failed') {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center p-6">
          <View className="bg-red-100 rounded-full p-6 mb-6">
            <XCircle size={64} color="#dc2626" />
          </View>
          <Text className="text-2xl font-bold text-slate-800 mb-2">Thanh toán thất bại</Text>
          <Text className="text-slate-600 text-center mb-8">
            {error || 'Đã xảy ra lỗi trong quá trình thanh toán'}
          </Text>
          <TouchableOpacity onPress={handleDone} className="bg-slate-600 rounded-xl py-3 px-8">
            <Text className="text-white font-semibold text-lg">Về danh sách đơn hàng</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'cancelled') {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center p-6">
          <View className="bg-slate-100 rounded-full p-6 mb-6">
            <XCircle size={64} color="#64748b" />
          </View>
          <Text className="text-2xl font-bold text-slate-800 mb-2">Đã hủy thanh toán</Text>
          <Text className="text-slate-600 text-center mb-8">
            Thanh toán đã bị hủy bởi người dùng
          </Text>
          <TouchableOpacity onPress={handleDone} className="bg-slate-600 rounded-xl py-3 px-8">
            <Text className="text-white font-semibold text-lg">Về danh sách đơn hàng</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'timeout') {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center p-6">
          <View className="bg-amber-100 rounded-full p-6 mb-6">
            <AlertCircle size={64} color="#d97706" />
          </View>
          <Text className="text-2xl font-bold text-slate-800 mb-2">Hết thời gian thanh toán</Text>
          <Text className="text-slate-600 text-center mb-8">
            Phiên thanh toán đã hết hạn.{'\n'}Vui lòng thử lại.
          </Text>
          <TouchableOpacity onPress={handleDone} className="bg-slate-600 rounded-xl py-3 px-8">
            <Text className="text-white font-semibold text-lg">Về danh sách đơn hàng</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}
