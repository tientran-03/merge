import { zodResolver } from '@hookform/resolvers/zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Alert, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { FormInput, FormNumericInput, FormSelect, FormTextarea } from '@/components/form';
import { SERVICE_TYPE_MAPPER } from '@/lib/schemas/order-schemas';
import { getApiResponseData } from '@/lib/types/api-types';
import { genomeTestService } from '@/services/genomeTestService';
import { ServiceResponse, serviceService } from '@/services/serviceService';

const createGenomeTestSchema = z.object({
  testId: z.string().min(1, 'Mã xét nghiệm là bắt buộc'),
  code: z.string().optional(),
  testName: z.string().min(1, 'Tên xét nghiệm là bắt buộc'),
  serviceId: z.string().min(1, 'Nhóm dịch vụ là bắt buộc'),
  price: z.coerce.number().min(1, 'Giá phải lớn hơn 0'),
  taxRate: z.coerce.number().min(0, 'Thuế suất phải lớn hơn hoặc bằng 0').optional(),
  testSample: z.array(z.string()).optional(),
  sampleInput: z.string().optional(),
  testDescription: z.string().optional(),
});

type CreateGenomeTestFormData = z.infer<typeof createGenomeTestSchema>;

const defaultValues: CreateGenomeTestFormData = {
  testId: '',
  testName: '',
  testDescription: '',
  code: '',
  serviceId: '',
  price: 0,
  taxRate: 0,
  testSample: [],
  sampleInput: '',
};

