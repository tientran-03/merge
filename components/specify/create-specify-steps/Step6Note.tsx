import React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { View, Text, TouchableOpacity, Switch } from "react-native";

import { FormTextarea } from "@/components/form";
import type { SpecifyFormData } from "@/lib/schemas/specify-form-schema";

export default function Step6Note() {
  const { control } = useFormContext<SpecifyFormData>();

  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Ghi chú
      </Text>

      <FormTextarea
        name="specifyNote"
        label="Ghi chú phiếu xét nghiệm"
        placeholder="Nhập ghi chú (nếu có)"
      />

      <View className="mt-4">
        <Controller
          control={control}
          name="sendEmailPatient"
          render={({ field: { onChange, value } }) => (
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-[13px] font-extrabold text-slate-700">
                Gửi email cho bệnh nhân
              </Text>
              <Switch
                value={value ?? false}
                onValueChange={onChange}
                trackColor={{ false: "#E2E8F0", true: "#0284C7" }}
                thumbColor="#fff"
              />
            </View>
          )}
        />
      </View>
    </View>
  );
}
