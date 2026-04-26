import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Heart } from 'lucide-react-native';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { usePrefetchProvinces } from '@/hooks/useAddressQueries';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import {
  FormInput,
  FormNumericInput,
  FormSelect,
  FormTextarea,
  FormAddressPicker,
  FormDatePicker,
} from '@/components/form';
import {
  createPatientDefaultValues,
  createPatientSchema,
  getFirstPatientFormErrorMessage,
  GENDER_OPTIONS,
  type CreatePatientFormData,
} from '@/lib/schemas/patient-schemas';
import { sanitizePatientNameInput } from '@/lib/specify-patient-input-formatters';
import { patientClinicalService } from '@/services/patientClinicalService';
import { patientService } from '@/services/patientService';

const generatePatientId = () => {
  return `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export default function CreatePatientScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  usePrefetchProvinces();

  const methods = useForm({
    resolver: zodResolver(createPatientSchema),
    mode: 'onTouched',
    defaultValues: createPatientDefaultValues,
  });

  const createPatientMutation = useMutation({
    mutationFn: async (data: CreatePatientFormData) => {
      const patientId = generatePatientId();
      const patientPayload = {
        patientId,
        patientName: data.patientName,
        patientPhone: data.patientPhone,
        patientDob: data.patientDob ? new Date(data.patientDob).toISOString() : null,
        gender: data.gender || null,
        patientEmail: data.patientEmail?.trim() || null,
        patientJob: data.patientJob?.trim() || null,
        patientContactName: data.patientContactName?.trim() || null,
        patientContactPhone: data.patientContactPhone?.trim() || null,
        patientAddress: data.patientAddress?.trim() || null,
        hospitalId: user?.hospitalId?.trim() || undefined,
      };

      const patientRes = await patientService.create(patientPayload);
      if (!patientRes.success) {
        throw new Error(patientRes.message || patientRes.error || 'Không thể tạo bệnh nhân');
      }

      const hasClinicalData =
        data.familyHistory ||
        data.patientHistory ||
        data.patientHeight !== undefined ||
        data.patientWeight !== undefined ||
        data.medicalHistory ||
        data.chronicDisease ||
        data.acuteDisease ||
        data.toxicExposure ||
        (data.medicalUsingInput && data.medicalUsingInput.trim());

      if (hasClinicalData) {
        const medicalUsing = data.medicalUsingInput
          ? data.medicalUsingInput
              .split('\n')
              .map((s) => s.trim())
              .filter((s) => s)
          : undefined;

        const clinicalPayload = {
          patientId,
          familyHistory: data.familyHistory?.trim() || undefined,
          patientHistory: data.patientHistory?.trim() || undefined,
          patientHeight: data.patientHeight,
          patientWeight: data.patientWeight,
          medicalHistory: data.medicalHistory?.trim() || undefined,
          medicalUsing,
          chronicDisease: data.chronicDisease?.trim() || undefined,
          toxicExposure: data.toxicExposure?.trim() || undefined,
          acuteDisease: data.acuteDisease?.trim() || undefined,
        };

        const clinicalRes = await patientClinicalService.create(clinicalPayload);
        if (!clinicalRes.success && clinicalRes.error) {
          console.warn('Lưu thông tin lâm sàng thất bại:', clinicalRes.error);
        }
      }

      return { success: true, patientId };
    },
    onError: (error: any) => {
      presentFeedbackError({
        title: 'Lỗi tạo bệnh nhân',
        message: error?.message || 'Không thể tạo bệnh nhân. Vui lòng thử lại.',
      });
    },
  });

  const handleSubmit = async () => {
    const isValid = await methods.trigger();
    if (!isValid) {
      const first = getFirstPatientFormErrorMessage(methods.formState.errors);
      presentFeedbackError({
        title: 'Lỗi',
        message: first || 'Vui lòng điền đầy đủ thông tin bắt buộc (họ tên, số điện thoại, định dạng email...)',
      });
      return;
    }

    try {
      const formData = createPatientSchema.parse(methods.getValues());
      await createPatientMutation.mutateAsync(formData);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      presentFeedbackSuccess({
        title: 'Thành công',
        message: 'Bệnh nhân đã được tạo thành công',
        onAfterClose: () => router.back(),
      });
    } catch {
      // onError mutation đã hiển thị modal lỗi
    }
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
              <Text className="text-slate-900 text-lg font-extrabold">Thêm bệnh nhân mới</Text>
              <Text className="mt-0.5 text-xs text-slate-500">{'Thông tin cá nhân & lâm sàng'}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Thông tin cá nhân */}
          <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
            <Text className="text-slate-900 text-base font-extrabold mb-4">Thông tin cá nhân</Text>

            <FormInput
              name="patientName"
              label="Họ và tên"
              required
              placeholder="Nhập họ và tên"
              formatter={sanitizePatientNameInput}
            />

            <FormInput
              name="patientPhone"
              label="Số điện thoại"
              required
              placeholder="VD: 0912345678 (10 số di động VN)"
              keyboardType="phone-pad"
              formatter={(v) => v.replace(/\D/g, "")}
            />

            <FormInput
              name="patientEmail"
              label="Email"
              placeholder="ten@gmail.com (ASCII, không dấu — tùy chọn)"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormDatePicker
              name="patientDob"
              label="Ngày sinh"
              placeholder="Chọn ngày sinh"
              maximumDate={new Date()}
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
              placeholder="VD: 0912345678 hoặc để trống"
              keyboardType="phone-pad"
              formatter={(v) => v.replace(/\D/g, "")}
            />

            <FormAddressPicker
              name="patientAddress"
              label="Địa chỉ"
              placeholder="Chọn tỉnh/thành phố, phường/xã"
            />
          </View>

          {/* Thông tin lâm sàng */}
          <View className="bg-white rounded-2xl border border-rose-100 p-4">
            <View className="flex-row items-center mb-4">
              <Heart size={18} color="#E11D48" />
              <Text className="ml-2 text-slate-900 text-base font-extrabold">Thông tin lâm sàng</Text>
            </View>

            <View className="flex-row gap-3 mb-2">
              <View className="flex-1">
                <FormNumericInput
                  name="patientHeight"
                  label="Chiều cao (cm)"
                  type="decimal"
                  placeholder="Nhập chiều cao"
                />
              </View>
              <View className="flex-1">
                <FormNumericInput
                  name="patientWeight"
                  label="Cân nặng (kg)"
                  type="decimal"
                  placeholder="Nhập cân nặng"
                />
              </View>
            </View>

            <FormTextarea
              name="patientHistory"
              label="Tiền sử bản thân"
              placeholder="Nhập tiền sử bản thân"
              minHeight={80}
            />

            <FormTextarea
              name="familyHistory"
              label="Tiền sử gia đình"
              placeholder="Nhập tiền sử gia đình"
              minHeight={80}
            />

            <FormTextarea
              name="medicalHistory"
              label="Tiền sử y tế"
              placeholder="Nhập tiền sử y tế"
              minHeight={80}
            />

            <FormTextarea
              name="acuteDisease"
              label="Bệnh lý cấp tính"
              placeholder="Nhập bệnh lý cấp tính"
              minHeight={80}
            />

            <FormTextarea
              name="chronicDisease"
              label="Bệnh mãn tính"
              placeholder="Nhập bệnh mãn tính"
              minHeight={80}
            />

            <FormTextarea
              name="medicalUsingInput"
              label="Thuốc đang sử dụng"
              placeholder="Nhập thuốc đang sử dụng (mỗi thuốc một dòng)"
              minHeight={80}
            />

            <FormTextarea
              name="toxicExposure"
              label="Phơi nhiễm độc hại"
              placeholder="Nhập thông tin phơi nhiễm độc hại"
              minHeight={80}
            />
          </View>
        </ScrollView>

        <View className="p-4 bg-white border-t border-sky-100">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={createPatientMutation.isPending}
            className={`p-4 rounded-2xl flex-row items-center justify-center ${
              createPatientMutation.isPending ? 'bg-slate-300' : 'bg-sky-600'
            }`}
            activeOpacity={0.85}
          >
            <Text className="text-white text-base font-extrabold">
              {createPatientMutation.isPending ? 'Đang tạo...' : 'Lưu'}
            </Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </FormProvider>
  );
}