export default function CreateGenomeTestScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { serviceType } = useLocalSearchParams<{ serviceType?: string }>();

  const methods = useForm({
    resolver: zodResolver(createGenomeTestSchema),
    mode: 'onTouched',
    defaultValues,
  });

  const { data: servicesResponse } = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceService.getAll(),
    retry: false,
  });

  const services = getApiResponseData<ServiceResponse>(servicesResponse) || [];
  const serviceOptions = services.map((service) => ({
    value: service.serviceId,
    label: SERVICE_TYPE_MAPPER[service.name] || service.name,
  }));

  useEffect(() => {
    if (serviceType && services.length > 0) {
      const matchingService = services.find(service => service.name.toLowerCase() === serviceType.toLowerCase());
      if (matchingService) {
        methods.setValue('serviceId', matchingService.serviceId);
      }
    }
  }, [serviceType, services, methods]);

  const createGenomeTestMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await genomeTestService.create(data);
      if (!response.success) {
        throw new Error(response.message || 'Không thể tạo xét nghiệm');
      }
      return response;
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ['genome-tests'] });
      const testId = response.data?.testId;
      
      if (testId) {
        try {
          await AsyncStorage.setItem('newlyCreatedTestId', testId);
        } catch (error) {
          console.log('Error saving test ID:', error);
        }
      }
      
      Alert.alert('Thành công', 'Xét nghiệm đã được tạo thành công', [
        {
          text: 'OK',
          onPress: () => {
            router.back();
          },
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert(
        'Lỗi tạo xét nghiệm',
        error?.message || 'Không thể tạo xét nghiệm. Vui lòng thử lại.'
      );
    },
  });

  const handleSubmit = async () => {
    const isValid = await methods.trigger();
    if (!isValid) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    const formData = methods.getValues();

    const submitData = {
      testId: formData.testId,
      testName: formData.testName,
      code: formData.code || '',
      serviceId: formData.serviceId,
      price: formData.price,
      taxRate: formData.taxRate || 0,
      testSample: formData.testSample || [],
      testDescription: formData.testDescription || '',
    };

    createGenomeTestMutation.mutate(submitData);
  };

  const addSample = () => {
    const sampleInput = methods.getValues('sampleInput');
    if (sampleInput?.trim()) {
      const currentSamples = methods.getValues('testSample') || [];
      if (!currentSamples.includes(sampleInput.trim())) {
        methods.setValue('testSample', [...currentSamples, sampleInput.trim()]);
        methods.setValue('sampleInput', '');
      } else {
        Alert.alert('Thông báo', 'Mẫu xét nghiệm này đã tồn tại');
      }
    }
  };

  const removeSample = (index: number) => {
    const currentSamples = methods.getValues('testSample') || [];
    const newSamples = currentSamples.filter((_, i) => i !== index);
    methods.setValue('testSample', newSamples);
  };

  const testSamples = methods.watch('testSample') || [];

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
              <Text className="text-slate-900 text-lg font-extrabold">Thêm dịch vụ mới</Text>
              <Text className="mt-0.5 text-[11px] text-slate-500">Tạo xét nghiệm/dịch vụ</Text>
            </View>
          </View>
        </View>

        <ScrollView className="flex-1 px-3 pt-3" contentContainerStyle={{ paddingBottom: 96 }}>
          <View className="bg-white rounded-2xl border border-slate-200 p-3">
            {/* Inline fields (label + input cùng 1 dòng). Mô tả giữ 1 mình 1 dòng. */}
            <View className="flex-row items-center mb-2">
              <Text numberOfLines={1} className="w-[112px] text-[12px] font-extrabold text-slate-700">
                Mã xét nghiệm <Text className="text-red-500">*</Text>
              </Text>
              <View className="flex-1">
                <FormInput
                  containerClassName="mb-0"
                  name="testId"
                  placeholder="Nhập mã xét nghiệm"
                />
              </View>
            </View>

            <View className="flex-row items-center mb-2">
              <Text numberOfLines={1} className="w-[112px] text-[12px] font-extrabold text-slate-700">
                Mã code
              </Text>
              <View className="flex-1">
                <FormInput
                  containerClassName="mb-0"
                  name="code"
                  placeholder="Nhập mã code"
                />
              </View>
            </View>

            <View className="flex-row items-center mb-2">
              <Text numberOfLines={1} className="w-[112px] text-[12px] font-extrabold text-slate-700">
                Tên xét nghiệm <Text className="text-red-500">*</Text>
              </Text>
              <View className="flex-1">
                <FormInput
                  containerClassName="mb-0"
                  name="testName"
                  placeholder="Nhập tên xét nghiệm"
                />
              </View>
            </View>

            <View className="flex-row items-center mb-2">
              <Text numberOfLines={1} className="w-[112px] text-[12px] font-extrabold text-slate-700">
                Nhóm dịch vụ <Text className="text-red-500">*</Text>
              </Text>
              <View className="flex-1">
                <FormSelect
                  containerClassName="mb-0"
                  name="serviceId"
                  options={serviceOptions}
                  getLabel={(o) => o.label}
                  getValue={(o) => o.value}
                  placeholder="Chọn nhóm dịch vụ"
                  modalTitle="Chọn nhóm dịch vụ"
                  disabled={!!serviceType}
                  helperText={serviceType ? "Đã được chọn từ bước trước" : undefined}
                />
              </View>
            </View>

            <View className="flex-row items-center mb-2">
              <Text numberOfLines={1} className="w-[112px] text-[12px] font-extrabold text-slate-700">
                Giá tiền (VNĐ) <Text className="text-red-500">*</Text>
              </Text>
              <View className="flex-1">
                <FormNumericInput
                  containerClassName="mb-0"
                  name="price"
                  type="integer"
                  placeholder="Nhập giá tiền"
                />
              </View>
            </View>

            <View className="flex-row items-center mb-2">
              <Text numberOfLines={1} className="w-[112px] text-[12px] font-extrabold text-slate-700">
                Thuế suất (%)
              </Text>
              <View className="flex-1">
                <FormNumericInput
                  containerClassName="mb-0"
                  name="taxRate"
                  type="decimal"
                  numericMax={100}
                  placeholder="Nhập thuế suất"
                />
              </View>
            </View>

            <View className="mt-1">
              <View className="flex-row items-center mb-1.5">
                <Text numberOfLines={1} className="w-[112px] text-[12px] font-extrabold text-slate-700">
                  Mẫu xét nghiệm
                </Text>
                <View className="flex-1">
                  <FormInput
                    containerClassName="mb-0"
                    name="sampleInput"
                    placeholder="Nhập loại mẫu"
                    onSubmitEditing={addSample}
                    onBlur={addSample}
                    returnKeyType="done"
                  />
                </View>
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

            <FormTextarea
              name="testDescription"
              label="Mô tả"
              placeholder="Nhập mô tả ở đây…"
              minHeight={110}
            />
          </View>
        </ScrollView>

        <View className="px-3 pb-4">
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="flex-1 py-3 rounded-2xl bg-slate-100 border border-slate-200 items-center justify-center"
              activeOpacity={0.85}
            >
              <Text className="text-slate-700 font-extrabold">Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={createGenomeTestMutation.isPending}
              className={`flex-1 py-3 rounded-2xl items-center justify-center ${
                createGenomeTestMutation.isPending ? 'bg-slate-300' : 'bg-sky-600'
              }`}
              activeOpacity={0.85}
            >
              <Text className="text-white font-extrabold">
                {createGenomeTestMutation.isPending ? 'Đang thêm...' : 'Thêm'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </FormProvider>
  );
}
