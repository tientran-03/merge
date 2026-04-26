import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SelectionModal } from '@/components/modals';
import { COLORS } from '@/constants/colors';
import { SuccessModal } from '@/components/modals';
import { getApiResponseData } from '@/lib/types/api-types';
import { type OrderResponse, orderService } from '@/services/orderService';
import { sampleAddService } from '@/services/sampleAddService';
import {
  sampleAddServiceCatalogService,
  type SampleAddServiceCatalogResponse,
} from '@/services/sampleAddServiceCatalogService';

export default function NewSampleAddScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedPaymentType, setSelectedPaymentType] = useState<'CASH' | 'ONLINE_PAYMENT' | ''>('');
  const [note, setNote] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);

  const { data: ordersResponse } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderService.getAll(),
  });

  const { data: sampleServicesResponse } = useQuery({
    queryKey: ['sample-add-services-catalog'],
    queryFn: () => sampleAddServiceCatalogService.getAll(),
  });

  const allOrders: OrderResponse[] = getApiResponseData<OrderResponse>(ordersResponse) || [];
  const orders: OrderResponse[] = allOrders.filter((o: any) => {
    const hid =
      o?.specifyId?.hospitalId ??
      o?.specifyId?.hospital?.hospitalId ??
      o?.specify?.hospitalId ??
      o?.specify?.hospital?.hospitalId;
    return String(hid ?? '').trim() === '1';
  });
  const sampleServices: SampleAddServiceCatalogResponse[] =
    getApiResponseData<SampleAddServiceCatalogResponse>(sampleServicesResponse) || [];

  const selectedOrder = orders.find(o => String(o.orderId) === selectedOrderId);
  const selectedService = sampleServices.find(s => String(s.id) === selectedServiceId);
  const formatCurrency = (amount?: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
      Number(amount || 0)
    );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId || !selectedServiceId || !selectedPaymentType) {
        throw new Error('Vui lòng chọn đơn hàng, dịch vụ mẫu bổ sung và hình thức thanh toán.');
      }

      if (!selectedOrder) {
        throw new Error('Không tìm thấy đơn hàng đã chọn.');
      }
      if (!selectedService) {
        throw new Error('Không tìm thấy dịch vụ mẫu bổ sung đã chọn.');
      }

      const request: any = {
        sampleName: selectedService.sampleName,
        orderId: selectedOrder.orderId,
        specifyId: (selectedOrder.specifyId as any)?.specifyVoteID || undefined,
        patientId:
          (selectedOrder.specifyId as any)?.patient?.patientId ||
          (selectedOrder.specifyId as any)?.patientId ||
          undefined,
        note: note.trim() || undefined,
      };

      const createRes = await sampleAddService.create(request);
      if (!createRes.success || !createRes.data) {
        throw new Error(createRes.error || createRes.message || 'Không thể tạo mẫu xét nghiệm bổ sung.');
      }

      const id = String(createRes.data.sampleAddId || createRes.data.id || '').trim();
      if (!id) {
        throw new Error('Không nhận được mã mẫu bổ sung sau khi tạo.');
      }

      await sampleAddService.updateStatus(id, 'accepted').catch(() => undefined);
      await sampleAddService.updatePaymentType(id, selectedPaymentType).catch(() => undefined);
      await sampleAddService.updatePaymentStatus(id, 'PENDING').catch(() => undefined);

      return createRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample-adds'] });
      setShowSuccessModal(true);
    },
    onError: (error: any) => {
      Alert.alert('Lỗi', error?.message || 'Không thể tạo mẫu xét nghiệm bổ sung.');
    },
  });

  const handleSubmit = () => {
    if (createMutation.isPending) return;
    createMutation.mutate();
  };

  const paymentTypeOptions = [
    { value: 'CASH', label: 'Tiền mặt' },
    { value: 'ONLINE_PAYMENT', label: 'Thanh toán online' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">Tạo mẫu xét nghiệm bổ sung</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4 rounded-2xl bg-white border border-slate-200 p-4">
          <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
            Thông tin mẫu xét nghiệm
          </Text>

          <View className="mb-4">
            <Text className="text-[13px] font-semibold text-slate-700 mb-2">
              Đơn hàng <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 flex-row items-center justify-between"
              onPress={() => setShowOrderModal(true)}
              activeOpacity={0.8}
            >
              <Text className={`text-[14px] font-semibold ${selectedOrder ? 'text-slate-900' : 'text-slate-400'}`}>
                {selectedOrder ? `${selectedOrder.orderId} - ${selectedOrder.orderName}` : 'Chọn đơn hàng'}
              </Text>
              <Text className="text-slate-400 text-lg">›</Text>
            </TouchableOpacity>
            {selectedOrder ? (
              <View className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <Text className="text-[12px] text-slate-500">
                  Bệnh nhân: {(selectedOrder as any)?.specifyId?.patient?.patientName || '-'}
                </Text>
                <Text className="text-[12px] text-slate-500 mt-1">
                  Tên đơn: {selectedOrder.orderName || '-'}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mb-4">
            <Text className="text-[13px] font-semibold text-slate-700 mb-2">
              Dịch vụ mẫu bổ sung <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 flex-row items-center justify-between"
              onPress={() => setShowServiceModal(true)}
              activeOpacity={0.8}
            >
              <Text className={`text-[14px] font-semibold ${selectedService ? 'text-slate-900' : 'text-slate-400'}`}>
                {selectedService ? selectedService.sampleName : 'Chọn dịch vụ'}
              </Text>
              <Text className="text-slate-400 text-lg">›</Text>
            </TouchableOpacity>
            {selectedService ? (
              <View className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
                <View className="flex-row justify-between">
                  <Text className="text-[12px] text-slate-600">Giá gốc</Text>
                  <Text className="text-[12px] font-semibold text-slate-900">
                    {formatCurrency(selectedService.price)}
                  </Text>
                </View>
                <View className="mt-1 flex-row justify-between">
                  <Text className="text-[12px] text-slate-600">Thuế ({selectedService.taxRate}%)</Text>
                  <Text className="text-[12px] font-semibold text-slate-900">
                    {formatCurrency((selectedService.price * selectedService.taxRate) / 100)}
                  </Text>
                </View>
                <View className="mt-2 border-t border-sky-200 pt-2 flex-row justify-between">
                  <Text className="text-[12px] font-bold text-slate-700">Tổng tiền</Text>
                  <Text className="text-[12px] font-extrabold text-sky-700">
                    {formatCurrency(selectedService.finalPrice ?? selectedService.price)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <View className="mb-4">
            <Text className="text-[13px] font-semibold text-slate-700 mb-2">
              Hình thức thanh toán <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 flex-row items-center justify-between"
              onPress={() => setShowPaymentTypeModal(true)}
              activeOpacity={0.8}
            >
              <Text className={`text-[14px] font-semibold ${selectedPaymentType ? 'text-slate-900' : 'text-slate-400'}`}>
                {paymentTypeOptions.find(x => x.value === selectedPaymentType)?.label || 'Chọn hình thức thanh toán'}
              </Text>
              <Text className="text-slate-400 text-lg">›</Text>
            </TouchableOpacity>
            <Text className="mt-2 text-[11px] text-slate-500">
              {selectedPaymentType === 'ONLINE_PAYMENT'
                ? 'Sau khi tạo: thanh toán online (trạng thái thanh toán: Chờ thanh toán).'
                : selectedPaymentType === 'CASH'
                  ? 'Sau khi tạo: thanh toán tiền mặt (trạng thái thanh toán: Chờ thanh toán, xác nhận sau).'
                  : 'Chọn hình thức thanh toán phù hợp.'}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-[13px] font-semibold text-slate-700 mb-2">Ghi chú</Text>
            <TextInput
              className="min-h-[100px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 font-semibold"
              placeholder="Nhập ghi chú (nếu có)"
              placeholderTextColor="#94A3B8"
              value={note}
              onChangeText={setNote}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={createMutation.isPending || !selectedOrderId || !selectedServiceId || !selectedPaymentType}
          className={`rounded-2xl py-4 px-6 items-center ${
            createMutation.isPending || !selectedOrderId || !selectedServiceId || !selectedPaymentType
              ? 'bg-slate-300'
              : 'bg-sky-600'
          }`}
          activeOpacity={0.8}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-white font-bold text-[15px]">Tạo mẫu xét nghiệm</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <SuccessModal
        visible={showSuccessModal}
        title="Tạo thành công"
        message="Mẫu xét nghiệm bổ sung đã được tạo thành công."
        onClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}
      />

      <SelectionModal
        visible={showOrderModal}
        title="Chọn đơn hàng"
        options={orders.map(o => ({
          value: String(o.orderId),
          label: `${o.orderId} - ${o.orderName || ''}`,
        }))}
        selectedValue={selectedOrderId}
        onSelect={value => setSelectedOrderId(String(value))}
        onClose={() => setShowOrderModal(false)}
      />

      <SelectionModal
        visible={showServiceModal}
        title="Chọn dịch vụ mẫu bổ sung"
        options={sampleServices.map(s => ({
          value: String(s.id),
          label: `${s.sampleName} (${(s.finalPrice ?? s.price ?? 0).toLocaleString('vi-VN')}đ)`,
        }))}
        selectedValue={selectedServiceId}
        onSelect={value => setSelectedServiceId(String(value))}
        onClose={() => setShowServiceModal(false)}
      />

      <SelectionModal
        visible={showPaymentTypeModal}
        title="Chọn hình thức thanh toán"
        options={paymentTypeOptions}
        selectedValue={selectedPaymentType}
        onSelect={value => setSelectedPaymentType(String(value) as 'CASH' | 'ONLINE_PAYMENT')}
        onClose={() => setShowPaymentTypeModal(false)}
      />
    </SafeAreaView>
  );
}
