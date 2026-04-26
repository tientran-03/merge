import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SelectionModal } from '@/components/modals/SelectionModal';
import {
  Step1BasicOrderInfo,
  Step2SpecifyImage,
  Step3SpecifyInfo,
  Step4ClinicalInfo,
  Step5GeneticResults,
  Step6ServiceType,
  Step7OrderNote,
} from '@/components/order/create-order-steps';
import { useAuth } from '@/contexts/AuthContext';
import { usePrefetchProvinces } from '@/hooks/useAddressQueries';
import {
  ensureSinglePaidOrderPatientMetadataLikeWeb,
} from '@/lib/ensurePaidOrderPatientMetadataWebStyle';
import { presentFeedbackError } from '@/lib/feedbackModal';
import {
  sampleCollectorOptionsForOrder,
  staffAnalystOptionsForOrderWithFallback,
} from '@/lib/hospitalStaffOrderOptions';
import { getOrderSpecifyVoteId } from '@/lib/orderSpecifyLink';
import {
  BarcodeStatus,
  defaultOrderFormValues,
  orderFormSchema,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  StaffPosition,
  type OrderFormData,
} from '@/lib/schemas/order-form-schema';
import { getApiResponseData } from '@/lib/types/api-types';
import { barcodeService, type BarcodeResponse } from '@/services/barcodeService';
import { diseaseService } from '@/services/diseaseService';
import { doctorService, type DoctorResponse } from '@/services/doctorService';
import { embryoService } from '@/services/embryoService';
import { genomeTestService, type GenomeTestResponse } from '@/services/genomeTestService';
import { hospitalStaffService, type HospitalStaffResponse } from '@/services/hospitalStaffService';
import { orderService, type OrderResponse } from '@/services/orderService';
import { patientClinicalService } from '@/services/patientClinicalService';
import { patientMetadataService } from '@/services/patientMetadataService';
import { patientService } from '@/services/patientService';
import { reproductionService } from '@/services/reproductionService';
import { serviceService, type ServiceResponse } from '@/services/serviceService';
import {
  specifyVoteTestService,
  type SpecifyVoteTestRequest,
  type SpecifyVoteTestResponse,
} from '@/services/specifyVoteTestService';

