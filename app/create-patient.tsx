import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Alert, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FormDatePicker, FormInput, FormSelect, FormTextarea } from "@/components/form";
import { GENDER_OPTIONS, patientDefaultValues, patientSchema } from "@/lib/schemas/patient-schemas";
import { patientService } from "@/services/patientService";

export default function CreatePatientScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const methods = useForm({
    resolver: zodResolver(patientSchema),
    mode: "onTouched",
    defaultValues: patientDefaultValues,
  });

  const createPatientMutation = useMutation({
    mutationFn: async (data: any) => {
      // Format date if provided
      const submitData = {
        ...data,
        patientDob: data.patientDob ? new Date(data.patientDob).toISOString() : null,
        gender: data.gender || null,
        patientEmail: data.patientEmail?.trim() || null,
        patientJob: data.patientJob?.trim() || null,
        patientContactName: data.patientContactName?.trim() || null,
        patientContactPhone: data.patientContactPhone?.trim() || null,
        patientAddress: data.patientAddress?.trim() || null,
      };
      const response = await patientService.create(submitData);
      if (!response.success) {
        throw new Error(response.message || "Không thể tạo bệnh nhân");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      Alert.alert("Thành công", "Bệnh nhân đã được tạo thành công", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Lỗi tạo bệnh nhân", error?.message || "Không thể tạo bệnh nhân. Vui lòng thử lại.");
    },
  });

  const handleSubmit = async () => {
    const isValid = await methods.trigger();
    if (!isValid) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    const formData = methods.getValues();
    createPatientMutation.mutate(formData);
  };

  return (
    <FormProvider {...methods}>
      <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <StatusBar barStyle="dark-content" />

        <View className="pb-3 px-4 bg-white border-b border-sky-100">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-slate-900 text-lg font-extrabold">Tạo mới bệnh nhân</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Nhập thông tin bệnh nhân</Text>
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-white rounded-2xl border border-sky-100 p-4">
            <FormInput
              name="patientId"
              label="Mã bệnh nhân"
              required
              placeholder="Nhập mã bệnh nhân"
            />

            <FormInput
              name="patientName"
              label="Tên bệnh nhân"
              required
              placeholder="Nhập tên bệnh nhân"
            />

            <FormInput
              name="patientPhone"
              label="Số điện thoại"
              required
              placeholder="Nhập số điện thoại (10-11 chữ số)"
              keyboardType="phone-pad"
            />

            <FormInput
              name="patientEmail"
              label="Email"
              placeholder="Nhập email (tùy chọn)"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormDatePicker
              name="patientDob"
              label="Ngày sinh"
              placeholder="Chọn ngày sinh"
              maximumDate={new Date()}
              helperText="Bấm để chọn ngày trên lịch (không bắt buộc)"
            />

            <FormSelect
              name="gender"
              label="Giới tính"
              options={GENDER_OPTIONS}
              getLabel={(o) => o.label}
              getValue={(o) => o.value}
              placeholder="Chọn giới tính"
              modalTitle="Chọn giới tính"
            />

            <FormInput
              name="patientJob"
              label="Nghề nghiệp"
              placeholder="Nhập nghề nghiệp (tùy chọn)"
            />

            <FormInput
              name="patientContactName"
              label="Tên người liên hệ"
              placeholder="Nhập tên người liên hệ (tùy chọn)"
            />

            <FormInput
              name="patientContactPhone"
              label="SĐT người liên hệ"
              placeholder="Nhập SĐT người liên hệ (tùy chọn)"
              keyboardType="phone-pad"
            />

            <FormTextarea
              name="patientAddress"
              label="Địa chỉ"
              placeholder="Nhập địa chỉ (tùy chọn)"
              minHeight={80}
            />
          </View>
        </ScrollView>

        <View className="p-4 bg-white border-t border-sky-100">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={createPatientMutation.isPending}
            className={`p-4 rounded-2xl flex-row items-center justify-center ${
              createPatientMutation.isPending ? "bg-slate-300" : "bg-sky-600"
            }`}
            activeOpacity={0.85}
          >
            <Text className="text-white text-base font-extrabold">
              {createPatientMutation.isPending ? "Đang tạo..." : "Tạo mới"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </FormProvider>
  );
}
