import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Switch, Text, View } from 'react-native';

import { FormInput, FormTextarea } from '@/components/form';
import type { OrderFormData } from '@/lib/schemas/order-form-schema';

export default function Step7OrderNote() {
  const { watch, setValue } = useFormContext<OrderFormData>();
  const sendEmailToPatient = watch('sendEmailToPatient') || false;
  const sendZaloToPatient = watch('sendZaloToPatient') || false;
  const patientEmail = watch('patientEmail');
  const patientPhone = watch('patientPhone');

  return (
    <View className="space-y-4">
      <View className="bg-white rounded-2xl border border-slate-100 p-4">
        <Text className="text-[15px] font-extrabold text-slate-900 mb-4">Ghi chú đơn hàng</Text>

        <FormTextarea
          name="orderNote"
          label="Ghi chú"
          placeholder="Nhập ghi chú cho đơn hàng (nếu có)"
          minHeight={120}
          maxLength={500}
        />

        <View className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <Text className="text-[11px] text-slate-500 font-medium">
            Ghi chú sẽ được hiển thị trong chi tiết đơn hàng và có thể được cập nhật sau.
          </Text>
        </View>
      </View>

      <View className="bg-white rounded-2xl border border-slate-100 p-4">
        <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
          Gửi thông báo cho bệnh nhân
        </Text>

        <View className="flex-row items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 mb-3">
          <View className="flex-1 mr-3" pointerEvents="none">
            <Text className="text-[14px] font-bold text-slate-900">
              Gửi email đơn hàng và phiếu xét nghiệm
            </Text>
            <Text className="mt-1 text-[12px] text-slate-500">
              {sendEmailToPatient
                ? patientEmail
                  ? `Hệ thống sẽ gửi thông báo đến ${patientEmail} sau khi lưu đơn (theo cấu hình máy chủ).`
                  : 'Nhập email nhận thông báo bên dưới hoặc ở bước 3.'
                : 'Không gửi email thông báo'}
            </Text>
          </View>
          <Switch
            value={sendEmailToPatient}
            onValueChange={value => {
              setValue('sendEmailToPatient', value, { shouldDirty: true, shouldValidate: true });
            }}
            trackColor={{ false: '#cbd5e1', true: '#0891b2' }}
            thumbColor="#fff"
          />
        </View>

        {sendEmailToPatient ? (
          <View className="mt-2 gap-2">
            <FormInput
              name="patientEmail"
              label="Email nhận thông báo"
              placeholder="vd: benhnhan@gmail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}

        {sendZaloToPatient && !patientPhone && (
          <View className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <Text className="text-[11px] text-amber-700 font-medium">
              Vui lòng quay lại bước 3 và nhập số điện thoại bệnh nhân để gửi Zalo.
            </Text>
          </View>
        )}

        {(sendEmailToPatient || sendZaloToPatient) && (
          <View className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
            {sendEmailToPatient ? (
              <Text className="text-[11px] text-blue-900 font-semibold leading-4">
                Khi bật gửi email, ứng dụng sẽ bật cờ thông báo trên phiếu xét nghiệm sau khi đơn được lưu
                thành công. Nội dung và thời điểm gửi do hệ thống email phía máy chủ quy định.
              </Text>
            ) : null}
            {sendZaloToPatient ? (
              <Text
                className={`text-[11px] text-blue-900 font-semibold leading-4 ${sendEmailToPatient ? 'mt-2' : ''}`}
              >
                Zalo: vui lòng đảm bảo đã nhập số điện thoại bệnh nhân ở bước 3 (tính năng gửi Zalo có thể được
                kết nối thêm).
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}