const TOTAL_STEPS = 7;
const STEP_TITLES = [
  'Thông tin cơ bản đơn hàng',
  'Hình ảnh phiếu xét nghiệm',
  'Thông tin nhóm xét nghiệm',
  'Thông tin phiếu xét nghiệm',
  'Thông tin lâm sàng',
  'Kết quả xét nghiệm di truyền',
  'Ghi chú đơn hàng',
];
const generatePatientId = () => {
  return `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

async function syncSpecifySendEmailPatientFlag(
  specifyVoteId: string,
  sendEmailPatient: boolean,
  patientEmail?: string | null
): Promise<void> {
  const id = String(specifyVoteId || '').trim();
  if (!id) return;
  const emailTrim = String(patientEmail || '').trim();
  const effectiveSend = Boolean(sendEmailPatient && emailTrim);

  const specifyDetail = await specifyVoteTestService.getById(id);
  if (!specifyDetail.success || !specifyDetail.data) return;
  const specify = specifyDetail.data;

  const updateRequest: SpecifyVoteTestRequest = {
    serviceId: specify.serviceID || '',
    patientId: specify.patientId || '',
    genomeTestId: specify.genomeTestId || '',
    embryoNumber: specify.embryoNumber ?? undefined,
    hospitalId: specify.hospitalId || undefined,
    doctorId: specify.doctorId || undefined,
    samplingSite: specify.samplingSite || undefined,
    sampleCollectDate: specify.sampleCollectDate || undefined,
    geneticTestResults: specify.geneticTestResults || undefined,
    geneticTestResultsRelationship: specify.geneticTestResultsRelationship || undefined,
    specifyNote: specify.specifyNote || undefined,
    sendEmailPatient: effectiveSend,
  };

  const res = await specifyVoteTestService.update(id, updateRequest);
  if (!res.success) {
    throw new Error(res.message || res.error || 'Không cập nhật được cờ gửi email trên phiếu xét nghiệm');
  }
}

function formatDateOnly(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function formatDatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function normalizePaymentTypeForForm(raw?: string | null): PaymentType {
  const p = String(raw || '')
    .trim()
    .toUpperCase();
  if (p === PaymentType.ONLINE_PAYMENT || p === 'ONLINE_PAYMENT') return PaymentType.ONLINE_PAYMENT;
  return PaymentType.CASH;
}

function paymentStatusForLinkedForm(raw?: string | null): 'UNPAID' | 'COMPLETED' {
  const normalized = String(raw ?? '')
    .trim()
    .toUpperCase();
  return normalized === 'COMPLETED' ||
    normalized === 'PAID' ||
    normalized === 'TRUE' ||
    normalized === '1'
    ? 'COMPLETED'
    : 'UNPAID';
}

function linkedOrderToFormValues(o: OrderResponse, defaults: OrderFormData): OrderFormData {
  const specify =
    o.specifyId && typeof o.specifyId === 'object'
      ? (o.specifyId as SpecifyVoteTestResponse)
      : null;
  const patient = specify?.patient;
  const clinical = specify?.patientClinical;
  const voteId = getOrderSpecifyVoteId(o);

  const serviceType: OrderFormData['serviceType'] = (() => {
    const st = String(specify?.serviceType || '').toLowerCase();
    if (st === 'reproduction' || st === 'embryo' || st === 'disease') return st;
    if (specify?.reproductionService) return 'reproduction';
    if (specify?.embryoService) return 'embryo';
    if (specify?.diseaseService) return 'disease';
    const svcName = String(
      (specify as any)?.genomeTest?.service?.name ||
      (specify as any)?.genomeTest?.serviceName ||
      ''
    ).toLowerCase();
    if (svcName.includes('embryo')) return 'embryo';
    if (svcName.includes('disease')) return 'disease';
    if (svcName) return 'reproduction';
    return '';
  })();

  const rep = specify?.reproductionService;
  const emb = specify?.embryoService;
  const dis = specify?.diseaseService;

  return {
    ...defaults,
    orderName: o.orderName || '',
    staffId: o.staffId || '',
    staffAnalystId: o.staffAnalystId || '',
    sampleCollectorId: o.sampleCollectorId || '',
    barcodeId: o.barcodeId || '',
    paymentType: normalizePaymentTypeForForm(o.paymentType),
    paymentStatus: paymentStatusForLinkedForm(o.paymentStatus),
    invoiceLink:
      o.invoiceLink && /^https?:\/\//i.test(String(o.invoiceLink).trim())
        ? String(o.invoiceLink).trim()
        : '',
    paymentAmount:
      o.paymentAmount != null && !Number.isNaN(Number(o.paymentAmount))
        ? String(o.paymentAmount)
        : '',
    specifyVoteTestImagePath: o.specifyVoteImagePath || '',
    orderNote: o.orderNote || '',
    doctorId: specify?.doctorId ? String(specify.doctorId) : '',
    specifyId: voteId,
    customerId: o.customerId || '',
    customerFastq: Boolean((o as any).customerFastq),
    genomeTestId: specify?.genomeTestId || '',
    testName: specify?.genomeTest?.testName || '',
    testContent: specify?.genomeTest?.testDescription || '',
    testSample: Array.isArray(specify?.genomeTest?.testSample)
      ? (specify!.genomeTest!.testSample || []).join(', ')
      : '',
    samplingSite: specify?.samplingSite || '',
    sampleCollectDate: formatDatetimeLocal(specify?.sampleCollectDate),
    embryoNumber: specify?.embryoNumber != null ? String(specify.embryoNumber) : '',
    geneticTestResults: specify?.geneticTestResults || '',
    geneticTestResultsRelationship: specify?.geneticTestResultsRelationship || '',
    patientPhone: patient?.patientPhone || '',
    patientName: patient?.patientName || '',
    patientDob: patient?.patientDob ? formatDateOnly(patient.patientDob) : '',
    patientGender: patient?.gender || '',
    patientEmail: patient?.patientEmail || '',
    patientJob: patient?.patientJob || '',
    patientContactName: patient?.patientContactName || '',
    patientContactPhone: patient?.patientContactPhone || '',
    patientAddress: patient?.patientAddress || '',
    serviceType,
    fetusesNumber: rep?.fetusesNumber != null ? String(rep.fetusesNumber) : '',
    fetusesWeek: rep?.fetusesWeek != null ? String(rep.fetusesWeek) : '',
    fetusesDay: rep?.fetusesDay != null ? String(rep.fetusesDay) : '',
    ultrasoundDay: rep?.ultrasoundDay || '',
    headRumpLength: rep?.headRumpLength != null ? String(rep.headRumpLength) : '',
    neckLength: rep?.neckLength != null ? String(rep.neckLength) : '',
    combinedTestResult: rep?.combinedTestResult || '',
    ultrasoundResult: rep?.ultrasoundResult || '',
    biospy: emb?.biospy || '',
    biospyDate: emb?.biospyDate || '',
    cellContainingSolution: emb?.cellContainingSolution || '',
    embryoCreate: emb?.embryoCreate != null ? String(emb.embryoCreate) : '',
    embryoStatus: emb?.embryoStatus || '',
    morphologicalAssessment: emb?.morphologicalAssessment || '',
    cellNucleus: emb?.cellNucleus ?? false,
    negativeControl: emb?.negativeControl || '',
    symptom: dis?.symptom || '',
    diagnose: dis?.diagnose || '',
    testRelated: dis?.testRelated || '',
    treatmentMethods: dis?.treatmentMethods || '',
    treatmentTimeDay: dis?.treatmentTimeDay != null ? String(dis.treatmentTimeDay) : '',
    drugResistance: dis?.drugResistance || '',
    relapse: dis?.relapse || '',
    patientHeight: clinical?.patientHeight != null ? String(clinical.patientHeight) : '',
    patientWeight: clinical?.patientWeight != null ? String(clinical.patientWeight) : '',
    patientHistory: clinical?.patientHistory || '',
    familyHistory: clinical?.familyHistory || '',
    toxicExposure: clinical?.toxicExposure || '',
    medicalHistory: clinical?.medicalHistory || '',
    chronicDisease: clinical?.chronicDisease || '',
    acuteDisease: clinical?.acuteDisease || '',
    medicalUsing: Array.isArray(clinical?.medicalUsing)
      ? (clinical!.medicalUsing || []).join(', ')
      : (clinical as any)?.medicalUsing || '',
  };
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
        className="absolute left-0 top-[14px] h-[2px] bg-cyan-600"
        style={{
          width: totalSteps <= 1 ? '0%' : `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
        }}
      />
      <View className="flex-row items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          const circleBg = isDone ? 'bg-cyan-600' : 'bg-white';
          const circleBorder = isDone
            ? 'border-cyan-600'
            : isActive
              ? 'border-cyan-600'
              : 'border-slate-300';

          const textColor = isDone ? 'text-white' : isActive ? 'text-cyan-700' : 'text-slate-500';

          return (
            <TouchableOpacity
              key={stepNum}
              activeOpacity={onStepPress && isDone ? 0.7 : 1}
              onPress={() => {
                if (onStepPress && isDone) onStepPress(stepNum);
              }}
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

export default function CreateOrderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  usePrefetchProvinces();

  const params = useLocalSearchParams<{ orderId?: string | string[]; initialStep?: string | string[] }>();
  const quickSpecifyIdFromParams = useMemo(() => {
    const raw = (params as any).quickSpecifyId;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return v && String(v).trim() !== '' ? String(v).trim() : undefined;
  }, [params]);
  const quickServiceTypeFromParams = useMemo(() => {
    const raw = (params as any).quickServiceType;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return v && String(v).trim() !== '' ? String(v).trim().toLowerCase() : undefined;
  }, [params]);
  const quickGenomeTestIdFromParams = useMemo(() => {
    const raw = (params as any).quickGenomeTestId;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return v && String(v).trim() !== '' ? String(v).trim() : undefined;
  }, [params]);
  const linkOrderId = useMemo(() => {
    const raw = params.orderId;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return v && String(v).trim() !== '' ? String(v).trim() : undefined;
  }, [params.orderId]);

  const initialStepFromParams = useMemo(() => {
    const raw = params.initialStep;
    const v = Array.isArray(raw) ? raw[0] : raw;
    const n = parseInt(String(v ?? '1'), 10);
    if (!Number.isFinite(n) || n < 1 || n > TOTAL_STEPS) return 1;
    return n;
  }, [params.initialStep]);

  const linkedOrderRef = useRef<OrderResponse | null>(null);
  const [linkHydrated, setLinkHydrated] = useState(() => !linkOrderId);

  const {
    data: linkedOrderResponse,
    isLoading: isLoadingLinkedOrder,
    isError: isLinkedOrderError,
  } = useQuery({
    queryKey: ['order', linkOrderId, 'create-order-link'],
    queryFn: () => orderService.getById(linkOrderId!),
    enabled: !!linkOrderId,
    retry: false,
  });

  const linkedOrder = useMemo((): OrderResponse | null => {
    if (!linkedOrderResponse || !(linkedOrderResponse as { success?: boolean }).success) return null;
    const raw = (linkedOrderResponse as { data?: unknown }).data;
    if (raw && typeof raw === 'object' && 'orderId' in (raw as object)) return raw as OrderResponse;
    const nested = (raw as { data?: OrderResponse } | undefined)?.data;
    return nested ?? null;
  }, [linkedOrderResponse]);

  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isCreatingSpecifyQuick, setIsCreatingSpecifyQuick] = useState(false);
  const [showQuickSpecifyModal, setShowQuickSpecifyModal] = useState(false);
  const [showQuickDoctorModal, setShowQuickDoctorModal] = useState(false);
  const [showQuickPatientModal, setShowQuickPatientModal] = useState(false);
  const [showQuickServiceModal, setShowQuickServiceModal] = useState(false);
  const [showQuickGenomeModal, setShowQuickGenomeModal] = useState(false);
  const [quickPatients, setQuickPatients] = useState<any[]>([]);
  const [quickGenomeTests, setQuickGenomeTests] = useState<GenomeTestResponse[]>([]);
  const [loadingQuickPatients, setLoadingQuickPatients] = useState(false);
  const [loadingQuickGenomeTests, setLoadingQuickGenomeTests] = useState(false);
  const [quickSpecifyForm, setQuickSpecifyForm] = useState<{
    serviceId: string;
    patientId: string;
    genomeTestId: string;
    doctorId: string;
    hospitalId: string;
    samplingSite: string;
    specifyNote: string;
  }>({
    serviceId: '',
    patientId: '',
    genomeTestId: '',
    doctorId: '',
    hospitalId: '',
    samplingSite: '',
    specifyNote: '',
  });
  const [manualServiceTypeSet, setManualServiceTypeSet] = useState(false);
  const [genomeTestsByService, setGenomeTestsByService] = useState<GenomeTestResponse[]>([]);
  const [isLoadingGenomeTestsByService, setIsLoadingGenomeTestsByService] = useState(false);
  const [createdOrderData, setCreatedOrderData] = useState<{
    orderId: string;
    orderName: string;
    paymentAmount: number;
    specifyId?: string;
  } | null>(null);

  const methods = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    mode: 'onTouched',
    defaultValues: defaultOrderFormValues,
  });

  const { watch, setValue, getValues } = methods;
  const lastAppliedQuickSpecifyRef = useRef<string>('');

  useEffect(() => {
    if (!linkOrderId) {
      linkedOrderRef.current = null;
      setLinkHydrated(true);
      return;
    }
    if (!linkedOrder) return;
    const o = linkedOrder;
    const next = linkedOrderToFormValues(o, defaultOrderFormValues);
    methods.reset(next);
    linkedOrderRef.current = o;
    setManualServiceTypeSet(Boolean(next.serviceType));
    setLinkHydrated(true);
    if (initialStepFromParams > 1) {
      setCurrentStep(initialStepFromParams);
    }
  }, [linkOrderId, linkedOrder, methods, initialStepFromParams]);

  useEffect(() => {
    if (!quickSpecifyIdFromParams) return;
    if (lastAppliedQuickSpecifyRef.current === quickSpecifyIdFromParams) return;
    setValue('specifyId', quickSpecifyIdFromParams, { shouldDirty: true, shouldValidate: true });
    if (quickServiceTypeFromParams) {
      setValue('serviceType', quickServiceTypeFromParams as any, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setManualServiceTypeSet(true);
    }
    if (quickGenomeTestIdFromParams) {
      setValue('genomeTestId', quickGenomeTestIdFromParams, { shouldDirty: true, shouldValidate: true });
    }
    lastAppliedQuickSpecifyRef.current = quickSpecifyIdFromParams;
    setCurrentStep(4);
  }, [
    quickSpecifyIdFromParams,
    quickServiceTypeFromParams,
    quickGenomeTestIdFromParams,
    setValue,
  ]);

  useEffect(() => {
    if (!linkOrderId || !linkedOrder) return;
    const specify = linkedOrder.specifyId;
    if (!specify || typeof specify !== 'object') return;
    const sid = (specify as SpecifyVoteTestResponse).patientId;
    if (!sid) return;
    const orderCaptured = linkedOrder.orderId;
    patientService.getById(sid).then(res => {
      if (linkedOrderRef.current?.orderId !== orderCaptured) return;
      if (!res.success || !res.data) return;
      const p = res.data as any;
      methods.setValue('patientName', p.patientName || '');
      methods.setValue('patientPhone', p.patientPhone || '');
      methods.setValue('patientDob', p.patientDob ? formatDateOnly(p.patientDob) : '');
      methods.setValue('patientGender', p.gender || '');
      methods.setValue('patientEmail', p.patientEmail || '');
      methods.setValue('patientJob', p.patientJob || '');
      methods.setValue('patientContactName', p.patientContactName || '');
      methods.setValue('patientContactPhone', p.patientContactPhone || '');
      methods.setValue('patientAddress', p.patientAddress || '');
    });
  }, [linkOrderId, linkedOrder, methods]);

  useEffect(() => {
    if (!linkOrderId || !linkedOrder) return;
    const specify = linkedOrder.specifyId;
    if (!specify || typeof specify !== 'object') return;
    const s = specify as SpecifyVoteTestResponse;
    if (s.patientClinical) return;
    const pid = s.patientId;
    if (!pid) return;
    const orderCaptured = linkedOrder.orderId;
    patientClinicalService.getByPatientId(pid).then(res => {
      if (linkedOrderRef.current?.orderId !== orderCaptured) return;
      if (!res.success || !res.data) return;
      const c = res.data as any;
      methods.setValue('patientHeight', c.patientHeight != null ? String(c.patientHeight) : '');
      methods.setValue('patientWeight', c.patientWeight != null ? String(c.patientWeight) : '');
      methods.setValue('patientHistory', c.patientHistory || '');
      methods.setValue('familyHistory', c.familyHistory || '');
      methods.setValue('toxicExposure', c.toxicExposure || '');
      methods.setValue('medicalHistory', c.medicalHistory || '');
      methods.setValue('chronicDisease', c.chronicDisease || '');
      methods.setValue('acuteDisease', c.acuteDisease || '');
      const mu = c.medicalUsing;
      methods.setValue(
        'medicalUsing',
        Array.isArray(mu) ? mu.join(', ') : mu != null && String(mu).trim() !== '' ? String(mu) : ''
      );
    });
  }, [linkOrderId, linkedOrder, methods]);

  const doctorId = watch('doctorId');

  const { data: doctorsResponse, isLoading: isLoadingDoctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorService.getAll(),
  });

  const { data: allHospitalStaffResponse, isLoading: isLoadingStaff } = useQuery({
    queryKey: ['hospital-staff'],
    queryFn: () => hospitalStaffService.getAll(),
  });

  const { data: barcodesResponse, isLoading: isLoadingBarcodes } = useQuery({
    queryKey: ['barcodes', BarcodeStatus.CREATED],
    queryFn: () => barcodeService.getByStatus(BarcodeStatus.CREATED),
  });

  const { data: specifyListResponse, isLoading: isLoadingSpecify } = useQuery({
    queryKey: ['specify-vote-tests', 'aggregated', 'create-order'],
    queryFn: () => specifyVoteTestService.getAllAggregatedForStaff(),
  });

  const { data: ordersResponse } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderService.getAll(),
  });

  const { data: genomeTestsResponse, isLoading: isLoadingGenomeTests } = useQuery({
    queryKey: ['genome-tests'],
    queryFn: () => genomeTestService.getAll(),
  });

  const { data: servicesResponse } = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceService.getAll(),
  });

  const doctors = useMemo(
    () => getApiResponseData<DoctorResponse>(doctorsResponse) || [],
    [doctorsResponse]
  );
  const allHospitalStaff = useMemo(
    () => getApiResponseData<HospitalStaffResponse>(allHospitalStaffResponse) || [],
    [allHospitalStaffResponse]
  );
  const barcodes = useMemo(
    () => getApiResponseData<BarcodeResponse>(barcodesResponse) || [],
    [barcodesResponse]
  );
  const orders = useMemo(
    () => getApiResponseData<OrderResponse>(ordersResponse) || [],
    [ordersResponse]
  );

  const availableBarcodes = useMemo(() => {
    const usedBarcodeIds = new Set<string>();
    orders.forEach(order => {
      if (linkOrderId && order.orderId === linkOrderId) return;
      const bid = String(order.barcodeId || '').trim();
      if (bid) usedBarcodeIds.add(bid);
    });

    let base = barcodes.filter(b => !usedBarcodeIds.has(String(b.barcode || '').trim()));
    const bid = linkedOrder?.barcodeId?.trim();
    if (linkOrderId && bid && !base.some(b => String(b.barcode).trim() === bid)) {
      base = [...base, { barcode: bid, status: BarcodeStatus.CREATED } as BarcodeResponse];
    }
    return base;
  }, [barcodes, orders, linkOrderId, linkedOrder?.barcodeId]);
  const services = useMemo(
    () => getApiResponseData<ServiceResponse>(servicesResponse) || [],
    [servicesResponse]
  );

  const usedSpecifyIds = useMemo(() => {
    const ids = new Set<string>();
    orders.forEach(order => {
      if (linkOrderId && order.orderId === linkOrderId) return;
      const id = getOrderSpecifyVoteId(order);
      if (id) ids.add(id);
    });
    return ids;
  }, [orders, linkOrderId]);

  const specifyList = useMemo(() => {
    const raw = getApiResponseData<SpecifyVoteTestResponse>(specifyListResponse) || [];
    const dedup = new Map<string, SpecifyVoteTestResponse>();
    raw.forEach(s => {
      const id = s?.specifyVoteID?.trim();
      if (id) dedup.set(id, s);
    });
    const allSpecifies = Array.from(dedup.values());
    const filtered = allSpecifies.filter(specify => !usedSpecifyIds.has(specify.specifyVoteID));
    const loSpec =
      linkedOrder?.specifyId && typeof linkedOrder.specifyId === 'object'
        ? (linkedOrder.specifyId as SpecifyVoteTestResponse)
        : null;
    if (
      linkOrderId &&
      loSpec?.specifyVoteID &&
      !filtered.some(s => s.specifyVoteID === loSpec.specifyVoteID)
    ) {
      return [...filtered, loSpec];
    }
    return filtered;
  }, [specifyListResponse, usedSpecifyIds, linkOrderId, linkedOrder?.specifyId]);

  const genomeTests = useMemo(
    () => getApiResponseData<GenomeTestResponse>(genomeTestsResponse) || [],
    [genomeTestsResponse]
  );

  const staffList = useMemo(() => {
    return allHospitalStaff.filter(s => s.staffPosition === StaffPosition.STAFF);
  }, [allHospitalStaff]);

  const sampleCollectorIdWatch = watch('sampleCollectorId');
  const staffAnalystIdWatch = watch('staffAnalystId');

  const sampleCollectorList = useMemo(
    () =>
      sampleCollectorOptionsForOrder(
        allHospitalStaff,
        sampleCollectorIdWatch || linkedOrder?.sampleCollectorId || ''
      ),
    [allHospitalStaff, sampleCollectorIdWatch, linkedOrder?.sampleCollectorId]
  );

  const staffAnalystList = useMemo(() => {
    const source = staffAnalystOptionsForOrderWithFallback(
      allHospitalStaff,
      staffAnalystIdWatch || linkedOrder?.staffAnalystId || ''
    );
    return source.map(s => ({
      id: s.staffId,
      name: s.staffName,
      position: s.staffPosition || 'doctor',
      type: 'staff' as const,
    }));
  }, [allHospitalStaff, staffAnalystIdWatch, linkedOrder?.staffAnalystId]);

  const hospitalName = useMemo(() => {
    const selectedDoctor = doctors.find(d => d.doctorId === doctorId);
    return selectedDoctor?.hospitalName || '';
  }, [doctors, doctorId]);

  useEffect(() => {
    const fetchCurrentUserStaff = async () => {
      if (!user?.id) return;
      try {
        const currentStaff = allHospitalStaff.find((s: any) => s.userId === user.id);
        if (currentStaff && !getValues('staffId')) {
          setValue('staffId', currentStaff.staffId);
        }
      } catch (error) {
        console.error('Failed to fetch current user staff:', error);
      }
    };
    if (allHospitalStaff.length > 0) {
      fetchCurrentUserStaff();
    }
  }, [user?.id, allHospitalStaff, setValue, getValues]);

  const specifyId = watch('specifyId');
  useEffect(() => {
    if (!specifyId) return;
    let cancelled = false;
    const applySpecifyToForm = (selectedSpecify: any) => {
      const patient = selectedSpecify?.patient;
      if (patient) {
        setValue('selectedPatientId' as any, String(patient.patientId || selectedSpecify.patientId || ''));
        setValue('patientPhone', patient.patientPhone || '');
        setValue('patientName', patient.patientName || '');
        setValue('patientDob', patient.patientDob ? String(patient.patientDob).split('T')[0] : '');
        setValue('patientGender', patient.gender || '');
        setValue('patientEmail', patient.patientEmail || '');
        setValue('patientJob', patient.patientJob || '');
        setValue('patientContactName', patient.patientContactName || '');
        setValue('patientContactPhone', patient.patientContactPhone || '');
        setValue('patientAddress', patient.patientAddress || '');
      }

      if (selectedSpecify?.genomeTest) {
        setValue('genomeTestId', selectedSpecify.genomeTestId || selectedSpecify.genomeTest.testId || '');
        setValue('testName', selectedSpecify.genomeTest.testName || '');
        setValue('testContent', selectedSpecify.genomeTest.testDescription || '');
        setValue('testSample', (selectedSpecify.genomeTest.testSample || []).join(', '));
      }

      setValue('samplingSite', selectedSpecify?.samplingSite || '');
      setValue(
        'sampleCollectDate',
        selectedSpecify?.sampleCollectDate
          ? new Date(selectedSpecify.sampleCollectDate).toISOString().slice(0, 16)
          : ''
      );
      setValue('embryoNumber', selectedSpecify?.embryoNumber?.toString() || '');
      setValue('geneticTestResults', selectedSpecify?.geneticTestResults || '');
      setValue('geneticTestResultsRelationship', selectedSpecify?.geneticTestResultsRelationship || '');

      if (selectedSpecify?.serviceType && !manualServiceTypeSet) {
        const sType = String(selectedSpecify.serviceType).toLowerCase();
        if (sType === 'reproduction' || sType === 'embryo' || sType === 'disease') {
          setValue('serviceType', sType as any);
        }
      }
    };

    const selectedSpecify = specifyList.find(s => s.specifyVoteID === specifyId);
    if (selectedSpecify) {
      applySpecifyToForm(selectedSpecify as any);
      return;
    }

    specifyVoteTestService
      .getById(String(specifyId))
      .then(res => {
        if (cancelled) return;
        if (res.success && res.data) {
          applySpecifyToForm(res.data as any);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [specifyId, specifyList, setValue, manualServiceTypeSet]);

  const genomeTestId = watch('genomeTestId');
  const serviceTypeWatch = watch('serviceType');
  useEffect(() => {
    if (!genomeTestId) return;
    const selectedTest =
      genomeTestsByService.find(t => t.testId === genomeTestId) ||
      genomeTests.find(t => t.testId === genomeTestId);
    if (selectedTest) {
      setValue('testName', selectedTest.testName || '');
      setValue('testContent', selectedTest.testDescription || '');
      setValue('testSample', (selectedTest.testSample || []).join(', '));
    }
  }, [genomeTestId, genomeTestsByService, genomeTests, setValue]);

  // Helper function to get serviceId from serviceType
  const normalizeServiceTypeKey = (raw?: string): 'reproduction' | 'embryo' | 'disease' | '' => {
    const v = String(raw || '')
      .trim()
      .toLowerCase();
    if (!v) return '';
    if (v === 'reproduction' || v.includes('sản') || v.includes('san')) return 'reproduction';
    if (v === 'embryo' || v.includes('phôi') || v.includes('phoi')) return 'embryo';
    if (v === 'disease' || v.includes('bệnh') || v.includes('benh')) return 'disease';
    return '';
  };
  const getServiceId = (serviceType?: string): string | undefined => {
    if (!serviceType || !services.length) return undefined;
    const normalizedInput = normalizeServiceTypeKey(serviceType);
    const service = services.find(
      s => {
        const byServiceId = s.serviceId?.toLowerCase() === String(serviceType).toLowerCase();
        const byNameExact = s.name?.toLowerCase() === String(serviceType).toLowerCase();
        const byNormalizedName =
          normalizedInput !== '' && normalizeServiceTypeKey(s.name || '') === normalizedInput;
        return Boolean(byServiceId || byNameExact || byNormalizedName);
      }
    );
    return service?.serviceId || serviceType;
  };

  useEffect(() => {
    let cancelled = false;

    const loadGenomeTestsByService = async () => {
      const normalizedType = normalizeServiceTypeKey(String(serviceTypeWatch || ''));
      if (!normalizedType) {
        setGenomeTestsByService(genomeTests);
        return;
      }
      const serviceId = getServiceId(normalizedType);
      if (!serviceId) {
        setGenomeTestsByService([]);
        return;
      }
      setIsLoadingGenomeTestsByService(true);
      try {
        const res = await genomeTestService.getByServiceId(serviceId);
        const tests = getApiResponseData<GenomeTestResponse>(res) || [];
        if (!cancelled) setGenomeTestsByService(tests);
      } catch (error) {
        console.error('[CreateOrder] Failed to fetch genome tests by service:', error);
        if (!cancelled) setGenomeTestsByService([]);
      } finally {
        if (!cancelled) setIsLoadingGenomeTestsByService(false);
      }
    };

    loadGenomeTestsByService();
    return () => {
      cancelled = true;
    };
  }, [serviceTypeWatch, services, genomeTests]);

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      if (!user?.id) throw new Error('Không tìm thấy thông tin người dùng');

      let resolvedPatientIdForSpecify: string | undefined;
      let didCreateServiceSpecificInFlow = false;
      const extractOrderIdFromApiResponse = (res: any): string => {
        const raw = res?.data;
        if (res && typeof res === 'object' && (res as any).orderId) return String((res as any).orderId);
        if (raw && typeof raw === 'object' && raw.orderId) return String(raw.orderId);
        if (raw && typeof raw === 'object' && (raw as any).data?.orderId) {
          return String((raw as any).data.orderId);
        }
        return '';
      };
      const ensureMetadataBySpecifyFallback = async (
        orderId: string,
        specifyId: string
      ): Promise<void> => {
        const oid = String(orderId || '').trim();
        const sid = String(specifyId || '').trim();
        if (!oid || !sid) return;

        const freshOrderRes = await orderService.getById(oid);
        if (!freshOrderRes.success || !freshOrderRes.data) return;
        const freshOrder = freshOrderRes.data as OrderResponse;
        const hasLinkedMetadata =
          Array.isArray(freshOrder.patientMetadata) && freshOrder.patientMetadata.length > 0;
        if (hasLinkedMetadata) return;

        const orderStatusLower = String(freshOrder.orderStatus || '').toLowerCase();
        const paymentStatusUpper = String(freshOrder.paymentStatus || '')
          .trim()
          .toUpperCase();
        const canCreate =
          orderStatusLower === 'accepted' ||
          paymentStatusUpper === 'COMPLETED' ||
          paymentStatusUpper === 'PAID' ||
          paymentStatusUpper === 'TRUE' ||
          paymentStatusUpper === '1';
        if (!canCreate) return;

        const specRes = await specifyVoteTestService.getById(sid);
        if (!specRes.success || !specRes.data) return;
        const spec = specRes.data;
        const patientId = String(spec.patient?.patientId || spec.patientId || '').trim();
        if (!patientId) return;
        const patientName = String(spec.patient?.patientName || '').trim();

        const sampleNamesFromTest = Array.isArray(spec.genomeTest?.testSample)
          ? spec.genomeTest!.testSample!.map(x => String(x || '').trim()).filter(Boolean)
          : [];
        const sampleNames =
          sampleNamesFromTest.length > 0
            ? sampleNamesFromTest
            : [String(spec.genomeTest?.testName || 'Mẫu xét nghiệm').trim()];

        const createdLabcodes: string[] = [];
        for (const sampleName of sampleNames) {
          let createRes = await patientMetadataService.createWithAnalyze({
            specifyId: sid,
            patientId,
            patientName,
            sampleName,
          });
          if (!createRes.success) {
            createRes = await patientMetadataService.create({
              specifyId: sid,
              patientId,
              patientName,
              sampleName,
            });
          }
          if (createRes.success && createRes.data?.labcode) {
            createdLabcodes.push(createRes.data.labcode);
          }
        }

        if (!createdLabcodes.length) return;
        await orderService.updateWithMergedPatch(oid, { patientMetadataIds: createdLabcodes });
      };

      if (!data.paymentType) {
        console.error('[CreateOrder] PaymentType is empty or missing:', data.paymentType);
        throw new Error('Vui lòng chọn hình thức thanh toán');
      }

      const paymentTypeValue = data.paymentType as PaymentType;
      if (
        paymentTypeValue !== PaymentType.CASH &&
        paymentTypeValue !== PaymentType.ONLINE_PAYMENT
      ) {
        console.error('[CreateOrder] Invalid PaymentType:', paymentTypeValue);
        throw new Error('Hình thức thanh toán không hợp lệ');
      }
      if (Boolean((data as any).customerFastq) && paymentTypeValue !== PaymentType.ONLINE_PAYMENT) {
        throw new Error('Đơn có FASTQ chỉ được chọn hình thức thanh toán online.');
      }

      const resolvedPaymentStatus =
        String(data.paymentStatus || 'UNPAID').toUpperCase() === 'COMPLETED'
          ? PaymentStatus.COMPLETED
          : PaymentStatus.UNPAID;

      if (resolvedPaymentStatus === PaymentStatus.COMPLETED) {
        const pn = String(data.patientName || '').trim();
        const pp = String(data.patientPhone || '').trim();
        if (!pn || !pp) {
          throw new Error('Đã thanh toán / hóa đơn: cần có họ tên và số điện thoại bệnh nhân (bước 4).');
        }
        const inv = String(data.invoiceLink || '').trim();
        if (!/^https?:\/\//i.test(inv)) {
          throw new Error(
            'Trạng thái đã thanh toán: vui lòng tải ảnh hóa đơn lên Cloudinary trước khi lưu đơn.'
          );
        }
      }

      if (data.sendEmailToPatient && !String(data.patientEmail || '').trim()) {
        throw new Error('Bật gửi email: vui lòng nhập email nhận thông báo (bước 7).');
      }

      const updateExistingPatientBestEffort = async (patientId: string): Promise<void> => {
        const pid = String(patientId || '').trim();
        const patientNameTrim = String(data.patientName || '').trim();
        const patientPhoneTrim = String(data.patientPhone || '').trim();
        if (!pid || !patientNameTrim || !patientPhoneTrim) return;

        const payload: any = {
          patientPhone: patientPhoneTrim,
          patientName: patientNameTrim,
          patientDob: data.patientDob ? new Date(data.patientDob).toISOString() : undefined,
          gender: data.patientGender?.toLowerCase() || undefined,
          patientEmail: data.patientEmail?.trim() || undefined,
          patientJob: data.patientJob?.trim() || undefined,
          patientContactName: data.patientContactName?.trim() || undefined,
          patientContactPhone: data.patientContactPhone?.trim() || undefined,
          patientAddress: data.patientAddress?.trim() || undefined,
          hospitalId: user.hospitalId || undefined,
        };
        // Match web behavior in update flow:
        // keep the existing linked patient, try update only, ignore unique-phone conflicts.
        await patientService.update(pid, payload).catch(() => undefined);
      };

      let finalSpecifyId = data.specifyId;

      const patientNameTrim = String(data.patientName || '').trim();
      const patientPhoneTrim = String(data.patientPhone || '').trim();
      const canAutoCreateSpecify =
        !linkOrderId &&
        !finalSpecifyId &&
        patientNameTrim &&
        patientPhoneTrim &&
        String(data.serviceType || '').trim() &&
        String(data.genomeTestId || '').trim();

      if (canAutoCreateSpecify) {
        console.log('[CreateOrder] Creating new patient and specify...');

        const patientRequest: any = {
          patientId: generatePatientId(),
          patientPhone: patientPhoneTrim,
          patientName: patientNameTrim,
          patientDob: data.patientDob ? new Date(data.patientDob).toISOString() : undefined,
          gender: data.patientGender?.toLowerCase() || undefined,
          patientEmail: data.patientEmail?.trim() || undefined,
          patientJob: data.patientJob?.trim() || undefined,
          patientContactName: data.patientContactName?.trim() || undefined,
          patientContactPhone: data.patientContactPhone?.trim() || undefined,
          patientAddress: data.patientAddress?.trim() || undefined,
          hospitalId: user.hospitalId || undefined,
        };

        console.log('[CreateOrder] Creating patient:', JSON.stringify(patientRequest, null, 2));
        const patientRes = await patientService.create(patientRequest);

        if (!patientRes.success) {
          throw new Error(patientRes.error || patientRes.message || 'Không thể tạo bệnh nhân');
        }

        const finalPatientId = patientRes.data?.patientId || patientRequest.patientId;
        resolvedPatientIdForSpecify = finalPatientId;
        console.log('[CreateOrder] Patient created with ID:', finalPatientId);

        const serviceId = getServiceId(data.serviceType);
        if (!serviceId) {
          throw new Error('Không tìm thấy dịch vụ tương ứng với loại xét nghiệm');
        }

        if (data.serviceType === 'reproduction') {
          const reproductionRequest: any = {
            serviceId,
            patientId: finalPatientId,
            fetusesNumber: data.fetusesNumber ? parseInt(data.fetusesNumber) : undefined,
            fetusesWeek: data.fetusesWeek ? parseInt(data.fetusesWeek) : undefined,
            fetusesDay: data.fetusesDay ? parseInt(data.fetusesDay) : undefined,
            ultrasoundDay: data.ultrasoundDay || undefined,
            headRumpLength: data.headRumpLength ? parseFloat(data.headRumpLength) : undefined,
            neckLength: data.neckLength ? parseFloat(data.neckLength) : undefined,
            combinedTestResult: data.combinedTestResult || undefined,
            ultrasoundResult: data.ultrasoundResult || undefined,
          };
          await reproductionService.create(reproductionRequest);
          didCreateServiceSpecificInFlow = true;
        } else if (data.serviceType === 'embryo') {
          const embryoRequest: any = {
            serviceId,
            patientId: finalPatientId,
            biospy: data.biospy || undefined,
            biospyDate: data.biospyDate || undefined,
            cellContainingSolution: data.cellContainingSolution || undefined,
            embryoCreate: data.embryoCreate ? parseInt(data.embryoCreate) : undefined,
            embryoStatus: data.embryoStatus || undefined,
            morphologicalAssessment: data.morphologicalAssessment || undefined,
            cellNucleus: data.cellNucleus || false,
            negativeControl: data.negativeControl || undefined,
          };
          await embryoService.create(embryoRequest);
          didCreateServiceSpecificInFlow = true;
        } else if (data.serviceType === 'disease') {
          const diseaseRequest: any = {
            serviceId,
            patientId: finalPatientId,
            symptom: data.symptom || undefined,
            diagnose: data.diagnose || undefined,
            testRelated: data.testRelated || undefined,
            treatmentMethods: data.treatmentMethods || undefined,
            treatmentTimeDay: data.treatmentTimeDay ? parseInt(data.treatmentTimeDay) : undefined,
            drugResistance: data.drugResistance || undefined,
            relapse: data.relapse || undefined,
          };
          await diseaseService.create(diseaseRequest);
          didCreateServiceSpecificInFlow = true;
        }

        const specifyRequest: any = {
          serviceId,
          patientId: finalPatientId,
          genomeTestId: data.genomeTestId,
          embryoNumber: data.embryoNumber ? parseInt(data.embryoNumber) : undefined,
          hospitalId: user.hospitalId || undefined,
          doctorId: data.doctorId || undefined,
          samplingSite: data.samplingSite?.trim() || undefined,
          sampleCollectDate: data.sampleCollectDate
            ? new Date(data.sampleCollectDate).toISOString()
            : undefined,
          geneticTestResults: data.geneticTestResults?.trim() || undefined,
          geneticTestResultsRelationship: data.geneticTestResultsRelationship?.trim() || undefined,
          specifyNote: data.orderNote?.trim() || undefined,
          sendEmailPatient: false,
        };

        console.log('[CreateOrder] Creating specify:', JSON.stringify(specifyRequest, null, 2));
        const specifyRes = await specifyVoteTestService.create(specifyRequest);

        if (!specifyRes.success) {
          throw new Error(specifyRes.error || specifyRes.message || 'Không thể tạo phiếu chỉ định');
        }

        finalSpecifyId = specifyRes.data?.specifyVoteID;
        if (finalSpecifyId) {
          await specifyVoteTestService.updateStatus(String(finalSpecifyId), 'accepted').catch(() => undefined);
        }
        if (finalSpecifyId && data.sendEmailToPatient && data.patientEmail?.trim()) {
          try {
            await syncSpecifySendEmailPatientFlag(String(finalSpecifyId), true, data.patientEmail);
          } catch (updateError) {
            console.error('[CreateOrder] Failed to enable specify email after creating specify:', updateError);
          }
        }
        console.log('[CreateOrder] Specify created with ID:', finalSpecifyId);
      } else if (!finalSpecifyId && patientNameTrim && patientPhoneTrim) {
        // Quick-order flow may input patient fields without running quick-specify.
        // In this case, do not hard-fail; allow creating order without linked specify.
        console.log(
          '[CreateOrder] Skip auto-create specify because serviceType/genomeTestId is incomplete.'
        );
      }

      // Ensure specialized service data (reproduction/embryo/disease) is persisted
      // even when specify is pre-created from quick-specify flow.
      if (!didCreateServiceSpecificInFlow && String(data.serviceType || '').trim()) {
        const st = normalizeServiceTypeKey(String(data.serviceType || ''));
        let patientIdForService = String((data as any).selectedPatientId || '').trim();
        let serviceIdForService = String(getServiceId(data.serviceType) || '').trim();

        if ((!patientIdForService || !serviceIdForService) && String(finalSpecifyId || '').trim()) {
          const sp = await specifyVoteTestService.getById(String(finalSpecifyId).trim());
          if (sp.success && sp.data) {
            patientIdForService = patientIdForService || String(sp.data.patientId || '').trim();
            serviceIdForService = serviceIdForService || String(sp.data.serviceID || '').trim();
          }
        }

        if (st && patientIdForService && serviceIdForService) {
          if (st === 'reproduction') {
            const payload: any = {
              serviceId: serviceIdForService,
              patientId: patientIdForService,
              fetusesNumber: data.fetusesNumber ? parseInt(data.fetusesNumber, 10) : undefined,
              fetusesWeek: data.fetusesWeek ? parseInt(data.fetusesWeek, 10) : undefined,
              fetusesDay: data.fetusesDay ? parseInt(data.fetusesDay, 10) : undefined,
              ultrasoundDay: data.ultrasoundDay || undefined,
              headRumpLength: data.headRumpLength ? parseFloat(data.headRumpLength) : undefined,
              neckLength: data.neckLength ? parseFloat(data.neckLength) : undefined,
              combinedTestResult: data.combinedTestResult || undefined,
              ultrasoundResult: data.ultrasoundResult || undefined,
            };
            const existingRes = await reproductionService.getByServiceId(serviceIdForService);
            const existing = existingRes.success
              ? (existingRes.data || []).find(x => String((x as any).patientId || '') === patientIdForService)
              : undefined;
            if (existing?.id) {
              await reproductionService.update(String(existing.id), payload);
            } else {
              await reproductionService.create(payload);
            }
          } else if (st === 'embryo') {
            const payload: any = {
              serviceId: serviceIdForService,
              patientId: patientIdForService,
              biospy: data.biospy || undefined,
              biospyDate: data.biospyDate || undefined,
              cellContainingSolution: data.cellContainingSolution || undefined,
              embryoCreate: data.embryoCreate ? parseInt(data.embryoCreate, 10) : undefined,
              embryoStatus: data.embryoStatus || undefined,
              morphologicalAssessment: data.morphologicalAssessment || undefined,
              cellNucleus: data.cellNucleus || false,
              negativeControl: data.negativeControl || undefined,
            };
            const existingRes = await embryoService.getByServiceId(serviceIdForService);
            const existing = existingRes.success
              ? (existingRes.data || []).find(x => String((x as any).patientId || '') === patientIdForService)
              : undefined;
            if (existing?.id) {
              await embryoService.update(String(existing.id), payload);
            } else {
              await embryoService.create(payload);
            }
          } else if (st === 'disease') {
            const payload: any = {
              serviceId: serviceIdForService,
              patientId: patientIdForService,
              symptom: data.symptom || undefined,
              diagnose: data.diagnose || undefined,
              testRelated: data.testRelated || undefined,
              treatmentMethods: data.treatmentMethods || undefined,
              treatmentTimeDay: data.treatmentTimeDay ? parseInt(data.treatmentTimeDay, 10) : undefined,
              drugResistance: data.drugResistance || undefined,
              relapse: data.relapse || undefined,
            };
            const existingRes = await diseaseService.getByServiceId(serviceIdForService);
            const existing = existingRes.success
              ? (existingRes.data || []).find(x => String((x as any).patientId || '') === patientIdForService)
              : undefined;
            if (existing?.id) {
              await diseaseService.update(String(existing.id), payload);
            } else {
              await diseaseService.create(payload);
            }
          }
        }
      }

      const createRequest: any = {
        orderName: data.orderName.trim(),
        ...(user.role === 'ROLE_CUSTOMER' && { customerId: user.id }),
        customerFastq: Boolean((data as any).customerFastq),
        specifyId: finalSpecifyId || undefined,
        paymentType: paymentTypeValue,
        orderNote: data.orderNote?.trim() || undefined,
        orderStatus: OrderStatus.ACCEPTED,
        paymentStatus: resolvedPaymentStatus,
        ...(resolvedPaymentStatus === PaymentStatus.COMPLETED &&
          data.invoiceLink &&
          /^https?:\/\//i.test(String(data.invoiceLink).trim()) && {
          invoiceLink: String(data.invoiceLink).trim(),
        }),
        ...(data.staffId && { staffId: data.staffId }),
        ...(data.staffAnalystId && { staffAnalystId: data.staffAnalystId }),
        ...(data.sampleCollectorId && { sampleCollectorId: data.sampleCollectorId }),
        ...(data.barcodeId && { barcodeId: data.barcodeId }),
        ...(data.specifyVoteTestImagePath && {
          specifyVoteImagePath: data.specifyVoteTestImagePath,
        }),
      };

      console.log('[CreateOrder] Creating order:', JSON.stringify(createRequest, null, 2));

      try {
        if (linkOrderId) {
          const lo = linkedOrderRef.current;
          if (!lo?.orderId) {
            throw new Error('Không tải được đơn hàng để cập nhật. Hãy quay lại và thử lại.');
          }
          const loSpec =
            lo.specifyId && typeof lo.specifyId === 'object'
              ? (lo.specifyId as SpecifyVoteTestResponse)
              : null;
          const linkedSpecifyId = String(getOrderSpecifyVoteId(lo) || '').trim();
          const resolvedUpdateSpecifyId =
            String(finalSpecifyId || '').trim() || linkedSpecifyId;
          const updatePayload: Record<string, unknown> = {
            orderName: createRequest.orderName,
            paymentType: paymentTypeValue,
            customerFastq: Boolean((data as any).customerFastq),
            orderStatus: lo.orderStatus || OrderStatus.ACCEPTED,
            paymentStatus: resolvedPaymentStatus,
            orderNote: createRequest.orderNote,
            ...(String(data.invoiceLink || '')
              .trim()
              .match(/^https?:\/\//i)
              ? { invoiceLink: String(data.invoiceLink).trim() }
              : lo.invoiceLink
                ? { invoiceLink: lo.invoiceLink }
                : {}),
            ...(createRequest.staffId && { staffId: createRequest.staffId }),
            ...(createRequest.staffAnalystId && { staffAnalystId: createRequest.staffAnalystId }),
            ...(createRequest.sampleCollectorId && { sampleCollectorId: createRequest.sampleCollectorId }),
            ...(createRequest.barcodeId && { barcodeId: createRequest.barcodeId }),
            ...(createRequest.specifyVoteImagePath && {
              specifyVoteImagePath: createRequest.specifyVoteImagePath,
            }),
            ...(resolvedUpdateSpecifyId && { specifyId: resolvedUpdateSpecifyId }),
          };
          if (lo.customerId) {
            updatePayload.customerId = lo.customerId;
          }
          const updateRes = await orderService.update(linkOrderId, updatePayload);
          if (!updateRes.success) {
            throw new Error(updateRes.message || updateRes.error || 'Cập nhật đơn hàng thất bại');
          }
          if (createRequest.barcodeId) {
            await barcodeService
              .update(String(createRequest.barcodeId), {
                status: BarcodeStatus.NOT_PRINTED,
              })
              .catch(() => undefined);
          }

          const vote = resolvedUpdateSpecifyId;
          const row =
            specifyList.find(s => s.specifyVoteID === vote) ||
            (linkedSpecifyId === vote ? loSpec : undefined);
          const patientIdForSpecify =
            resolvedPatientIdForSpecify ||
            row?.patientId ||
            row?.patient?.patientId ||
            loSpec?.patientId ||
            loSpec?.patient?.patientId;
          if (patientIdForSpecify) {
            await updateExistingPatientBestEffort(String(patientIdForSpecify));
          }
          const genomeTestIdForSpecify =
            (data.genomeTestId || '').trim() || row?.genomeTestId || loSpec?.genomeTestId || '';
          const serviceIdForSpecify =
            getServiceId(data.serviceType) || row?.serviceID || loSpec?.serviceID || '';
          const formDoctorId = (data.doctorId || '').trim();
          const doctorRow = doctors.find(d => String(d.doctorId).trim() === formDoctorId);

          if (vote && serviceIdForSpecify && patientIdForSpecify && genomeTestIdForSpecify) {
            const specifyReq: SpecifyVoteTestRequest = {
              serviceId: serviceIdForSpecify,
              patientId: patientIdForSpecify,
              genomeTestId: genomeTestIdForSpecify,
              embryoNumber: data.embryoNumber ? parseInt(data.embryoNumber, 10) : undefined,
              hospitalId:
                doctorRow?.hospitalId != null && String(doctorRow.hospitalId).trim() !== ''
                  ? String(doctorRow.hospitalId)
                  : loSpec?.hospitalId || user.hospitalId || undefined,
              doctorId: formDoctorId || loSpec?.doctorId || undefined,
              samplingSite: data.samplingSite?.trim() || undefined,
              sampleCollectDate: data.sampleCollectDate
                ? new Date(data.sampleCollectDate).toISOString()
                : undefined,
              geneticTestResults: data.geneticTestResults?.trim() || undefined,
              geneticTestResultsRelationship: data.geneticTestResultsRelationship?.trim() || undefined,
              specifyNote: data.orderNote?.trim() || undefined,
              sendEmailPatient: Boolean(
                data.sendEmailToPatient && String(data.patientEmail || '').trim()
              ),
            };
            const specifyUp = await specifyVoteTestService.update(vote, specifyReq);
            if (!specifyUp.success) {
              throw new Error(specifyUp.message || specifyUp.error || 'Cập nhật phiếu xét nghiệm thất bại');
            }
          }

          if (linkOrderId && user?.hospitalId) {
            await ensureSinglePaidOrderPatientMetadataLikeWeb(linkOrderId, String(user.hospitalId)).catch(
              () => undefined
            );
          }

          return updateRes;
        }

        const response = await orderService.create(createRequest);
        console.log('[CreateOrder] Order creation response:', JSON.stringify(response, null, 2));

        if (!response.success) {
          let errorMessage = response.message || response.error || 'Tạo đơn hàng thất bại';
          if (response.data && Array.isArray(response.data)) {
            const validationErrors = response.data
              .map((err: any) => {
                if (typeof err === 'object' && err.message) {
                  return err.message;
                }
                return String(err);
              })
              .join('; ');
            if (validationErrors) {
              errorMessage = `${errorMessage}: ${validationErrors}`;
            }
          }

          console.error('[CreateOrder] API error:', errorMessage, response);
          throw new Error(errorMessage);
        }
        if (createRequest.barcodeId) {
          await barcodeService
            .update(String(createRequest.barcodeId), {
              status: BarcodeStatus.NOT_PRINTED,
            })
            .catch(() => undefined);
        }

        if (data.sendZaloToPatient && data.patientPhone?.trim()) {
          console.log('[CreateOrder] Zalo notification requested');
          console.log('[CreateOrder] Patient phone:', data.patientPhone);
        }

        const sidAfterCreate = String(finalSpecifyId || '').trim();
        if (sidAfterCreate) {
          try {
            await syncSpecifySendEmailPatientFlag(
              sidAfterCreate,
              Boolean(data.sendEmailToPatient),
              data.patientEmail
            );
          } catch (emailErr) {
            console.error('[CreateOrder] sync specify email after order create:', emailErr);
          }
        }

        const createdOrderId = extractOrderIdFromApiResponse(response);
        if (createdOrderId && user?.hospitalId) {
          await ensureSinglePaidOrderPatientMetadataLikeWeb(
            createdOrderId,
            String(user.hospitalId)
          ).catch(() => undefined);
          if (sidAfterCreate) {
            await ensureMetadataBySpecifyFallback(createdOrderId, sidAfterCreate).catch(() => undefined);
          }
        }

        return response;
      } catch (error: any) {
        console.error('[CreateOrder] Exception:', error);
        let errorMessage = 'Tạo đơn hàng thất bại';

        if (error instanceof Error) {
          errorMessage = error.message;
          if (
            errorMessage.includes('already used') ||
            errorMessage.includes('duplicate key') ||
            errorMessage.includes('uk66b7ribqen473vde5ay62u050')
          ) {
            errorMessage =
              'Phiếu chỉ định này đã được sử dụng cho một đơn hàng khác. Vui lòng chọn phiếu chỉ định khác hoặc tạo phiếu chỉ định mới.';
          }
          errorMessage = error.message;
          if (
            errorMessage.includes('already used') ||
            errorMessage.includes('duplicate key') ||
            errorMessage.includes('uk66b7ribqen473vde5ay62u050')
          ) {
            errorMessage =
              'Phiếu chỉ định này đã được sử dụng cho một đơn hàng khác. Vui lòng chọn phiếu chỉ định khác hoặc tạo phiếu chỉ định mới.';
          }
        }

        throw new Error(errorMessage);
      }
    },
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['specify-vote-tests'] });
      if (linkOrderId) {
        queryClient.invalidateQueries({ queryKey: ['order', linkOrderId] });
      }

      if (response.data) {
        const orderData = response.data as any;
        const formData = getValues();
        setCreatedOrderData({
          orderId: (linkOrderId || orderData.orderId) as string,
          orderName: orderData.orderName || (formData as any).orderName,
          paymentAmount:
            typeof orderData?.paymentAmount === 'number' && !Number.isNaN(orderData.paymentAmount)
              ? orderData.paymentAmount
              : 0,
          specifyId: (formData as any).specifyId,
        });
      }

      setShowSuccessModal(true);
    },
    onError: (error: any) => {
      presentFeedbackError({
        title: 'Lỗi tạo đơn hàng',
        message: error?.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.',
      });
    },
  });

  const validateCurrentStep = async (): Promise<boolean> => {
    switch (currentStep) {
      case 1: {
        const orderName = getValues('orderName');
        const paymentType = getValues('paymentType');
        const customerFastq = Boolean((getValues() as any).customerFastq);

        if (!orderName || !orderName.trim()) {
          presentFeedbackError({ title: 'Lỗi', message: 'Vui lòng nhập tên đơn hàng' });
          return false;
        }

        if (!paymentType) {
          presentFeedbackError({ title: 'Lỗi', message: 'Vui lòng chọn hình thức thanh toán' });
          return false;
        }
        if (customerFastq && paymentType !== PaymentType.ONLINE_PAYMENT) {
          presentFeedbackError({
            title: 'Hình thức thanh toán không hợp lệ',
            message: 'Đơn có FASTQ chỉ được thanh toán online.',
          });
          return false;
        }

        const paymentStatus = getValues('paymentStatus');
        const isPaymentCompleted = String(paymentStatus || 'UNPAID').toUpperCase() === 'COMPLETED';
        // Allow moving through steps to fill patient info in step 4.
        // Paid-order requirements are enforced on final submit.
        if (isPaymentCompleted) return true;

        return true;
      }
      case 3: {
        // Match web behavior: do not hard-block moving step by detailed
        // service-specific fields at this stage.
        return true;
      }
      case 4: {
        const genomeTestId = String(getValues('genomeTestId') || '').trim();
        if (!genomeTestId) {
          presentFeedbackError({
            title: 'Thiếu thông tin',
            message: 'Vui lòng chọn mã xét nghiệm ở bước 4 trước khi chuyển tiếp.',
          });
          return false;
        }
        return true;
      }
      case 5: {
        // Match web behavior: clinical fields are not mandatory for step navigation.
        return true;
      }
      case 7: {
        if (getValues('sendEmailToPatient') && !String(getValues('patientEmail') || '').trim()) {
          presentFeedbackError({
            title: 'Thiếu email',
            message: 'Bật gửi email: vui lòng nhập email nhận thông báo.',
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
    const isValid = await validateCurrentStep();
    if (!isValid) return;

    if (currentStep === TOTAL_STEPS) {
      handleSubmit();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else {
      setCurrentStep(prev => Math.max(prev - 1, 1));
    }
  };

  const handleSubmit = async () => {
    const orderName = getValues('orderName');
    const paymentType = getValues('paymentType');
    const customerFastq = Boolean((getValues() as any).customerFastq);

    if (!orderName || !orderName.trim()) {
      presentFeedbackError({ title: 'Lỗi', message: 'Vui lòng nhập tên đơn hàng' });
      setCurrentStep(1);
      return;
    }

    if (!paymentType) {
      presentFeedbackError({ title: 'Lỗi', message: 'Vui lòng chọn hình thức thanh toán' });
      setCurrentStep(1);
      return;
    }
    if (customerFastq && paymentType !== PaymentType.ONLINE_PAYMENT) {
      presentFeedbackError({
        title: 'Hình thức thanh toán không hợp lệ',
        message: 'Đơn có FASTQ chỉ được thanh toán online.',
      });
      setCurrentStep(1);
      return;
    }

    const ps = String(getValues('paymentStatus') || 'UNPAID').toUpperCase();
    if (ps === 'COMPLETED') {
      const pn = String(getValues('patientName') || '').trim();
      const pp = String(getValues('patientPhone') || '').trim();
      if (!pn || !pp) {
        presentFeedbackError({
          title: 'Chưa đủ thông tin',
          message: 'Đã thanh toán / hóa đơn: cần có họ tên và SĐT bệnh nhân (bước 4).',
        });
        setCurrentStep(1);
        return;
      }
      const inv = String(getValues('invoiceLink') || '').trim();
      if (!/^https?:\/\//i.test(inv)) {
        presentFeedbackError({
          title: 'Thiếu hóa đơn',
          message: 'Đã thanh toán: vui lòng tải ảnh hóa đơn lên Cloudinary trước khi lưu.',
        });
        setCurrentStep(1);
        return;
      }
    }

    if (getValues('sendEmailToPatient') && !String(getValues('patientEmail') || '').trim()) {
      presentFeedbackError({
        title: 'Thiếu email',
        message: 'Bật gửi email: vui lòng nhập email nhận thông báo ở bước 7.',
      });
      setCurrentStep(7);
      return;
    }

    if (!user?.id) {
      presentFeedbackError({
        title: 'Lỗi',
        message: 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = getValues();
      await createOrderMutation.mutateAsync(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (uri: string): Promise<string | null> => {
    setIsUploadingImage(true);
    try {
      return uri;
    } catch (error) {
      presentFeedbackError({ title: 'Lỗi', message: 'Không thể tải ảnh lên. Vui lòng thử lại.' });
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const openQuickSpecifyForm = () => {
    const data = getValues();
    router.push({
      pathname: '/staff/quick-specify',
      params: {
        returnPath: '/staff/create-order',
        orderId: linkOrderId || '',
        serviceType: String(data.serviceType || ''),
        genomeTestId: String(data.genomeTestId || ''),
        doctorId: String(data.doctorId || ''),
      },
    });
  };

  useEffect(() => {
    if (!showQuickSpecifyModal) return;
    const d = doctors.find(x => String(x.doctorId) === String(quickSpecifyForm.doctorId || ''));
    if (!d) return;
    const hid = String(d.hospitalId || '');
    const hname = String(d.hospitalName || '');
    setQuickSpecifyForm(prev => ({
      ...prev,
      hospitalId: hid || prev.hospitalId,
      samplingSite: prev.samplingSite || hname,
    }));
  }, [showQuickSpecifyModal, quickSpecifyForm.doctorId, doctors]);

  useEffect(() => {
    if (!showQuickSpecifyModal) return;
    const hid = String(quickSpecifyForm.hospitalId || '').trim();
    if (!hid) {
      setQuickPatients([]);
      return;
    }
    let cancelled = false;
    setLoadingQuickPatients(true);
    patientService
      .getByHospitalId(hid)
      .then(res => {
        if (cancelled) return;
        setQuickPatients(res.success && Array.isArray(res.data) ? (res.data as any[]) : []);
      })
      .catch(() => {
        if (!cancelled) setQuickPatients([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuickPatients(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showQuickSpecifyModal, quickSpecifyForm.hospitalId]);

  useEffect(() => {
    if (!showQuickSpecifyModal) return;
    const sid = String(quickSpecifyForm.serviceId || '').trim();
    if (!sid) {
      setQuickGenomeTests([]);
      return;
    }
    let cancelled = false;
    setLoadingQuickGenomeTests(true);
    genomeTestService
      .getByServiceId(sid)
      .then(res => {
        if (cancelled) return;
        setQuickGenomeTests(getApiResponseData<GenomeTestResponse>(res) || []);
      })
      .catch(() => {
        if (!cancelled) setQuickGenomeTests([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuickGenomeTests(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showQuickSpecifyModal, quickSpecifyForm.serviceId]);

  const handleQuickCreateSpecify = async () => {
    if (isCreatingSpecifyQuick) return;
    const serviceId = String(quickSpecifyForm.serviceId || '').trim();
    const patientId = String(quickSpecifyForm.patientId || '').trim();
    const genomeTestId = String(quickSpecifyForm.genomeTestId || '').trim();
    if (!serviceId) {
      presentFeedbackError({
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn dịch vụ.',
      });
      return;
    }
    if (!patientId) {
      presentFeedbackError({
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn bệnh nhân.',
      });
      return;
    }
    if (!genomeTestId) {
      presentFeedbackError({
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn xét nghiệm.',
      });
      return;
    }

    setIsCreatingSpecifyQuick(true);
    try {
      const specifyRes = await specifyVoteTestService.create({
        serviceId,
        patientId,
        genomeTestId,
        embryoNumber: undefined,
        hospitalId: String(quickSpecifyForm.hospitalId || '').trim() || user?.hospitalId || undefined,
        doctorId: String(quickSpecifyForm.doctorId || '').trim() || undefined,
        samplingSite: String(quickSpecifyForm.samplingSite || '').trim() || undefined,
        sampleCollectDate: undefined,
        geneticTestResults: undefined,
        geneticTestResultsRelationship: undefined,
        specifyNote: String(quickSpecifyForm.specifyNote || '').trim() || undefined,
        sendEmailPatient: false,
      });
      if (!specifyRes.success || !specifyRes.data?.specifyVoteID) {
        throw new Error(specifyRes.error || specifyRes.message || 'Không thể tạo phiếu chỉ định');
      }
      await specifyVoteTestService.updateStatus(specifyRes.data.specifyVoteID, 'accepted');

      const createdSpecifyId = specifyRes.data.specifyVoteID;
      const detail = await specifyVoteTestService.getById(createdSpecifyId);

      setValue('specifyId', createdSpecifyId, { shouldDirty: true, shouldValidate: true });
      setManualServiceTypeSet(true);
      setValue('selectedPatientId' as any, patientId, { shouldDirty: true, shouldValidate: false } as any);
      if (detail.success && detail.data) {
        const d = detail.data;
        if (d.patient) {
          setValue('patientPhone', d.patient.patientPhone || '');
          setValue('patientName', d.patient.patientName || '');
          setValue('patientDob', d.patient.patientDob ? formatDateOnly(d.patient.patientDob) : '');
          setValue('patientGender', d.patient.gender || '');
          setValue('patientEmail', d.patient.patientEmail || '');
          setValue('patientJob', d.patient.patientJob || '');
          setValue('patientContactName', d.patient.patientContactName || '');
          setValue('patientContactPhone', d.patient.patientContactPhone || '');
          setValue('patientAddress', d.patient.patientAddress || '');
        }
        if (d.genomeTest) {
          setValue('genomeTestId', d.genomeTestId || d.genomeTest.testId || '');
          setValue('testName', d.genomeTest.testName || '');
          setValue('testContent', d.genomeTest.testDescription || '');
          setValue('testSample', Array.isArray(d.genomeTest.testSample) ? d.genomeTest.testSample.join(', ') : '');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['specify-vote-tests', 'aggregated', 'create-order'] });
      setShowQuickSpecifyModal(false);
    } catch (error: any) {
      presentFeedbackError({
        title: 'Tạo nhanh phiếu xét nghiệm thất bại',
        message: error?.message || 'Không thể tạo nhanh phiếu xét nghiệm.',
      });
    } finally {
      setIsCreatingSpecifyQuick(false);
    }
  };

  const openQuickDoctorPicker = () => setShowQuickDoctorModal(true);

  const openQuickPatientPicker = () => {
    if (!String(quickSpecifyForm.doctorId || '').trim()) {
      presentFeedbackError({
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn bác sĩ chỉ định trước.',
      });
      return;
    }
    if (loadingQuickPatients) {
      presentFeedbackError({
        title: 'Đang tải',
        message: 'Danh sách bệnh nhân đang tải, vui lòng thử lại sau vài giây.',
      });
      return;
    }
    if (!quickPatients.length) {
      presentFeedbackError({
        title: 'Không có dữ liệu',
        message: 'Không có bệnh nhân phù hợp với phòng khám/bệnh viện đã chọn.',
      });
      return;
    }
    setShowQuickPatientModal(true);
  };

  const openQuickServicePicker = () => {
    if (!services.length) {
      presentFeedbackError({
        title: 'Không có dữ liệu',
        message: 'Danh sách dịch vụ đang trống hoặc chưa tải xong.',
      });
      return;
    }
    setShowQuickServiceModal(true);
  };

  const openQuickGenomePicker = () => {
    if (!String(quickSpecifyForm.serviceId || '').trim()) {
      presentFeedbackError({
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn dịch vụ trước.',
      });
      return;
    }
    if (loadingQuickGenomeTests) {
      presentFeedbackError({
        title: 'Đang tải',
        message: 'Danh sách xét nghiệm đang tải, vui lòng thử lại sau vài giây.',
      });
      return;
    }
    if (!quickGenomeTests.length) {
      presentFeedbackError({
        title: 'Không có dữ liệu',
        message: 'Không có xét nghiệm cho dịch vụ đã chọn.',
      });
      return;
    }
    setShowQuickGenomeModal(true);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1BasicOrderInfo
            doctors={doctors}
            staffList={staffList}
            staffAnalystList={staffAnalystList}
            sampleCollectorList={sampleCollectorList}
            barcodes={availableBarcodes}
            hospitalName={hospitalName}
            isEditMode={Boolean(linkOrderId)}
          />
        );
      case 2:
        return (
          <Step2SpecifyImage isUploading={isUploadingImage} onImageSelect={handleImageUpload} />
        );
      case 3:
        return (
          <Step6ServiceType
            isEditMode={Boolean(linkOrderId)}
            onManualServiceTypeSet={() => setManualServiceTypeSet(true)}
            onQuickCreateSpecify={
              !linkOrderId && !String(specifyId || '').trim() ? openQuickSpecifyForm : undefined
            }
            creatingSpecify={false}
          />
        );
      case 4:
        return (
          <Step3SpecifyInfo
            specifyList={specifyList}
            genomeTests={genomeTestsByService}
            isEditMode={Boolean(linkOrderId)}
          />
        );
      case 5:
        return <Step4ClinicalInfo isEditMode={Boolean(linkOrderId)} />;
      case 6:
        return <Step5GeneticResults />;
      case 7:
        return <Step7OrderNote />;
      default:
        return null;
    }
  };

  const isLoading =
    isLoadingDoctors ||
    isLoadingStaff ||
    isLoadingBarcodes ||
    isLoadingSpecify ||
    isLoadingGenomeTests ||
    isLoadingGenomeTestsByService ||
    (Boolean(linkOrderId) && (isLoadingLinkedOrder || !linkedOrder || !linkHydrated));

  if (linkOrderId && isLinkedOrderError) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="mb-4 text-center text-base font-bold text-slate-800">
          Không tải được đơn hàng để hoàn thiện.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-2xl bg-cyan-600 px-6 py-3"
          activeOpacity={0.85}
        >
          <Text className="text-[15px] font-extrabold text-white">Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (linkOrderId && !isLoadingLinkedOrder && !linkedOrder) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="mb-4 text-center text-base font-bold text-slate-800">Không tìm thấy đơn hàng.</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-2xl bg-cyan-600 px-6 py-3"
          activeOpacity={0.85}
        >
          <Text className="text-[15px] font-extrabold text-white">Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0891B2" />
        <Text className="mt-4 text-slate-600">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <FormProvider {...methods}>
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" />

        <View className="pb-4 px-5 bg-white border-b border-slate-200">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={handleBack}
              className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-100 items-center justify-center"
              activeOpacity={0.75}
            >
              <ArrowLeft size={22} color="#0891B2" strokeWidth={2.5} />
            </TouchableOpacity>

            <View className="flex-1 items-center px-3">
              <Text className="text-[15px] font-extrabold text-slate-900" numberOfLines={1}>
                {linkOrderId ? 'Chỉnh sửa đơn hàng' : 'Thêm đơn hàng'}
              </Text>
              <Text className="mt-0.5 text-[11px] font-bold text-slate-500" numberOfLines={1}>
                {linkOrderId
                  ? 'Cùng màn hình tạo đơn — dữ liệu đã được điền sẵn'
                  : 'Hoàn thiện theo từng bước'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.back()}
              className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200"
              activeOpacity={0.75}
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

            <View className="px-3 py-1.5 rounded-2xl bg-cyan-50 border border-cyan-100">
              <Text className="text-sm font-extrabold text-cyan-700">{currentStep}</Text>
            </View>
          </View>

          <Stepper
            totalSteps={TOTAL_STEPS}
            currentStep={currentStep}
            onStepPress={step => setCurrentStep(step)}
          />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 110 + insets.bottom }}
        >
          {renderCurrentStep()}
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
            className={`flex-1 h-12 rounded-2xl items-center justify-center ${isSubmitting ? 'bg-cyan-400' : 'bg-cyan-600'
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

        <Modal
          visible={showSuccessModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowSuccessModal(false);
            router.push('/staff/orders');
          }}
        >
          <View className="flex-1 bg-black/60 justify-center items-center p-5">
            <View className="bg-white rounded-3xl w-full max-w-[420px] overflow-hidden border border-slate-200">
              <View className="items-center p-6">
                <View className="w-16 h-16 rounded-2xl bg-emerald-500/12 border border-emerald-200 items-center justify-center">
                  <Check size={30} color="#22C55E" strokeWidth={3} />
                </View>

                <Text className="mt-4 text-[16px] font-extrabold text-slate-900">
                  {linkOrderId ? 'Đã cập nhật đơn' : 'Tạo đơn thành công'}
                </Text>
                <Text className="mt-2 text-[12px] font-bold text-slate-500 text-center leading-5">
                  {linkOrderId
                    ? 'Đơn đã gắn phiếu và được lưu. Bạn có thể xem chi tiết trong danh sách đơn hàng.'
                    : 'Đơn hàng đã được lưu. Bạn có thể xem trong danh sách đơn hàng.'}
                </Text>
              </View>

              <View className="flex-row p-4 gap-3 border-t border-slate-200 bg-slate-50">
                <TouchableOpacity
                  className="flex-1 h-12 rounded-2xl items-center justify-center bg-white border border-slate-200"
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.push('/staff/orders');
                  }}
                  activeOpacity={0.85}
                >
                  <Text className="text-[14px] font-extrabold text-slate-700">Xem danh sách</Text>
                </TouchableOpacity>

                {createdOrderData && createdOrderData.paymentAmount > 0 && (
                  <TouchableOpacity
                    className="flex-1 h-12 rounded-2xl items-center justify-center bg-emerald-600"
                    onPress={() => {
                      setShowSuccessModal(false);
                      router.push({
                        pathname: '/staff/payment',
                        params: {
                          orderId: createdOrderData.orderId,
                          orderName: createdOrderData.orderName,
                          amount: createdOrderData.paymentAmount.toString(),
                          specifyId: createdOrderData.specifyId || '',
                        },
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <Text className="text-[14px] font-extrabold text-white">Thanh toán</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  className="flex-1 h-12 rounded-2xl items-center justify-center bg-cyan-600"
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.back();
                  }}
                  activeOpacity={0.85}
                >
                  <Text className="text-[14px] font-extrabold text-white">Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showQuickSpecifyModal} transparent animationType="fade" onRequestClose={() => setShowQuickSpecifyModal(false)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-4">
            <View className="w-full max-w-[560px] rounded-3xl bg-white p-5 border border-slate-200">
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1 pr-3">
                  <Text className="text-[18px] font-extrabold text-slate-900 mb-1">Tạo nhanh phiếu xét nghiệm</Text>
                  <Text className="text-[12px] font-semibold text-slate-500">
                    Chọn thông tin giống form web để tạo phiếu mới nhanh chóng.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowQuickSpecifyModal(false)}
                  className="h-9 w-9 rounded-full bg-slate-100 items-center justify-center"
                >
                  <Text className="text-[18px] text-slate-600">×</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={openQuickDoctorPicker}
                className="border border-slate-200 rounded-xl px-3 py-3 mb-2 bg-white"
              >
                <Text className="text-[12px] text-slate-500">
                  Bác sĩ chỉ định <Text className="text-rose-500">*</Text>
                </Text>
                <Text className="text-[14px] font-bold text-slate-800">
                  {doctors.find(d => String(d.doctorId) === quickSpecifyForm.doctorId)?.doctorName || 'Chọn bác sĩ chỉ định'}
                </Text>
              </TouchableOpacity>
              <View className="border border-slate-200 rounded-xl px-3 py-3 mb-2 bg-slate-50">
                <Text className="text-[12px] text-slate-500">Phòng khám / Bệnh viện</Text>
                <Text className="text-[14px] font-bold text-slate-700">
                  {doctors.find(d => String(d.doctorId) === quickSpecifyForm.doctorId)?.hospitalName || 'Tự động điền theo bác sĩ chỉ định'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={openQuickPatientPicker}
                disabled={!String(quickSpecifyForm.doctorId || '').trim()}
                className={`border rounded-xl px-3 py-3 mb-2 ${String(quickSpecifyForm.doctorId || '').trim()
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-200 bg-slate-50'
                  }`}
              >
                <Text className="text-[12px] text-slate-500">Bệnh nhân *</Text>
                <Text className="text-[14px] font-bold text-slate-800">
                  {quickPatients.find(p => String(p.patientId) === quickSpecifyForm.patientId)?.patientName ||
                    (String(quickSpecifyForm.doctorId || '').trim()
                      ? loadingQuickPatients
                        ? 'Đang tải bệnh nhân...'
                        : 'Chọn bệnh nhân'
                      : 'Vui lòng chọn bác sĩ trước')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openQuickServicePicker} className="border border-slate-200 rounded-xl px-3 py-3 mb-2">
                <Text className="text-[12px] text-slate-500">Dịch vụ *</Text>
                <Text className="text-[14px] font-bold text-slate-800">
                  {services.find(s => String(s.serviceId) === quickSpecifyForm.serviceId)?.name || 'Chọn dịch vụ'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openQuickGenomePicker}
                disabled={!String(quickSpecifyForm.serviceId || '').trim()}
                className={`border rounded-xl px-3 py-3 mb-2 ${String(quickSpecifyForm.serviceId || '').trim()
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-200 bg-slate-50'
                  }`}
              >
                <Text className="text-[12px] text-slate-500">Xét nghiệm *</Text>
                <Text className="text-[14px] font-bold text-slate-800">
                  {quickGenomeTests.find(t => String(t.testId) === quickSpecifyForm.genomeTestId)?.testName || 'Chọn xét nghiệm'}
                </Text>
              </TouchableOpacity>
              <TextInput value={quickSpecifyForm.samplingSite} onChangeText={v => setQuickSpecifyForm(p => ({ ...p, samplingSite: v }))} placeholder="Nơi thu mẫu" className="border border-slate-200 rounded-xl px-3 py-2 mb-2" />
              <TextInput value={quickSpecifyForm.specifyNote} onChangeText={v => setQuickSpecifyForm(p => ({ ...p, specifyNote: v }))} placeholder="Ghi chú (không bắt buộc)" className="border border-slate-200 rounded-xl px-3 py-2 mb-3" />
              <View className="flex-row gap-2">
                <TouchableOpacity onPress={() => setShowQuickSpecifyModal(false)} className="flex-1 rounded-xl border border-slate-200 py-3 items-center">
                  <Text className="font-bold text-slate-700">Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void handleQuickCreateSpecify()} disabled={isCreatingSpecifyQuick} className="flex-1 rounded-xl bg-cyan-600 py-3 items-center">
                  <Text className="font-extrabold text-white">{isCreatingSpecifyQuick ? 'Đang tạo...' : 'Tạo phiếu'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <SelectionModal
          visible={showQuickDoctorModal}
          title="Chọn bác sĩ chỉ định"
          options={doctors.map(d => ({ value: String(d.doctorId), label: `${d.doctorName}${d.hospitalName ? ` - ${d.hospitalName}` : ''}` }))}
          selectedValue={quickSpecifyForm.doctorId}
          onSelect={value =>
            setQuickSpecifyForm(p => ({
              ...p,
              doctorId: value,
              patientId: '',
              hospitalId: String(doctors.find(d => String(d.doctorId) === value)?.hospitalId || ''),
              samplingSite: String(doctors.find(d => String(d.doctorId) === value)?.hospitalName || p.samplingSite),
            }))
          }
          onClose={() => setShowQuickDoctorModal(false)}
        />
        <SelectionModal
          visible={showQuickPatientModal}
          title={loadingQuickPatients ? 'Đang tải bệnh nhân...' : 'Chọn bệnh nhân'}
          options={quickPatients.map((p: any) => ({ value: String(p.patientId), label: `${p.patientName || '-'} - ${p.patientPhone || ''}` }))}
          selectedValue={quickSpecifyForm.patientId}
          onSelect={value => setQuickSpecifyForm(p => ({ ...p, patientId: value }))}
          onClose={() => setShowQuickPatientModal(false)}
        />
        <SelectionModal
          visible={showQuickServiceModal}
          title="Chọn dịch vụ"
          options={services.map(s => ({ value: String(s.serviceId), label: s.name }))}
          selectedValue={quickSpecifyForm.serviceId}
          onSelect={value => setQuickSpecifyForm(p => ({ ...p, serviceId: value, genomeTestId: '' }))}
          onClose={() => setShowQuickServiceModal(false)}
        />
        <SelectionModal
          visible={showQuickGenomeModal}
          title={loadingQuickGenomeTests ? 'Đang tải xét nghiệm...' : 'Chọn xét nghiệm'}
          options={quickGenomeTests.map(t => ({ value: String(t.testId), label: `${t.testId} - ${t.testName}` }))}
          selectedValue={quickSpecifyForm.genomeTestId}
          onSelect={value => setQuickSpecifyForm(p => ({ ...p, genomeTestId: value }))}
          onClose={() => setShowQuickGenomeModal(false)}
        />
      </SafeAreaView>
    </FormProvider>
  );
}
