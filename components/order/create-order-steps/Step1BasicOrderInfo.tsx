import React from 'react';
import { View, Text } from 'react-native';

import { FormInput, FormNumericInput, FormSelect, FormReadOnly, FormFieldGroup } from '@/components/form';
import { PaymentType, getStaffPositionDisplayName } from '@/lib/schemas/order-form-schema';
import type { BarcodeResponse } from '@/services/barcodeService';
import type { DoctorResponse } from '@/services/doctorService';
import type { HospitalStaffResponse } from '@/services/hospitalStaffService';

interface StaffOrDoctorOption {
  id: string;
  name: string;
  position: string;
  type: 'staff' | 'doctor';
}

interface Step1Props {
  doctors: DoctorResponse[];
  staffList: HospitalStaffResponse[];
  staffAnalystList: StaffOrDoctorOption[];
  sampleCollectorList: HospitalStaffResponse[];
  barcodes: BarcodeResponse[];
  hospitalName: string;
  isEditMode?: boolean;
}

const paymentTypeOptions = [
  { value: PaymentType.CASH, label: 'Tiền mặt' },
  { value: PaymentType.ONLINE_PAYMENT, label: 'Thanh toán online' },
];

export default function Step1BasicOrderInfo({
  doctors,
  staffList,
  staffAnalystList,
  sampleCollectorList,
  barcodes,
  hospitalName,
  isEditMode = false,
}: Step1Props) {
  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Thông tin cơ bản đơn hàng
      </Text>
      <FormInput
        name="orderName"
        label="Tên đơn hàng"
        required
        placeholder="Nhập tên đơn hàng"
        editable={!isEditMode}
      />
      <FormSelect
        name="doctorId"
        label="Bác sĩ chỉ định"
        options={doctors}
        getLabel={d => d.doctorName || d.doctorId}
        getValue={d => d.doctorId}
        placeholder="Lựa chọn bác sĩ"
        modalTitle="Chọn bác sĩ chỉ định"
        searchable
        disabled={isEditMode}
      />

      <FormReadOnly
        label="P.khám/Bệnh viện"
        value={hospitalName}
        placeholder="Vui lòng chọn bác sĩ trước"
      />

      <FormFieldGroup>
        <FormSelect
          name="staffId"
          label="Người thu tiền"
          options={staffList}
          getLabel={s => `${s.staffName} - ${getStaffPositionDisplayName(s.staffPosition)}`}
          getValue={s => s.staffId}
          placeholder="Lựa chọn"
          modalTitle="Chọn người thu tiền"
          searchable
        />

        <FormNumericInput
          name="paymentAmount"
          label="Số tiền đã thu"
          type="currency"
          placeholder="Nhập số tiền"
        />
      </FormFieldGroup>

      <FormFieldGroup>
        <FormSelect
          name="staffAnalystId"
          label="Nhân viên phụ trách"
          options={staffAnalystList}
          getLabel={s => `${s.name} - ${getStaffPositionDisplayName(s.type)}`}
          getValue={s => s.id}
          placeholder="Lựa chọn"
          modalTitle="Chọn nhân viên phụ trách"
          searchable
        />
        <FormSelect
          name="sampleCollectorId"
          label="Nhân viên thu mẫu"
          options={sampleCollectorList}
          getLabel={s => `${s.staffName} - ${getStaffPositionDisplayName(s.staffPosition)}`}
          getValue={s => s.staffId}
          placeholder="Lựa chọn"
          modalTitle="Chọn nhân viên thu mẫu"
          searchable
        />
      </FormFieldGroup>
      <FormSelect
        name="barcodeId"
        label="Mã vạch"
        options={barcodes}
        getLabel={b => b.barcode}
        getValue={b => b.barcode}
        placeholder="Lựa chọn mã vạch"
        modalTitle="Chọn mã vạch"
        searchable
      />
      <FormSelect
        name="paymentType"
        label="Hình thức thanh toán"
        required
        options={paymentTypeOptions}
        getLabel={o => o.label}
        getValue={o => o.value}
        placeholder="Lựa chọn"
        modalTitle="Chọn hình thức thanh toán"
        disabled={isEditMode}
      />
    </View>
  );
}
