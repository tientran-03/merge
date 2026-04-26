import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Alert, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { FormInput, FormNumericInput, FormSelect, FormTextarea } from "@/components/form";
import { getApiResponseData } from "@/lib/types/api-types";
import { zRhfNonNegativeNumber, zRhfOptionalNonNegativeNumber } from "@/lib/schemas/genome-test-form";
import { SERVICE_TYPE_MAPPER } from "@/lib/schemas/order-schemas";
import {
  genomeTestService,
  CreateGenomeTestRequest,
  type GenomeTestResponse,
} from "@/services/genomeTestService";
import { ServiceResponse, serviceService } from "@/services/serviceService";

const editGenomeTestSchema = z.object({
  testId: z.string().min(1, "ID xét nghiệm là bắt buộc"),
  testName: z.string().min(1, "Tên xét nghiệm là bắt buộc"),
  testDescription: z.string().optional(),
  code: z.string().optional(),
  serviceId: z.string().optional(),
  price: zRhfNonNegativeNumber(0, "Giá phải lớn hơn hoặc bằng 0"),
  taxRate: zRhfOptionalNonNegativeNumber("Thuế suất phải lớn hơn hoặc bằng 0"),
  testSample: z.array(z.string()).optional(),
  sampleInput: z.string().optional(),
});

type EditGenomeTestFormData = z.infer<typeof editGenomeTestSchema>;

