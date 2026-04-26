import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Alert, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FormDatePicker, FormInput, FormSelect, FormTextarea } from "@/components/form";
import { GENDER_OPTIONS, patientDefaultValues, patientSchema } from "@/lib/schemas/patient-schemas";
import { patientService } from "@/services/patientService";

const formatDateForInput = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
};

export default function EditPatientScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const queryClient = useQueryClient();

  const { data: patientResponse, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientService.getById(patientId!),
    enabled: !!patientId,
  });

  const methods = useForm({
    resolver: zodResolver(patientSchema),
    mode: "onTouched",
    defaultValues: patientDefaultValues,
  });

  // Pre-fill form when patient data is loaded
  useEffect(() => {
    if (patientResponse?.success && patientResponse.data) {
      const patient = patientResponse.data as any;
      methods.reset({
        patientId: patient.patientId || "",
        patientName: patient.patientName || patient.name || "",
        patientPhone: patient.patientPhone || patient.phone || "",
        patientEmail: patient.patientEmail || patient.email || "",
        patientDob: formatDateForInput(patient.patientDob || patient.dateOfBirth),
        gender: patient.gender || undefined,
        patientJob: patient.patientJob || "",
        patientContactName: patient.patientContactName || "",
        patientContactPhone: patient.patientContactPhone || "",
        patientAddress: patient.patientAddress || patient.address || "",
        hospitalId: patient.hospitalId || "",
      });
    }
  }, [patientResponse, methods]);

  const updatePatientMutation = useMutation({
    mutationFn: async (data: any) => {
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
      const response = await patientService.update(patientId!, submitData);
      if (!response.success) {
        throw new Error(response.message || "Không thể cập nhật bệnh nhân");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      Alert.alert("Thành công", "Bệnh nhân đã được cập nhật thành công", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Lỗi cập nhật bệnh nhân", error?.message || "Không thể cập nhật bệnh nhân. Vui lòng thử lại.");
    },
  });

  const handleSubmit = async () => {
    const isValid = await methods.trigger();
    if (!isValid) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    const formData = methods.getValues();
    updatePatientMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

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
              <Text className="text-slate-900 text-lg font-extrabold">Sửa thông tin bệnh nhân</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Cập nhật thông tin bệnh nhân</Text>
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
              editable={false}
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
            disabled={updatePatientMutation.isPending}
            className={`p-4 rounded-2xl flex-row items-center justify-center ${
              updatePatientMutation.isPending ? "bg-slate-300" : "bg-sky-600"
            }`}
            activeOpacity={0.85}
          >
            <Text className="text-white text-base font-extrabold">
              {updatePatientMutation.isPending ? "Đang cập nhật..." : "Cập nhật"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </FormProvider>
  );
}
