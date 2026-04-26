import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Step1Patient,
  Step2Clinical,
  Step3ServiceTest,
  Step4GeneticResults,
  Step5ServiceType,
  Step6Note,
} from '@/components/specify/create-specify-steps';
import { useAuth } from '@/contexts/AuthContext';
import { usePrefetchProvinces } from '@/hooks/useAddressQueries';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import {
  specifyFormDefaultValues,
  specifyFormSchema,
  type SpecifyFormData,
} from '@/lib/schemas/specify-form-schema';
import { getApiResponseData, getApiResponseSingle } from '@/lib/types/api-types';
import { diseaseService } from '@/services/diseaseService';
import { doctorService, type DoctorResponse } from '@/services/doctorService';
import { embryoService } from '@/services/embryoService';
import { genomeTestService, type GenomeTestResponse } from '@/services/genomeTestService';
import { hospitalService, type HospitalResponse } from '@/services/hospitalService';
import { patientClinicalService } from '@/services/patientClinicalService';
import { patientService } from '@/services/patientService';
import { reproductionService } from '@/services/reproductionService';
import { serviceEntityService, type ServiceEntityResponse } from '@/services/serviceEntityService';
import {
  specifyVoteTestService,
  type SpecifyVoteTestRequest,
} from '@/services/specifyVoteTestService';

const TOTAL_STEPS = 6;
const STEP_TITLES = [
  'Thông tin bệnh nhân',
  'Thông tin lâm sàng',
  'Loại dịch vụ và xét nghiệm',
  'Thông tin nhóm xét nghiệm',
  'Kết quả xét nghiệm di truyền',
  'Ghi chú',
];

