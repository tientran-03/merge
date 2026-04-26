import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { FormDatePicker, FormInput, FormSelect, FormTextarea } from '@/components/form';
import { SuccessModal } from '@/components/modals';
import { useAuth } from '@/contexts/AuthContext';
import { EMBRYO_NUMBER_OPTIONS, GENDER_OPTIONS } from '@/lib/schemas/order-schemas';
import { getApiResponseData } from '@/lib/types/api-types';
import { diseaseService } from '@/services/diseaseService';
import type { DoctorResponse } from '@/services/doctorService';
import { doctorService } from '@/services/doctorService';
import { embryoService } from '@/services/embryoService';
import { genomeTestService } from '@/services/genomeTestService';
import { patientClinicalService } from '@/services/patientClinicalService';
import { PatientResponse, patientService } from '@/services/patientService';
import { reproductionService } from '@/services/reproductionService';
import { ServiceResponse, serviceService } from '@/services/serviceService';
import { SpecifyVoteTestRequest, specifyVoteTestService } from '@/services/specifyVoteTestService';

type ServiceGroupType = 'reproduction' | 'embryo' | 'disease';

const prescriptionSlipSchema = z.object({
  serviceGroup: z.enum(['reproduction', 'embryo', 'disease']),
  isNewPatient: z.boolean(),
  selectedPatientId: z.string().optional(),
  patientPhone: z
    .string()
    .min(1, 'Vui lòng nhập số điện thoại')
    .regex(/^[0-9]{10,11}$/, 'Số điện thoại phải có 10-11 chữ số'),
  patientName: z.string().min(1, 'Vui lòng nhập tên bệnh nhân'),
  patientDob: z.string().optional(),
  patientGender: z.enum(['male', 'female', 'other']).optional(),
  patientEmail: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  patientJob: z.string().optional(),
  patientContactName: z.string().optional(),
  patientContactPhone: z.string().optional(),
  patientAddress: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  patientHistory: z.string().optional(),
  familyHistory: z.string().optional(),
  medicalHistory: z.string().optional(),
  acuteDisease: z.string().optional(),
  chronicDisease: z.string().optional(),
  medication: z.string().optional(),
  toxicExposure: z.string().optional(),
  geneticTestResult: z.string().optional(),
  geneticTestResultsRelationship: z.string().optional(),
  genomeTestId: z.string().min(1, 'Vui lòng chọn xét nghiệm'),
  embryoNumber: z.string().optional(),
  doctorId: z.string().optional(),
  hospitalId: z.string().optional(),
  samplingSite: z.string().optional(),
  sampleCollectDate: z.string().optional(),
  fetusesNumber: z.string().optional(),
  fetusesWeek: z.string().optional(),
  fetusesDay: z.string().optional(),
  ultrasoundDay: z.string().optional(),
  headRumpLength: z.string().optional(),
  neckLength: z.string().optional(),
  combinedTestResult: z.string().optional(),
  ultrasoundResult: z.string().optional(),
  biospy: z.string().optional(),
  biospyDate: z.string().optional(),
  cellContainingSolution: z.string().optional(),
  embryoCreate: z.string().optional(),
  embryoStatus: z.string().optional(),
  morphologicalAssessment: z.string().optional(),
  cellNucleus: z.boolean().optional(),
  negativeControl: z.string().optional(),
  symptom: z.string().optional(),
  diagnose: z.string().optional(),
  diagnoseImage: z.string().optional(),
  testRelated: z.string().optional(),
  treatmentMethods: z.string().optional(),
  treatmentTimeDay: z.string().optional(),
  drugResistance: z.string().optional(),
  relapse: z.string().optional(),
  specifyNote: z.string().optional(),
  sendEmailPatient: z.boolean().optional(),
});

type PrescriptionSlipFormData = z.infer<typeof prescriptionSlipSchema>;

const defaultValues: PrescriptionSlipFormData = {
  serviceGroup: 'reproduction',
  isNewPatient: true,
  selectedPatientId: '',
  patientPhone: '',
  patientName: '',
  patientDob: '',
  patientGender: undefined,
  patientEmail: '',
  patientJob: '',
  patientContactName: '',
  patientContactPhone: '',
  patientAddress: '',
  height: '',
  weight: '',
  patientHistory: '',
  familyHistory: '',
  medicalHistory: '',
  acuteDisease: '',
  chronicDisease: '',
  medication: '',
  toxicExposure: '',
  geneticTestResult: '',
  geneticTestResultsRelationship: '',
  genomeTestId: '',
  embryoNumber: '',
  doctorId: '',
  hospitalId: '',
  samplingSite: '',
  sampleCollectDate: '',
  fetusesNumber: '',
  fetusesWeek: '',
  fetusesDay: '',
  ultrasoundDay: '',
  headRumpLength: '',
  neckLength: '',
  combinedTestResult: '',
  ultrasoundResult: '',
  biospy: '',
  biospyDate: '',
  cellContainingSolution: '',
  embryoCreate: '',
  embryoStatus: '',
  morphologicalAssessment: '',
  cellNucleus: false,
  negativeControl: '',
  symptom: '',
  diagnose: '',
  diagnoseImage: '',
  testRelated: '',
  treatmentMethods: '',
  treatmentTimeDay: '',
  drugResistance: '',
  relapse: '',
  specifyNote: '',
  sendEmailPatient: false,
};
const formatDateToInput = (dateStr?: string | null | Date | number): string => {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    if (!isNaN(dateStr.getTime())) {
      return dateStr.toISOString().split('T')[0];
    }
    return '';
  }

  if (typeof dateStr === 'number') {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch { }
    return '';
  }

  if (typeof dateStr === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch { }
  }

  return '';
};

