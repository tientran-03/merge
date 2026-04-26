import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { ActivityIndicator, Alert, Image, Switch, Text, TouchableOpacity, View } from 'react-native';

import { FormFieldGroup, FormInput, FormReadOnly, FormSelect } from '@/components/form';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { PaymentType, getStaffPositionDisplayName } from '@/lib/schemas/order-form-schema';
import type { BarcodeResponse } from '@/services/barcodeService';
import type { DoctorResponse } from '@/services/doctorService';
import type { HospitalStaffResponse } from '@/services/hospitalStaffService';
import { uploadImageToCloudinary } from '@/utils/cloudinary';

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

const paymentStatusOptions = [
  { value: 'UNPAID', label: 'Chưa thanh toán' },
  { value: 'COMPLETED', label: 'Đã thanh toán' },
] as const;

export default function Step1BasicOrderInfo({
  doctors,
  staffList,
  staffAnalystList,
  sampleCollectorList,
  barcodes,
  hospitalName,
  isEditMode = false,
}: Step1Props) {
  const { control, setValue } = useFormContext();
  const paymentStatus = useWatch({ control, name: 'paymentStatus' });
  const customerFastq = useWatch({ control, name: 'customerFastq' });
  const paymentAmount = useWatch({ control, name: 'paymentAmount' });
  const invoiceLink = useWatch({ control, name: 'invoiceLink' });
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const prevPaymentStatus = useRef<string | undefined>(undefined);
  const paymentTypeOptionsForSelect = useMemo(() => {
    if (Boolean(customerFastq)) {
      return paymentTypeOptions.filter(o => o.value === PaymentType.ONLINE_PAYMENT);
    }
    return paymentTypeOptions;
  }, [customerFastq]);
  const paymentAmountDisplay = useMemo(() => {
    const raw = String(paymentAmount ?? '').trim();
    if (!raw) return '';
    const amount = Number(raw);
    if (Number.isNaN(amount)) return raw;
    return `${amount.toLocaleString('vi-VN')} đ`;
  }, [paymentAmount]);

  useEffect(() => {
    const prev = prevPaymentStatus.current;
    prevPaymentStatus.current = paymentStatus;
    if (prev === 'COMPLETED' && paymentStatus === 'UNPAID') {
      setValue('invoiceLink', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [paymentStatus, setValue]);

  useEffect(() => {
    if (Boolean(customerFastq)) {
      setValue('paymentType', PaymentType.ONLINE_PAYMENT, { shouldDirty: true, shouldValidate: true });
    }
  }, [customerFastq, setValue]);

  const handlePickInvoice = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần quyền', 'Vui lòng cho phép truy cập ảnh để tải hóa đơn thanh toán.');
        return;
      }
      setUploadingInvoice(true);
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (pick.canceled || !pick.assets?.[0]?.uri) {
        setUploadingInvoice(false);
        return;
      }
      const res = await uploadImageToCloudinary(pick.assets[0].uri, { folder: 'invoices' });
      const url = res.secureUrl || res.url;
      if (!url) throw new Error('Không nhận được link sau khi upload');
      setValue('invoiceLink', url, { shouldDirty: true, shouldValidate: true });
      presentFeedbackSuccess({
        title: 'Đã tải hóa đơn',
        message: 'Ảnh hóa đơn đã được lưu trên Cloudinary.',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload thất bại';
      presentFeedbackError({ title: 'Không tải được hóa đơn', message: msg });
    } finally {
      setUploadingInvoice(false);
    }
  };

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
      </FormFieldGroup>

      <FormFieldGroup>
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
        <FormSelect
          name="staffAnalystId"
          label="Nhân viên phụ trách"
          options={staffAnalystList}
          getLabel={s => `${s.name} - ${getStaffPositionDisplayName(s.position)}`}
          getValue={s => s.id}
          placeholder="Lựa chọn"
          modalTitle="Chọn nhân viên phụ trách"
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
        disabled={isEditMode}
      />
      <FormSelect
        name="paymentType"
        label="Hình thức thanh toán"
        required
        options={paymentTypeOptionsForSelect}
        getLabel={o => o.label}
        getValue={o => o.value}
        placeholder="Lựa chọn"
        modalTitle="Chọn hình thức thanh toán"
        disabled={Boolean(customerFastq)}
      />
      <View className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 flex-row items-center justify-between">
        <View className="pr-4 flex-1">
          <Text className="text-[13px] font-extrabold text-slate-800">Có FASTQ</Text>
        </View>
        <Switch
          value={Boolean(customerFastq)}
          onValueChange={v => setValue('customerFastq', v, { shouldDirty: true, shouldValidate: true })}
        />
      </View>

      <FormSelect
        name="paymentStatus"
        label="Trạng thái thanh toán"
        options={paymentStatusOptions}
        getLabel={o => o.label}
        getValue={o => o.value}
        placeholder="Chọn trạng thái"
        modalTitle="Trạng thái thanh toán"
      />
      {isEditMode &&
        String(paymentStatus || '').toUpperCase() === 'COMPLETED' &&
        String(paymentAmountDisplay || '').trim() ? (
        <FormReadOnly label="Số tiền đã thu" value={paymentAmountDisplay} />
      ) : null}
      {String(paymentStatus || '').toUpperCase() === 'COMPLETED' ? (
        <View className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 gap-2">
          <Text className="text-[12px] font-bold text-amber-950">
            Hóa đơn thanh toán (bắt buộc khi đã thanh toán)
          </Text>
          <TouchableOpacity
            onPress={() => void handlePickInvoice()}
            disabled={uploadingInvoice}
            activeOpacity={0.85}
            className="rounded-xl bg-white border border-amber-200 px-3 py-3 flex-row items-center justify-center gap-2"
          >
            {uploadingInvoice ? (
              <ActivityIndicator color="#b45309" />
            ) : null}
            <Text className="text-[13px] font-extrabold text-amber-900">
              {uploadingInvoice ? 'Đang tải lên Cloudinary…' : 'Chọn ảnh hóa đơn'}
            </Text>
          </TouchableOpacity>
          {invoiceLink && /^https?:\/\//i.test(String(invoiceLink)) ? (
            <View className="gap-2">
              <Text className="text-[11px] font-semibold text-emerald-800">Đã có link hóa đơn hợp lệ</Text>
              <Image
                source={{ uri: String(invoiceLink) }}
                className="w-full h-40 rounded-lg bg-slate-100"
                resizeMode="contain"
              />
            </View>
          ) : (
            <Text className="text-[11px] font-semibold text-amber-900/90">
              Chưa có ảnh hóa đơn. Vui lòng chọn ảnh để hệ thống upload lên Cloudinary trước khi lưu đơn.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