const generatePatientId = () => `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function resolvePatientIdFromResponse(p: unknown): string {
  if (!p || typeof p !== 'object') return '';
  const o = p as Record<string, unknown>;
  const raw = o.patientId ?? o.id ?? o.uuid;
  return raw != null && String(raw).trim() !== '' ? String(raw).trim() : '';
}
function patientGenderForApi(g: SpecifyFormData['patientGender']): 'male' | 'female' | null {
  if (g === 'male' || g === 'female') return g;
  return null;
}

function Stepper({
  totalSteps,
  currentStep,
  onStepPress,
}: {
  totalSteps: number;
  currentStep: number;
  onStepPress?: (step: number) => void;
}) {
  return (
    <View className="mt-4">
      <View className="absolute left-0 right-0 top-[14px] h-[2px] bg-slate-200" />
      <View
        className="absolute left-0 top-[14px] h-[2px] bg-sky-600"
        style={{
          width: totalSteps <= 1 ? '0%' : `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
        }}
      />
      <View className="flex-row items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const circleBg = isDone ? 'bg-sky-600' : 'bg-white';
          const circleBorder = isDone
            ? 'border-sky-600'
            : isActive
              ? 'border-sky-600'
              : 'border-slate-300';
          const textColor = isDone ? 'text-white' : isActive ? 'text-sky-700' : 'text-slate-500';

          return (
            <TouchableOpacity
              key={stepNum}
              activeOpacity={onStepPress && isDone ? 0.7 : 1}
              onPress={() => onStepPress && isDone && onStepPress(stepNum)}
              disabled={!onStepPress || !isDone}
              className="items-center"
            >
              <View
                className={`w-8 h-8 rounded-full items-center justify-center border-2 ${circleBg} ${circleBorder}`}
              >
                {isDone ? (
                  <Check size={16} color="#fff" strokeWidth={3} />
                ) : (
                  <Text className={`text-[12px] font-extrabold ${textColor}`}>{stepNum}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export type CreateSpecifyWizardVariant = 'customer' | 'staff';

export interface CreateSpecifyWizardScreenProps {
  variant: CreateSpecifyWizardVariant;
}

export function CreateSpecifyWizardScreen({ variant }: CreateSpecifyWizardScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isStaff = variant === 'staff';
  const { user, isLoading: isAuthLoading, canCreatePrescriptionSlip } = useAuth();
  const insets = useSafeAreaInsets();
  usePrefetchProvinces();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hospitalId = user?.hospitalId != null ? String(user.hospitalId) : '';

  const methods = useForm<SpecifyFormData>({
    resolver: zodResolver(specifyFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: specifyFormDefaultValues,
  });

  const { getValues, setValue, trigger } = methods;

  useEffect(() => {
    if (!isStaff) return;
    if (isAuthLoading) return;
    if (!user) {
      router.back();
      return;
    }
    if (!canCreatePrescriptionSlip()) {
      presentFeedbackError({
        title: 'Không có quyền',
        message:
          'Bạn không có quyền tạo phiếu chỉ định. Vui lòng liên hệ quản trị viên.',
        onAfterClose: () => router.back(),
      });
    }
  }, [isStaff, user, isAuthLoading, canCreatePrescriptionSlip, router]);

  React.useEffect(() => {
    if (hospitalId) setValue('hospitalId', hospitalId);
  }, [hospitalId, setValue]);


  const { data: servicesResponse } = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceEntityService.getAll(),
  });

  const { data: doctorByUserResponse } = useQuery({
    queryKey: ['doctor-by-user', user?.id],
    queryFn: () => doctorService.getByUserId(user!.id),
    enabled: !!user?.id,
  });

  const { data: doctorsByHospitalResponse } = useQuery({
    queryKey: ['doctors-by-hospital', hospitalId],
    queryFn: () => doctorService.getByHospitalId(hospitalId),
    enabled: !!hospitalId,
  });

  const { data: doctorsAllResponse } = useQuery({
    queryKey: ['doctors-all'],
    queryFn: () => doctorService.getAll(),
    enabled: isStaff || (!user?.id && !hospitalId),
  });

  const { data: hospitalsResponse } = useQuery({
    queryKey: ['hospitals'],
    queryFn: () => hospitalService.getAll(),
  });

  const serviceId = methods.watch('serviceId');
  const { data: genomeTestsResponse } = useQuery({
    queryKey: ['genome-tests', serviceId],
    queryFn: () => genomeTestService.getByServiceId(serviceId!),
    enabled: !!serviceId,
  });

  const services = useMemo(() => getApiResponseData<ServiceEntityResponse>(servicesResponse) || [], [servicesResponse]);
  const currentUserDoctor = getApiResponseSingle<DoctorResponse>(doctorByUserResponse);
  const doctorsByHospital = getApiResponseData<DoctorResponse>(doctorsByHospitalResponse) || [];
  const doctorsAll = getApiResponseData<DoctorResponse>(doctorsAllResponse) || [];
  const doctors = useMemo(() => {
    if (!isStaff && currentUserDoctor) return [currentUserDoctor];
    if (doctorsByHospital.length > 0) return doctorsByHospital;
    return doctorsAll;
  }, [isStaff, currentUserDoctor, doctorsByHospital, doctorsAll]);

  React.useEffect(() => {
    if (isStaff) return;
    if (currentUserDoctor) {
      setValue('doctorId', currentUserDoctor.doctorId);
      if (currentUserDoctor.hospitalId) setValue('hospitalId', currentUserDoctor.hospitalId);
    }
  }, [isStaff, currentUserDoctor, setValue]);
  const hospitals = useMemo(
    () => getApiResponseData<HospitalResponse>(hospitalsResponse) || [],
    [hospitalsResponse]
  );
  const genomeTests = useMemo(
    () => getApiResponseData<GenomeTestResponse>(genomeTestsResponse) || [],
    [genomeTestsResponse]
  );

  const stackScreenOptions = useMemo(() => ({ headerShown: false }), []);

  const createSpecifyMutation = useMutation({
    mutationFn: async (formData: SpecifyFormData) => {
      let patientId = formData.selectedPatientId;

      const clinicalPayload = {
        patientId: '',
        patientHeight:
          formData.patientHeight != null && formData.patientHeight !== ''
            ? Number(formData.patientHeight)
            : undefined,
        patientWeight:
          formData.patientWeight != null && formData.patientWeight !== ''
            ? Number(formData.patientWeight)
            : undefined,
        patientHistory: formData.patientHistory?.trim() || undefined,
        familyHistory: formData.familyHistory?.trim() || undefined,
        medicalHistory: formData.medicalHistory?.trim() || undefined,
        medicalUsing: formData.medicalUsing
          ? formData.medicalUsing.split(',').map((m) => m.trim()).filter(Boolean)
          : undefined,
        chronicDisease: formData.chronicDisease?.trim() || undefined,
        acuteDisease: formData.acuteDisease?.trim() || undefined,
        toxicExposure: formData.toxicExposure?.trim() || undefined,
      };

      if (formData.isNewPatient) {
        const patientPayload = {
          patientId: generatePatientId(),
          patientName: formData.patientName!,
          patientPhone: formData.patientPhone!,
          patientDob: formData.patientDob ? new Date(formData.patientDob).toISOString() : null,
          gender: patientGenderForApi(formData.patientGender),
          patientEmail: formData.patientEmail || null,
          patientJob: formData.patientJob?.trim() || null,
          patientContactName: formData.patientContactName?.trim() || null,
          patientContactPhone: formData.patientContactPhone?.trim() || null,
          patientAddress: formData.patientAddress?.trim() || null,
          hospitalId: formData.hospitalId || hospitalId || undefined,
        };

        const patientRes = await patientService.create(patientPayload);
        if (!patientRes.success) {
          throw new Error(patientRes.error || patientRes.message || 'Không thể tạo bệnh nhân');
        }
        patientId = (patientRes.data as any)?.patientId ?? patientPayload.patientId;
      } else {
        if (!formData.selectedPatientId) {
          throw new Error('Vui lòng chọn bệnh nhân');
        }
        const updateRes = await patientService.update(formData.selectedPatientId, {
          patientId: formData.selectedPatientId,
          patientName: formData.patientName!,
          patientPhone: formData.patientPhone!,
          patientDob: formData.patientDob ? new Date(formData.patientDob).toISOString() : undefined,
          gender: patientGenderForApi(formData.patientGender) ?? undefined,
          patientEmail: formData.patientEmail || undefined,
          patientJob: formData.patientJob?.trim() || undefined,
          patientContactName: formData.patientContactName?.trim() || undefined,
          patientContactPhone: formData.patientContactPhone?.trim() || undefined,
          patientAddress: formData.patientAddress?.trim() || undefined,
        });
        if (!updateRes.success) {
          throw new Error(updateRes.error || updateRes.message || 'Không thể cập nhật bệnh nhân');
        }
        patientId = formData.selectedPatientId;
      }

      if (!patientId || !formData.serviceId || !formData.genomeTestId) {
        throw new Error('Thiếu thông tin bắt buộc: bệnh nhân, loại dịch vụ, xét nghiệm');
      }

      clinicalPayload.patientId = patientId;
      if (formData.patientClinicalId) {
        const clinicalRes = await patientClinicalService.update(
          formData.patientClinicalId,
          clinicalPayload
        );
        if (!clinicalRes.success) {
          throw new Error(clinicalRes.error || clinicalRes.message || 'Không thể cập nhật lâm sàng');
        }
      } else {
        const clinicalRes = await patientClinicalService.create(clinicalPayload);
        if (!clinicalRes.success) {
          throw new Error(clinicalRes.error || clinicalRes.message || 'Không thể lưu thông tin lâm sàng');
        }
      }

      const svcId = formData.serviceId;

      if (formData.serviceType === 'reproduction') {
        const repRes = await reproductionService.create({
          serviceId: svcId,
          patientId,
          fetusesNumber: formData.fetusesNumber ? parseInt(formData.fetusesNumber, 10) : undefined,
          fetusesWeek: formData.fetusesWeek ? parseInt(formData.fetusesWeek, 10) : undefined,
          fetusesDay: formData.fetusesDay ? parseInt(formData.fetusesDay, 10) : undefined,
          ultrasoundDay: formData.ultrasoundDay || undefined,
          headRumpLength: formData.headRumpLength ? parseFloat(formData.headRumpLength) : undefined,
          neckLength: formData.neckLength ? parseFloat(formData.neckLength) : undefined,
          combinedTestResult: formData.combinedTestResult?.trim() || undefined,
          ultrasoundResult: formData.ultrasoundResult?.trim() || undefined,
        });
        if (!repRes.success) {
          throw new Error(repRes.error || 'Không thể lưu thông tin nhóm sản');
        }
      } else if (formData.serviceType === 'embryo') {
        const embRes = await embryoService.create({
          serviceId: svcId,
          patientId,
          biospy: formData.biospy?.trim() || undefined,
          biospyDate: formData.biospyDate || undefined,
          cellContainingSolution: formData.cellContainingSolution?.trim() || undefined,
          embryoCreate: formData.embryoCreate ? parseInt(formData.embryoCreate, 10) : undefined,
          embryoStatus: formData.embryoStatus?.trim() || undefined,
          morphologicalAssessment: formData.morphologicalAssessment?.trim() || undefined,
          cellNucleus: formData.cellNucleus === true,
          negativeControl: formData.negativeControl?.trim() || undefined,
        });
        if (!embRes.success) {
          throw new Error(embRes.error || 'Không thể lưu thông tin nhóm phôi');
        }
      } else if (formData.serviceType === 'disease') {
        const disRes = await diseaseService.create({
          serviceId: svcId,
          patientId,
          symptom: formData.symptom?.trim() || undefined,
          diagnose: formData.diagnose?.trim() || undefined,
          diagnoseImage: formData.diagnoseImage?.trim() || undefined,
          testRelated: formData.testRelated?.trim() || undefined,
          treatmentMethods: formData.treatmentMethods?.trim() || undefined,
          treatmentTimeDay: formData.treatmentTimeDay
            ? parseInt(formData.treatmentTimeDay, 10)
            : undefined,
          drugResistance: formData.drugResistance?.trim() || undefined,
          relapse: formData.relapse?.trim() || undefined,
        });
        if (!disRes.success) {
          throw new Error(disRes.error || 'Không thể lưu thông tin nhóm bệnh lý');
        }
      }

      const specifyReq: SpecifyVoteTestRequest = {
        serviceId: formData.serviceId,
        patientId,
        genomeTestId: formData.genomeTestId,
        hospitalId: formData.hospitalId || hospitalId || undefined,
        doctorId: formData.doctorId?.trim() || undefined,
        samplingSite: formData.samplingSite?.trim() || undefined,
        sampleCollectDate: formData.sampleCollectDate
          ? new Date(formData.sampleCollectDate).toISOString()
          : undefined,
        embryoNumber:
          formData.embryoNumber != null && formData.embryoNumber !== ''
            ? Number(formData.embryoNumber)
            : undefined,
        geneticTestResults: formData.geneticTestResults?.trim() || undefined,
        geneticTestResultsRelationship:
          formData.geneticTestResultsRelationship?.trim() || undefined,
        specifyNote: formData.specifyNote?.trim() || undefined,
        sendEmailPatient: formData.sendEmailPatient ?? false,
      };

      const specifyRes = await specifyVoteTestService.create(specifyReq);
      if (!specifyRes.success || !specifyRes.data) {
        throw new Error(specifyRes.error || 'Không thể tạo phiếu xét nghiệm');
      }

      return specifyRes.data.specifyVoteID;
    },
    onError: (error: any) => {
      presentFeedbackError({
        title: 'Lỗi tạo phiếu',
        message: error?.message || 'Không thể tạo phiếu xét nghiệm. Vui lòng thử lại.',
      });
    },
  });

  const validateStep = async (step: number): Promise<boolean> => {
    const data = getValues();

    switch (step) {
      case 1: {
        const fields =
          data.isNewPatient === true
            ? ([
              'patientPhone',
              'patientName',
              'patientDob',
              'patientGender',
              'patientEmail',
              'patientJob',
              'patientContactName',
              'patientContactPhone',
              'patientAddress',
            ] as const)
            : ([
              'patientPhone',
              'patientName',
              'patientDob',
              'patientGender',
              'patientEmail',
              'patientJob',
              'patientContactName',
              'patientContactPhone',
            ] as const);
        const valid = await trigger([...fields]);
        if (!valid) {
          const errors = methods.formState.errors;
          const firstError =
            errors.patientPhone?.message ||
            errors.patientName?.message ||
            errors.patientDob?.message ||
            errors.patientGender?.message ||
            errors.patientEmail?.message ||
            errors.patientContactName?.message ||
            errors.patientContactPhone?.message ||
            errors.patientAddress?.message ||
            'Vui lòng kiểm tra lại thông tin bệnh nhân';
          presentFeedbackError({ title: 'Lỗi', message: String(firstError) });
          return false;
        }
        const emailTrim = (data.patientEmail || '').trim();
        if (emailTrim) {
          const emailRes = await patientService.getByEmail(emailTrim);
          if (emailRes.success && emailRes.data) {
            const foundId = resolvePatientIdFromResponse(emailRes.data);
            const selected = String(data.selectedPatientId || '').trim();
            const samePatient = !!foundId && !!selected && foundId === selected;
            if (!samePatient) {
              methods.setError('patientEmail', { message: 'Email đã được sử dụng trong hệ thống' });
              presentFeedbackError({
                title: 'Lỗi',
                message: 'Email đã được sử dụng trong hệ thống',
              });
              return false;
            }
          }
        }
        if (!data.isNewPatient && !data.selectedPatientId) {
          presentFeedbackError({ title: 'Lỗi', message: 'Vui lòng chọn bệnh nhân' });
          return false;
        }
        if (data.isNewPatient) {
          if (!(data.patientAddress || '').trim()) {
            presentFeedbackError({ title: 'Lỗi', message: 'Vui lòng nhập / chọn địa chỉ' });
            return false;
          }
          const parts = (data.patientAddress || '')
            .split(',')
            .map(p => p.trim())
            .filter(Boolean);
          if (parts.length < 3) {
            presentFeedbackError({
              title: 'Lỗi',
              message: 'Vui lòng chọn đủ tỉnh/thành phố, quận/huyện và phường/xã',
            });
            return false;
          }
        }
        return true;
      }
      case 2: {
        const fields = [
          'patientHeight',
          'patientWeight',
          'patientHistory',
          'familyHistory',
          'medicalHistory',
          'medicalUsing',
          'chronicDisease',
          'acuteDisease',
          'toxicExposure',
        ] as const;
        const valid = await trigger(fields);
        if (!valid) {
          const errors = methods.formState.errors;
          const firstError =
            errors.patientHeight?.message ||
            errors.patientWeight?.message ||
            errors.patientHistory?.message ||
            errors.familyHistory?.message ||
            errors.medicalHistory?.message ||
            errors.medicalUsing?.message ||
            errors.chronicDisease?.message ||
            errors.acuteDisease?.message ||
            errors.toxicExposure?.message ||
            'Vui lòng kiểm tra lại thông tin lâm sàng';
          presentFeedbackError({ title: 'Lỗi', message: String(firstError) });
          return false;
        }
        return true;
      }
      case 3:
        if (!data.serviceId) {
          presentFeedbackError({ title: 'Lỗi', message: 'Vui lòng chọn loại dịch vụ' });
          return false;
        }
        if (!data.genomeTestId) {
          presentFeedbackError({ title: 'Lỗi', message: 'Vui lòng chọn xét nghiệm' });
          return false;
        }
        if (isStaff && !(data.doctorId || '').trim()) {
          presentFeedbackError({ title: 'Lỗi', message: 'Vui lòng chọn bác sĩ chỉ định' });
          return false;
        }
        return true;
      case 4: {
        const st = data.serviceType;
        const fields: (keyof SpecifyFormData)[] = [];
        if (st === 'reproduction') {
          fields.push(
            'fetusesNumber',
            'fetusesWeek',
            'fetusesDay',
            'ultrasoundDay',
            'headRumpLength',
            'neckLength',
            'combinedTestResult',
            'ultrasoundResult'
          );
        } else if (st === 'embryo') {
          fields.push(
            'biospy',
            'biospyDate',
            'cellContainingSolution',
            'embryoCreate',
            'embryoStatus',
            'morphologicalAssessment',
            'negativeControl'
          );
        } else if (st === 'disease') {
          fields.push(
            'symptom',
            'diagnose',
            'diagnoseImage',
            'testRelated',
            'treatmentMethods',
            'treatmentTimeDay',
            'drugResistance',
            'relapse'
          );
        } else {
          presentFeedbackError({
            title: 'Lỗi',
            message: 'Chưa xác định nhóm xét nghiệm. Vui lòng chọn loại dịch vụ ở bước trước.',
          });
          return false;
        }
        const valid = await trigger(fields as any);
        if (!valid) {
          const err = methods.formState.errors;
          for (const f of fields) {
            const e = err[f];
            if (e?.message) {
              presentFeedbackError({ title: 'Thông tin không hợp lệ', message: String(e.message) });
              return false;
            }
          }
          presentFeedbackError({
            title: 'Lỗi',
            message: 'Vui lòng kiểm tra lại thông tin nhóm xét nghiệm (các ô có gạch đỏ).',
          });
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!(await validateStep(currentStep))) return;

    if (currentStep === TOTAL_STEPS) {
      const formData = getValues();
      if (formData.sendEmailPatient && !(formData.patientEmail || '').trim()) {
        presentFeedbackError({
          title: 'Lỗi',
          message: 'Vui lòng nhập email bệnh nhân để gửi thông báo',
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const specifyId = await createSpecifyMutation.mutateAsync(formData);
        queryClient.invalidateQueries({ queryKey: ['customer-specifies'] });
        queryClient.invalidateQueries({ queryKey: ['specify-vote-tests'] });
        const afterPath = isStaff ? '/staff/prescription-slips' : '/customer/specifies';
        presentFeedbackSuccess({
          title: 'Tạo phiếu thành công',
          message: `Phiếu xét nghiệm ${specifyId} đã được tạo thành công.`,
          onAfterClose: () => router.replace(afterPath),
        });
      } catch {
        // Error handled in mutation
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentStep(p => Math.min(p + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else {
      setCurrentStep(p => Math.max(p - 1, 1));
    }
  };

  const handlePatientSelect = async (patientId: string) => {
    try {
      const clinicalRes = await patientClinicalService.getByPatientId(patientId);
      const clinical = clinicalRes.data;
      if (clinical) {
        setValue(
          'patientClinicalId',
          (clinical as any).id ?? (clinical as any).patientClinicalId ?? ''
        );
        setValue('patientHeight', clinical.patientHeight?.toString() ?? '');
        setValue('patientWeight', clinical.patientWeight?.toString() ?? '');
        setValue('patientHistory', clinical.patientHistory ?? '');
        setValue('familyHistory', clinical.familyHistory ?? '');
        setValue('medicalHistory', (clinical as any).medicalHistory ?? '');
        setValue('chronicDisease', clinical.chronicDisease ?? '');
        setValue('acuteDisease', clinical.acuteDisease ?? '');
        setValue('toxicExposure', (clinical as any).toxicExposure ?? '');
        setValue(
          'medicalUsing',
          Array.isArray((clinical as any).medicalUsing)
            ? (clinical as any).medicalUsing.join(', ')
            : ''
        );
      } else {
        setValue('patientClinicalId', '');
        setValue('patientHeight', '');
        setValue('patientWeight', '');
        setValue('patientHistory', '');
        setValue('familyHistory', '');
        setValue('medicalHistory', '');
        setValue('chronicDisease', '');
        setValue('acuteDisease', '');
        setValue('toxicExposure', '');
        setValue('medicalUsing', '');
      }
    } catch {
      setValue('patientClinicalId', '');
      setValue('patientHeight', '');
      setValue('patientWeight', '');
      setValue('patientHistory', '');
      setValue('familyHistory', '');
      setValue('medicalHistory', '');
      setValue('chronicDisease', '');
      setValue('acuteDisease', '');
      setValue('toxicExposure', '');
      setValue('medicalUsing', '');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Patient onPatientSelect={handlePatientSelect} />;
      case 2:
        return <Step2Clinical />;
      case 3:
        return (
          <Step3ServiceTest
            services={services}
            genomeTests={genomeTests}
            doctors={doctors}
            hospitals={hospitals}
            isCurrentUserDoctor={!isStaff && !!currentUserDoctor}
          />
        );
      case 4:
        return <Step5ServiceType key={methods.watch('serviceType') || 'none'} services={services} />;
      case 5:
        return <Step4GeneticResults />;
      case 6:
        return <Step6Note />;
      default:
        return null;
    }
  };

  return (
    <FormProvider {...methods}>
      <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
        <Stack.Screen options={stackScreenOptions} />
        <StatusBar barStyle="dark-content" />

        <View className="pb-4 px-5 bg-white border-b border-slate-200">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={handleBack}
              className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-100 items-center justify-center"
              activeOpacity={0.75}
              disabled={isSubmitting}
            >
              <ArrowLeft size={22} color="#0284C7" strokeWidth={2.5} />
            </TouchableOpacity>

            <View className="flex-1 items-center px-3">
              <Text className="text-[15px] font-extrabold text-slate-900" numberOfLines={1}>
                Thêm phiếu xét nghiệm
              </Text>
              <Text className="mt-0.5 text-[11px] font-bold text-slate-500" numberOfLines={1}>
                Hoàn thiện theo từng bước
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.back()}
              className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200"
              activeOpacity={0.75}
              disabled={isSubmitting}
            >
              <Text className="text-sm font-extrabold text-slate-700">Xong</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-white px-5 pt-4 pb-5 border-b border-slate-200">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[12px] font-bold text-slate-500">
                Bước {currentStep}/{TOTAL_STEPS}
              </Text>
              <Text className="mt-1 text-[14px] font-extrabold text-slate-900" numberOfLines={2}>
                {STEP_TITLES[currentStep - 1]}
              </Text>
            </View>
            <View className="px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-100">
              <Text className="text-sm font-extrabold text-sky-700">{currentStep}</Text>
            </View>
          </View>
          <Stepper
            totalSteps={TOTAL_STEPS}
            currentStep={currentStep}
            onStepPress={s => setCurrentStep(s)}
          />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 110 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex-row gap-3"
          style={{ paddingBottom: Math.max(16, insets.bottom) }}
        >
          <TouchableOpacity
            className="flex-1 h-12 rounded-2xl items-center justify-center bg-white border border-slate-200"
            onPress={handleBack}
            activeOpacity={0.8}
            disabled={isSubmitting}
          >
            <Text className="text-[15px] font-extrabold text-slate-700">
              {currentStep === 1 ? 'Huỷ' : 'Quay lại'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 h-12 rounded-2xl items-center justify-center ${isSubmitting ? 'bg-sky-400' : 'bg-sky-600'
              }`}
            onPress={handleNext}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-extrabold text-white">
                {currentStep === TOTAL_STEPS ? 'Hoàn thành' : 'Tiếp theo'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

    </FormProvider>
  );
}
