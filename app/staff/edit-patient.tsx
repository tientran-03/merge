import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Heart } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Controller, FormProvider, useForm, type Resolver } from 'react-hook-form';
import { ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  FormDatePicker,
  FormInput,
  FormNumericInput,
  FormSelect,
  FormTextarea,
} from '@/components/form';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import {
  editPatientFullDefaultValues,
  editPatientFullSchema,
  getFirstPatientFormErrorMessage,
  GENDER_OPTIONS,
  type EditPatientFullFormData,
} from '@/lib/schemas/patient-schemas';
import { normalizeVnMobileDigits } from '@/lib/schemas/patient-field-rules';
import { sanitizePatientNameInput } from '@/lib/specify-patient-input-formatters';
import {
  mergeAddressDetailWithAdmin,
  splitAddressDetailAndAdmin,
} from '@/services/addressService';
import {
  patientClinicalService,
  type PatientClinicalResponse,
} from '@/services/patientClinicalService';
import { patientService, type PatientResponse } from '@/services/patientService';

const formatDateForInput = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

function phoneSuffixForDisplay(stored: string): string {
  const s = normalizeVnMobileDigits(stored);
  return s.startsWith('0') ? s.slice(1) : s;
}

function storedFromPlus84Suffix(suffix: string): string {
  const d = suffix.replace(/\D/g, '').slice(0, 9);
  return d ? `0${d}` : '';
}