function toNum(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function EditGenomeTestScreen() {
  const router = useRouter();
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const queryClient = useQueryClient();

  const { data: testResponse, isLoading } = useQuery({
    queryKey: ["genome-test", testId],
    queryFn: () => genomeTestService.getById(testId!),
    enabled: !!testId,
  });

  const { data: servicesResponse } = useQuery({
    queryKey: ["services"],
    queryFn: () => serviceService.getAll(),
  });

  const methods = useForm<EditGenomeTestFormData>({
    resolver: zodResolver(editGenomeTestSchema),
    mode: "onTouched",
  });

  const services = getApiResponseData<ServiceResponse>(servicesResponse) || [];
  const serviceOptions = services.map((service) => ({
    value: service.serviceId,
    label: SERVICE_TYPE_MAPPER[service.name] || service.name,
  }));

  useEffect(() => {
    if (!testResponse?.success || !testResponse.data) return;
    const test = testResponse.data as GenomeTestResponse;
    methods.reset({
      testId: test.testId ?? "",
      testName: test.testName ?? "",
      testDescription: test.testDescription ?? "",
      code: test.code ?? "",
      serviceId: test.service?.serviceId ?? "",
      price: toNum(test.price, 0),
      taxRate: toNum(test.taxRate, 0),
      testSample: Array.isArray(test.testSample) ? test.testSample : [],
      sampleInput: "",
    });
  }, [testResponse, methods]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditGenomeTestFormData) => {
      const submitData: CreateGenomeTestRequest = {
        testId: data.testId,
        testName: data.testName,
        testDescription: data.testDescription?.trim() || undefined,
        code: data.code?.trim() || undefined,
        serviceId: data.serviceId?.trim() || undefined,
        price: toNum(data.price, 0),
        taxRate:
          data.taxRate !== undefined && data.taxRate !== null
            ? toNum(data.taxRate, 0)
            : undefined,
        testSample: data.testSample?.length ? data.testSample : undefined,
      };
      const response = await genomeTestService.update(testId!, submitData);
      if (!response.success) {
        throw new Error(response.message || "Không thể cập nhật xét nghiệm");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genome-tests"] });
      queryClient.invalidateQueries({ queryKey: ["genome-test", testId] });
      Alert.alert("Thành công", "Xét nghiệm đã được cập nhật thành công", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Lỗi cập nhật xét nghiệm", error?.message || "Không thể cập nhật xét nghiệm. Vui lòng thử lại.");
    },
  });

  const handleSubmit = async () => {
    const isValid = await methods.trigger();
    if (!isValid) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    const formData = methods.getValues();
    updateMutation.mutate(formData);
  };

  const addSample = () => {
    const sampleInput = methods.getValues("sampleInput");
    if (sampleInput?.trim()) {
      const currentSamples = methods.getValues("testSample") || [];
      if (!currentSamples.includes(sampleInput.trim())) {
        methods.setValue("testSample", [...currentSamples, sampleInput.trim()]);
        methods.setValue("sampleInput", "");
      } else {
        Alert.alert("Thông báo", "Mẫu xét nghiệm này đã tồn tại");
      }
    }
  };

  const removeSample = (index: number) => {
    const currentSamples = methods.getValues("testSample") || [];
    const newSamples = currentSamples.filter((_, i) => i !== index);
    methods.setValue("testSample", newSamples);
  };

  const testSamples = methods.watch("testSample") || [];

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <FormProvider {...methods}>
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'left', 'right']}>
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
              <Text className="text-slate-900 text-lg font-extrabold">Sửa xét nghiệm</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Cập nhật thông tin xét nghiệm</Text>
            </View>
          </View>
        </View>

        <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
          <View className="bg-white rounded-3xl border border-slate-200 p-4">
            <FormInput
              name="testId"
              label="ID xét nghiệm"
              required
              placeholder="Nhập ID xét nghiệm"
              editable={false}
            />

            <FormInput
              name="testName"
              label="Tên xét nghiệm"
              required
              placeholder="Nhập tên xét nghiệm"
            />

            <FormTextarea
              name="testDescription"
              label="Mô tả xét nghiệm"
              placeholder="Nhập mô tả xét nghiệm"
              minHeight={100}
            />

            <FormInput name="code" label="Mã xét nghiệm" placeholder="Nhập mã xét nghiệm" />

            <FormSelect
              name="serviceId"
              label="Loại dịch vụ"
              options={serviceOptions}
              getLabel={(o) => o.label}
              getValue={(o) => o.value}
              placeholder="Chọn loại dịch vụ"
              modalTitle="Chọn loại dịch vụ"
            />

            <FormNumericInput
              name="price"
              label="Giá (VNĐ)"
              required
              type="integer"
              placeholder="Nhập giá"
            />

            <FormNumericInput
              name="taxRate"
              label="Thuế suất (%)"
              type="decimal"
              placeholder="Nhập thuế suất"
            />

            <View className="mt-4">
              <Text className="text-slate-700 font-medium mb-2">Mẫu xét nghiệm</Text>

              <View className="flex-row items-center mb-6">
                <View className="flex-1 mr-2">
                  <FormInput
                    containerClassName="mb-0"
                    name="sampleInput"
                    placeholder="Nhập loại mẫu"
                  />
                </View>
                <TouchableOpacity
                  onPress={addSample}
                  className="bg-cyan-600 rounded-lg h-11 flex-row items-center justify-center px-2"
                >
                  <Text className="text-white font-medium">Thêm</Text>
                </TouchableOpacity>
              </View>

              {testSamples.length > 0 && (
                <View className="border border-slate-200 rounded-lg p-2">
                  {testSamples.map((sample, index) => (
                    <View key={index} className="flex-row items-center justify-between py-1">
                      <Text className="text-slate-700">{sample}</Text>
                      <TouchableOpacity
                        onPress={() => removeSample(index)}
                        className="bg-red-100 px-2 py-1 rounded"
                      >
                        <Text className="text-red-600 text-xs">Xóa</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View className="p-4 mb-4">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={updateMutation.isPending}
            className={`p-4 rounded-lg flex-row items-center justify-center ${
              updateMutation.isPending ? "bg-slate-300" : "bg-cyan-600"
            }`}
            activeOpacity={0.85}
          >
            <Text className="text-white font-medium ml-1">
              {updateMutation.isPending ? "Đang cập nhật..." : "Cập nhật"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </FormProvider>
  );
}
