import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Barcode, Coins, FilePlus, Users } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Step2SpecifyImage } from '@/components/order/create-order-steps';
import { FormInfoBox, FormInput, FormNumericInput } from '@/components/form';
import { SelectionModal } from '@/components/modals';
import { useAuth } from '@/contexts/AuthContext';
import {
  cashierStaffOptionsForOrder,
  isCashierAllowed,
  isSampleCollectorAllowed,
  isStaffAnalystAllowed,
  sampleCollectorOptionsForOrder,
  staffAnalystOptionsForOrder,
} from '@/lib/hospitalStaffOrderOptions';
import { BarcodeStatus } from '@/lib/schemas/order-form-schema';
import {
  PAYMENT_TYPE_OPTIONS,
  quickOrderDefaultValues,
  quickOrderSchema,
  type QuickOrderFormData,
} from '@/lib/schemas/order-schemas';
import { barcodeService, type BarcodeResponse } from '@/services/barcodeService';
import { hospitalStaffService, type HospitalStaffResponse } from '@/services/hospitalStaffService';
import { orderService } from '@/services/orderService';
import { uploadImageToCloudinary } from '@/utils/cloudinary';

export default function QuickOrderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const methods = useForm<QuickOrderFormData>({
    resolver: zodResolver(quickOrderSchema),
    mode: 'onTouched',
    defaultValues: quickOrderDefaultValues,
  });

  const [showStaffAnalystModal, setShowStaffAnalystModal] = useState(false);
  const [showSampleCollectorModal, setShowSampleCollectorModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const pendingPaymentRef = useRef<{
    paymentType: string;
    orderName: string;
    paymentAmount: number;
    paymentCompleted: boolean;
  } | null>(null);

  const { data: staffsResponse } = useQuery({
    queryKey: ['hospitalStaffs'],
    queryFn: () => hospitalStaffService.getAll(),
    retry: false,
  });

  const { data: barcodesResponse } = useQuery({
    queryKey: ['barcodes', BarcodeStatus.CREATED],
    queryFn: () => barcodeService.getByStatus(BarcodeStatus.CREATED),
    retry: false,
  });
  const { data: ordersResponse } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderService.getAll(),
    retry: false,
  });

  const staffs = (staffsResponse as any)?.success
    ? ((staffsResponse as any).data as HospitalStaffResponse[]) || []
    : [];

  const barcodes = (barcodesResponse as any)?.success
    ? ((barcodesResponse as any).data as BarcodeResponse[]) || []
    : [];
  const orders = (ordersResponse as any)?.success
    ? ((ordersResponse as any).data as { orderId?: string; barcodeId?: string }[]) || []
    : [];

  const staffIdWatch = methods.watch('staffId');
  const sampleCollectorIdWatch = methods.watch('sampleCollectorId');

  const staffOptions = useMemo(
    () =>
      cashierStaffOptionsForOrder(staffs, staffIdWatch).map(s => ({
        value: s.staffId,
        label: s.staffName || s.staffId,
      })),
    [staffs, staffIdWatch]
  );

  const staffAnalystOptions = useMemo(
    () =>
      staffAnalystOptionsForOrder(staffs).map(s => ({
        value: s.staffId,
        label: s.staffName || s.staffId,
      })),
    [staffs]
  );

  const sampleCollectorOptions = useMemo(
    () =>
      sampleCollectorOptionsForOrder(staffs, sampleCollectorIdWatch).map(s => ({
        value: s.staffId,
        label: s.staffName || s.staffId,
      })),
    [staffs, sampleCollectorIdWatch]
  );

  const barcodeOptions = useMemo(
    () => {
      const usedBarcodeIds = new Set<string>();
      orders.forEach(o => {
        const bid = String(o?.barcodeId || '').trim();
        if (bid) usedBarcodeIds.add(bid);
      });
      return barcodes
        .filter(b => !usedBarcodeIds.has(String(b.barcode || '').trim()))
        .map(b => ({
        value: b.barcode,
        label: b.barcode,
        }));
    },
    [barcodes, orders]
  );

  const paymentTypeOptions = useMemo(
    () =>
      PAYMENT_TYPE_OPTIONS.map(opt => ({
        value: opt.value,
        label: opt.label,
      })),
    []
  );

  useEffect(() => {
    if (!user?.id || staffs.length === 0) return;
    const current = staffs.find(s => (s as any).userId === user.id);
    if (current?.staffId && !methods.getValues('staffId')) {
      methods.setValue('staffId', current.staffId);
    }
  }, [user?.id, staffs, methods]);

  const getSelectedStaffAnalystName = () => {
    const id = methods.watch('staffAnalystId');
    const staff = staffs.find(s => s.staffId === id);
    return staff?.staffName || 'Chọn nhân viên phụ trách';
  };

  const getSelectedSampleCollectorName = () => {
    const id = methods.watch('sampleCollectorId');
    const staff = staffs.find(s => s.staffId === id);
    return staff?.staffName || 'Chọn nhân viên thu mẫu';
  };

  const getSelectedStaffName = () => {
    const id = methods.watch('staffId');
    const staff = staffs.find(s => s.staffId === id);
    return staff?.staffName || 'Chọn nhân viên thu tiền';
  };

  const getSelectedPaymentTypeName = () => {
    const paymentType = methods.watch('paymentType');
    const option = PAYMENT_TYPE_OPTIONS.find(opt => opt.value === paymentType);
    return option?.label || 'Chọn hình thức thanh toán';
  };

  const getSelectedBarcodeLabel = () => {
    const id = methods.watch('barcodeId');
    return id?.trim() ? id : 'Chọn barcode';
  };

  const handleSlipUpload = async (uri: string) => {
    setUploadingSlip(true);
    try {
      const r = await uploadImageToCloudinary(uri, { folder: 'specify-votes' });
      return r.secureUrl || r.url || null;
    } catch (e: any) {
      Alert.alert('Lỗi tải ảnh', e?.message || 'Không tải được ảnh phiếu xét nghiệm.');
      return null;
    } finally {
      setUploadingSlip(false);
    }
  };

  const handleInvoiceUpload = async (uri: string) => {
    setUploadingInvoice(true);
    try {
      const r = await uploadImageToCloudinary(uri, { folder: 'invoices' });
      return r.secureUrl || r.url || null;
    } catch (e: any) {
      Alert.alert('Lỗi tải ảnh', e?.message || 'Không tải được ảnh hóa đơn.');
      return null;
    } finally {
      setUploadingInvoice(false);
    }
  };

  const createOrderMutation = useMutation({
    mutationFn: async (data: QuickOrderFormData) => {
      const paymentAmount =
        data.paymentAmount?.trim() && !Number.isNaN(parseFloat(data.paymentAmount))
          ? parseFloat(data.paymentAmount)
          : undefined;

      const payload: Record<string, unknown> = {
        orderName: data.orderName.trim(),
        orderStatus: data.paymentCompleted ? 'accepted' : 'initiation',
        paymentStatus: data.paymentCompleted ? 'COMPLETED' : 'UNPAID',
        paymentType: data.paymentType,
        staffId: data.staffId.trim(),
        staffAnalystId: data.staffAnalystId.trim(),
        sampleCollectorId: data.sampleCollectorId.trim(),
        barcodeId: data.barcodeId.trim(),
        specifyVoteImagePath: data.specifyVoteImagePath.trim(),
      };

      if (data.paymentCompleted && data.invoiceLink?.trim()) {
        payload.invoiceLink = data.invoiceLink.trim();
      }
      if (paymentAmount != null && paymentAmount > 0) {
        payload.paymentAmount = paymentAmount;
      }
      if (data.orderNote?.trim()) {
        payload.orderNote = data.orderNote.trim();
      }

      const response = await orderService.create(payload);
      if (!response.success) {
        const errorMsg = response.error || response.message || 'Không thể tạo đơn hàng';
        throw new Error(errorMsg);
      }
      if (data.barcodeId?.trim()) {
        await barcodeService
          .update(data.barcodeId.trim(), {
            status: BarcodeStatus.NOT_PRINTED,
          })
          .catch(() => undefined);
      }
      return response;
    },
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['barcodes'] });

      const createdOrder = response.data as { orderId?: string } | undefined;
      const pending = pendingPaymentRef.current;
      if (
        pending?.paymentType === 'ONLINE_PAYMENT' &&
        !pending.paymentCompleted &&
        createdOrder?.orderId
      ) {
        router.push({
          pathname: '/staff/payment',
          params: {
            orderId: createdOrder.orderId,
            orderName: pending.orderName,
            amount: String(pending.paymentAmount ?? 0),
            specifyId: '',
          },
        });
        pendingPaymentRef.current = null;
      } else {
        Alert.alert(
          'Thành công',
          'Đơn hàng đã được tạo thành công.\nBạn có thể xem trong danh sách đơn hàng.',
          [
            { text: 'Xem danh sách', onPress: () => router.push('/staff/orders') },
            { text: 'OK', style: 'cancel', onPress: () => router.back() },
          ]
        );
      }
    },
    onError: (error: any) => {
      pendingPaymentRef.current = null;
      let errorMessage = error?.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.';
      if (errorMessage.includes('Barcode') && errorMessage.includes('use')) {
        errorMessage = 'Barcode đã gắn đơn khác. Vui lòng chọn barcode khác.';
      }
      Alert.alert('Lỗi tạo đơn hàng', errorMessage);
    },
  });

  const handleSubmit = () => {
    methods.trigger().then(isValid => {
      if (!isValid) {
        const err = methods.formState.errors;
        const first =
          err.orderName?.message ||
          err.staffId?.message ||
          err.staffAnalystId?.message ||
          err.sampleCollectorId?.message ||
          err.barcodeId?.message ||
          err.specifyVoteImagePath?.message ||
          err.invoiceLink?.message ||
          err.paymentType?.message;
        if (first) Alert.alert('Thiếu thông tin', first);
        return;
      }

      const formData = methods.getValues();
      if (!isStaffAnalystAllowed(staffs, formData.staffAnalystId)) {
        Alert.alert(
          'Không hợp lệ',
          'Nhân viên phụ trách phải là bác sĩ thuộc HT Genetic (DOCTOR, cơ sở HTG).'
        );
        return;
      }
      if (!isSampleCollectorAllowed(staffs, formData.sampleCollectorId)) {
        Alert.alert(
          'Không hợp lệ',
          'Nhân viên thu mẫu phải là kỹ thuật viên lab (LAB_TECHNICIAN).'
        );
        return;
      }
      if (!isCashierAllowed(staffs, formData.staffId)) {
        Alert.alert(
          'Không hợp lệ',
          'Nhân viên thu tiền phải có vị trí nhân viên thu ngân (STAFF), hoặc chọn trong danh sách được phép.'
        );
        return;
      }

      const paymentAmount =
        formData.paymentAmount?.trim() && !Number.isNaN(parseFloat(formData.paymentAmount))
          ? parseFloat(formData.paymentAmount)
          : 0;

      pendingPaymentRef.current = {
        paymentType: formData.paymentType,
        orderName: formData.orderName.trim(),
        paymentAmount,
        paymentCompleted: formData.paymentCompleted,
      };

      createOrderMutation.mutate(formData);
    });
  };

  const paymentCompleted = methods.watch('paymentCompleted');

  return (
    <FormProvider {...methods}>
      <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" />

        <View className="border-b border-sky-100 bg-white px-4 pb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              className="mr-3 h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50"
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-lg font-extrabold text-slate-900">Tạo nhanh phiếu xét nghiệm</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                Chỉ các thông tin cần cho nhân viên
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        >
          <View className="rounded-2xl border border-sky-100 bg-white p-4">
            <FormInput
              name="orderName"
              label="Tên đơn hàng"
              required
              placeholder="Nhập tên đơn hàng"
              icon={<FilePlus size={18} color="#0284C7" />}
            />

            <View className="mb-4">
              <Text className="mb-2 text-sm font-bold text-slate-900">
                Nhân viên thu tiền <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="h-12 flex-row items-center rounded-2xl border border-sky-100 bg-white px-3"
                activeOpacity={0.75}
                onPress={() => setShowStaffModal(true)}
              >
                <Users size={18} color="#0284C7" />
                <Text
                  className={`ml-2 flex-1 text-[14px] font-semibold ${
                    !methods.watch('staffId') ? 'text-slate-400' : 'text-slate-900'
                  }`}
                  numberOfLines={1}
                >
                  {getSelectedStaffName()}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-bold text-slate-900">
                Nhân viên phụ trách <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="h-12 flex-row items-center rounded-2xl border border-sky-100 bg-white px-3"
                activeOpacity={0.75}
                onPress={() => setShowStaffAnalystModal(true)}
              >
                <Users size={18} color="#0284C7" />
                <Text
                  className={`ml-2 flex-1 text-[14px] font-semibold ${
                    !methods.watch('staffAnalystId') ? 'text-slate-400' : 'text-slate-900'
                  }`}
                  numberOfLines={1}
                >
                  {getSelectedStaffAnalystName()}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-bold text-slate-900">
                Nhân viên thu mẫu <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="h-12 flex-row items-center rounded-2xl border border-sky-100 bg-white px-3"
                activeOpacity={0.75}
                onPress={() => setShowSampleCollectorModal(true)}
              >
                <Users size={18} color="#0284C7" />
                <Text
                  className={`ml-2 flex-1 text-[14px] font-semibold ${
                    !methods.watch('sampleCollectorId') ? 'text-slate-400' : 'text-slate-900'
                  }`}
                  numberOfLines={1}
                >
                  {getSelectedSampleCollectorName()}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-bold text-slate-900">
                Barcode <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="h-12 flex-row items-center rounded-2xl border border-sky-100 bg-white px-3"
                activeOpacity={0.75}
                onPress={() => setShowBarcodeModal(true)}
              >
                <Barcode size={18} color="#0284C7" />
                <Text
                  className={`ml-2 flex-1 text-[14px] font-semibold ${
                    !methods.watch('barcodeId') ? 'text-slate-400' : 'text-slate-900'
                  }`}
                  numberOfLines={1}
                >
                  {getSelectedBarcodeLabel()}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-bold text-slate-900">
                Hình thức thanh toán <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="h-12 flex-row items-center rounded-2xl border border-sky-100 bg-white px-3"
                activeOpacity={0.75}
                onPress={() => setShowPaymentTypeModal(true)}
              >
                <Coins size={18} color="#0284C7" />
                <Text
                  className={`ml-2 flex-1 text-[14px] font-semibold ${
                    !methods.watch('paymentType') ? 'text-slate-400' : 'text-slate-900'
                  }`}
                  numberOfLines={1}
                >
                  {getSelectedPaymentTypeName()}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-sm font-bold text-slate-900">Đã thanh toán</Text>
                <Text className="mt-0.5 text-[11px] text-slate-500">
                  Bật nếu đã thu — cần ảnh hóa đơn
                </Text>
              </View>
              <Switch
                value={paymentCompleted}
                onValueChange={v => methods.setValue('paymentCompleted', v)}
                trackColor={{ false: '#E2E8F0', true: '#0284C7' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {paymentCompleted ? (
              <View className="mb-4">
                <FormNumericInput
                  name="paymentAmount"
                  label="Số tiền (nếu có)"
                  type="integer"
                  placeholder="Ví dụ: 5000000"
                  icon={<Coins size={18} color="#0284C7" />}
                />
              </View>
            ) : null}

            <View className="mb-4">
              <Step2SpecifyImage
                fieldName="specifyVoteImagePath"
                title="Ảnh phiếu xét nghiệm *"
                isUploading={uploadingSlip}
                onImageSelect={handleSlipUpload}
              />
            </View>

            {paymentCompleted ? (
              <View className="mb-4">
                <Step2SpecifyImage
                  fieldName="invoiceLink"
                  title="Ảnh hóa đơn *"
                  isUploading={uploadingInvoice}
                  onImageSelect={handleInvoiceUpload}
                />
              </View>
            ) : null}

            <FormInput
              name="orderNote"
              label="Ghi chú"
              placeholder="Ghi chú thêm (tùy chọn)"
              multiline
            />

            <FormInfoBox>
              {paymentCompleted ? (
                <>
                  Đơn được tạo ở trạng thái <Text className="font-bold">Đã chấp nhận</Text> khi chọn đã thanh toán.
                  Ảnh phiếu và hóa đơn được lưu qua liên kết (Cloudinary).
                </>
              ) : (
                <>
                  Đơn được tạo ở trạng thái <Text className="font-bold">Khởi tạo</Text>. Ảnh phiếu và hóa đơn
                  được lưu qua liên kết (Cloudinary).
                </>
              )}
            </FormInfoBox>
          </View>
        </ScrollView>

        <SelectionModal
          visible={showStaffAnalystModal}
          title="Chọn nhân viên phụ trách"
          options={staffAnalystOptions}
          selectedValue={methods.watch('staffAnalystId')}
          onSelect={value => methods.setValue('staffAnalystId', value)}
          onClose={() => setShowStaffAnalystModal(false)}
        />

        <SelectionModal
          visible={showSampleCollectorModal}
          title="Chọn nhân viên thu mẫu"
          options={sampleCollectorOptions}
          selectedValue={methods.watch('sampleCollectorId')}
          onSelect={value => methods.setValue('sampleCollectorId', value)}
          onClose={() => setShowSampleCollectorModal(false)}
        />

        <SelectionModal
          visible={showStaffModal}
          title="Chọn nhân viên thu tiền"
          options={staffOptions}
          selectedValue={methods.watch('staffId')}
          onSelect={value => methods.setValue('staffId', value)}
          onClose={() => setShowStaffModal(false)}
        />

        <SelectionModal
          visible={showPaymentTypeModal}
          title="Chọn hình thức thanh toán"
          options={paymentTypeOptions}
          selectedValue={methods.watch('paymentType')}
          onSelect={value => methods.setValue('paymentType', value as 'CASH' | 'ONLINE_PAYMENT')}
          onClose={() => setShowPaymentTypeModal(false)}
        />

        <SelectionModal
          visible={showBarcodeModal}
          title="Chọn barcode"
          options={barcodeOptions}
          selectedValue={methods.watch('barcodeId')}
          onSelect={value => methods.setValue('barcodeId', value)}
          onClose={() => setShowBarcodeModal(false)}
        />

        <View className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-sky-100 bg-white p-4">
          <TouchableOpacity
            className="h-12 flex-1 items-center justify-center rounded-2xl border border-sky-200 bg-white"
            onPress={() => router.back()}
            activeOpacity={0.8}
            disabled={createOrderMutation.isPending}
          >
            <Text className="text-[15px] font-extrabold text-slate-600">Huỷ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`h-12 flex-1 items-center justify-center rounded-2xl ${
              createOrderMutation.isPending ? 'bg-sky-400' : 'bg-sky-600'
            }`}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={createOrderMutation.isPending}
          >
            {createOrderMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-extrabold text-white">Tạo đơn</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </FormProvider>
  );
}