const generatePatientId = () => {
  return `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export default function CreatePrescriptionSlipScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading, canCreatePrescriptionSlip } = useAuth();

  console.log('[CreatePrescriptionSlip] Component mounted', {
    hasUser: !!user,
    userRole: user?.role,
    isAuthLoading,
    canCreate: canCreatePrescriptionSlip(),
  });

  useEffect(() => {
    console.log('[CreatePrescriptionSlip] Permission check effect', {
      isAuthLoading,
      hasUser: !!user,
      userRole: user?.role,
    });

    if (isAuthLoading) {
      console.log('[CreatePrescriptionSlip] Auth still loading, skipping permission check');
      return;
    }
    if (!user) {
      console.log('[CreatePrescriptionSlip] No user found, redirecting back');
      router.back();
      return;
    }
    const hasPermission = canCreatePrescriptionSlip();
    console.log('[CreatePrescriptionSlip] Permission check result', {
      hasPermission,
      userRole: user.role,
    });

    if (!hasPermission) {
      console.log('[CreatePrescriptionSlip] No permission, showing alert');
      Alert.alert(
        'Không có quyền',
        'Bạn không có quyền tạo phiếu chỉ định. Vui lòng liên hệ quản trị viên.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    }
  }, [user, isAuthLoading, canCreatePrescriptionSlip]);

  const methods = useForm({
    resolver: zodResolver(prescriptionSlipSchema),
    mode: 'onTouched',
    defaultValues,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientClinicalId, setPatientClinicalId] = useState<string>('');
  const [lastSelectedPatientId, setLastSelectedPatientId] = useState<string>('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { data: servicesResponse, isLoading: isLoadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceService.getAll(),
  });

  const { data: patientsResponse, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
  });

  const { data: doctorsResponse, isLoading: isLoadingDoctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorService.getAll(),
  });

  const services = getApiResponseData<ServiceResponse>(servicesResponse) || [];
  const patients = getApiResponseData<PatientResponse>(patientsResponse) || [];
  const doctors = getApiResponseData<DoctorResponse>(doctorsResponse) || [];

  const serviceGroup = methods.watch('serviceGroup');
  const selectedServiceId = methods.watch('selectedPatientId');
  const isNewPatient = methods.watch('isNewPatient');
  const patientId = methods.watch('selectedPatientId');
  const sendEmailPatient = methods.watch('sendEmailPatient');

  useEffect(() => {
    if (!isNewPatient && patientId && patientId !== lastSelectedPatientId && patients.length > 0) {
      setLastSelectedPatientId(patientId);
      handlePatientSelect(patientId);
    }
  }, [patientId, isNewPatient, lastSelectedPatientId]);

  const getServiceId = () => {
    const serviceMap: Record<ServiceGroupType, string> = {
      reproduction: 'reproduction',
      embryo: 'embryo',
      disease: 'disease',
    };
    const serviceType = serviceMap[serviceGroup];
    const service = services.find(s => s.name === serviceType || s.serviceId === serviceType);
    return service?.serviceId || serviceType;
  };
  const { data: genomeTestsResponse, isLoading: isLoadingGenomeTests } = useQuery({
    queryKey: ['genome-tests', getServiceId()],
    queryFn: () => genomeTestService.getAll(),
    enabled: !!getServiceId() && services.length > 0,
  });

  const genomeTests = getApiResponseData(genomeTestsResponse) || [];
  const filteredGenomeTests = genomeTests.filter((test: any) => {
    const serviceId = getServiceId();
    if (!serviceId) return true;
    return test.service?.serviceId === serviceId || test.service?.name === serviceId;
  });
  const doctorId = methods.watch('doctorId');

  useEffect(() => {
    if (user?.hospitalId) {
      methods.setValue('hospitalId', user.hospitalId.toString());
    }
  }, [user?.hospitalId]);
  const selectedDoctor = doctors.find((d) => d.doctorId === doctorId);
  useEffect(() => {
    if (!doctorId || !selectedDoctor?.hospitalId) return;
    methods.setValue('hospitalId', selectedDoctor.hospitalId);
  }, [doctorId, selectedDoctor?.hospitalId]);

  const handlePatientSelect = async (patientId: string) => {
    const patient = patients.find(p => p.patientId === patientId);
    if (!patient) return;

    const formattedDob = formatDateToInput(patient.patientDob);
    methods.setValue('patientPhone', patient.patientPhone || '');
    methods.setValue('patientName', patient.patientName || '');
    methods.setValue('patientDob', formattedDob);
    methods.setValue('patientGender', patient.gender as any);
    methods.setValue('patientEmail', patient.patientEmail || '');
    methods.setValue('patientJob', patient.patientJob || '');
    methods.setValue('patientContactName', patient.patientContactName || '');
    methods.setValue('patientContactPhone', patient.patientContactPhone || '');
    methods.setValue('patientAddress', patient.patientAddress || '');
    methods.setValue('isNewPatient', false);
    try {
      const clinicalRes = await patientClinicalService.getByPatientId(patientId);
      if (clinicalRes.success && clinicalRes.data) {
        const clinical = clinicalRes.data;
        setPatientClinicalId(clinical.patientClinicalId || '');
        methods.setValue('height', clinical.patientHeight?.toString() || '');
        methods.setValue('weight', clinical.patientWeight?.toString() || '');
        methods.setValue('patientHistory', clinical.patientHistory || '');
        methods.setValue('familyHistory', clinical.familyHistory || '');
        methods.setValue('medicalHistory', clinical.medicalHistory || '');
        methods.setValue('acuteDisease', clinical.acuteDisease || '');
        methods.setValue('chronicDisease', clinical.chronicDisease || '');
        methods.setValue('medication', clinical.medicalUsing?.join(', ') || '');
        methods.setValue('toxicExposure', clinical.toxicExposure || '');
      } else {
        setPatientClinicalId('');
        methods.setValue('height', '');
        methods.setValue('weight', '');
        methods.setValue('patientHistory', '');
        methods.setValue('familyHistory', '');
        methods.setValue('medicalHistory', '');
        methods.setValue('acuteDisease', '');
        methods.setValue('chronicDisease', '');
        methods.setValue('medication', '');
        methods.setValue('toxicExposure', '');
      }
    } catch (error: any) {
      if (!error?.message?.includes('404') && !error?.error?.includes('404')) {
        console.error('Error loading clinical data:', error);
      }
      setPatientClinicalId('');
    }
  };
  useEffect(() => {
    if (isNewPatient && !patientId) {
      setPatientClinicalId('');
      setLastSelectedPatientId('');
      methods.setValue('height', '');
      methods.setValue('weight', '');
      methods.setValue('patientHistory', '');
      methods.setValue('familyHistory', '');
      methods.setValue('medicalHistory', '');
      methods.setValue('acuteDisease', '');
      methods.setValue('chronicDisease', '');
      methods.setValue('medication', '');
      methods.setValue('toxicExposure', '');
    }
  }, [isNewPatient, patientId]);
  const serviceGroupOptions = [
    { value: 'reproduction', label: 'Nhóm sản' },
    { value: 'embryo', label: 'Nhóm phôi' },
    { value: 'disease', label: 'Nhóm bệnh lý' },
  ];

  const patientOptions = patients.map((p: PatientResponse) => ({
    value: p.patientId,
    label: `${p.patientName || ''} - ${p.patientPhone || ''}`,
  }));

  const genomeTestOptions = filteredGenomeTests.map((test: any) => ({
    value: test.testId,
    label: test.testName || test.testId,
  }));

  const doctorOptions = doctors.map((d: any) => ({
    value: d.doctorId,
    label: d.doctorName || d.doctorId,
  }));

  const genderOptions = GENDER_OPTIONS.map(g => ({
    value: g.value,
    label: g.label,
  }));

  const handleSubmit = async () => {
    console.log('[CreatePrescriptionSlip] Submit button clicked');
    console.log('[CreatePrescriptionSlip] Form values:', methods.getValues());

    const isValid = await methods.trigger();
    console.log('[CreatePrescriptionSlip] Form validation result:', isValid);
    console.log('[CreatePrescriptionSlip] Form errors:', methods.formState.errors);

    if (!isValid) {
      const errors = methods.formState.errors;
      const errorMessages = Object.keys(errors)
        .map(key => {
          const error = errors[key as keyof typeof errors];
          return `${key}: ${error?.message || 'Invalid'}`;
        })
        .join('\n');
      console.log('[CreatePrescriptionSlip] Validation errors:', errorMessages);
      console.log('[CreatePrescriptionSlip] Full errors object:', JSON.stringify(errors, null, 2));
      const firstError = Object.values(errors)[0];
      const errorMessage = firstError?.message || 'Vui lòng điền đầy đủ thông tin bắt buộc';
      Alert.alert('Lỗi', errorMessage);
      return;
    }
    const formData = methods.getValues();
    if (!formData.genomeTestId) {
      Alert.alert('Lỗi', 'Vui lòng chọn mã xét nghiệm');
      return;
    }
    if (!formData.doctorId) {
      Alert.alert('Lỗi', 'Vui lòng chọn bác sĩ chỉ định');
      return;
    }
    if (!formData.hospitalId) {
      Alert.alert('Lỗi', 'Vui lòng chọn phòng khám');
      return;
    }
    if (!formData.patientPhone || !formData.patientName) {
      Alert.alert('Lỗi', 'Vui lòng nhập thông tin bệnh nhân');
      return;
    }
    if (sendEmailPatient && !formData.patientEmail) {
      Alert.alert('Lỗi', 'Vui lòng nhập email bệnh nhân để gửi thông báo');
      return;
    }
    if (formData.height && parseFloat(formData.height) < 0) {
      Alert.alert('Lỗi', 'Chiều cao không được âm');
      return;
    }
    if (formData.weight && parseFloat(formData.weight) < 0) {
      Alert.alert('Lỗi', 'Cân nặng không được âm');
      return;
    }
    if (formData.embryoNumber && parseInt(formData.embryoNumber) < 0) {
      Alert.alert('Lỗi', 'Số lượng phôi không được âm');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalPatientId = formData.selectedPatientId || '';
      if (isNewPatient || !formData.selectedPatientId) {
        const patientRequest: any = {
          patientId: generatePatientId(),
          patientPhone: formData.patientPhone,
          patientName: formData.patientName,
          patientDob: formData.patientDob || undefined,
          gender: formData.patientGender?.toUpperCase() || undefined,
          patientEmail: formData.patientEmail || undefined,
          patientJob: formData.patientJob || undefined,
          patientContactName: formData.patientContactName || undefined,
          patientContactPhone: formData.patientContactPhone || undefined,
          patientAddress: formData.patientAddress || undefined,
          hospitalId: formData.hospitalId || undefined,
        };
        const patientRes = await patientService.create(patientRequest);
        finalPatientId = patientRes.data?.patientId || patientRequest.patientId;
      } else {
        const patientRequest: any = {
          patientId: formData.selectedPatientId,
          patientPhone: formData.patientPhone,
          patientName: formData.patientName,
          patientDob: formData.patientDob || undefined,
          gender: formData.patientGender?.toUpperCase() || undefined,
          patientEmail: formData.patientEmail || undefined,
          patientJob: formData.patientJob || undefined,
          patientContactName: formData.patientContactName || undefined,
          patientContactPhone: formData.patientContactPhone || undefined,
          patientAddress: formData.patientAddress || undefined,
          hospitalId: formData.hospitalId || undefined,
        };
        await patientService.update(formData.selectedPatientId, patientRequest);
        finalPatientId = formData.selectedPatientId;
      }
      const clinicalRequest: any = {
        patientId: finalPatientId,
        patientHeight: formData.height ? parseFloat(formData.height) : undefined,
        patientWeight: formData.weight ? parseFloat(formData.weight) : undefined,
        patientHistory: formData.patientHistory || undefined,
        familyHistory: formData.familyHistory || undefined,
        medicalHistory: formData.medicalHistory || undefined,
        acuteDisease: formData.acuteDisease || undefined,
        chronicDisease: formData.chronicDisease || undefined,
        medicalUsing: formData.medication
          ? formData.medication
            .split(',')
            .map(m => m.trim())
            .filter(m => m)
          : undefined,
        toxicExposure: formData.toxicExposure || undefined,
      };

      if (patientClinicalId) {
        await patientClinicalService.update(patientClinicalId, clinicalRequest);
      } else {
        const clinicalRes = await patientClinicalService.create(clinicalRequest);
        if (clinicalRes.data?.patientClinicalId) {
          setPatientClinicalId(clinicalRes.data.patientClinicalId);
        }
      }
      const serviceId = getServiceId();

      if (serviceGroup === 'reproduction') {
        const reproductionRequest: any = {
          serviceId,
          patientId: finalPatientId,
          fetusesNumber: formData.fetusesNumber ? parseInt(formData.fetusesNumber) : undefined,
          fetusesWeek: formData.fetusesWeek ? parseInt(formData.fetusesWeek) : undefined,
          fetusesDay: formData.fetusesDay ? parseInt(formData.fetusesDay) : undefined,
          ultrasoundDay: formData.ultrasoundDay || undefined,
          headRumpLength: formData.headRumpLength ? parseFloat(formData.headRumpLength) : undefined,
          neckLength: formData.neckLength ? parseFloat(formData.neckLength) : undefined,
          combinedTestResult: formData.combinedTestResult || undefined,
          ultrasoundResult: formData.ultrasoundResult || undefined,
        };
        await reproductionService.create(reproductionRequest);
      } else if (serviceGroup === 'embryo') {
        const embryoRequest: any = {
          serviceId,
          patientId: finalPatientId,
          biospy: formData.biospy || undefined,
          biospyDate: formData.biospyDate || undefined,
          cellContainingSolution: formData.cellContainingSolution || undefined,
          embryoCreate: formData.embryoCreate ? parseInt(formData.embryoCreate) : undefined,
          embryoStatus: formData.embryoStatus || undefined,
          morphologicalAssessment: formData.morphologicalAssessment || undefined,
          cellNucleus: formData.cellNucleus || false,
          negativeControl: formData.negativeControl || undefined,
        };
        await embryoService.create(embryoRequest);
      } else if (serviceGroup === 'disease') {
        const diseaseRequest: any = {
          serviceId,
          patientId: finalPatientId,
          symptom: formData.symptom || undefined,
          diagnose: formData.diagnose || undefined,
          diagnoseImage: formData.diagnoseImage || undefined,
          testRelated: formData.testRelated || undefined,
          treatmentMethods: formData.treatmentMethods || undefined,
          treatmentTimeDay: formData.treatmentTimeDay
            ? parseInt(formData.treatmentTimeDay)
            : undefined,
          drugResistance: formData.drugResistance || undefined,
          relapse: formData.relapse || undefined,
        };
        await diseaseService.create(diseaseRequest);
      }
      const specifyRequest: SpecifyVoteTestRequest = {
        serviceId,
        patientId: finalPatientId,
        genomeTestId: formData.genomeTestId,
        embryoNumber: formData.embryoNumber ? parseInt(formData.embryoNumber) : undefined,
        hospitalId: formData.hospitalId,
        doctorId: formData.doctorId || undefined,
        samplingSite: formData.samplingSite || undefined,
        sampleCollectDate: formData.sampleCollectDate
          ? new Date(formData.sampleCollectDate).toISOString()
          : undefined,
        geneticTestResults: formData.geneticTestResult || undefined,
        geneticTestResultsRelationship: formData.geneticTestResultsRelationship || undefined,
        sendEmailPatient: formData.sendEmailPatient || false,
        specifyNote: formData.specifyNote || undefined,
      };
      const specifyRes = await specifyVoteTestService.create(specifyRequest);

      if (specifyRes.success) {
        queryClient.invalidateQueries({ queryKey: ['specify-vote-tests'] });
        setShowSuccessModal(true);
      } else {
        Alert.alert('Lỗi', specifyRes.error || 'Không thể tạo phiếu chỉ định');
      }
    } catch (error: any) {
      console.error('Error creating specify:', error);
      Alert.alert('Lỗi', error?.message || 'Không thể tạo phiếu chỉ định. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading =
    isLoadingServices || isLoadingPatients || isLoadingDoctors || isLoadingGenomeTests;
  React.useEffect(() => {
    console.log('[CreatePrescriptionSlip] Loading states', {
      isLoadingServices,
      isLoadingPatients,
      isLoadingDoctors,
      isLoadingGenomeTests,
      isLoading,
      isSubmitting,
    });
  }, [
    isLoadingServices,
    isLoadingPatients,
    isLoadingDoctors,
    isLoadingGenomeTests,
    isLoading,
    isSubmitting,
  ]);

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
              <Text className="text-slate-900 text-lg font-extrabold">Tạo mới phiếu chỉ định</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Nhập thông tin phiếu chỉ định</Text>
            </View>
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#0284C7" />
            <Text className="mt-3 text-slate-600">Đang tải dữ liệu...</Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Service Group Selection */}
            <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
              <Text className="text-slate-900 text-base font-extrabold mb-3">
                Chọn nhóm dịch vụ
              </Text>
              <View className="flex-row gap-2">
                {serviceGroupOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() =>
                      methods.setValue('serviceGroup', option.value as ServiceGroupType)
                    }
                    className={`px-4 py-2 rounded-xl border ${serviceGroup === option.value
                      ? 'bg-sky-600 border-sky-600'
                      : 'bg-sky-50 border-sky-200'
                      }`}
                    activeOpacity={0.85}
                  >
                    <Text
                      className={`text-sm font-extrabold ${serviceGroup === option.value ? 'text-white' : 'text-sky-700'
                        }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Send Email Switch */}
              <View className="mt-4 pt-4 border-t border-sky-100 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900">
                    Gửi email cho bệnh nhân
                  </Text>
                  <Text className="text-xs text-slate-500 mt-0.5">
                    {sendEmailPatient
                      ? 'Email sẽ được gửi cho bệnh nhân sau khi tạo phiếu'
                      : 'Không gửi email thông báo'}
                  </Text>
                </View>
                <Switch
                  value={sendEmailPatient}
                  onValueChange={value => methods.setValue('sendEmailPatient', value)}
                  trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* Patient Info Section */}
            <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
              <Text className="text-slate-900 text-base font-extrabold mb-3">
                Thông tin bệnh nhân
              </Text>

              {/* New/Existing Patient Toggle */}
              <View className="flex-row gap-2 mb-4">
                <TouchableOpacity
                  onPress={() => {
                    methods.setValue('isNewPatient', true);
                    methods.setValue('selectedPatientId', '');
                    setLastSelectedPatientId('');
                    // Clear patient fields when switching to new patient
                    methods.setValue('patientPhone', '');
                    methods.setValue('patientName', '');
                    methods.setValue('patientDob', '');
                    methods.setValue('patientGender', undefined);
                    methods.setValue('patientEmail', '');
                    methods.setValue('patientJob', '');
                    methods.setValue('patientContactName', '');
                    methods.setValue('patientContactPhone', '');
                    methods.setValue('patientAddress', '');
                  }}
                  className={`px-4 py-2 rounded-xl border ${isNewPatient ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-200'
                    }`}
                  activeOpacity={0.85}
                >
                  <Text
                    className={`text-sm font-extrabold ${isNewPatient ? 'text-white' : 'text-sky-700'
                      }`}
                  >
                    Bệnh nhân mới
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    methods.setValue('isNewPatient', false);
                    // If there's already a selected patient, auto-fill
                    if (patientId && patientId !== lastSelectedPatientId) {
                      handlePatientSelect(patientId);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl border ${!isNewPatient ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-200'
                    }`}
                  activeOpacity={0.85}
                >
                  <Text
                    className={`text-sm font-extrabold ${!isNewPatient ? 'text-white' : 'text-sky-700'
                      }`}
                  >
                    Chọn bệnh nhân
                  </Text>
                </TouchableOpacity>
              </View>

              {!isNewPatient && (
                <FormSelect
                  name="selectedPatientId"
                  label="Chọn bệnh nhân"
                  required
                  options={patientOptions}
                  getLabel={o => o.label}
                  getValue={o => o.value}
                  placeholder="Chọn bệnh nhân"
                  modalTitle="Chọn bệnh nhân"
                />
              )}

              <FormInput
                name="patientPhone"
                label="Số điện thoại"
                required
                placeholder="Nhập số điện thoại (10-11 chữ số)"
                keyboardType="phone-pad"
                formatter={v => v.replace(/\D/g, '')}
              />

              <FormInput
                name="patientName"
                label="Tên bệnh nhân"
                required
                placeholder="Nhập tên bệnh nhân"
              />

              <FormDatePicker
                name="patientDob"
                label="Ngày sinh"
                placeholder="Chọn ngày sinh"
                maximumDate={new Date()}
              />

              <FormSelect
                name="patientGender"
                label="Giới tính"
                options={genderOptions}
                getLabel={o => o.label}
                getValue={o => o.value}
                placeholder="Chọn giới tính"
                modalTitle="Chọn giới tính"
              />

              <FormInput
                name="patientEmail"
                label="Email"
                placeholder="Nhập email (tùy chọn)"
                keyboardType="email-address"
                autoCapitalize="none"
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
                label="Số điện thoại người liên hệ"
                placeholder="Nhập số điện thoại (tùy chọn)"
                keyboardType="phone-pad"
                formatter={v => v.replace(/\D/g, '')}
              />

              <FormInput
                name="patientAddress"
                label="Địa chỉ"
                placeholder="Nhập địa chỉ (tùy chọn)"
              />
            </View>

            {/* Clinical Info Section */}
            <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
              <Text className="text-slate-900 text-base font-extrabold mb-3">
                Thông tin lâm sàng
              </Text>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FormInput
                    name="height"
                    label="Chiều cao (cm)"
                    placeholder="Nhập chiều cao"
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1">
                  <FormInput
                    name="weight"
                    label="Cân nặng (kg)"
                    placeholder="Nhập cân nặng"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <FormTextarea
                name="patientHistory"
                label="Tiền sử bệnh nhân"
                placeholder="Nhập tiền sử bệnh nhân (tùy chọn)"
                minHeight={80}
              />

              <FormTextarea
                name="familyHistory"
                label="Tiền sử gia đình"
                placeholder="Nhập tiền sử gia đình (tùy chọn)"
                minHeight={80}
              />

              <FormTextarea
                name="medicalHistory"
                label="Tiền sử y khoa"
                placeholder="Nhập tiền sử y khoa (tùy chọn)"
                minHeight={80}
              />

              <FormInput
                name="acuteDisease"
                label="Bệnh cấp tính"
                placeholder="Nhập bệnh cấp tính (tùy chọn)"
              />

              <FormInput
                name="chronicDisease"
                label="Bệnh mãn tính"
                placeholder="Nhập bệnh mãn tính (tùy chọn)"
              />

              <FormInput
                name="medication"
                label="Thuốc đang sử dụng"
                placeholder="Nhập thuốc (phân cách bằng dấu phẩy)"
                helperText="Phân cách các thuốc bằng dấu phẩy"
              />

              <FormInput
                name="toxicExposure"
                label="Tiếp xúc độc tố"
                placeholder="Nhập thông tin tiếp xúc độc tố (tùy chọn)"
              />

              <FormTextarea
                name="geneticTestResult"
                label="Kết quả xét nghiệm di truyền"
                placeholder="Nhập kết quả xét nghiệm di truyền (tùy chọn)"
                minHeight={80}
              />

              <FormInput
                name="geneticTestResultsRelationship"
                label="Mối quan hệ kết quả xét nghiệm"
                placeholder="Nhập mối quan hệ (tùy chọn)"
              />
            </View>
            <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
              <Text className="text-slate-900 text-base font-extrabold mb-3">
                Thông tin xét nghiệm
              </Text>

              <FormSelect
                name="genomeTestId"
                label="Xét nghiệm"
                required
                options={genomeTestOptions}
                getLabel={o => o.label}
                getValue={o => o.value}
                placeholder="Chọn xét nghiệm"
                modalTitle="Chọn xét nghiệm"
                disabled={!getServiceId()}
                helperText={!getServiceId() ? 'Vui lòng chọn nhóm dịch vụ trước' : undefined}
              />

              <FormSelect
                name="doctorId"
                label="Bác sĩ chỉ định"
                required
                options={doctorOptions}
                getLabel={o => o.label}
                getValue={o => o.value}
                placeholder="Chọn bác sĩ"
                modalTitle="Chọn bác sĩ"
              />

              {doctorId && (
                <View className="mb-4">
                  <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
                    Phòng khám
                  </Text>
                  <Text className="text-[14px] text-slate-600">
                    {selectedDoctor?.hospitalName || 'Chưa có thông tin'}
                  </Text>
                </View>
              )}

              <FormSelect
                name="embryoNumber"
                label="Số phôi"
                options={EMBRYO_NUMBER_OPTIONS}
                getLabel={o => o.label}
                getValue={o => o.value}
                placeholder="Chọn số phôi"
                modalTitle="Chọn số phôi"
              />

              <FormInput
                name="samplingSite"
                label="Địa điểm lấy mẫu"
                placeholder="Nhập địa điểm lấy mẫu (tùy chọn)"
              />

              <FormInput
                name="sampleCollectDate"
                label="Ngày thu mẫu"
                placeholder="YYYY-MM-DD"
                helperText="Định dạng: YYYY-MM-DD"
              />
            </View>
            {serviceGroup === 'reproduction' && (
              <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
                <Text className="text-slate-900 text-base font-extrabold mb-3">
                  Thông tin nhóm sản
                </Text>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <FormInput
                      name="fetusesNumber"
                      label="Số thai"
                      placeholder="Nhập số thai"
                      keyboardType="numeric"
                    />
                  </View>
                  <View className="flex-1">
                    <FormInput
                      name="fetusesWeek"
                      label="Tuần thai"
                      placeholder="Nhập tuần thai"
                      keyboardType="numeric"
                    />
                  </View>
                  <View className="flex-1">
                    <FormInput
                      name="fetusesDay"
                      label="Ngày thai"
                      placeholder="Nhập ngày thai"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <FormInput
                  name="ultrasoundDay"
                  label="Ngày siêu âm"
                  placeholder="YYYY-MM-DD"
                  helperText="Định dạng: YYYY-MM-DD"
                />

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <FormInput
                      name="headRumpLength"
                      label="Chiều dài đầu mông (mm)"
                      placeholder="Nhập chiều dài"
                      keyboardType="numeric"
                    />
                  </View>
                  <View className="flex-1">
                    <FormInput
                      name="neckLength"
                      label="Chiều dài cổ (mm)"
                      placeholder="Nhập chiều dài"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <FormInput
                  name="combinedTestResult"
                  label="Kết quả test kết hợp"
                  placeholder="Nhập kết quả test kết hợp (tùy chọn)"
                />

                <FormTextarea
                  name="ultrasoundResult"
                  label="Kết quả siêu âm"
                  placeholder="Nhập kết quả siêu âm (tùy chọn)"
                  minHeight={80}
                />
              </View>
            )}

            {serviceGroup === 'embryo' && (
              <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
                <Text className="text-slate-900 text-base font-extrabold mb-3">
                  Thông tin nhóm phôi
                </Text>

                <FormInput
                  name="biospy"
                  label="Sinh thiết"
                  placeholder="Nhập thông tin sinh thiết (tùy chọn)"
                />

                <FormInput
                  name="biospyDate"
                  label="Ngày sinh thiết"
                  placeholder="YYYY-MM-DD"
                  helperText="Định dạng: YYYY-MM-DD"
                />

                <FormInput
                  name="cellContainingSolution"
                  label="Dung dịch chứa tế bào"
                  placeholder="Nhập dung dịch chứa tế bào (tùy chọn)"
                />

                <FormInput
                  name="embryoCreate"
                  label="Ngày tạo phôi"
                  placeholder="Nhập ngày tạo phôi"
                  keyboardType="numeric"
                />

                <FormInput
                  name="embryoStatus"
                  label="Trạng thái phôi"
                  placeholder="Nhập trạng thái phôi (tùy chọn)"
                />

                <FormTextarea
                  name="morphologicalAssessment"
                  label="Đánh giá hình thái"
                  placeholder="Nhập đánh giá hình thái (tùy chọn)"
                  minHeight={80}
                />

                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-sm font-semibold text-slate-900">Có nhân tế bào</Text>
                  <Switch
                    value={methods.watch('cellNucleus') || false}
                    onValueChange={value => methods.setValue('cellNucleus', value)}
                    trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                    thumbColor="#fff"
                  />
                </View>

                <FormInput
                  name="negativeControl"
                  label="Đối chứng âm"
                  placeholder="Nhập đối chứng âm (tùy chọn)"
                />
              </View>
            )}

            {serviceGroup === 'disease' && (
              <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
                <Text className="text-slate-900 text-base font-extrabold mb-3">
                  Thông tin nhóm bệnh lý
                </Text>

                <FormTextarea
                  name="symptom"
                  label="Triệu chứng"
                  placeholder="Nhập triệu chứng (tùy chọn)"
                  minHeight={80}
                />

                <FormTextarea
                  name="diagnose"
                  label="Chẩn đoán"
                  placeholder="Nhập chẩn đoán (tùy chọn)"
                  minHeight={80}
                />

                <FormInput
                  name="diagnoseImage"
                  label="Hình ảnh chẩn đoán"
                  placeholder="Nhập URL hình ảnh (tùy chọn)"
                />

                <FormInput
                  name="testRelated"
                  label="Xét nghiệm liên quan"
                  placeholder="Nhập xét nghiệm liên quan (tùy chọn)"
                />

                <FormTextarea
                  name="treatmentMethods"
                  label="Phương pháp điều trị"
                  placeholder="Nhập phương pháp điều trị (tùy chọn)"
                  minHeight={80}
                />

                <FormInput
                  name="treatmentTimeDay"
                  label="Thời gian điều trị (ngày)"
                  placeholder="Nhập thời gian điều trị"
                  keyboardType="numeric"
                />

                <FormInput
                  name="drugResistance"
                  label="Kháng thuốc"
                  placeholder="Nhập thông tin kháng thuốc (tùy chọn)"
                />

                <FormInput
                  name="relapse"
                  label="Tái phát"
                  placeholder="Nhập thông tin tái phát (tùy chọn)"
                />
              </View>
            )}
            <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
              <Text className="text-slate-900 text-base font-extrabold mb-3">Ghi chú</Text>
              <FormTextarea
                name="specifyNote"
                label="Ghi chú phiếu chỉ định"
                placeholder="Nhập ghi chú (tùy chọn)"
                minHeight={100}
              />
            </View>
          </ScrollView>
        )}
        <View className="p-4 bg-white border-t border-sky-100">
          <TouchableOpacity
            onPress={() => {
              console.log('[CreatePrescriptionSlip] Button pressed', {
                isSubmitting,
                isLoading,
                disabled: isSubmitting || isLoading,
              });
              if (!isSubmitting && !isLoading) {
                handleSubmit();
              } else {
                console.log('[CreatePrescriptionSlip] Button is disabled');
              }
            }}
            disabled={isSubmitting || isLoading}
            className={`p-4 rounded-2xl flex-row items-center justify-center ${isSubmitting || isLoading ? 'bg-slate-300' : 'bg-sky-600'
              }`}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text className="text-white text-base font-extrabold">Đang tạo...</Text>
              </>
            ) : isLoading ? (
              <>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text className="text-white text-base font-extrabold">Đang tải...</Text>
              </>
            ) : (
              <Text className="text-white text-base font-extrabold">Tạo mới</Text>
            )}
          </TouchableOpacity>
        </View>
        <SuccessModal
          visible={showSuccessModal}
          title="Thành công"
          message="Phiếu chỉ định đã được tạo thành công!\nBạn có thể xem trong danh sách phiếu chỉ định."
          buttonText="Xem danh sách"
          onClose={() => {
            setShowSuccessModal(false);
            router.push('/customer/prescription-slips');
          }}
        />
      </SafeAreaView>
    </FormProvider>
  );
}
