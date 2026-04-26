import React from 'react';
import { useFormContext } from 'react-hook-form';
import { View, Text } from 'react-native';

import { FormInput, FormFieldGroup, FormReadOnly } from '@/components/form';

interface Step4Props {
  isEditMode?: boolean;
}

export default function Step4ClinicalInfo({ isEditMode = false }: Step4Props) {
  const { watch } = useFormContext();

  const readOnly = isEditMode;

  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">Thông tin lâm sàng</Text>

      <FormFieldGroup>
        <FormInput
          name="patientHeight"
          label="Chiều cao (cm)"
          placeholder="Nhập chiều cao"
          keyboardType="numeric"
          editable={!readOnly}
        />
        <FormInput
          name="patientWeight"
          label="Cân nặng (kg)"
          placeholder="Nhập cân nặng"
          keyboardType="numeric"
          editable={!readOnly}
        />
      </FormFieldGroup>

      <FormFieldGroup>
        <FormInput
          name="patientHistory"
          label="Tiền sử bệnh nhân"
          placeholder="Nhập tiền sử bệnh nhân"
          editable={!readOnly}
        />
        <FormInput
          name="familyHistory"
          label="Tiền sử gia đình"
          placeholder="Nhập tiền sử gia đình"
          editable={!readOnly}
        />
      </FormFieldGroup>

      <FormFieldGroup>
        <FormInput
          name="toxicExposure"
          label="Tiếp xúc độc hại"
          placeholder="Nhập thông tin"
          editable={!readOnly}
        />
        <FormInput
          name="medicalHistory"
          label="Tiền sử bệnh"
          placeholder="Nhập tiền sử bệnh"
          editable={!readOnly}
        />
      </FormFieldGroup>

      <FormFieldGroup>
        <FormInput
          name="chronicDisease"
          label="Bệnh lý mãn tính"
          placeholder="Nhập bệnh lý mãn tính"
          editable={!readOnly}
        />
        <FormInput
          name="acuteDisease"
          label="Bệnh lý cấp tính"
          placeholder="Nhập bệnh lý cấp tính"
          editable={!readOnly}
        />
      </FormFieldGroup>

      <FormReadOnly
        label="Thuốc đang dùng"
        value={watch('medicalUsing')}
        placeholder="Chưa có thông tin"
      />

      <View className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
        <Text className="text-[11px] text-blue-700 font-medium">
          Thông tin lâm sàng: Vui lòng nhập đầy đủ các thông tin bệnh sử và tình trạng sức khỏe hiện
          tại của bệnh nhân để hỗ trợ quá trình xét nghiệm.
        </Text>
      </View>
    </View>
  );
}
