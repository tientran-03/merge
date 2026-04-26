import React from "react";
import { View, Text } from "react-native";

import { FormFieldGroup, FormInput, FormTextarea } from "@/components/form";

export default function Step2Clinical() {
  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Thông tin lâm sàng
      </Text>

      <FormFieldGroup>
        <FormInput
          name="patientHeight"
          label="Chiều cao (cm)"
          placeholder="Nhập chiều cao"
          keyboardType="numeric"
          validateOnChange
        />
        <FormInput
          name="patientWeight"
          label="Cân nặng (kg)"
          placeholder="Nhập cân nặng"
          keyboardType="numeric"
          validateOnChange
        />
      </FormFieldGroup>

      <FormFieldGroup>
        <FormTextarea
          name="patientHistory"
          label="Tiền sử bệnh nhân"
          placeholder="Mô tả tiền sử bệnh nhân"
          minHeight={72}
        />
        <FormTextarea
          name="familyHistory"
          label="Tiền sử gia đình"
          placeholder="Mô tả tiền sử gia đình"
          minHeight={72}
        />
      </FormFieldGroup>

      <FormTextarea
        name="medicalHistory"
        label="Tiền sử bệnh"
        placeholder="Mô tả tiền sử bệnh"
        minHeight={72}
      />

      <FormFieldGroup>
        <FormTextarea
          name="acuteDisease"
          label="Bệnh lý cấp tính"
          placeholder="Mô tả bệnh lý cấp tính"
          minHeight={72}
        />
        <FormTextarea
          name="chronicDisease"
          label="Bệnh lý mãn tính"
          placeholder="Mô tả bệnh lý mãn tính"
          minHeight={72}
        />
      </FormFieldGroup>

      <FormTextarea
        name="medicalUsing"
        label="Thuốc đang dùng"
        placeholder="Liệt kê thuốc (phân cách bằng dấu phẩy)"
        helperText="Phân cách các thuốc bằng dấu phẩy"
        minHeight={72}
      />

      <FormTextarea
        name="toxicExposure"
        label="Tiếp xúc độc hại"
        placeholder="Mô tả tiếp xúc độc hại"
        minHeight={72}
      />
    </View>
  );
}
