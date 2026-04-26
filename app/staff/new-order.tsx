import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useReducer, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SelectionModal } from '@/components/modals';
import {
  OrderFormFields,
  OrderFormFooter,
  OrderFormSuccessModal,
} from '@/components/order';
import { COLORS } from '@/constants/colors';
import { useOrderData } from '@/hooks/useOrderData';
import {
  simpleOrderDefaultValues,
  simpleOrderSchema,
  type SimpleOrderFormData,
} from '@/lib/schemas/simple-order-schema';
import { CustomerResponse } from '@/services/customerService';
import {
  HospitalStaffResponse,
} from '@/services/hospitalStaffService';
import { orderService } from '@/services/orderService';
import { handleOrderError } from '@/utils/orderErrorHandler';

import { ORDER_STATUS_OPTIONS } from "@/lib/constants/order-status";
import { OrderStatus } from "@/types";

type PaymentStatus = 'COMPLETED' | 'UNPAID';
type PaymentType = 'CASH' | 'ONLINE_PAYMENT';

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'COMPLETED', label: 'Đã thanh toán' },
  { value: 'UNPAID', label: 'Chưa thanh toán' },
];

const PAYMENT_TYPE_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'ONLINE_PAYMENT', label: 'Thanh toán online' },
];

function buildSpecifyIdFromBarcode(barcode: string) {
  const clean = (barcode || '').trim();
  if (!clean) return undefined;
  return 'B' + clean.slice(0, 6);
}

type ModalState = {
  customer: boolean;
  sampleCollector: boolean;
  staffAnalyst: boolean;
  barcode: boolean;
  orderStatus: boolean;
  paymentStatus: boolean;
  paymentType: boolean;
  success: boolean;
};

type ModalKey = keyof ModalState;

type ModalAction =
  | { type: 'OPEN'; modal: Exclude<ModalKey, 'success'> }
  | { type: 'OPEN_SUCCESS' }
  | { type: 'CLOSE'; modal: ModalKey }
  | { type: 'CLOSE_ALL' };

const initialModalState: ModalState = {
  customer: false,
  sampleCollector: false,
  staffAnalyst: false,
  barcode: false,
  orderStatus: false,
  paymentStatus: false,
  paymentType: false,
  success: false,
};

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, [action.modal]: true };
    case 'OPEN_SUCCESS':
      return { ...state, success: true };
    case 'CLOSE':
      return { ...state, [action.modal]: false };
    case 'CLOSE_ALL':
      return initialModalState;
    default:
      return state;
  }
}

