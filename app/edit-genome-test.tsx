import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect, useMemo, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { FormInput, FormNumericInput, FormSelect, FormTextarea } from "@/components/form";
import { getApiResponseData } from "@/lib/types/api-types";
import { genomeTestService, CreateGenomeTestRequest } from "@/services/genomeTestService";
import { ServiceResponse, serviceService } from "@/services/serviceService";

const MIN_PRICE = 10000;
const MAX_TAX_RATE = 100;

/** Giống admin web `genome-test-form-modal.tsx`: trim, bắt buộc, giá tối thiểu, thuế 0–100% */
const editGenomeTestSchema = z.object({
  testId: z.string().min(1, "ID xét nghiệm là bắt buộc"),
  testName: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, { message: "Tên xét nghiệm không được để trống." })),
  testDescription: z.string().optional(),
  code: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, { message: "Mã code không được để trống." })),
  serviceId: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, { message: "Vui lòng chọn nhóm dịch vụ." })),
  price: z.union([z.number(), z.string()]).superRefine((val, ctx) => {
    const raw = typeof val === "number" ? String(val) : String(val ?? "");
    const n = Number(raw.replace(/[^\d]/g, ""));
    if (!raw.trim() || !Number.isFinite(n) || n <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Giá tiền là bắt buộc",
        path: ["price"],
      });
      return;
    }
    if (n < MIN_PRICE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Giá tối thiểu là ${MIN_PRICE.toLocaleString("vi-VN")} đ`,
        path: ["price"],
      });
    }
  }),
  taxRate: z.union([z.number(), z.string()]).superRefine((val, ctx) => {
    const str = typeof val === "number" ? String(val) : String(val ?? "");
    const trimmed = str.trim();
    if (trimmed === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Thuế suất là bắt buộc",
        path: ["taxRate"],
      });
      return;
    }
    const n = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > MAX_TAX_RATE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Thuế suất phải từ 0 đến 100%",
        path: ["taxRate"],
      });
    }
  }),
  testSample: z.array(z.string()).optional(),
  sampleInput: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, { message: "Mẫu xét nghiệm không được để trống." })),
});

type EditGenomeTestFormData = z.infer<typeof editGenomeTestSchema>;

export default function EditGenomeTestScreen() {
  const router = useRouter();
  const {
    testId,
    testName: testNameParam,
    testDescription: testDescriptionParam,
    code: codeParam,
    serviceId: serviceIdParam,
    price: priceParam,
    taxRate: taxRateParam,
    sampleInput: sampleInputParam,
  } = useLocalSearchParams<{
    testId: string;
    testName?: string;
    testDescription?: string;
    code?: string;
    serviceId?: string;
    price?: string;
    taxRate?: string;
    sampleInput?: string;
  }>();
  const queryClient = useQueryClient();
  const hydratedTestIdRef = useRef<string | null>(null);

  const { data: testResponse, isLoading } = useQuery({
    queryKey: ["genome-test", testId],
    queryFn: () => genomeTestService.getById(testId!),
    enabled: !!testId,
  });
  const { data: servicesResponse } = useQuery({
    queryKey: ["services"],
    queryFn: () => serviceService.getAll(),
  });

  const methods = useForm({
    resolver: zodResolver(editGenomeTestSchema),
    mode: "onTouched",
  });
  const { reset, watch } = methods;
  const services = getApiResponseData<ServiceResponse>(servicesResponse) || [];
  const serviceOptions = services.map((service) => ({
    value: service.serviceId,
    label: service.name,
  }));
  const rawPriceValue = watch("price");
  const rawTaxRateValue = watch("taxRate");
  const priceValue =
    typeof rawPriceValue === "number"
      ? rawPriceValue
      : Number(String(rawPriceValue || "").replace(/[^\d]/g, ""));
  const taxRateValue =
    typeof rawTaxRateValue === "number"
      ? rawTaxRateValue
      : Number(String(rawTaxRateValue || "").replace(",", "."));
  const priceAfterTax = useMemo(() => {
    if (!Number.isFinite(priceValue) || !Number.isFinite(taxRateValue)) {
      return 0;
    }
    return Math.round(priceValue * (1 + taxRateValue / 100));
  }, [priceValue, taxRateValue]);

  useEffect(() => {
    hydratedTestIdRef.current = null;
  }, [testId]);

  useEffect(() => {
    if (!testId) return;
    const initialSamples = String(sampleInputParam || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    reset({
      testId: String(testId || ""),
      testName: String(testNameParam || ""),
      testDescription: String(testDescriptionParam || ""),
      code: String(codeParam || ""),
      serviceId: String(serviceIdParam || ""),
      price: String(priceParam || "").trim(),
      taxRate: String(taxRateParam || "").trim(),
      testSample: initialSamples,
      sampleInput: String(sampleInputParam || "").trim(),
    });
  }, [
    testId,
    testNameParam,
    testDescriptionParam,
    codeParam,
    serviceIdParam,
    priceParam,
    taxRateParam,
    sampleInputParam,
    reset,
  ]);

  useEffect(() => {
    if (!testId || !testResponse?.success || !testResponse.data) return;
    const test = testResponse.data as any;

    if (hydratedTestIdRef.current === testId) return;
    hydratedTestIdRef.current = testId;

    const samples = Array.isArray(test.testSample)
      ? test.testSample.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    const resolvedServiceId =
      test.serviceId ||
      test.service?.serviceId ||
      test.service?.serviceID ||
      test.service?.id ||
      "";

    reset({
      testId: test.testId || test.id || testId || "",
      testName: test.testName || "",
      testDescription: test.testDescription || "",
      code: test.code || "",
      serviceId: resolvedServiceId,
      price:
        typeof test.price === "number"
          ? test.price.toLocaleString("vi-VN")
          : String(test.price || "").trim(),
      taxRate:
        typeof test.taxRate === "number"
          ? String(test.taxRate)
          : String(test.taxRate || "").trim(),
      testSample: samples,
      sampleInput: samples.join(", "),
    });
  }, [testId, testResponse?.success, testResponse?.data, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditGenomeTestFormData) => {
      const normalizedPrice =
        typeof data.price === "number"
          ? data.price
          : Number(String(data.price).replace(/[^\d]/g, ""));
      const normalizedTaxRate =
        typeof data.taxRate === "number"
          ? data.taxRate
          : Number(String(data.taxRate).replace(",", "."));

      if (!Number.isFinite(normalizedPrice) || normalizedPrice < MIN_PRICE) {
        throw new Error(`Giá tối thiểu là ${MIN_PRICE.toLocaleString("vi-VN")} đ`);
      }
      if (!Number.isFinite(normalizedTaxRate) || normalizedTaxRate < 0 || normalizedTaxRate > 100) {
        throw new Error("Thuế suất phải từ 0 đến 100%");
      }

      const submitData: CreateGenomeTestRequest = {
        testId: data.testId,
        testName: data.testName,
        testDescription: data.testDescription?.trim() || undefined,
        code: data.code?.trim() || undefined,
        serviceId: data.serviceId?.trim() || undefined,
        price: normalizedPrice,
        taxRate: Number.isFinite(normalizedTaxRate) ? normalizedTaxRate : 0,
        testSample: data.sampleInput
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      const apiId =
        String((testResponse?.data as any)?.id || "").trim() ||
        String((testResponse?.data as any)?.testId || "").trim() ||
        String(testId || "").trim();
      const response = await genomeTestService.update(apiId, submitData);
      if (!response.success) {
        throw new Error(response.message || "Không thể cập nhật xét nghiệm");
      }
      return response;
    },
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["genome-tests"] });
      queryClient.invalidateQueries({ queryKey: ["genome-test", testId] });
      queryClient.invalidateQueries({ queryKey: ["genome-tests-by-service"] });
      if (variables.serviceId) {
        queryClient.invalidateQueries({
          queryKey: ["genome-tests-by-service", variables.serviceId],
        });
      }
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
              <Text className="text-slate-900 text-lg font-extrabold">Chỉnh sửa dịch vụ</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Cập nhật thông tin dịch vụ xét nghiệm</Text>
            </View>
          </View>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "position"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 20}
        >
          <ScrollView
            className="flex-1 p-4"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            <View className="bg-white rounded-3xl border border-slate-200 p-4">
              <FormInput
                name="testId"
                label="Mã xét nghiệm"
                required
                placeholder="Nhập mã xét nghiệm"
                editable={false}
              />

              <FormInput
                name="code"
                label="Mã code"
                required
                placeholder="Nhập mã code"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <FormNumericInput
                name="price"
                label="Giá tiền (VND)"
                required
                type="currency"
                placeholder="Nhập giá tiền (VD: 500.000)"
                helperText={`Giá tối thiểu: ${MIN_PRICE.toLocaleString("vi-VN")} đ`}
              />

              <FormNumericInput
                name="taxRate"
                label="Thuế suất (%)"
                required
                type="decimal"
                numericMax={100}
                placeholder="Nhập thuế suất (VD: 10)"
                helperText={`Giá sau thuế: ${new Intl.NumberFormat("vi-VN").format(priceAfterTax)} đ`}
              />

              <FormInput
                name="testName"
                label="Tên xét nghiệm"
                required
                placeholder="Nhập tên xét nghiệm"
              />

              <FormSelect
                name="serviceId"
                label="Nhóm dịch vụ"
                required
                options={serviceOptions}
                getLabel={(o) => o.label}
                getValue={(o) => o.value}
                placeholder="Chọn nhóm dịch vụ"
                modalTitle="Chọn nhóm dịch vụ"
              />

              <View className="mt-4">
                <Text className="text-slate-700 font-medium mb-2">Mẫu xét nghiệm *</Text>
                <FormInput
                  name="sampleInput"
                  placeholder="Nhập mẫu xét nghiệm"
                  helperText="Ví dụ: Máu, Nước tiểu, Mô"
                />
              </View>

              <FormTextarea
                name="testDescription"
                label="Mô tả"
                placeholder="Nhập mô tả..."
                minHeight={120}
              />
            </View>
          </ScrollView>

          <View className="p-4 pb-6">
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </FormProvider>
  );
}
