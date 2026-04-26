import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ArrowLeft, CheckCircle, Clock, Copy, FileText, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Image,
  InteractionManager,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { InvoiceView, type InvoiceData } from '@/components/invoice/InvoiceView';
import { ConfirmModal, InvoiceModal } from '@/components/modals';
import { presentFeedbackSuccess } from '@/lib/feedbackModal';
import { isExplicitNoFastqParam } from '@/lib/payment-fastq';
import { orderService } from '@/services/orderService';
import { patientMetadataService } from '@/services/patientMetadataService';
import {
  CheckOrderPaymentStatusResponse,
  InitiatePaymentResponse,
  paymentService,
} from '@/services/paymentService';
import { sampleAddService } from '@/services/sampleAddService';
import {
  sampleAddServiceCatalogService,
  type SampleAddServiceCatalogResponse,
} from '@/services/sampleAddServiceCatalogService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';
import { uploadImageToCloudinary } from '@/utils/cloudinary';

const POLLING_INTERVAL = 3000;
const INVOICE_CAPTURE_WIDTH = 600;
const INVOICE_CAPTURE_MIN_HEIGHT = 1200;

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
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    orderId: string;
    orderName: string;
    amount: string;
    specifyId?: string;
    hasFastq?: string;
    allOrderIds?: string;
    allSpecifyIds?: string;
    sampleAddId?: string;
    patientId?: string;
    patientName?: string;
    sampleName?: string;
    returnPath?: string;
    cancelPath?: string;
  }>();

  const {
    orderId,
    orderName,
    amount,
    specifyId,
    hasFastq,
    allOrderIds,
    allSpecifyIds,
    sampleAddId,
    patientId,
    patientName,
    sampleName,
    returnPath,
    cancelPath,
  } = params;

  const [step, setStep] = useState<PaymentStep>('loading');
  const [paymentInfo, setPaymentInfo] = useState<InitiatePaymentResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<CheckOrderPaymentStatusResponse | null>(null);
  const [invoiceLink, setInvoiceLink] = useState<string | null>(null);
  const [invoiceDataForCapture, setInvoiceDataForCapture] = useState<InvoiceData | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(15 * 60);
  const [sampleAddCatalog, setSampleAddCatalog] = useState<SampleAddServiceCatalogResponse | null>(null);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const invoiceViewRef = useRef<View>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const isInitializedRef = useRef<boolean>(false);
  const paymentIdRef = useRef<string | null>(null);
  const createdOrderIdRef = useRef<string | null>(null);
  const createdOrderIdsRef = useRef<string[]>([]);
  const afterInvoiceCallbackRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (allOrderIds && String(allOrderIds).trim()) {
      createdOrderIdsRef.current = String(allOrderIds)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else if (orderId) {
      createdOrderIdsRef.current = [String(orderId)];
    } else {
      createdOrderIdsRef.current = [];
    }
    createdOrderIdRef.current = orderId ? String(orderId) : null;
  }, [orderId, allOrderIds]);

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    presentFeedbackSuccess({
      title: 'Đã sao chép',
      message: `${label} đã được sao chép vào clipboard`,
    });
  };

  useEffect(() => {
    if (!sampleAddId || !sampleName) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sampleAddServiceCatalogService.getBySampleName(String(sampleName));
        if (!cancelled && res.success && res.data) {
          setSampleAddCatalog(res.data);
          return;
        }
        const allRes = await sampleAddServiceCatalogService.getAll();
        if (!cancelled && allRes.success && Array.isArray(allRes.data)) {
          const found = allRes.data.find(s => s.sampleName === sampleName);
          if (found) setSampleAddCatalog(found);
        }
      } catch {
        try {
          const allRes = await sampleAddServiceCatalogService.getAll();
          if (!cancelled && allRes.success && Array.isArray(allRes.data)) {
            const found = allRes.data.find(s => s.sampleName === sampleName);
            if (found) setSampleAddCatalog(found);
          }
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sampleAddId, sampleName]);

  const checkPaymentStatus = useCallback(async () => {
    if (sampleAddId) {
      try {
        const result = await paymentService.checkSampleAddPaymentStatus(sampleAddId);
        if (!result.success || !result.data) return;
        const status = result.data;
        setPaymentStatus({
          orderId: status.orderId,
          orderName: '',
          paymentStatus: status.paymentStatus as CheckOrderPaymentStatusResponse['paymentStatus'],
          paymentType: null,
          paymentAmount: status.amountIn ?? null,
          hasPaymentRecord: status.hasPaymentRecord,
          transactionId: status.transactionId,
          amountIn: status.amountIn,
          transactionDate: status.transactionDate as string | undefined,
        });

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

          const cat = sampleAddCatalog;
          const invData: InvoiceData = {
            orderId: sampleAddId,
            orderName: orderName || undefined,
            transactionId: status.transactionId,
            transactionDate: status.transactionDate as string | undefined,
            genomeTest: cat
              ? {
                testName: `Bổ sung mẫu - ${cat.sampleName}`,
                price: cat.price,
                taxRate: cat.taxRate ?? 10,
                finalPrice: cat.finalPrice,
              }
              : {
                testName: `Bổ sung mẫu - ${sampleName || ''}`,
                price: Number(amount) || 0,
                taxRate: 10,
                finalPrice: Number(amount) || 0,
              },
            patient: patientId
              ? {
                patientId: String(patientId),
                patientName: patientName || undefined,
              }
              : undefined,
            amountPaid: status.amountIn ?? (amount ? parseFloat(String(amount)) : undefined),
          };

          afterInvoiceCallbackRef.current = async () => {
            try {
              await sampleAddService.updatePaymentStatus(sampleAddId, 'COMPLETED');
              if (isExplicitNoFastqParam(hasFastq)) {
                await sampleAddService.updateStatus(sampleAddId, 'forward_analysis');
              }

              if (specifyId && patientId) {
                try {
                  await patientMetadataService.createWithSampleAdd({
                    specifyId: String(specifyId),
                    patientId: String(patientId),
                    patientName: patientName || undefined,
                    sampleName: sampleName || undefined,
                  });
                } catch (metadataErr) {
                  console.error('createWithSampleAdd:', metadataErr);
                }
              }
            } catch (err) {
              console.error('Error completing sample add payment:', err);
            }
          };

          setInvoiceDataForCapture(invData);
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
      } catch {
        /* Chưa có bản ghi thanh toán — bình thường vài giây đầu */
      }
      return;
    }

    if (!orderId) return;

    try {
      const result = await paymentService.checkOrderPaymentStatus(orderId);
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
          const specifyIds =
            allSpecifyIds && String(allSpecifyIds).trim()
              ? String(allSpecifyIds)
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
              : specifyId
                ? [String(specifyId)]
                : [];

          const primarySpecifyId = specifyIds[0] || specifyId;
          let specifyData: any = null;
          if (primarySpecifyId) {
            try {
              const specifyRes = await specifyVoteTestService.getById(primarySpecifyId);
              specifyData = specifyRes.success && specifyRes.data ? specifyRes.data : null;
            } catch (e) {
              console.error('Error fetching specify for invoice:', e);
            }
          }
          const invData: InvoiceData = {
            orderId:
              status.orderId ||
              createdOrderIdRef.current ||
              (orderId && String(orderId).trim() ? String(orderId) : ''),
            orderName: orderName || undefined,
            transactionId: status.transactionId,
            transactionDate: status.transactionDate,
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
            amountPaid: status.amountIn ?? status.paymentAmount ?? (amount ? parseFloat(amount) : undefined),
          };

          afterInvoiceCallbackRef.current = async () => {
            const noFastq = isExplicitNoFastqParam(hasFastq);
            const orderIds =
              createdOrderIdsRef.current.length > 0
                ? createdOrderIdsRef.current
                : orderId
                  ? [String(orderId)]
                  : [];

            if (!noFastq) {
              // Match web flow exactly: after successful online payment + hasFastq,
              // create patient metadata rows from each specify.genomeTest.testSample.
              for (const sid of specifyIds) {
                try {
                  const specifyRes = await specifyVoteTestService.getById(sid);
                  if (specifyRes.success && specifyRes.data) {
                    const spec = specifyRes.data as any;
                    const patient = spec.patient || {};
                    const gt = spec.genomeTest || {};
                    const testSamples: string[] = Array.isArray(gt.testSample)
                      ? gt.testSample.map((x: any) => String(x || '').trim()).filter(Boolean)
                      : [];
                    const sampleNames = testSamples.length > 0
                      ? testSamples
                      : [String(gt.testName || 'Mẫu xét nghiệm').trim() || 'Mẫu xét nghiệm'];

                    for (const sampleName of sampleNames) {
                      await patientMetadataService.create({
                        specifyId: sid,
                        patientId: patient.patientId || undefined,
                        patientName: patient.patientName || undefined,
                        sampleName,
                      });
                    }
                  }
                } catch (err) {
                  console.error('Error creating patient metadata after payment:', err);
                }
              }
              for (const sid of specifyIds) {
                try {
                  await specifyVoteTestService.updateStatus(sid, 'accepted');
                } catch (err) {
                  console.error('Error updating specify status:', err);
                }
              }
              return;
            }

            for (const oid of orderIds) {
              try {
                await orderService.updateStatus(oid, 'forward_analysis');
              } catch (err) {
                console.error('Error updating order status after payment:', err);
              }
            }
            for (const sid of specifyIds) {
              try {
                await specifyVoteTestService.updateStatus(sid, 'forward_analysis');
              } catch (err) {
                console.error('Error updating specify status after payment:', err);
              }
            }
          };

          setInvoiceDataForCapture(invData);
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
  }, [
    sampleAddId,
    sampleAddCatalog,
    patientId,
    patientName,
    sampleName,
    amount,
    orderName,
    orderId,
    specifyId,
    hasFastq,
    allOrderIds,
    allSpecifyIds,
  ]);

  useEffect(() => {
    if (!invoiceDataForCapture || (!orderId && !sampleAddId)) return;
    if (step !== 'processing') return;

    let cancelled = false;
    setInvoiceError(null);

    const timer = setTimeout(async () => {
      try {
        if (cancelled) return;
        await new Promise<void>(resolve => {
          InteractionManager.runAfterInteractions(() => resolve());
        });
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        if (cancelled) return;
        if (!invoiceViewRef.current) {
          setInvoiceError('Không thể tạo hóa đơn');
        } else {
          let uri: string;
          try {
            uri = await captureRef(invoiceViewRef, {
              format: 'png',
              quality: 1,
              result: 'tmpfile',
            });
          } catch (capErr) {
            console.warn('[invoice] captureRef retry after layout:', capErr);
            await new Promise<void>(r => setTimeout(r, 450));
            await new Promise<void>(resolve => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            });
            uri = await captureRef(invoiceViewRef, {
              format: 'png',
              quality: 1,
              result: 'tmpfile',
            });
          }
          const result = await uploadImageToCloudinary(uri, { folder: 'invoice' });
          if (result.secureUrl) {
            if (sampleAddId) {
              const sampleRes = await sampleAddService.updateInvoiceLink(sampleAddId, result.secureUrl);
              if (orderId) {
                const orderIds =
                  createdOrderIdsRef.current.length > 0
                    ? createdOrderIdsRef.current
                    : [String(orderId)];
                for (const oid of orderIds) {
                  try {
                    await orderService.updateInvoiceLink(String(oid), result.secureUrl);
                  } catch (e) {
                    console.error('[invoice] order updateInvoiceLink', oid, e);
                  }
                }
              }
              if (sampleRes.success === false) {
                setInvoiceError('Đã tạo hóa đơn nhưng cập nhật chưa thành công');
              }
            } else {
              const orderIds =
                createdOrderIdsRef.current.length > 0
                  ? createdOrderIdsRef.current
                  : orderId
                    ? [String(orderId)]
                    : [];
              let anyFailed = false;
              for (const oid of orderIds) {
                try {
                  const updateRes = await orderService.updateInvoiceLink(String(oid), result.secureUrl);
                  if (updateRes.success === false) anyFailed = true;
                } catch (e) {
                  anyFailed = true;
                  console.error('[invoice] order updateInvoiceLink', oid, e);
                }
              }
              if (anyFailed && orderIds.length > 0) {
                setInvoiceError('Đã tạo hóa đơn nhưng một số đơn chưa cập nhật link');
              }
            }
            setInvoiceLink(result.secureUrl);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Lỗi tạo hóa đơn';
        console.error('Error generating invoice:', e);
        setInvoiceError(msg);
      } finally {
        if (cancelled) return;
        try {
          await afterInvoiceCallbackRef.current?.();
        } catch (e) {
          console.error('afterInvoice payment:', e);
        }
        afterInvoiceCallbackRef.current = null;
        setInvoiceDataForCapture(null);
        setStep('success');
      }
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [invoiceDataForCapture, orderId, sampleAddId, step]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initPayment = async () => {
      if (!orderId || !amount) {
        setError('Thiếu thông tin thanh toán');
        setStep('failed');
        return;
      }

      const returnRoute =
        typeof returnPath === 'string' && returnPath.trim()
          ? returnPath.trim().replace(/^\//, '')
          : isExplicitNoFastqParam(hasFastq)
            ? 'customer/orders'
            : 'customer/patient-metadatas';
      const cancelRoute =
        typeof cancelPath === 'string' && cancelPath.trim()
          ? cancelPath.trim().replace(/^\//, '')
          : 'customer/specifies';

      try {
        const result = await paymentService.initiatePayment({
          orderId,
          amount: parseFloat(amount),
          description: orderName || undefined,
          returnUrl: Linking.createURL(returnRoute),
          cancelUrl: Linking.createURL(cancelRoute),
          ...(sampleAddId ? { sampleAddId } : {}),
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
  }, [orderId, amount, orderName, sampleAddId, returnPath, cancelPath, hasFastq, checkPaymentStatus]);

  const handleCancelPress = () => {
    setCancelConfirmVisible(true);
  };

  const confirmCancelPayment = async () => {
    setCancelConfirmVisible(false);
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
  };

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['specify-vote-tests'] });
    queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
    const defaultReturn =
      typeof returnPath === 'string' && returnPath.trim()
        ? returnPath.trim()
        : isExplicitNoFastqParam(hasFastq)
          ? '/customer/orders'
          : '/customer/patient-metadatas';
    const defaultCancel =
      typeof cancelPath === 'string' && cancelPath.trim() ? cancelPath.trim() : '/customer/specifies';

    if (sampleAddId) {
      if (typeof returnPath === 'string' && returnPath.trim()) {
        router.replace(returnPath.trim() as never);
        return;
      }
      router.replace('/customer/sample-adds' as never);
      return;
    }

    if (step === 'cancelled' || step === 'failed' || step === 'timeout') {
      router.replace(defaultCancel as never);
      return;
    }
    router.replace(defaultReturn as never);
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
        <ConfirmModal
          visible={cancelConfirmVisible}
          title="Hủy thanh toán"
          message="Bạn có chắc chắn muốn hủy thanh toán?"
          confirmText="Có, hủy thanh toán"
          cancelText="Không"
          destructive
          onConfirm={() => {
            void confirmCancelPayment();
          }}
          onCancel={() => setCancelConfirmVisible(false)}
        />
        <View className="bg-cyan-600 px-4 py-4">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={handleCancelPress} className="p-2 -ml-2">
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View className="flex-1 ml-2">
              <Text className="text-white text-lg font-semibold">
                {sampleAddId ? 'Thanh toán bổ sung mẫu' : 'Thanh toán đơn hàng'}
              </Text>
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

          {/* QR Code */}
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
            onPress={handleCancelPress}
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
        {invoiceDataForCapture ? (
          <View
            ref={invoiceViewRef}
            style={{
              position: 'absolute',
              left: -10000,
              top: 0,
              width: INVOICE_CAPTURE_WIDTH,
              minHeight: INVOICE_CAPTURE_MIN_HEIGHT,
              backgroundColor: '#ffffff',
              opacity: 1,
            }}
            collapsable={false}
            pointerEvents="none"
          >
            <InvoiceView data={invoiceDataForCapture} collapsable={false} />
          </View>
        ) : null}
        <View className="flex-1 justify-center items-center p-6">
          <ActivityIndicator size="large" color="#0891b2" />
          <Text className="mt-4 text-slate-600 text-center">
            {invoiceDataForCapture
              ? 'Đang tạo hóa đơn...'
              : 'Đang xử lý thanh toán...'}
            {'\n'}
            Vui lòng đợi trong giây lát
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
        <View className="flex-1 justify-center items-center p-6">
          <View className="bg-green-100 rounded-full p-6 mb-6">
            <CheckCircle size={64} color="#16a34a" />
          </View>
          <Text className="text-2xl font-bold text-slate-800 mb-2">Thanh toán thành công!</Text>
          <Text className="text-slate-600 text-center mb-2">{orderName}</Text>
          {paymentStatus && (
            <Text className="text-cyan-600 font-bold text-xl mb-4">
              {formatCurrency(paymentStatus.paymentAmount || 0)}
            </Text>
          )}
          {invoiceLink && (
            <TouchableOpacity
              onPress={() => setInvoiceModalVisible(true)}
              className="mb-4 flex-row items-center bg-white border border-slate-200 rounded-xl py-3 px-6"
            >
              <FileText size={20} color="#0284c7" />
              <Text className="text-sky-600 font-semibold ml-2">Xem hóa đơn</Text>
            </TouchableOpacity>
          )}
          <InvoiceModal
            visible={invoiceModalVisible}
            onClose={() => setInvoiceModalVisible(false)}
            invoiceLink={invoiceLink}
            orderId={orderId || ''}
          />
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