export default function NewOrderScreen() {
  const router = useRouter();
  const { customers, staffs, barcodeOptions, isLoading } = useOrderData();

  const [modals, dispatch] = useReducer(modalReducer, initialModalState);

  const { data: ordersResponse } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderService.getAll(),
    retry: false,
  });

  const methods = useForm<SimpleOrderFormData>({
    resolver: zodResolver(simpleOrderSchema),
    defaultValues: simpleOrderDefaultValues,
    mode: 'onTouched',
  });

  const { watch } = methods;
  const formData = watch();

  const customerOptions = useMemo(
    () =>
      customers.map((c: CustomerResponse) => ({
        value: c.customerId,
        label: c.customerName,
      })),
    [customers],
  );

  const sampleCollectorOptions = useMemo(
    () =>
      staffs.map((s: HospitalStaffResponse) => ({
        value: s.staffId,
        label: s.staffName,
      })),
    [staffs],
  );

  const staffAnalystOptions = useMemo(
    () =>
      staffs.map((s: HospitalStaffResponse) => ({
        value: s.staffId,
        label: s.staffName,
      })),
    [staffs],
  );

  const barcodeSelectionOptions = useMemo(
    () => barcodeOptions.map((b) => ({ value: b.value, label: b.label })),
    [barcodeOptions],
  );

  const getSelectedCustomerName = () => {
    const customer = customers.find(
      (c: CustomerResponse) => c.customerId === formData.customerId,
    );
    return customer?.customerName || 'Chọn khách hàng';
  };

  const getSelectedSampleCollectorName = () => {
    const staff = staffs.find(
      (s: HospitalStaffResponse) => s.staffId === formData.sampleCollectorId,
    );
    return staff?.staffName || 'Chọn nhân viên thu mẫu';
  };

  const getSelectedStaffAnalystName = () => {
    const staff = staffs.find(
      (s: HospitalStaffResponse) => s.staffId === formData.staffAnalystId,
    );
    return staff?.staffName || 'Chọn nhân viên phân tích';
  };

  const getSelectedBarcodeName = () => {
    const found = barcodeSelectionOptions.find(
      (x) => x.value === formData.barcodeId,
    );
    return found?.label || 'Chọn mã barcode';
  };


  const pendingPaymentRef = useRef<{
    paymentType: string;
    orderName: string;
    paymentAmount: number;
    specifyId?: string;
  } | null>(null);

  const createOrderMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const response = await orderService.create(data);
      if (!response.success)
        throw new Error(response.error || 'Không thể tạo đơn hàng');
      return response;
    },
    onSuccess: (response) => {
      const createdOrder = response.data;
      const pendingPayment = pendingPaymentRef.current;

      if (pendingPayment?.paymentType === 'ONLINE_PAYMENT' && createdOrder?.orderId) {
        router.push({
          pathname: '/staff/payment',
          params: {
            orderId: createdOrder.orderId,
            orderName: pendingPayment.orderName,
            amount: pendingPayment.paymentAmount.toString(),
            specifyId: pendingPayment.specifyId || '',
          },
        });
        pendingPaymentRef.current = null;
      } else {
        dispatch({ type: 'OPEN_SUCCESS' });
      }
    },
    onError: (error: unknown) => {
      pendingPaymentRef.current = null;
      handleOrderError(error);
    },
  });

  const handleSubmit = (data: SimpleOrderFormData) => {
    let selectedCustomer:
      | (CustomerResponse & { userId?: string })
      | undefined = undefined;
    if (data.customerId?.trim()) {
      selectedCustomer = customers.find(
        (c: CustomerResponse) => c.customerId === data.customerId,
      ) as CustomerResponse & { userId?: string };
      if (!selectedCustomer) {
        Alert.alert(
          'Lỗi',
          'Khách hàng được chọn không hợp lệ. Vui lòng chọn lại.',
        );
        return;
      }
      if (!selectedCustomer.userId) {
        Alert.alert(
          'Lỗi',
          `Khách hàng "${selectedCustomer.customerName}" không có userId.\n\nVui lòng chọn khách hàng khác hoặc để trống.`,
        );
        return;
      }
    }

    if (
      data.sampleCollectorId?.trim() &&
      !staffs.find((s: HospitalStaffResponse) => s.staffId === data.sampleCollectorId)
    ) {
      Alert.alert(
        'Lỗi',
        'Nhân viên thu mẫu được chọn không hợp lệ. Vui lòng chọn lại.',
      );
      return;
    }

    if (
      data.staffAnalystId?.trim() &&
      !staffs.find((s: HospitalStaffResponse) => s.staffId === data.staffAnalystId)
    ) {
      Alert.alert(
        'Lỗi',
        'Nhân viên phân tích được chọn không hợp lệ. Vui lòng chọn lại.',
      );
      return;
    }

    const selectedBarcodeOption = barcodeOptions.find(
      (x) => x.value === data.barcodeId,
    );
    if (data.barcodeId?.trim() && !selectedBarcodeOption) {
      Alert.alert(
        'Lỗi',
        'Mã barcode không hợp lệ hoặc đã được dùng. Vui lòng chọn lại.',
      );
      return;
    }

    const payload: Record<string, unknown> = {
      orderName: data.orderName.trim(),
      orderStatus: data.orderStatus,
      paymentStatus: data.paymentStatus,
      paymentType: data.paymentType,
    };
    if (selectedCustomer?.userId) {
      payload.customerId = selectedCustomer.userId.trim();
    }

    if (data.sampleCollectorId?.trim())
      payload.sampleCollectorId = data.sampleCollectorId.trim();
    if (data.staffAnalystId?.trim())
      payload.staffAnalystId = data.staffAnalystId.trim();

    if (data.barcodeId?.trim()) {
      payload.barcodeId = data.barcodeId.trim();
      const specifyId = buildSpecifyIdFromBarcode(data.barcodeId.trim());
      if (specifyId) payload.specifyId = specifyId;
    }

    if (data.paymentAmount?.trim()) {
      const amount = Number(data.paymentAmount);
      if (!Number.isNaN(amount) && amount > 0) payload.paymentAmount = amount;
    }

    if (data.orderNote?.trim()) payload.orderNote = data.orderNote.trim();

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, value]) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        return true;
      }),
    );


    const paymentAmount = data.paymentAmount?.trim()
      ? Number(data.paymentAmount)
      : 0;
    const specifyId = data.barcodeId?.trim()
      ? buildSpecifyIdFromBarcode(data.barcodeId.trim())
      : undefined;

    pendingPaymentRef.current = {
      paymentType: data.paymentType,
      orderName: data.orderName.trim(),
      paymentAmount: paymentAmount,
      specifyId: specifyId,
    };

    createOrderMutation.mutate(cleanPayload);
  };

  const closeModal = (modal: keyof ModalState) => {
    dispatch({ type: 'CLOSE', modal });
  };

  const openModal = (modal: keyof Omit<ModalState, 'success'>) => {
    dispatch({ type: 'OPEN', modal });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <FormProvider {...methods}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <OrderFormFields
              showCustomerModal={modals.customer}
              setShowCustomerModal={() => openModal('customer')}
              customerOptions={customerOptions}
              getSelectedCustomerName={getSelectedCustomerName}
              showSampleCollectorModal={modals.sampleCollector}
              setShowSampleCollectorModal={() => openModal('sampleCollector')}
              sampleCollectorOptions={sampleCollectorOptions}
              getSelectedSampleCollectorName={getSelectedSampleCollectorName}
              showStaffAnalystModal={modals.staffAnalyst}
              setShowStaffAnalystModal={() => openModal('staffAnalyst')}
              staffAnalystOptions={staffAnalystOptions}
              getSelectedStaffAnalystName={getSelectedStaffAnalystName}
              showBarcodeModal={modals.barcode}
              setShowBarcodeModal={() => openModal('barcode')}
              barcodeOptions={barcodeSelectionOptions}
              getSelectedBarcodeName={getSelectedBarcodeName}
              showOrderStatusModal={modals.orderStatus}
              setShowOrderStatusModal={() => openModal('orderStatus')}
              orderStatusOptions={ORDER_STATUS_OPTIONS}
              showPaymentStatusModal={modals.paymentStatus}
              setShowPaymentStatusModal={() => openModal('paymentStatus')}
              paymentStatusOptions={PAYMENT_STATUS_OPTIONS}
              showPaymentTypeModal={modals.paymentType}
              setShowPaymentTypeModal={() => openModal('paymentType')}
              paymentTypeOptions={PAYMENT_TYPE_OPTIONS}
            />
          </View>
        </ScrollView>

        <OrderFormFooter
          onCancel={() => router.back()}
          onSubmit={methods.handleSubmit(handleSubmit)}
          isPending={createOrderMutation.isPending}
        />

        <OrderFormSuccessModal
          visible={modals.success}
          onClose={() => {
            closeModal('success');
            router.back();
          }}
          onViewOrders={() => {
            closeModal('success');
            router.push('/staff/orders');
          }}
        />

        <SelectionModal
          visible={modals.customer}
          title="Chọn khách hàng"
          options={customerOptions}
          selectedValue={formData.customerId}
          onSelect={(value) => methods.setValue('customerId', value)}
          onClose={() => closeModal('customer')}
        />

        <SelectionModal
          visible={modals.sampleCollector}
          title="Chọn nhân viên thu mẫu"
          options={sampleCollectorOptions}
          selectedValue={formData.sampleCollectorId}
          onSelect={(value) => methods.setValue('sampleCollectorId', value)}
          onClose={() => closeModal('sampleCollector')}
        />

        <SelectionModal
          visible={modals.staffAnalyst}
          title="Chọn nhân viên phân tích"
          options={staffAnalystOptions}
          selectedValue={formData.staffAnalystId}
          onSelect={(value) => methods.setValue('staffAnalystId', value)}
          onClose={() => closeModal('staffAnalyst')}
        />

        <SelectionModal
          visible={modals.barcode}
          title={`Chọn mã barcode${barcodeSelectionOptions.length > 0
            ? ` (${barcodeSelectionOptions.length} mã có sẵn)`
            : ''
            }`}
          options={barcodeSelectionOptions}
          selectedValue={formData.barcodeId}
          onSelect={(value) => methods.setValue('barcodeId', value)}
          onClose={() => closeModal('barcode')}
        />

        <SelectionModal
          visible={modals.orderStatus}
          title="Chọn trạng thái đơn hàng"
          options={ORDER_STATUS_OPTIONS}
          selectedValue={formData.orderStatus}
          onSelect={(value) => methods.setValue('orderStatus', value as OrderStatus)}
          onClose={() => closeModal('orderStatus')}
        />

        <SelectionModal
          visible={modals.paymentStatus}
          title="Chọn trạng thái thanh toán"
          options={PAYMENT_STATUS_OPTIONS}
          selectedValue={formData.paymentStatus}
          onSelect={(value) =>
            methods.setValue('paymentStatus', value as PaymentStatus)
          }
          onClose={() => closeModal('paymentStatus')}
        />

        <SelectionModal
          visible={modals.paymentType}
          title="Chọn loại thanh toán"
          options={PAYMENT_TYPE_OPTIONS}
          selectedValue={formData.paymentType}
          onSelect={(value) =>
            methods.setValue('paymentType', value as PaymentType)
          }
          onClose={() => closeModal('paymentType')}
        />
      </SafeAreaView>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.sub,
  },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  form: { gap: 16 },
});
