import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useSheetBottomInset } from '@/lib/useSheetBottomInset';
import { MEDICAL } from '@/lib/theme/medical';
import {
  SampleAddResponse,
  sampleAddService,
} from '@/services/sampleAddService';
import {
  SampleAddServiceCatalogResponse,
  sampleAddServiceCatalogService,
} from '@/services/sampleAddServiceCatalogService';

export interface SampleAddWithOrder extends SampleAddResponse {
  orderName?: string;
  patientName?: string;
  hospitalName?: string;
  staffId?: string;
}

interface ForwardSampleAddModalProps {
  visible: boolean;
  onClose: () => void;
  sampleAddData: SampleAddWithOrder | null;
  onSuccess?: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export const ForwardSampleAddModal: React.FC<ForwardSampleAddModalProps> = ({
  visible,
  onClose,
  sampleAddData,
  onSuccess,
}) => {
  const router = useRouter();
  const sheetBottomInset = useSheetBottomInset();
  const [hasFastq, setHasFastq] = useState(false);
  const [paymentOnline, setPaymentOnline] = useState(true);
  const [isForwarding, setIsForwarding] = useState(false);
  const [sampleService, setSampleService] = useState<SampleAddServiceCatalogResponse | null>(null);
  const [isLoadingService, setIsLoadingService] = useState(false);

  const saId = sampleAddData?.id ?? sampleAddData?.sampleAddId;

  useEffect(() => {
    if (!visible || !sampleAddData?.sampleName) return;
    setIsLoadingService(true);
    sampleAddServiceCatalogService
      .getBySampleName(sampleAddData.sampleName)
      .then(res => {
        if (res.success && res.data) {
          setSampleService(res.data);
        } else {
          sampleAddServiceCatalogService.getAll().then(allRes => {
            if (allRes.success && Array.isArray(allRes.data)) {
              const found = allRes.data.find(s => s.sampleName === sampleAddData.sampleName);
              if (found) setSampleService(found);
            }
          });
        }
      })
      .catch(() => {
        sampleAddServiceCatalogService.getAll().then(allRes => {
          if (allRes.success && Array.isArray(allRes.data)) {
            const found = allRes.data.find(s => s.sampleName === sampleAddData.sampleName);
            if (found) setSampleService(found);
          }
        });
      })
      .finally(() => setIsLoadingService(false));
  }, [visible, sampleAddData?.sampleName]);

  useEffect(() => {
    if (hasFastq) setPaymentOnline(true);
  }, [hasFastq]);

  useEffect(() => {
    if (!visible) {
      setHasFastq(false);
      setPaymentOnline(true);
      setSampleService(null);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (!isForwarding) onClose();
  }, [isForwarding, onClose]);

  const handleForward = useCallback(async () => {
    if (!sampleAddData || !saId) {
      Alert.alert('Lỗi', 'Không có thông tin mẫu bổ sung');
      return;
    }
    if (!sampleService) {
      Alert.alert('Lỗi', 'Không tìm thấy thông tin giá dịch vụ');
      return;
    }

    const paymentAmount = sampleService.finalPrice;
    setIsForwarding(true);

    try {
      if (paymentOnline) {
        await sampleAddService.updatePaymentType(saId, 'ONLINE_PAYMENT');
        await sampleAddService.updatePaymentStatus(saId, 'PENDING');
        await sampleAddService.updateCustomerFastq(saId, hasFastq);

        const returnPath = hasFastq ? '/customer/patient-metadatas' : '/customer/sample-adds';

        onClose();
        router.push({
          pathname: '/customer/payment',
          params: {
            orderId: sampleAddData.orderId || '',
            sampleAddId: saId,
            orderName: `Bổ sung mẫu - ${sampleAddData.sampleName}`,
            amount: String(paymentAmount),
            specifyId: sampleAddData.specifyId || '',
            patientId: sampleAddData.patientId || '',
            patientName: sampleAddData.patientName || '',
            sampleName: sampleAddData.sampleName,
            hasFastq: hasFastq ? 'true' : 'false',
            returnPath,
            cancelPath: '/customer/sample-adds',
          },
        });
        onSuccess?.();
      } else {
        await sampleAddService.updatePaymentType(saId, 'CASH');
        await sampleAddService.updatePaymentStatus(saId, 'UNPAID');
        await sampleAddService.updateCustomerFastq(saId, hasFastq);
        await sampleAddService.updateStatus(saId, 'forward_analysis');

        Alert.alert('Thành công', 'Đã gửi yêu cầu bổ sung mẫu. Vui lòng chờ nhân viên xác nhận thanh toán.');
        onClose();
        onSuccess?.();
      }
    } catch (e) {
      console.error('Forward sample add error:', e);
      Alert.alert('Lỗi', 'Đã xảy ra lỗi khi chuyển tiếp phân tích');
    } finally {
      setIsForwarding(false);
    }
  }, [
    sampleAddData,
    saId,
    sampleService,
    paymentOnline,
    hasFastq,
    onClose,
    onSuccess,
    router,
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[90%]" style={{ paddingBottom: sheetBottomInset }}>
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-sky-100">
            <Text className="text-lg font-extrabold text-sky-950">Chuyển tiếp phân tích</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isForwarding}
              className="w-10 h-10 rounded-xl items-center justify-center bg-sky-50"
            >
              <X size={22} color={MEDICAL.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-4 py-4" keyboardShouldPersistTaps="handled">
            <View className="bg-sky-50 rounded-2xl p-3 mb-4 border border-sky-100">
              <Text className="text-xs text-sky-700 mb-1">Tên mẫu</Text>
              <Text className="text-sm font-bold text-sky-950">{sampleAddData?.sampleName || '—'}</Text>
              {sampleAddData?.orderName ? (
                <Text className="text-xs text-sky-700 mt-2">
                  Đơn: <Text className="font-semibold text-sky-900">{sampleAddData.orderName}</Text>
                </Text>
              ) : null}
              {sampleAddData?.patientName ? (
                <Text className="text-xs text-sky-700 mt-1">
                  BN: <Text className="font-semibold text-sky-900">{sampleAddData.patientName}</Text>
                </Text>
              ) : null}
            </View>

            {isLoadingService ? (
              <View className="flex-row items-center justify-center py-6">
                <ActivityIndicator color={MEDICAL.primary} />
                <Text className="ml-2 text-sky-700">Đang tải giá...</Text>
              </View>
            ) : sampleService ? (
              <View className="bg-white rounded-2xl p-4 mb-4 border border-sky-100">
                <Text className="text-xs font-bold text-sky-800 mb-2">Chi phí</Text>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-sky-600">Giá gốc</Text>
                  <Text className="text-xs font-semibold text-sky-900">
                    {formatCurrency(sampleService.price)}
                  </Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-sky-600">Thuế ({sampleService.taxRate ?? 10}%)</Text>
                  <Text className="text-xs font-semibold text-sky-900">
                    {formatCurrency((sampleService.price * (sampleService.taxRate ?? 10)) / 100)}
                  </Text>
                </View>
                <View className="flex-row justify-between pt-2 border-t border-sky-100 mt-1">
                  <Text className="text-sm font-extrabold text-sky-950">Tổng</Text>
                  <Text className="text-sm font-extrabold text-sky-600">
                    {formatCurrency(sampleService.finalPrice)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-center text-amber-700 mb-4 text-sm">
                Không tải được bảng giá dịch vụ.
              </Text>
            )}

            <View className="flex-row items-center justify-between py-2 mb-2">
              <View className="flex-1 mr-3">
                <Text className="text-sm font-bold text-sky-950">Khách đã có FASTQ</Text>
                <Text className="text-xs text-sky-600">Bật thì bắt buộc thanh toán online</Text>
              </View>
              <Switch
                value={hasFastq}
                onValueChange={setHasFastq}
                trackColor={{ false: '#cbd5e1', true: '#7dd3fc' }}
                thumbColor={hasFastq ? MEDICAL.primary : '#f1f5f9'}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-bold text-sky-950 mb-2">Hình thức thanh toán</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  disabled={hasFastq}
                  onPress={() => setPaymentOnline(true)}
                  className={`flex-1 py-3 rounded-2xl border items-center ${
                    paymentOnline ? 'bg-sky-600 border-sky-600' : 'bg-white border-sky-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-extrabold ${paymentOnline ? 'text-white' : 'text-sky-800'}`}
                  >
                    Online (QR)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={hasFastq}
                  onPress={() => setPaymentOnline(false)}
                  className={`flex-1 py-3 rounded-2xl border items-center ${
                    !paymentOnline ? 'bg-sky-600 border-sky-600' : 'bg-white border-sky-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-extrabold ${!paymentOnline ? 'text-white' : 'text-sky-800'}`}
                  >
                    Tiền mặt
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleForward}
              disabled={isForwarding || !sampleService}
              className="bg-sky-600 py-4 rounded-2xl items-center mb-6"
              style={{ opacity: isForwarding || !sampleService ? 0.6 : 1 }}
            >
              {isForwarding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-extrabold">
                  {paymentOnline ? 'Tiếp tục thanh toán' : 'Xác nhận chuyển tiếp'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
