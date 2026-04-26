import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Alert, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { FormInput, FormTextarea } from "@/components/form";
import { customerService } from "@/services/customerService";

const customerSchema = z.object({
  customerName: z.string().min(1, "Tên khách hàng là bắt buộc"),
  customerEmail: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

const defaultValues: CustomerFormData = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerAddress: "",
};

export default function CreateCustomerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const methods = useForm({
    resolver: zodResolver(customerSchema),
    mode: "onTouched",
    defaultValues,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const submitData = {
        customerName: data.customerName.trim(),
        customerEmail: data.customerEmail?.trim() || null,
        customerPhone: data.customerPhone?.trim() || null,
        customerAddress: data.customerAddress?.trim() || null,
      };
      const response = await customerService.create(submitData);
      if (!response.success) {
        throw new Error(response.message || "Không thể tạo khách hàng");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      Alert.alert("Thành công", "Khách hàng đã được tạo thành công", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Lỗi tạo khách hàng", error?.message || "Không thể tạo khách hàng. Vui lòng thử lại.");
    },
  });

  const handleSubmit = async () => {
    const isValid = await methods.trigger();
    if (!isValid) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    const formData = methods.getValues();
    createMutation.mutate(formData);
  };

  return (
    <FormProvider {...methods}>
      <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
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
              <Text className="text-slate-900 text-lg font-extrabold">Tạo mới khách hàng</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Nhập thông tin khách hàng</Text>
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
              name="customerName"
              label="Tên khách hàng"
              required
              placeholder="Nhập tên khách hàng"
            />

            <FormInput
              name="customerPhone"
              label="Số điện thoại"
              placeholder="Nhập số điện thoại (tùy chọn)"
              keyboardType="phone-pad"
            />

            <FormInput
              name="customerEmail"
              label="Email"
              placeholder="Nhập email (tùy chọn)"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormTextarea
              name="customerAddress"
              label="Địa chỉ"
              placeholder="Nhập địa chỉ (tùy chọn)"
              minHeight={80}
            />
          </View>
        </ScrollView>

        <View className="p-4 bg-white border-t border-sky-100">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={createMutation.isPending}
            className={`p-4 rounded-2xl flex-row items-center justify-center ${
              createMutation.isPending ? "bg-slate-300" : "bg-sky-600"
            }`}
            activeOpacity={0.85}
          >
            <Text className="text-white text-base font-extrabold">
              {createMutation.isPending ? "Đang tạo..." : "Tạo mới"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </FormProvider>
  );
}