export default function EditPatientScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const queryClient = useQueryClient();
  const addressAdminTailRef = useRef<[string, string, string] | null>(null);
  const clinicalRecordIdRef = useRef<string | null>(null);
  const [addressHasAdminTail, setAddressHasAdminTail] = useState(false);

  const { data: patientResponse, isLoading, isError } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientService.getById(patientId!),
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: clinicalResponse } = useQuery({
    queryKey: ['patient-clinical', patientId],
    queryFn: () => patientClinicalService.getByPatientId(patientId!),
    enabled: !!patientId,
  });

  const patient =
    patientResponse?.success && patientResponse.data ? patientResponse.data : null;

  const methods = useForm<EditPatientFullFormData>({
    resolver: zodResolver(editPatientFullSchema) as Resolver<EditPatientFullFormData>,
    mode: 'onTouched',
    defaultValues: editPatientFullDefaultValues,
  });

  useEffect(() => {
    if (!patient) return;
    const p = patient as PatientResponse & Record<string, unknown>;
    const gender = (p.gender || p.Gender)?.toString?.()?.toLowerCase?.();
    const normalizedGender = gender === 'male' || gender === 'female' ? gender : undefined;
    const fullAddr = (p.patientAddress ?? p.patient_address ?? p.address ?? '') as string;
    const { detail, adminTail } = splitAddressDetailAndAdmin(fullAddr);
    addressAdminTailRef.current = adminTail;
    setAddressHasAdminTail(adminTail != null);

    const c =
      clinicalResponse?.success && clinicalResponse.data
        ? (clinicalResponse.data as PatientClinicalResponse)
        : null;
    clinicalRecordIdRef.current = c ? (c.id ?? c.patientClinicalId ?? null) : null;

    const rawPhone = String(p.patientPhone ?? p.phone ?? '');
    const rawContactPhone = String(p.patientContactPhone ?? p.patient_contact_phone ?? '').trim();

    methods.reset({
      patientId: (p.patientId ?? p.patientCode ?? '') as string,
      patientName: (p.patientName ?? p.name ?? '') as string,
      patientPhone: rawPhone ? normalizeVnMobileDigits(rawPhone) : '',
      patientEmail: (p.patientEmail ?? p.patient_email ?? p.email ?? '') as string,
      patientDob: formatDateForInput((p.patientDob ?? p.patient_dob ?? p.dateOfBirth) as string),
      gender: normalizedGender,
      patientJob: (p.patientJob ?? p.patient_job ?? '') as string,
      patientContactName: (p.patientContactName ?? p.patient_contact_name ?? '') as string,
      patientContactPhone: rawContactPhone ? normalizeVnMobileDigits(rawContactPhone) : '',
      patientAddress: detail,
      hospitalId: (p.hospitalId ?? p.hospital_id ?? '') as string,
      patientHeight: c?.patientHeight ?? undefined,
      patientWeight: c?.patientWeight ?? undefined,
      patientHistory: c?.patientHistory ?? '',
      familyHistory: c?.familyHistory ?? '',
      medicalHistory: c?.medicalHistory ?? '',
      acuteDisease: c?.acuteDisease ?? '',
      chronicDisease: c?.chronicDisease ?? '',
      medicalUsingInput: (c?.medicalUsing ?? []).join('\n'),
      toxicExposure: c?.toxicExposure ?? '',
    });
  }, [patient, clinicalResponse, methods]);

  const saveMutation = useMutation({
    mutationFn: async (data: EditPatientFullFormData) => {
      const submitData = {
        patientId: data.patientId,
        patientName: data.patientName,
        patientPhone: data.patientPhone,
        patientDob: data.patientDob ? new Date(data.patientDob).toISOString() : null,
        gender: data.gender || null,
        patientEmail: data.patientEmail?.trim() || null,
        patientJob: data.patientJob?.trim() || null,
        patientContactName: data.patientContactName?.trim() || null,
        patientContactPhone: data.patientContactPhone?.trim() || null,
        patientAddress:
          mergeAddressDetailWithAdmin(
            data.patientAddress?.trim() || '',
            addressAdminTailRef.current
          ).trim() || null,
        hospitalId: data.hospitalId?.trim() || undefined,
      };
      const response = await patientService.update(patientId!, submitData);
      if (!response.success) {
        throw new Error(response.message || response.error || 'Không thể cập nhật bệnh nhân');
      }

      const hasClinical =
        (data.patientHistory && data.patientHistory.trim()) ||
        (data.familyHistory && data.familyHistory.trim()) ||
        (data.medicalHistory && data.medicalHistory.trim()) ||
        (data.acuteDisease && data.acuteDisease.trim()) ||
        (data.chronicDisease && data.chronicDisease.trim()) ||
        (data.toxicExposure && data.toxicExposure.trim()) ||
        (data.medicalUsingInput && data.medicalUsingInput.trim()) ||
        data.patientHeight != null ||
        data.patientWeight != null;

      if (hasClinical) {
        const medicalUsing = data.medicalUsingInput
          ? data.medicalUsingInput
              .split('\n')
              .map(s => s.trim())
              .filter(Boolean)
          : undefined;
        const clinicalPayload = {
          patientId: patientId!,
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

        const cid = clinicalRecordIdRef.current;
        if (cid) {
          const cr = await patientClinicalService.update(cid, clinicalPayload);
          if (!cr.success) {
            throw new Error(cr.error || cr.message || 'Không thể cập nhật thông tin lâm sàng');
          }
        } else {
          const cr = await patientClinicalService.create(clinicalPayload);
          if (!cr.success) {
            throw new Error(cr.error || cr.message || 'Không thể tạo thông tin lâm sàng');
          }
          const created = cr.data as PatientClinicalResponse | undefined;
          clinicalRecordIdRef.current = created?.id ?? created?.patientClinicalId ?? null;
        }
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-clinical', patientId] });
      presentFeedbackSuccess({
        title: 'Thành công',
        message: 'Bệnh nhân đã được cập nhật thành công',
        onAfterClose: () => router.back(),
      });
    },
    onError: (error: any) => {
      presentFeedbackError({
        title: 'Lỗi cập nhật',
        message: error?.message || 'Không thể cập nhật bệnh nhân. Vui lòng thử lại.',
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
    saveMutation.mutate(methods.getValues());
  };

  if (isLoading && !patient) {
    return (
      <View className="flex-1 bg-sky-50">
        <View className="pb-3 px-4 bg-white border-b border-sky-100">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-xl bg-slate-200 mr-3" />
            <View className="flex-1">
              <View className="h-5 w-40 bg-slate-200 rounded mb-1" />
              <View className="h-3 w-24 bg-slate-100 rounded" />
            </View>
          </View>
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          <View className="bg-white rounded-2xl border border-sky-100 p-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
              <View key={i} className="mb-4">
                <View className="h-3 w-20 bg-slate-100 rounded mb-2" />
                <View className="h-12 bg-slate-100 rounded-2xl" />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (isError || !patient) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 px-6">
        <Text className="text-slate-600 text-center font-semibold">
          Không tìm thấy thông tin bệnh nhân
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 bg-sky-600 rounded-2xl"
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold">Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
              <Text className="text-slate-900 text-lg font-extrabold">Sửa thông tin bệnh nhân</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Cập nhật hồ sơ & lâm sàng</Text>
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-white rounded-2xl border border-sky-100 p-4">
            <FormInput name="patientId" label="Mã bệnh nhân" required placeholder="" editable={false} />

            <FormInput
              name="patientName"
              label="Tên bệnh nhân"
              required
              placeholder="Nhập tên bệnh nhân"
              formatter={sanitizePatientNameInput}
            />

            <View className="mb-4">
              <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
                Số điện thoại <Text className="text-red-500">*</Text>
              </Text>
              <Controller
                control={methods.control}
                name="patientPhone"
                render={({ field: { onChange, value } }) => (
                  <View
                    className={`bg-white rounded-2xl border flex-row items-center overflow-hidden ${
                      methods.formState.errors.patientPhone ? 'border-red-400' : 'border-slate-200'
                    }`}
                  >
                    <Text className="pl-4 pr-1 text-[14px] font-bold text-slate-600">+84</Text>
                    <TextInput
                      value={phoneSuffixForDisplay(String(value || ''))}
                      onChangeText={v => {
                        const digits = v.replace(/\D/g, '');
                        if (digits.startsWith('0')) {
                          methods.setError('patientPhone', {
                            type: 'manual',
                            message: 'Sau +84 không nhập số 0 đầu. Ví dụ: +84 339258608',
                          });
                          return;
                        }
                        methods.clearErrors('patientPhone');
                        onChange(storedFromPlus84Suffix(digits));
                      }}
                      keyboardType="phone-pad"
                      maxLength={9}
                      placeholder="912345678"
                      className="flex-1 py-3.5 pr-4 text-[14px] font-bold text-slate-800"
                    />
                  </View>
                )}
              />
              {methods.formState.errors.patientPhone?.message ? (
                <Text className="text-[11px] text-red-500 mt-1">
                  {String(methods.formState.errors.patientPhone.message)}
                </Text>
              ) : (
                <Text className="text-[11px] text-slate-500 mt-1">
                  Nhập 9 số sau +84, không nhập số 0 đầu.
                </Text>
              )}
            </View>

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
              getLabel={o => o.label}
              getValue={o => o.value}
              placeholder="Chọn giới tính"
              modalTitle="Chọn giới tính"
            />

            <FormInput name="patientJob" label="Nghề nghiệp" placeholder="Tùy chọn" />

            <FormInput name="patientContactName" label="Tên người liên hệ" placeholder="Tùy chọn" />

            <View className="mb-4">
              <Text className="text-[13px] font-extrabold text-slate-700 mb-2">SĐT người liên hệ</Text>
              <Controller
                control={methods.control}
                name="patientContactPhone"
                render={({ field: { onChange, value } }) => (
                  <View
                    className={`bg-white rounded-2xl border flex-row items-center overflow-hidden ${
                      methods.formState.errors.patientContactPhone ? 'border-red-400' : 'border-slate-200'
                    }`}
                  >
                    <Text className="pl-4 pr-1 text-[14px] font-bold text-slate-600">+84</Text>
                    <TextInput
                      value={phoneSuffixForDisplay(String(value || ''))}
                      onChangeText={v => {
                        const digits = v.replace(/\D/g, '');
                        if (digits.startsWith('0')) {
                          methods.setError('patientContactPhone', {
                            type: 'manual',
                            message: 'Sau +84 không nhập số 0 đầu',
                          });
                          return;
                        }
                        methods.clearErrors('patientContactPhone');
                        onChange(storedFromPlus84Suffix(digits));
                      }}
                      keyboardType="phone-pad"
                      maxLength={9}
                      placeholder="(tùy chọn)"
                      className="flex-1 py-3.5 pr-4 text-[14px] font-bold text-slate-800"
                    />
                  </View>
                )}
              />
              {methods.formState.errors.patientContactPhone?.message ? (
                <Text className="text-[11px] text-red-500 mt-1">
                  {String(methods.formState.errors.patientContactPhone.message)}
                </Text>
              ) : (
                <Text className="text-[11px] text-slate-500 mt-1">
                  Để trống hoặc nhập 9 số sau +84, không nhập số 0 đầu.
                </Text>
              )}
            </View>

            <FormTextarea
              name="patientAddress"
              label="Địa chỉ"
              placeholder="Ví dụ: Tổ 36, ngõ..., số nhà, đường..."
              helperText={
                addressHasAdminTail
                  ? 'Chỉnh sửa phần số nhà / tổ / ngõ. Phường, quận, thành phố giữ theo hồ sơ khi lưu.'
                  : 'Nhập địa chỉ đầy đủ'
              }
              minHeight={100}
            />
          </View>

          <View className="bg-white rounded-2xl border border-rose-100 p-4 mt-4">
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
                  placeholder="cm"
                />
              </View>
              <View className="flex-1">
                <FormNumericInput
                  name="patientWeight"
                  label="Cân nặng (kg)"
                  type="decimal"
                  placeholder="kg"
                />
              </View>
            </View>

            <FormTextarea name="patientHistory" label="Tiền sử bản thân" minHeight={80} />
            <FormTextarea name="familyHistory" label="Tiền sử gia đình" minHeight={80} />
            <FormTextarea name="medicalHistory" label="Tiền sử y tế" minHeight={80} />
            <FormTextarea name="acuteDisease" label="Bệnh lý cấp tính" minHeight={80} />
            <FormTextarea name="chronicDisease" label="Bệnh mãn tính" minHeight={80} />
            <FormTextarea
              name="medicalUsingInput"
              label="Thuốc đang sử dụng"
              placeholder="Mỗi thuốc một dòng"
              minHeight={80}
            />
            <FormTextarea name="toxicExposure" label="Phơi nhiễm độc hại" minHeight={80} />
          </View>
        </ScrollView>

        <View className="p-4 bg-white border-t border-sky-100">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={saveMutation.isPending}
            className={`p-4 rounded-2xl flex-row items-center justify-center ${
              saveMutation.isPending ? 'bg-slate-300' : 'bg-sky-600'
            }`}
            activeOpacity={0.85}
          >
            <Text className="text-white text-base font-extrabold">
              {saveMutation.isPending ? 'Đang cập nhật...' : 'Cập nhật'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </FormProvider>
  );
}
