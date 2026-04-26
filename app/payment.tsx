import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, Copy } from 'lucide-react-native';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Clipboard,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  paymentService,
  InitiatePaymentResponse,
  CheckOrderPaymentStatusResponse,
} from '@/services/paymentService';
import { getDefaultHomeRoute } from '@/constants/roles';
import { useAuth } from '@/contexts/AuthContext';
import { SpecifyStatus } from '@/lib/schemas/order-form-schema';
import { patientMetadataService } from '@/services/patientMetadataService';
import { orderService } from '@/services/orderService';
import { sampleAddService } from '@/services/sampleAddService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';
import { ensurePatientMetadataForOrder } from '@/utils/ensurePatientMetadataForOrder';

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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    orderId: string;
    orderName: string;
    amount: string;
    specifyId?: string;
    sampleAddId?: string;
  }>();

  const paramStr = (v: string | string[] | undefined) => {
    if (v === undefined || v === null) return "";
    return Array.isArray(v) ? (v[0] ?? "") : v;
  };

  const orderId = paramStr(params.orderId);
  const orderName = paramStr(params.orderName);
  const amount = paramStr(params.amount);
  const specifyId = paramStr(params.specifyId);
  const sampleAddId = paramStr(params.sampleAddId);
  const isSampleAddPayment = Boolean(sampleAddId.trim());

  const [step, setStep] = useState<PaymentStep>('loading');
  const [paymentInfo, setPaymentInfo] = useState<InitiatePaymentResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<CheckOrderPaymentStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(15 * 60);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const isInitializedRef = useRef<boolean>(false);
  const paymentIdRef = useRef<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Đã sao chép', `${label} đã được sao chép vào clipboard`);
  };

  const ensureMetadataForSampleAddPayment = useCallback(async () => {
    const sid = String(sampleAddId || '').trim();
    if (!sid) return;

    try {
      const sampleRes = await sampleAddService.getById(sid);
      if (!sampleRes.success || !sampleRes.data) return;
      const row = sampleRes.data as any;

      const specifyId = String(row.specifyId || '').trim();
      let patientId = String(row.patientId || '').trim();
      const patientName = String(row.patientName || '').trim();
      const sampleName = String(row.sampleName || '').trim();
      if (!specifyId) return;

      // Tránh tạo trùng metadata cho cùng mẫu bổ sung.
      const existing = await patientMetadataService.getBySpecifyId(specifyId);
      const existingRows =
        existing.success && Array.isArray(existing.data) ? existing.data : [];
      if (sampleName) {
        const duplicated = existingRows.some(
          (m: any) => String(m.sampleName || '').trim() === sampleName
        );
        if (duplicated) return;
      }

      if (!patientId) {
        const sp = await specifyVoteTestService.getById(specifyId);
        patientId = String(
          (sp.success && (sp.data?.patientId || sp.data?.patient?.patientId)) || ''
        ).trim();
      }
      if (!patientId) return;

      await patientMetadataService.createWithSampleAdd({
        specifyId,
        patientId,
        ...(patientName ? { patientName } : {}),
        ...(sampleName ? { sampleName } : {}),
      } as any);
    } catch (e) {
      console.warn('[payment] ensureMetadataForSampleAddPayment:', e);
    }
  }, [sampleAddId]);

  const syncParentOrderPaymentCompletedForSampleAdd = useCallback(
    async (paidAmount?: number): Promise<boolean> => {
      const parentOrderId = String(orderId || '').trim();
      if (!parentOrderId) return false;

      try {
        const currentOrderRes = await orderService.getById(parentOrderId);
        if (!currentOrderRes.success || !currentOrderRes.data) {
          console.warn('[payment] cannot load parent order to sync payment status');
          return false;
        }

        const currentOrder = currentOrderRes.data as any;
        const payload: Record<string, unknown> = {
          orderName: currentOrder.orderName || orderName || "",
          orderStatus: currentOrder.orderStatus || "accepted",
          paymentStatus: "COMPLETED",
          paymentType: "ONLINE_PAYMENT",
        };

        if (typeof paidAmount === "number" && Number.isFinite(paidAmount) && paidAmount > 0) {
          payload.paymentAmount = paidAmount;
        }
        if (currentOrder.specifyId?.specifyVoteID) {
          payload.specifyId = currentOrder.specifyId.specifyVoteID;
        }
        if (currentOrder.specifyVoteImagePath) {
          payload.specifyVoteImagePath = currentOrder.specifyVoteImagePath;
        }
        if (currentOrder.sampleCollectorId) {
          payload.sampleCollectorId = currentOrder.sampleCollectorId;
        }
        if (currentOrder.staffAnalystId) {
          payload.staffAnalystId = currentOrder.staffAnalystId;
        }
        if (currentOrder.barcodeId) {
          payload.barcodeId = currentOrder.barcodeId;
        }

        const updateRes = await orderService.update(parentOrderId, payload);
        if (!updateRes.success) {
          console.warn('[payment] failed to sync parent order payment status:', updateRes.error);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('[payment] syncParentOrderPaymentCompletedForSampleAdd:', e);
        return false;
      }
    },
    [orderId, orderName],
  );

  const checkPaymentStatus = useCallback(async () => {
    if (!orderId) return;

    try {
      if (isSampleAddPayment && sampleAddId) {
        const result = await paymentService.checkSampleAddPaymentStatus(sampleAddId);
        if (!result.success || !result.data) return;

        const row = result.data;
        const ps = (row.paymentStatus || "").toUpperCase();
        const amt =
          row.amountIn != null && row.amountIn !== ""
            ? Number(row.amountIn)
            : parseFloat(amount || "0") || 0;

        setPaymentStatus({
          orderId: row.orderId || orderId,
          orderName: orderName || "",
          paymentStatus: ps === "COMPLETED" ? "COMPLETED" : ps === "FAILED" ? "FAILED" : "PENDING",
          paymentType: "ONLINE_PAYMENT",
          paymentAmount: amt,
          hasPaymentRecord: Boolean(row.hasPaymentRecord),
          transactionId: row.transactionId,
          amountIn: row.amountIn != null ? Number(row.amountIn) : undefined,
          transactionDate: row.transactionDate as string | undefined,
        });

        if (ps === "COMPLETED") {
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
          setStep("processing");
          try {
            await ensureMetadataForSampleAddPayment();
            const synced = await syncParentOrderPaymentCompletedForSampleAdd(amt);
            if (!synced) {
              Alert.alert(
                "Cảnh báo",
                "Thanh toán mẫu bổ sung đã thành công nhưng chưa cập nhật được trạng thái thanh toán của đơn hàng cha.",
              );
            }
          } catch (e) {
            console.warn('[payment] sample add metadata creation failed:', e);
          }
          queryClient.invalidateQueries({ queryKey: ["patient-metadatas"] });
          queryClient.invalidateQueries({ queryKey: ["invoice-create-sample-adds"] });
          queryClient.invalidateQueries({ queryKey: ["sample-adds"] });
          queryClient.invalidateQueries({ queryKey: ["invoice-create-orders"] });
          queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          setStep("success");
        } else if (ps === "FAILED") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          setStep("failed");
        }
        return;
      }

      const result = await paymentService.checkOrderPaymentStatus(orderId);
      if (result.success && result.data) {
        const status = result.data;
        setPaymentStatus(status);

        if (status.paymentStatus === "COMPLETED") {
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

          setStep("processing");

          if (specifyId) {
            try {
              await specifyVoteTestService.updateStatus(
                specifyId,
                SpecifyStatus.WAITING_RECEIVE_SAMPLE
              );
            } catch (err) {
              console.error("Error updating specify status:", err);
            }
          }

          try {
            await ensurePatientMetadataForOrder(orderId, specifyId);
          } catch (e) {
            console.warn("[payment] ensurePatientMetadataForOrder:", e);
          }
          queryClient.invalidateQueries({ queryKey: ["patient-metadatas"] });

          setStep("success");
        } else if (status.paymentStatus === "FAILED") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          setStep("failed");
        }
      }
    } catch (err) {
      console.error("Error checking payment status:", err);
    }
  }, [
    orderId,
    orderName,
    amount,
    specifyId,
    isSampleAddPayment,
    sampleAddId,
    ensureMetadataForSampleAddPayment,
    syncParentOrderPaymentCompletedForSampleAdd,
    queryClient,
  ]);

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
          ...(isSampleAddPayment && sampleAddId ? { sampleAddId } : {}),
          returnUrl: "htgenmobile://payment/success",
          cancelUrl: "htgenmobile://payment/cancel",
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
  }, [orderId, amount, orderName, checkPaymentStatus, isSampleAddPayment, sampleAddId]);

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
    router.replace(getDefaultHomeRoute(user?.role));
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

        {/* Header */}
        <View className="bg-cyan-600 px-4 py-4">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={handleCancel} className="p-2 -ml-2">
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View className="flex-1 ml-2">
              <Text className="text-white text-lg font-semibold">
                {isSampleAddPayment ? "Thanh toán mẫu bổ sung" : "Thanh toán đơn hàng"}
              </Text>
              <Text className="text-cyan-100 text-sm">{paymentInfo.orderId}</Text>
            </View>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {/* Amount */}
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

          {/* Bank Info */}
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

          {/* Countdown */}
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

          {/* Status indicator */}
          <View className="flex-row items-center justify-center mb-4">
            <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
            <Text className="text-slate-500 text-sm">Đang chờ thanh toán...</Text>
          </View>

          {/* Cancel button */}
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
        <View className="flex-1 justify-center items-center p-6">
          <View className="bg-green-100 rounded-full p-6 mb-6">
            <CheckCircle size={64} color="#16a34a" />
          </View>
          <Text className="text-2xl font-bold text-slate-800 mb-2">Thanh toán thành công!</Text>
          <Text className="text-slate-600 text-center mb-2">{orderName}</Text>
          {paymentStatus && (
            <Text className="text-cyan-600 font-bold text-xl mb-8">
              {formatCurrency(paymentStatus.paymentAmount || 0)}
            </Text>
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
          <TouchableOpacity onPress={handleGoBack} className="bg-slate-600 rounded-xl py-3 px-8">
            <Text className="text-white font-semibold text-lg">Quay lại</Text>
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
          <TouchableOpacity onPress={handleGoBack} className="bg-slate-600 rounded-xl py-3 px-8">
            <Text className="text-white font-semibold text-lg">Quay lại</Text>
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
          <TouchableOpacity onPress={handleGoBack} className="bg-slate-600 rounded-xl py-3 px-8">
            <Text className="text-white font-semibold text-lg">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}
