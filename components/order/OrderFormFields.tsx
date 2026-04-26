import React from 'react';
import { useFormContext } from 'react-hook-form';

import {
  FormInput,
  FormNumericInput,
  FormTextarea,
  SimpleFormSelect,
} from '@/components/form';
import { SelectionOption } from '@/components/modals';
import type { SimpleOrderFormData } from '@/lib/schemas/simple-order-schema';

interface OrderFormFieldsProps {
  showCustomerModal: boolean;
  setShowCustomerModal: (show: boolean) => void;
  customerOptions: SelectionOption[];
  getSelectedCustomerName: () => string;
  showSampleCollectorModal: boolean;
  setShowSampleCollectorModal: (show: boolean) => void;
  sampleCollectorOptions: SelectionOption[];
  getSelectedSampleCollectorName: () => string;
  showStaffAnalystModal: boolean;
  setShowStaffAnalystModal: (show: boolean) => void;
  staffAnalystOptions: SelectionOption[];
  getSelectedStaffAnalystName: () => string;
  showBarcodeModal: boolean;
  setShowBarcodeModal: (show: boolean) => void;
  barcodeOptions: SelectionOption[];
  getSelectedBarcodeName: () => string;
  showOrderStatusModal: boolean;
  setShowOrderStatusModal: (show: boolean) => void;
  orderStatusOptions: SelectionOption[];
  showPaymentStatusModal: boolean;
  setShowPaymentStatusModal: (show: boolean) => void;
  paymentStatusOptions: SelectionOption[];
  showPaymentTypeModal: boolean;
  setShowPaymentTypeModal: (show: boolean) => void;
  paymentTypeOptions: SelectionOption[];
}

export function OrderFormFields({
  setShowCustomerModal,
  customerOptions,
  getSelectedCustomerName,
  setShowSampleCollectorModal,
  sampleCollectorOptions,
  getSelectedSampleCollectorName,
  setShowStaffAnalystModal,
  staffAnalystOptions,
  getSelectedStaffAnalystName,
  setShowBarcodeModal,
  barcodeOptions,
  getSelectedBarcodeName,
  setShowOrderStatusModal,
  orderStatusOptions,
  setShowPaymentStatusModal,
  paymentStatusOptions,
  setShowPaymentTypeModal,
  paymentTypeOptions,
}: OrderFormFieldsProps) {
  const { control } = useFormContext<SimpleOrderFormData>();

  return (
    <>
      <FormInput
        name="orderName"
        label="Tên đơn hàng"
        required
        placeholder="Nhập tên đơn hàng"
      />

      <SimpleFormSelect
        name="customerId"
        label="Khách hàng"
        control={control}
        options={customerOptions}
        displayValue={getSelectedCustomerName()}
        onPress={() => setShowCustomerModal(true)}
      />

      <SimpleFormSelect
        name="sampleCollectorId"
        label="Nhân viên thu mẫu"
        control={control}
        options={sampleCollectorOptions}
        displayValue={getSelectedSampleCollectorName()}
        onPress={() => setShowSampleCollectorModal(true)}
      />

      <SimpleFormSelect
        name="staffAnalystId"
        label="Nhân viên phân tích"
        control={control}
        options={staffAnalystOptions}
        displayValue={getSelectedStaffAnalystName()}
        onPress={() => setShowStaffAnalystModal(true)}
      />

      <SimpleFormSelect
        name="barcodeId"
        label="Mã Barcode"
        control={control}
        options={barcodeOptions}
        displayValue={getSelectedBarcodeName()}
        onPress={() => setShowBarcodeModal(true)}
      />

      <SimpleFormSelect
        name="orderStatus"
        label="Trạng thái đơn hàng"
        required
        control={control}
        options={orderStatusOptions}
        onPress={() => setShowOrderStatusModal(true)}
      />

      <SimpleFormSelect
        name="paymentStatus"
        label="Trạng thái thanh toán"
        required
        control={control}
        options={paymentStatusOptions}
        onPress={() => setShowPaymentStatusModal(true)}
      />

      <SimpleFormSelect
        name="paymentType"
        label="Loại thanh toán"
        required
        control={control}
        options={paymentTypeOptions}
        onPress={() => setShowPaymentTypeModal(true)}
      />

      <FormNumericInput
        name="paymentAmount"
        label="Số tiền thanh toán (VNĐ)"
        type="integer"
        placeholder="Nhập số tiền"
      />

      <FormTextarea
        name="orderNote"
        label="Ghi chú"
        placeholder="Nhập ghi chú (nếu có)"
      />
    </>
  );
}

