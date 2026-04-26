import { zodResolver } from '@hookform/resolvers/zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, ChevronDown, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, useForm, type FieldError } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { getFieldError } from '@/components/form/error-utils';
import {
  FormDatePicker,
  FormFieldGroup,
  FormInfoBox,
  FormInput,
  FormNumericInput,
  FormReadOnly,
  FormSelect,
  FormTextarea,
} from '@/components/form';
import { useAuth } from '@/contexts/AuthContext';
import {
  createOrderDefaultValues,
  createOrderSchema,
  parseFlexibleDate,
  GENDER_OPTIONS,
  EMBRYO_COUNT_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  SERVICE_TYPE_MAPPER,
  type CreateOrderFormData,
} from '@/lib/schemas/order-schemas';
import { ORDER_STATUS_ON_CREATE } from '@/lib/constants/order-status';
import { SpecifyStatus, PaymentStatus } from '@/lib/schemas/order-form-schema';
import { setListFreshOnNextFocus } from '@/lib/list-navigation-flags';
import { collectUsedSpecifyVoteIdsFromOrders } from '@/lib/order-used-specify';
import { getApiResponseData } from '@/lib/types/api-types';
import { collectUsedBarcodeStringsFromOrders } from '@/utils/order-barcode';
import { BarcodeResponse, barcodeService } from '@/services/barcodeService';
import { CustomerResponse, customerService } from '@/services/customerService';
import { DoctorResponse, doctorService } from '@/services/doctorService';
import { GenomeTestResponse, genomeTestService } from '@/services/genomeTestService';
import { HospitalStaffResponse, hospitalStaffService } from '@/services/hospitalStaffService';
import { orderService, type OrderResponse } from '@/services/orderService';
import { patientService, type PatientResponse } from '@/services/patientService';
import { ServiceResponse, serviceService } from '@/services/serviceService';
import {
  specifyVoteTestService,
  type SpecifyVoteTestResponse,
} from '@/services/specifyVoteTestService';
import { reproductionService } from '@/services/reproductionService';
import { embryoService } from '@/services/embryoService';
import { diseaseService } from '@/services/diseaseService';
import { patientClinicalService } from '@/services/patientClinicalService';
import {
  patientMetadataService,
  type PatientMetadataResponse,
} from '@/services/patientMetadataService';
import { uploadFileToCloudinary, uploadImageToCloudinary } from '@/utils/cloudinary';
import { parseVndAmountInput } from '@/utils/money';
import {
  isLabPosition,
  isStaffAnalystWebRule,
  isStaffPosition,
} from '@/utils/hospital-staff-position';

const TOTAL_STEPS = 6;
const STEP_TITLES = [
  'Thông tin đơn hàng & thanh toán',
  'Phiếu xét nghiệm, bác sĩ & bệnh nhân',
  'Thông tin nhóm xét nghiệm',
  'Thông tin lâm sàng',
  'Thông tin xét nghiệm',
  'Kết quả xét nghiệm di truyền',
];

const toISO = (s?: string) => {
  if (!s || !s.trim()) return undefined;
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
};

const toDateInput = (value?: string) => {
  if (!value || !String(value).trim()) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const safeTrim = (value: unknown): string => String(value ?? '').trim();

/**
 * Giống web (`invoice-payment-page` / `invoice-creation`): mỗi phần tử `genomeTest.testSample`
 * tạo một bản ghi patient metadata với `sampleName` = tên mẫu (Tiểu, Blood…), không gộp một dòng.
 */
function resolveSampleNamesForPatientMetadata(
  genomeTestRow: { testSample?: string[] | string; testName?: string } | null | undefined,
  formData: CreateOrderFormData,
  orderName: string,
): string[] {
  const raw = genomeTestRow?.testSample;
  let parts: string[] = [];
  if (Array.isArray(raw) && raw.length > 0) {
    parts = raw.map((s) => safeTrim(s)).filter(Boolean);
  } else if (typeof raw === 'string' && raw.trim()) {
    parts = raw
      .split(/[,，]/)
      .map((s) => safeTrim(s))
      .filter(Boolean);
  } else {
    const step5 = safeTrim(formData.step5?.testSample);
    if (step5) {
      parts = step5
        .split(/[,，]/)
        .map((s) => safeTrim(s))
        .filter(Boolean);
    }
  }
  if (parts.length > 0) return parts;

  const single =
    safeTrim(formData.step6?.samplingSite) ||
    safeTrim(formData.step5?.testName) ||
    safeTrim(orderName) ||
    safeTrim(formData.step2?.patientName) ||
    '';
  return single ? [single] : [];
}

/**
 * Trạng thái phiếu chỉ định sau khi tạo đơn — khớp web:
 * - FASTQ do khách upload → `waiting_receive_sample` (giống customer forward-test có FASTQ).
 * - Đã thanh toán xong (ghi nhận trên đơn) → `waiting_receive_sample` (giống payment-page sau COMPLETED).
 * - Còn lại (staff tạo đơn, chờ xử lý) → `accepted` (giống htgen `order-new` sau create).
 */
function resolveSpecifyStatusAfterOrderCreate(formData: CreateOrderFormData): SpecifyStatus {
  const fastqYes = formData.step6.fastq === 'YES';
  const ps = String(formData.step6.paymentStatus ?? '')
    .trim()
    .toUpperCase();
  const paid = ps === PaymentStatus.COMPLETED;

  if (fastqYes) return SpecifyStatus.WAITING_RECEIVE_SAMPLE;
  if (paid) return SpecifyStatus.WAITING_RECEIVE_SAMPLE;
  return SpecifyStatus.ACCEPTED;
}
const normalizeServiceType = (value?: string): 'reproduction' | 'embryo' | 'disease' | '' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'reproduction' || normalized === 'sản' || normalized === 'san') {
    return 'reproduction';
  }
  if (normalized === 'embryo' || normalized === 'phôi' || normalized === 'phoi') {
    return 'embryo';
  }
  if (normalized === 'disease' || normalized === 'bệnh lý' || normalized === 'benh ly') {
    return 'disease';
  }
  return '';
};
const pickLatestPatientService = <T extends { patientId?: string; serviceId?: string; createdAt?: string }>(
  records: T[],
  patientId: string,
  serviceId?: string
): T | undefined => {
  if (!Array.isArray(records) || !patientId) return undefined;

  const normalizedPatientId = safeTrim(patientId);
  const normalizedServiceId = safeTrim(serviceId);
  const filtered = records.filter((item) => {
    if (safeTrim(item.patientId) !== normalizedPatientId) return false;
    if (!normalizedServiceId) return true;
    return safeTrim(item.serviceId) === normalizedServiceId;
  });

  if (!filtered.length) return undefined;
  return filtered.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  })[0];
};
const MAX_SPECIFY_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

/** Giống admin web `FETUS_NUMBER_OPTIONS` / `EMBRYO_NUMBER_OPTIONS` */
const STEP3_COUNT_123_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
] as const;

export default function CreateOrderScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const targetOrdersRoute = source === 'admin' ? '/admin/orders' : '/orders';

  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoadingPatient, setIsLoadingPatient] = useState(false);
  const [hasPreviousOrders, setHasPreviousOrders] = useState(false);
  const [autofilledFields, setAutofilledFields] = useState<string[]>([]);
  const [patientMetadataList, setPatientMetadataList] = useState<PatientMetadataResponse[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isUploadingSpecifyFile, setIsUploadingSpecifyFile] = useState(false);
  const [isUploadingInvoiceFile, setIsUploadingInvoiceFile] = useState(false);
  const [uploadingStep3DiagnoseImage, setUploadingStep3DiagnoseImage] = useState(false);
  const [specifyIdPickerOpen, setSpecifyIdPickerOpen] = useState(false);
  const [specifyPickerQuery, setSpecifyPickerQuery] = useState('');
  const orderNameCacheRef = useRef<string>('');
  const lastAutofilledGenomeTestIdRef = useRef<string>('');
  const lastAutofilledSpecifyIdRef = useRef<string>('');
  /** Tăng mỗi khi mã phiếu đổi — hủy tải/ghi form từ lần nhập cũ (tránh nhảy sang phiếu khác khi xóa). */
  const specifyAutofillRunIdRef = useRef(0);
  /** Theo dõi mã phiếu bước 2 — khi xóa hết mã thì reset dữ liệu đã fill từ phiếu. */
  const prevStep2SpecifyIdForResetRef = useRef('');
  /** Tránh reset nhầm khi ô tạm thành rỗng giữa chừng lúc gõ/xóa từng ký tự. */
  const specifyIdClearResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHadValidStep2PhoneRef = useRef(false);

  const methods = useForm<CreateOrderFormData>({
    resolver: zodResolver(createOrderSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    shouldUnregister: false,
    defaultValues: createOrderDefaultValues,
  });
  const methodsRef = useRef(methods);
  methodsRef.current = methods;

  /** Xóa toàn bộ dữ liệu đã fill từ phiếu; `null` = ô mã trống, còn string = giữ đúng mã đang nhập (sai/không tìm thấy). */
  const resetSpecifyAutofillBundle = useCallback((keepSpecifyInput: string | null) => {
    const m = methodsRef.current;
    specifyAutofillRunIdRef.current += 1;
    lastAutofilledSpecifyIdRef.current = '';
    lastAutofilledGenomeTestIdRef.current = '';
    setHasPreviousOrders(false);
    const vals = m.getValues();
    const step2Next =
      keepSpecifyInput === null
        ? { ...createOrderDefaultValues.step2 }
        : { ...createOrderDefaultValues.step2, specifyId: keepSpecifyInput };
    m.reset({
      ...vals,
      step1: { ...vals.step1, doctorId: '', hospitalId: '' },
      step2: step2Next,
      step3: { ...createOrderDefaultValues.step3 },
      step4: { ...createOrderDefaultValues.step4 },
      step5: { ...createOrderDefaultValues.step5 },
      step6: {
        ...vals.step6,
        samplingSite: '',
        sampleCollectDate: '',
        embryoNumber: '',
      },
      step7: { ...createOrderDefaultValues.step7 },
    });
    prevStep2SpecifyIdForResetRef.current =
      keepSpecifyInput === null ? '' : safeTrim(keepSpecifyInput);
  }, []);

  const { data: doctorsResponse } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorService.getAll(),
    retry: false,
  });

  const { data: customersResponse } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerService.getAll(),
    retry: false,
  });

  const { data: staffResponse } = useQuery({
    queryKey: ['hospital-staffs'],
    queryFn: () => hospitalStaffService.getAll(),
    retry: false,
  });

  const { data: barcodesResponse } = useQuery({
    queryKey: ['barcodes'],
    queryFn: () => barcodeService.getAll(),
    retry: false,
  });

  const { data: ordersResponse } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderService.getAll(),
    retry: false,
  });

  const { data: genomeTestsResponse } = useQuery({
    queryKey: ['genome-tests'],
    queryFn: () => genomeTestService.getAll(),
    retry: false,
  });

  const { data: patientsResponse } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
    retry: false,
  });

  const patients = getApiResponseData<PatientResponse>(patientsResponse);

  const { data: servicesResponse } = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceService.getAll(),
    retry: false,
  });
  const { data: specifyVoteTestsResponse } = useQuery({
    queryKey: ['specify-vote-tests'],
    queryFn: () => specifyVoteTestService.getAll(),
    retry: false,
  });

  const doctors = getApiResponseData<DoctorResponse>(doctorsResponse);
  const customers = getApiResponseData<CustomerResponse>(customersResponse);
  const staffs = getApiResponseData<HospitalStaffResponse>(staffResponse);
  const paymentStaffs = useMemo(
    () => staffs.filter((s) => isStaffPosition((s as any).staffPosition)),
    [staffs]
  );
  const analystStaffs = useMemo(
    () => staffs.filter((s) => isStaffAnalystWebRule(s as HospitalStaffResponse)),
    [staffs]
  );
  const allBarcodes = getApiResponseData<BarcodeResponse>(barcodesResponse);
  const genomeTests = getApiResponseData<GenomeTestResponse>(genomeTestsResponse);
  const services = getApiResponseData<ServiceResponse>(servicesResponse);
  const specifyVoteTests = getApiResponseData<SpecifyVoteTestResponse>(specifyVoteTestsResponse);
  const selectedHospitalId = methods.watch('step1.hospitalId');
  const selectedDoctorId = methods.watch('step1.doctorId');
  const watchedSampleCollectorId = methods.watch('step1.sampleCollectorId');

  /** Giống update-order-wizard: nếu đã chọn NV nhưng không lọt danh sách LAB (chuỗi vai trò lệch API), vẫn gắn option để FormSelect hiện tên. */
  const collectorStaffs = useMemo(() => {
    const filtered = staffs.filter((s) =>
      isLabPosition((s as HospitalStaffResponse).staffPosition)
    );
    const id = String(watchedSampleCollectorId || '').trim();
    if (!id) return filtered;
    if (filtered.some((s) => String(s.staffId).trim() === id)) return filtered;
    const current = staffs.find((s) => String(s.staffId).trim() === id);
    if (current) return [...filtered, current];
    return [
      ...filtered,
      {
        staffId: id,
        staffName: id,
        staffPosition: 'sample_collector',
      } as HospitalStaffResponse,
    ];
  }, [staffs, watchedSampleCollectorId]);

  const hospitalOptions = useMemo(() => {
    const hospitalMap = new Map<string, { value: string; label: string }>();
    doctors.forEach((doctor: any) => {
      const hospitalId = String(doctor.hospitalId || '').trim();
      if (!hospitalId) return;
      if (!hospitalMap.has(hospitalId)) {
        hospitalMap.set(hospitalId, {
          value: hospitalId,
          label: String(doctor.hospitalName || hospitalId),
        });
      }
    });
    return Array.from(hospitalMap.values());
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    if (!selectedHospitalId) return doctors;
    return doctors.filter((doctor: any) => String(doctor.hospitalId || '') === selectedHospitalId);
  }, [doctors, selectedHospitalId]);
  const serviceOptions = useMemo(() => {
    const seen = new Set<string>();
    const uniqueServices: Array<{
      value: string;
      label: string;
      serviceId: string;
      uniqueKey: string;
    }> = [];

    services.forEach((service, index) => {
      if (!service.name || !service.serviceId) return;
      const normalizedType = normalizeServiceType(service.name);
      const normalizedName = service.name.toLowerCase();
      const optionValue = normalizedType || normalizedName;
      if (!seen.has(optionValue)) {
        seen.add(optionValue);
        uniqueServices.push({
          value: optionValue,
          label: SERVICE_TYPE_MAPPER[optionValue] || service.name,
          serviceId: service.serviceId,
          uniqueKey: `${service.serviceId}-${index}`, // Always unique key
        });
      }
    });

    return uniqueServices;
  }, [services]);

  const usedSpecifyIdSet = useMemo(
    () => collectUsedSpecifyVoteIdsFromOrders(getApiResponseData<OrderResponse>(ordersResponse)),
    [ordersResponse]
  );

  const specifyIdOptions = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ value: string; label: string }> = [];
    specifyVoteTests.forEach((item: any) => {
      const id = safeTrim(item?.specifyVoteID || item?.specifyId);
      if (!id || seen.has(id)) return;
      if (usedSpecifyIdSet.has(id)) return;
      seen.add(id);
      const patientName = safeTrim(item?.patient?.patientName);
      items.push({
        value: id,
        label: patientName ? `${id} - ${patientName}` : id,
      });
    });
    return items;
  }, [specifyVoteTests, usedSpecifyIdSet]);

  const filteredSpecifyPickOptions = useMemo(() => {
    const q = specifyPickerQuery.trim().toLowerCase();
    if (!q) return specifyIdOptions;
    return specifyIdOptions.filter(
      o =>
        o.label.toLowerCase().includes(q) ||
        String(o.value).toLowerCase().includes(q)
    );
  }, [specifyIdOptions, specifyPickerQuery]);

  useFocusEffect(
    useCallback(() => {
      const checkForNewTest = async () => {
        try {
          const newTestId = await AsyncStorage.getItem('newlyCreatedTestId');
          if (newTestId && genomeTests.length > 0) {
            const newTest = genomeTests.find((t: any) => t.testId === newTestId);
            if (newTest) {
              methods.setValue('step5.genomeTestId', newTestId, {
                shouldDirty: true,
                shouldTouch: true,
              });
              setCurrentStep(5);
              await AsyncStorage.removeItem('newlyCreatedTestId');
            }
          }
        } catch {}
      };
      queryClient.invalidateQueries({ queryKey: ['genome-tests'] });
      setTimeout(checkForNewTest, 300);
    }, [queryClient, genomeTests, methods])
  );

  const usedBarcodeIds = useMemo(() => {
    const orders = getApiResponseData<OrderResponse>(ordersResponse);
    return collectUsedBarcodeStringsFromOrders(orders);
  }, [ordersResponse]);

  const availableBarcodes = useMemo(() => {
    return allBarcodes.filter(b => !usedBarcodeIds.has(String(b.barcode).trim()));
  }, [allBarcodes, usedBarcodeIds]);

  const serviceType = methods.watch('step3.serviceType');
  const watchedOrderName = methods.watch('step1.orderName');
  const isFastqEnabled = methods.watch('step6.fastq') === 'YES';
  const specifyVoteImagePath = String(methods.watch('step6.specifyVoteImagePath') || '').trim();
  const paymentStatusWatched = methods.watch('step6.paymentStatus');
  const paymentAmountWatched = String(methods.watch('step6.paymentAmount') || '').trim();
  const invoiceLinkWatched = String(methods.watch('step6.invoiceLink') || '').trim();
  const filteredGenomeTests = useMemo(() => {
    if (!serviceType) return genomeTests;
    return genomeTests.filter(test => {
      const serviceName = test.service?.name?.toLowerCase();
      return normalizeServiceType(serviceName) === normalizeServiceType(serviceType);
    });
  }, [genomeTests, serviceType]);

  const genomeTestId = methods.watch('step5.genomeTestId');
  useEffect(() => {
    const cached = safeTrim(watchedOrderName);
    if (cached) {
      orderNameCacheRef.current = cached;
    }
  }, [watchedOrderName]);

  useEffect(() => {
    if (currentStep !== 1) return;
    const currentOrderName = safeTrim(methods.getValues('step1.orderName'));
    if (!currentOrderName && orderNameCacheRef.current) {
      methods.setValue('step1.orderName', orderNameCacheRef.current, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }, [currentStep, methods]);
  useEffect(() => {
    if (isFastqEnabled) {
      methods.setValue('step6.paymentType', 'ONLINE_PAYMENT', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      methods.clearErrors('step6.paymentType');
    }
  }, [isFastqEnabled, methods]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!selectedDoctorId) return;
    const doctor = doctors.find((d: any) => d.doctorId === selectedDoctorId);
    const doctorHospitalId = String((doctor as any)?.hospitalId || '').trim();
    if (doctorHospitalId && doctorHospitalId !== selectedHospitalId) {
      methods.setValue('step1.hospitalId', doctorHospitalId, { shouldDirty: true, shouldTouch: true });
    }
  }, [selectedDoctorId, selectedHospitalId, doctors, methods]);

  useEffect(() => {
    if (!selectedHospitalId || !selectedDoctorId) return;
    const doctor = doctors.find((d: any) => d.doctorId === selectedDoctorId);
    const doctorHospitalId = String((doctor as any)?.hospitalId || '').trim();
    if (doctorHospitalId && doctorHospitalId !== selectedHospitalId) {
      methods.setValue('step1.doctorId', '', { shouldDirty: true, shouldTouch: true });
    }
  }, [selectedHospitalId, selectedDoctorId, doctors, methods]);
  useEffect(() => {
    if (!genomeTestId) {
      lastAutofilledGenomeTestIdRef.current = '';
      return;
    }
    const test = genomeTests.find((t: any) => t.testId === genomeTestId);
    if (!test) return;
    // Chỉ điền tự động khi đổi mã xét nghiệm (tránh ghi đè khi genomeTests refetch hoặc khi user đã sửa tay)
    if (lastAutofilledGenomeTestIdRef.current === genomeTestId) return;
    lastAutofilledGenomeTestIdRef.current = genomeTestId;
    methods.setValue('step5.testName', test.testName || '', {
      shouldDirty: true,
      shouldTouch: true,
    });
    methods.setValue(
      'step5.testSample',
      Array.isArray(test.testSample) ? test.testSample.join(', ') : test.testSample || '',
      { shouldDirty: true, shouldTouch: true }
    );
    methods.setValue('step5.testContent', test.testDescription || '', {
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [genomeTestId, genomeTests, methods]);

  useEffect(() => {
    const parsedAmount = parseVndAmountInput(paymentAmountWatched);
    const hasCollectedAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
    if (!hasCollectedAmount) return;
    if (paymentStatusWatched === 'COMPLETED') return;

    methods.setValue('step6.paymentStatus', 'COMPLETED', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    methods.clearErrors('step6.paymentStatus');
  }, [paymentAmountWatched, paymentStatusWatched, methods]);

  useEffect(() => {
    if (paymentStatusWatched !== 'COMPLETED') {
      const cur = String(methods.getValues('step6.invoiceLink') || '').trim();
      if (cur) {
        methods.setValue('step6.invoiceLink', '', {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
    }
    if (paymentStatusWatched === 'UNPAID') {
      const currentAmount = String(methods.getValues('step6.paymentAmount') || '').trim();
      if (currentAmount) {
        methods.setValue('step6.paymentAmount', '', {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
    }
  }, [paymentStatusWatched, methods]);

  const patientPhoneRaw = methods.watch('step2.patientPhone');
  const patientPhone = String(patientPhoneRaw ?? '');
  const step2SpecifyIdRaw = methods.watch('step2.specifyId');

  useEffect(() => {
    const thisRun = ++specifyAutofillRunIdRef.current;
    let cancelled = false;
    const typedSpecifyId = safeTrim(step2SpecifyIdRaw);
    if (currentStep !== 2) return;

    if (!typedSpecifyId || typedSpecifyId.length < 4) {
      if (!typedSpecifyId) {
        lastAutofilledSpecifyIdRef.current = '';
      } else if (typedSpecifyId.length < 4 && lastAutofilledSpecifyIdRef.current) {
        resetSpecifyAutofillBundle(typedSpecifyId);
      }
      return;
    }

    const loadSpecifyAndAutofill = async () => {
        if (thisRun !== specifyAutofillRunIdRef.current) return;
        try {
          let specify: any | undefined;
          const typedTrim = safeTrim(typedSpecifyId);
          const exactLocal = specifyVoteTests.find(
            (item: any) => safeTrim(item?.specifyVoteID || item?.specifyId) === typedTrim
          );
          if (exactLocal) {
            specify = exactLocal;
          } else {
            const specifyResponse = await specifyVoteTestService.getById(typedSpecifyId);
            if (cancelled || thisRun !== specifyAutofillRunIdRef.current) return;

            if (specifyResponse?.success && specifyResponse?.data) {
              specify = specifyResponse.data;
            } else {
              const normalizedTypedId = typedSpecifyId.toLowerCase();
              const fallbackSpecify = specifyVoteTests.find((item: any) => {
                const id = safeTrim(item?.specifyVoteID || item?.specifyId).toLowerCase();
                if (!id) return false;
                return id === normalizedTypedId;
              });
              if (fallbackSpecify) {
                specify = fallbackSpecify;
              }
            }
          }
          if (cancelled || thisRun !== specifyAutofillRunIdRef.current) return;

          if (!specify) {
            const verifyMissing = safeTrim(methodsRef.current.getValues('step2.specifyId'));
            if (verifyMissing !== typedSpecifyId) return;
            if (lastAutofilledSpecifyIdRef.current) {
              resetSpecifyAutofillBundle(typedSpecifyId);
            }
            Alert.alert('Không tìm thấy', `Không tìm thấy phiếu xét nghiệm với mã "${typedSpecifyId}".`);
            return;
          }

          const setOpts = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;
          const specifyVoteId = safeTrim(specify.specifyVoteID || typedSpecifyId);
          const patientId = safeTrim(specify.patientId || specify.patient?.patientId);
          let patient = specify.patient;

          if ((!patient || !safeTrim(patient?.patientName)) && patientId) {
            try {
              const patientResponse = await patientService.getById(patientId);
              if (
                !cancelled &&
                thisRun === specifyAutofillRunIdRef.current &&
                patientResponse?.success &&
                patientResponse?.data
              ) {
                patient = patientResponse.data;
              }
            } catch {
              // Keep using patient data from specify response when patient lookup fails.
            }
          }

          if (cancelled || thisRun !== specifyAutofillRunIdRef.current) return;

          const verifySpecifyId = safeTrim(methods.getValues('step2.specifyId'));
          if (verifySpecifyId !== typedSpecifyId && verifySpecifyId !== specifyVoteId) return;

          methods.setValue('step2.specifyId', specifyVoteId, setOpts);
          methods.clearErrors('step2.specifyId');
          if (safeTrim(specify.specifyNote)) {
            methods.setValue('step2.specifyImagePath', safeTrim(specify.specifyNote), setOpts);
          }
          if (patientId) {
            methods.setValue('step2.patientId', patientId, setOpts);
          }

          if (patient) {
            if (safeTrim(patient.patientName)) {
              methods.setValue('step2.patientName', safeTrim(patient.patientName), setOpts);
            }
            if (safeTrim(patient.patientPhone)) {
              methods.setValue('step2.patientPhone', safeTrim(patient.patientPhone), setOpts);
            }
            const patientDob = toDateInput(patient.patientDob || patient.dateOfBirth);
            if (patientDob) {
              methods.setValue('step2.patientDob', patientDob, setOpts);
            }
            const gender = safeTrim(patient.gender).toLowerCase();
            if (gender === 'male' || gender === 'female' || gender === 'other') {
              methods.setValue('step2.patientGender', gender as any, setOpts);
            }
            if (safeTrim(patient.patientEmail || patient.email)) {
              methods.setValue(
                'step2.patientEmail',
                safeTrim(patient.patientEmail || patient.email),
                setOpts
              );
            }
            if (safeTrim(patient.patientJob)) {
              methods.setValue('step2.patientJob', safeTrim(patient.patientJob), setOpts);
            }
            if (safeTrim(patient.patientContactName)) {
              methods.setValue(
                'step2.patientContactName',
                safeTrim(patient.patientContactName),
                setOpts
              );
            }
            if (safeTrim(patient.patientContactPhone)) {
              methods.setValue(
                'step2.patientContactPhone',
                safeTrim(patient.patientContactPhone),
                setOpts
              );
            }
            if (safeTrim(patient.patientAddress || patient.address)) {
              methods.setValue(
                'step2.patientAddress',
                safeTrim(patient.patientAddress || patient.address),
                setOpts
              );
            }
          }

          const doctorId = safeTrim(specify.doctorId || specify.doctor?.doctorId);
          if (doctorId) {
            methods.setValue('step1.doctorId', doctorId, setOpts);
          }
          const hospitalId = safeTrim(specify.hospitalId || specify.hospital?.hospitalId);
          if (hospitalId) {
            methods.setValue('step1.hospitalId', hospitalId, setOpts);
          }

          const selectedGenomeTestId = safeTrim(specify.genomeTestId || specify.genomeTest?.testId);
          const selectedGenomeTest = selectedGenomeTestId
            ? genomeTests.find((t: any) => t.testId === selectedGenomeTestId)
            : undefined;
          const specifyServiceId = safeTrim(
            specify.serviceID || specify.serviceId || selectedGenomeTest?.service?.serviceId
          );
          const specifyService = specifyServiceId
            ? services.find((service: any) => safeTrim(service.serviceId) === specifyServiceId)
            : undefined;
          if (selectedGenomeTestId) {
            methods.setValue('step5.genomeTestId', selectedGenomeTestId, setOpts);
          }
          const testName = safeTrim(specify.genomeTest?.testName || selectedGenomeTest?.testName);
          if (testName) {
            methods.setValue('step5.testName', testName, setOpts);
          }
          const testSampleRaw = specify.genomeTest?.testSample ?? selectedGenomeTest?.testSample;
          const testSample = Array.isArray(testSampleRaw)
            ? testSampleRaw.join(', ')
            : safeTrim(testSampleRaw);
          if (testSample) {
            methods.setValue('step5.testSample', testSample, setOpts);
          }
          const testContent = safeTrim(
            specify.genomeTest?.testDescription || selectedGenomeTest?.testDescription
          );
          if (testContent) {
            methods.setValue('step5.testContent', testContent, setOpts);
          }

          const serviceTypeFromSpecify = normalizeServiceType(
            safeTrim(specify.serviceType) ||
              safeTrim(specify.service?.name) ||
              safeTrim(specify.service?.serviceType) ||
              safeTrim(selectedGenomeTest?.service?.name) ||
              safeTrim(specifyService?.name)
          );
          if (serviceTypeFromSpecify) {
            methods.setValue('step3.serviceType', serviceTypeFromSpecify, setOpts);
          }

          // Fallback: some backends embed step3 data directly on specify payload.
          const embeddedReproduction = specify.reproduction || specify.reproductionService || specify;
          const embeddedEmbryo = specify.embryo || specify.embryoService || specify;
          const embeddedDisease = specify.disease || specify.diseaseService || specify;

          if (embeddedReproduction.fetusesNumber !== undefined && embeddedReproduction.fetusesNumber !== null) {
            methods.setValue('step3.fetusesNumber', String(embeddedReproduction.fetusesNumber), setOpts);
          }
          if (embeddedReproduction.fetusesWeek !== undefined && embeddedReproduction.fetusesWeek !== null) {
            methods.setValue('step3.fetusesWeek', String(embeddedReproduction.fetusesWeek), setOpts);
          }
          if (embeddedReproduction.fetusesDay !== undefined && embeddedReproduction.fetusesDay !== null) {
            methods.setValue('step3.fetusesDay', String(embeddedReproduction.fetusesDay), setOpts);
          }
          const embeddedUltrasoundDay = toDateInput(embeddedReproduction.ultrasoundDay);
          if (embeddedUltrasoundDay) {
            methods.setValue('step3.ultrasoundDay', embeddedUltrasoundDay, setOpts);
          }
          if (
            embeddedReproduction.headRumpLength !== undefined &&
            embeddedReproduction.headRumpLength !== null
          ) {
            methods.setValue('step3.headRumpLength', String(embeddedReproduction.headRumpLength), setOpts);
          }
          if (embeddedReproduction.neckLength !== undefined && embeddedReproduction.neckLength !== null) {
            methods.setValue('step3.neckLength', String(embeddedReproduction.neckLength), setOpts);
          }
          if (safeTrim(embeddedReproduction.combinedTestResult)) {
            methods.setValue(
              'step3.combinedTestResult',
              safeTrim(embeddedReproduction.combinedTestResult),
              setOpts
            );
          }
          if (safeTrim(embeddedReproduction.ultrasoundResult)) {
            methods.setValue(
              'step3.ultrasoundResult',
              safeTrim(embeddedReproduction.ultrasoundResult),
              setOpts
            );
          }

          if (safeTrim(embeddedEmbryo.biospy)) {
            methods.setValue('step3.biospy', safeTrim(embeddedEmbryo.biospy), setOpts);
          }
          const embeddedBiospyDate = toDateInput(embeddedEmbryo.biospyDate);
          if (embeddedBiospyDate) {
            methods.setValue('step3.biospyDate', embeddedBiospyDate, setOpts);
          }
          if (safeTrim(embeddedEmbryo.cellContainingSolution)) {
            methods.setValue(
              'step3.cellContainingSolution',
              safeTrim(embeddedEmbryo.cellContainingSolution),
              setOpts
            );
          }
          if (embeddedEmbryo.embryoCreate !== undefined && embeddedEmbryo.embryoCreate !== null) {
            methods.setValue('step3.embryoCreate', String(embeddedEmbryo.embryoCreate), setOpts);
          }
          if (safeTrim(embeddedEmbryo.embryoStatus)) {
            methods.setValue('step3.embryoStatus', safeTrim(embeddedEmbryo.embryoStatus), setOpts);
          }
          if (safeTrim(embeddedEmbryo.morphologicalAssessment)) {
            methods.setValue(
              'step3.morphologicalAssessment',
              safeTrim(embeddedEmbryo.morphologicalAssessment),
              setOpts
            );
          }
          if (typeof embeddedEmbryo.cellNucleus === 'boolean') {
            methods.setValue('step3.cellNucleus', embeddedEmbryo.cellNucleus, setOpts);
          }
          if (safeTrim(embeddedEmbryo.negativeControl)) {
            methods.setValue('step3.negativeControl', safeTrim(embeddedEmbryo.negativeControl), setOpts);
          }

          if (safeTrim(embeddedDisease.symptom)) {
            methods.setValue('step3.symptom', safeTrim(embeddedDisease.symptom), setOpts);
          }
          if (safeTrim(embeddedDisease.diagnose)) {
            methods.setValue('step3.diagnose', safeTrim(embeddedDisease.diagnose), setOpts);
          }
          if (safeTrim(embeddedDisease.diagnoseImage)) {
            methods.setValue('step3.diagnoseImage', safeTrim(embeddedDisease.diagnoseImage), setOpts);
          }
          if (safeTrim(embeddedDisease.testRelated)) {
            methods.setValue('step3.testRelated', safeTrim(embeddedDisease.testRelated), setOpts);
          }
          if (safeTrim(embeddedDisease.treatmentMethods)) {
            methods.setValue(
              'step3.treatmentMethods',
              safeTrim(embeddedDisease.treatmentMethods),
              setOpts
            );
          }
          if (embeddedDisease.treatmentTimeDay !== undefined && embeddedDisease.treatmentTimeDay !== null) {
            methods.setValue('step3.treatmentTimeDay', String(embeddedDisease.treatmentTimeDay), setOpts);
          }
          if (safeTrim(embeddedDisease.drugResistance)) {
            methods.setValue('step3.drugResistance', safeTrim(embeddedDisease.drugResistance), setOpts);
          }
          if (safeTrim(embeddedDisease.relapse)) {
            methods.setValue('step3.relapse', safeTrim(embeddedDisease.relapse), setOpts);
          }

          if (patientId) {
            const [clinicalResult, reproductionResult, embryoResult, diseaseResult] =
              await Promise.allSettled([
                patientClinicalService.getByPatientId(patientId),
                reproductionService.getAll(),
                embryoService.getAll(),
                diseaseService.getAll(),
              ]);
            if (cancelled || thisRun !== specifyAutofillRunIdRef.current) return;

            const clinicalData =
              clinicalResult.status === 'fulfilled' && clinicalResult.value?.success
                ? clinicalResult.value.data
                : undefined;
            if (clinicalData) {
              if (clinicalData.patientHeight !== undefined && clinicalData.patientHeight !== null) {
                methods.setValue('step4.patientHeight', String(clinicalData.patientHeight), setOpts);
              }
              if (clinicalData.patientWeight !== undefined && clinicalData.patientWeight !== null) {
                methods.setValue('step4.patientWeight', String(clinicalData.patientWeight), setOpts);
              }
              if (safeTrim(clinicalData.patientHistory)) {
                methods.setValue('step4.patientHistory', safeTrim(clinicalData.patientHistory), setOpts);
              }
              if (safeTrim(clinicalData.familyHistory)) {
                methods.setValue('step4.familyHistory', safeTrim(clinicalData.familyHistory), setOpts);
              }
              if (safeTrim(clinicalData.toxicExposure)) {
                methods.setValue('step4.toxicExposure', safeTrim(clinicalData.toxicExposure), setOpts);
              }
              if (safeTrim(clinicalData.medicalHistory)) {
                methods.setValue('step4.medicalHistory', safeTrim(clinicalData.medicalHistory), setOpts);
              }
              if (safeTrim(clinicalData.chronicDisease)) {
                methods.setValue('step4.chronicDisease', safeTrim(clinicalData.chronicDisease), setOpts);
              }
              if (safeTrim(clinicalData.acuteDisease)) {
                methods.setValue('step4.acuteDisease', safeTrim(clinicalData.acuteDisease), setOpts);
              }
              const medicalUsingText = Array.isArray(clinicalData.medicalUsing)
                ? clinicalData.medicalUsing.map((item: string) => safeTrim(item)).filter(Boolean).join(', ')
                : safeTrim(clinicalData.medicalUsing as any);
              if (medicalUsingText) {
                methods.setValue('step4.medicalUsing', medicalUsingText, setOpts);
              }
            }

            const reproductionData =
              reproductionResult.status === 'fulfilled' && reproductionResult.value?.success
                ? pickLatestPatientService(
                    reproductionResult.value.data || [],
                    patientId,
                    specifyServiceId || undefined
                  )
                : undefined;
            const embryoData =
              embryoResult.status === 'fulfilled' && embryoResult.value?.success
                ? pickLatestPatientService(
                    embryoResult.value.data || [],
                    patientId,
                    specifyServiceId || undefined
                  )
                : undefined;
            const diseaseData =
              diseaseResult.status === 'fulfilled' && diseaseResult.value?.success
                ? pickLatestPatientService(
                    diseaseResult.value.data || [],
                    patientId,
                    specifyServiceId || undefined
                  )
                : undefined;

            if (!serviceTypeFromSpecify) {
              if (reproductionData) methods.setValue('step3.serviceType', 'reproduction', setOpts);
              else if (embryoData) methods.setValue('step3.serviceType', 'embryo', setOpts);
              else if (diseaseData) methods.setValue('step3.serviceType', 'disease', setOpts);
            }

            if (reproductionData) {
              if (reproductionData.fetusesNumber !== undefined && reproductionData.fetusesNumber !== null) {
                methods.setValue('step3.fetusesNumber', String(reproductionData.fetusesNumber), setOpts);
              }
              if (reproductionData.fetusesWeek !== undefined && reproductionData.fetusesWeek !== null) {
                methods.setValue('step3.fetusesWeek', String(reproductionData.fetusesWeek), setOpts);
              }
              if (reproductionData.fetusesDay !== undefined && reproductionData.fetusesDay !== null) {
                methods.setValue('step3.fetusesDay', String(reproductionData.fetusesDay), setOpts);
              }
              const ultrasoundDay = toDateInput(reproductionData.ultrasoundDay);
              if (ultrasoundDay) {
                methods.setValue('step3.ultrasoundDay', ultrasoundDay, setOpts);
              }
              if (
                reproductionData.headRumpLength !== undefined &&
                reproductionData.headRumpLength !== null
              ) {
                methods.setValue('step3.headRumpLength', String(reproductionData.headRumpLength), setOpts);
              }
              if (reproductionData.neckLength !== undefined && reproductionData.neckLength !== null) {
                methods.setValue('step3.neckLength', String(reproductionData.neckLength), setOpts);
              }
              if (safeTrim(reproductionData.combinedTestResult)) {
                methods.setValue(
                  'step3.combinedTestResult',
                  safeTrim(reproductionData.combinedTestResult),
                  setOpts
                );
              }
              if (safeTrim(reproductionData.ultrasoundResult)) {
                methods.setValue(
                  'step3.ultrasoundResult',
                  safeTrim(reproductionData.ultrasoundResult),
                  setOpts
                );
              }
            }

            if (embryoData) {
              if (safeTrim(embryoData.biospy)) {
                methods.setValue('step3.biospy', safeTrim(embryoData.biospy), setOpts);
              }
              const biospyDate = toDateInput(embryoData.biospyDate);
              if (biospyDate) {
                methods.setValue('step3.biospyDate', biospyDate, setOpts);
              }
              if (safeTrim(embryoData.cellContainingSolution)) {
                methods.setValue(
                  'step3.cellContainingSolution',
                  safeTrim(embryoData.cellContainingSolution),
                  setOpts
                );
              }
              if (embryoData.embryoCreate !== undefined && embryoData.embryoCreate !== null) {
                methods.setValue('step3.embryoCreate', String(embryoData.embryoCreate), setOpts);
              }
              if (safeTrim(embryoData.embryoStatus)) {
                methods.setValue('step3.embryoStatus', safeTrim(embryoData.embryoStatus), setOpts);
              }
              if (safeTrim(embryoData.morphologicalAssessment)) {
                methods.setValue(
                  'step3.morphologicalAssessment',
                  safeTrim(embryoData.morphologicalAssessment),
                  setOpts
                );
              }
              if (typeof embryoData.cellNucleus === 'boolean') {
                methods.setValue('step3.cellNucleus', embryoData.cellNucleus, setOpts);
              }
              if (safeTrim(embryoData.negativeControl)) {
                methods.setValue('step3.negativeControl', safeTrim(embryoData.negativeControl), setOpts);
              }
            }

            if (diseaseData) {
              if (safeTrim(diseaseData.symptom)) {
                methods.setValue('step3.symptom', safeTrim(diseaseData.symptom), setOpts);
              }
              if (safeTrim(diseaseData.diagnose)) {
                methods.setValue('step3.diagnose', safeTrim(diseaseData.diagnose), setOpts);
              }
              if (safeTrim(diseaseData.diagnoseImage)) {
                methods.setValue('step3.diagnoseImage', safeTrim(diseaseData.diagnoseImage), setOpts);
              }
              if (safeTrim(diseaseData.testRelated)) {
                methods.setValue('step3.testRelated', safeTrim(diseaseData.testRelated), setOpts);
              }
              if (safeTrim(diseaseData.treatmentMethods)) {
                methods.setValue(
                  'step3.treatmentMethods',
                  safeTrim(diseaseData.treatmentMethods),
                  setOpts
                );
              }
              if (diseaseData.treatmentTimeDay !== undefined && diseaseData.treatmentTimeDay !== null) {
                methods.setValue(
                  'step3.treatmentTimeDay',
                  String(diseaseData.treatmentTimeDay),
                  setOpts
                );
              }
              if (safeTrim(diseaseData.drugResistance)) {
                methods.setValue('step3.drugResistance', safeTrim(diseaseData.drugResistance), setOpts);
              }
              if (safeTrim(diseaseData.relapse)) {
                methods.setValue('step3.relapse', safeTrim(diseaseData.relapse), setOpts);
              }
            }
          }

          if (safeTrim(specify.samplingSite)) {
            methods.setValue('step6.samplingSite', safeTrim(specify.samplingSite), setOpts);
          }
          const sampleCollectDate = toDateInput(specify.sampleCollectDate);
          if (sampleCollectDate) {
            methods.setValue('step6.sampleCollectDate', sampleCollectDate, setOpts);
          }
          if (specify.embryoNumber !== undefined && specify.embryoNumber !== null) {
            methods.setValue('step6.embryoNumber', String(specify.embryoNumber), setOpts);
          }
          if (safeTrim(specify.geneticTestResults)) {
            methods.setValue(
              'step7.geneticTestResults',
              safeTrim(specify.geneticTestResults),
              setOpts
            );
          }
          if (safeTrim(specify.geneticTestResultsRelationship)) {
            methods.setValue(
              'step7.geneticTestResultsRelationship',
              safeTrim(specify.geneticTestResultsRelationship),
              setOpts
            );
          }

          lastAutofilledSpecifyIdRef.current = specifyVoteId;
        } catch {
          if (!cancelled) {
            Alert.alert('Lỗi', 'Không thể tải dữ liệu phiếu xét nghiệm. Vui lòng thử lại.');
          }
        }
      };
    const timeoutId = setTimeout(() => {
      void loadSpecifyAndAutofill();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [step2SpecifyIdRaw, currentStep, genomeTests, services, specifyVoteTests, methods, resetSpecifyAutofillBundle]);

  useEffect(() => {
    const id = safeTrim(step2SpecifyIdRaw);

    if (specifyIdClearResetTimerRef.current) {
      clearTimeout(specifyIdClearResetTimerRef.current);
      specifyIdClearResetTimerRef.current = null;
    }

    if (currentStep !== 2) {
      prevStep2SpecifyIdForResetRef.current = id;
      return;
    }

    if (id.length > 0) {
      prevStep2SpecifyIdForResetRef.current = id;
      return;
    }

    const prev = prevStep2SpecifyIdForResetRef.current;
    if (prev.length === 0) return;

    specifyIdClearResetTimerRef.current = setTimeout(() => {
      specifyIdClearResetTimerRef.current = null;
      const m = methodsRef.current;
      const confirm = safeTrim(m.getValues('step2.specifyId'));
      if (confirm.length > 0) {
        prevStep2SpecifyIdForResetRef.current = confirm;
        return;
      }

      resetSpecifyAutofillBundle(null);
    }, 450);

    return () => {
      if (specifyIdClearResetTimerRef.current) {
        clearTimeout(specifyIdClearResetTimerRef.current);
        specifyIdClearResetTimerRef.current = null;
      }
    };
  }, [step2SpecifyIdRaw, currentStep, resetSpecifyAutofillBundle]);

  useEffect(() => {
    if (currentStep !== 2) return;
    const digits = String(methods.getValues('step2.patientPhone') ?? '').replace(/[^\d]/g, '');
    const hasValid = /^0\d{9}$/.test(digits);

    if (prevHadValidStep2PhoneRef.current && !hasValid) {
      const o = { shouldDirty: true, shouldTouch: true, shouldValidate: true };
      methods.setValue('step2.patientName', '', o);
      methods.setValue('step2.patientDob', '', o);
      methods.setValue('step2.patientGender', '', o);
      methods.setValue('step2.patientEmail', '', o);
      methods.setValue('step2.patientJob', '', o);
      methods.setValue('step2.patientContactName', '', o);
      methods.setValue('step2.patientContactPhone', '', o);
      methods.setValue('step2.patientAddress', '', o);
      methods.setValue('step2.patientId', '', o);
      setHasPreviousOrders(false);
    }
    prevHadValidStep2PhoneRef.current = hasValid;
  }, [patientPhone, currentStep, methods]);

  useEffect(() => {
    let cancelled = false;

    const loadPatientInfo = async () => {
      if (cancelled) return;

      const trimmed = String(methods.getValues('step2.patientPhone') ?? '').trim();

      if (!trimmed || trimmed.length < 10) {
        setHasPreviousOrders(false);
        return;
      }

      if (currentStep !== 2) return;

      setIsLoadingPatient(true);
      try {
        const phone = trimmed.replace(/[\s\-\(\)]/g, '');
        if (phone.length < 10) {
          setIsLoadingPatient(false);
          return;
        }

        const patientResponse = await patientService.getByPhone(phone);

        if (cancelled) return;

        const verifyPhone = String(methods.getValues('step2.patientPhone') ?? '')
          .trim()
          .replace(/[\s\-\(\)]/g, '');
        if (verifyPhone !== phone) {
          setHasPreviousOrders(false);
          return;
        }

        if (patientResponse?.error) {
          const err = String(patientResponse.error).toLowerCase();
          if (err.includes('not found') || err.includes('404')) {
            setHasPreviousOrders(false);
            setIsLoadingPatient(false);
            return;
          }
        }

        if (patientResponse?.success && patientResponse?.data) {
          const patient: any = patientResponse.data;

          const patientName = (patient.patientName || patient.name || '').toString();
          if (patientName.trim()) {
            methods.setValue('step2.patientName', patientName.trim(), {
              shouldDirty: true,
              shouldTouch: true,
            });
          }

          const patientDob = patient.patientDob || patient.dateOfBirth;
          if (patientDob) {
            const dob = patientDob instanceof Date ? patientDob : new Date(patientDob);
            if (!isNaN(dob.getTime())) {
              const formattedDob = dob.toISOString().split('T')[0];
              methods.setValue('step2.patientDob', formattedDob, {
                shouldDirty: true,
                shouldTouch: true,
              });
            }
          }

          if (patient.gender) {
            const genderValue = String(patient.gender).toLowerCase();
            if (genderValue === 'male' || genderValue === 'female' || genderValue === 'other') {
              methods.setValue('step2.patientGender', genderValue, {
                shouldDirty: true,
                shouldTouch: true,
              });
            }
          }

          const patientEmail = (patient.patientEmail || patient.email || '').toString();
          if (patientEmail.trim()) {
            methods.setValue('step2.patientEmail', patientEmail.trim(), {
              shouldDirty: true,
              shouldTouch: true,
            });
          }

          const patientJob = (patient.patientJob || '').toString();
          if (patientJob.trim()) {
            methods.setValue('step2.patientJob', patientJob.trim(), {
              shouldDirty: true,
              shouldTouch: true,
            });
          }

          const patientContactName = (patient.patientContactName || '').toString();
          if (patientContactName.trim()) {
            methods.setValue('step2.patientContactName', patientContactName.trim(), {
              shouldDirty: true,
              shouldTouch: true,
            });
          }

          const patientContactPhone = (patient.patientContactPhone || '').toString();
          if (patientContactPhone.trim()) {
            methods.setValue('step2.patientContactPhone', patientContactPhone.trim(), {
              shouldDirty: true,
              shouldTouch: true,
            });
          }

          const patientAddress = (patient.patientAddress || patient.address || '').toString();
          if (patientAddress.trim()) {
            methods.setValue('step2.patientAddress', patientAddress.trim(), {
              shouldDirty: true,
              shouldTouch: true,
            });
          }

          if (patient.patientId) {
            methods.setValue('step2.patientId', String(patient.patientId), {
              shouldDirty: true,
              shouldTouch: true,
            });
            try {
              const prev = await orderService.getByPatientId(patient.patientId);
              if (prev?.success && Array.isArray(prev?.data) && prev.data.length > 0) {
                setHasPreviousOrders(true);
                setAutofilledFields([]);
              } else {
                setHasPreviousOrders(false);
                setAutofilledFields([]);
              }
            } catch {
              setHasPreviousOrders(false);
              setAutofilledFields([]);
            }
          } else {
            setHasPreviousOrders(false);
          }
        } else {
          setHasPreviousOrders(false);
        }
      } catch {
        setHasPreviousOrders(false);
      } finally {
        setIsLoadingPatient(false);
      }
    };

    const timeoutId = setTimeout(() => {
      void loadPatientInfo();
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [patientPhone, currentStep, methods]);
  useEffect(() => {
    if (currentStep !== 6) {
      return;
    }

    const formData = methods.getValues();

    const metadataFromSteps: any[] = [];
    const assignIfPresent = (target: Record<string, unknown>, key: string, value: unknown) => {
      const text = safeTrim(value);
      if (text) target[key] = text;
    };

    if (formData.step1) {
      const orderInfo: any = {};
      assignIfPresent(orderInfo, 'orderName', formData.step1.orderName);
      assignIfPresent(orderInfo, 'doctorId', formData.step1.doctorId);
      assignIfPresent(orderInfo, 'hospitalId', formData.step1.hospitalId);
      assignIfPresent(orderInfo, 'staffId', formData.step1.staffId);
      assignIfPresent(orderInfo, 'staffAnalystId', formData.step1.staffAnalystId);
      assignIfPresent(orderInfo, 'sampleCollectorId', formData.step1.sampleCollectorId);
      assignIfPresent(orderInfo, 'barcodeId', formData.step1.barcodeId);
      assignIfPresent(orderInfo, 'paymentAmount', formData.step1.paymentAmount);
      assignIfPresent(orderInfo, 'customerId', formData.step1.customerId);
      if (Object.keys(orderInfo).length > 0) {
        metadataFromSteps.push({ type: 'Thông tin đơn hàng', data: orderInfo });
      }
    }

    if (formData.step2) {
      const patientInfo: any = {};
      assignIfPresent(patientInfo, 'patientId', formData.step2.patientId);
      assignIfPresent(patientInfo, 'patientName', formData.step2.patientName);
      assignIfPresent(patientInfo, 'patientPhone', formData.step2.patientPhone);
      assignIfPresent(patientInfo, 'patientDob', formData.step2.patientDob);
      assignIfPresent(patientInfo, 'patientGender', formData.step2.patientGender);
      assignIfPresent(patientInfo, 'patientEmail', formData.step2.patientEmail);
      assignIfPresent(patientInfo, 'patientJob', formData.step2.patientJob);
      assignIfPresent(patientInfo, 'patientContactName', formData.step2.patientContactName);
      assignIfPresent(patientInfo, 'patientContactPhone', formData.step2.patientContactPhone);
      assignIfPresent(patientInfo, 'patientAddress', formData.step2.patientAddress);
      assignIfPresent(patientInfo, 'specifyId', formData.step2.specifyId);
      if (Object.keys(patientInfo).length > 0) {
        metadataFromSteps.push({ type: 'Thông tin bệnh nhân', data: patientInfo });
      }
    }

    if (formData.step3) {
      const serviceInfo: any = {};
      assignIfPresent(serviceInfo, 'serviceType', formData.step3.serviceType);
      assignIfPresent(serviceInfo, 'genomeTestId', formData.step3.genomeTestId);
      assignIfPresent(serviceInfo, 'testName', formData.step3.testName);
      assignIfPresent(serviceInfo, 'testSample', formData.step3.testSample);
      assignIfPresent(serviceInfo, 'testContent', formData.step3.testContent);
      assignIfPresent(serviceInfo, 'fetusesNumber', formData.step3.fetusesNumber);
      assignIfPresent(serviceInfo, 'fetusesWeek', formData.step3.fetusesWeek);
      assignIfPresent(serviceInfo, 'fetusesDay', formData.step3.fetusesDay);
      assignIfPresent(serviceInfo, 'ultrasoundDay', formData.step3.ultrasoundDay);
      assignIfPresent(serviceInfo, 'headRumpLength', formData.step3.headRumpLength);
      assignIfPresent(serviceInfo, 'neckLength', formData.step3.neckLength);
      assignIfPresent(serviceInfo, 'combinedTestResult', formData.step3.combinedTestResult);
      assignIfPresent(serviceInfo, 'ultrasoundResult', formData.step3.ultrasoundResult);
      assignIfPresent(serviceInfo, 'biospy', formData.step3.biospy);
      assignIfPresent(serviceInfo, 'biospyDate', formData.step3.biospyDate);
      assignIfPresent(serviceInfo, 'cellContainingSolution', formData.step3.cellContainingSolution);
      assignIfPresent(serviceInfo, 'embryoCreate', formData.step3.embryoCreate);
      assignIfPresent(serviceInfo, 'embryoStatus', formData.step3.embryoStatus);
      assignIfPresent(serviceInfo, 'morphologicalAssessment', formData.step3.morphologicalAssessment);
      assignIfPresent(serviceInfo, 'negativeControl', formData.step3.negativeControl);
      if (formData.step3.cellNucleus !== undefined) {
        serviceInfo.cellNucleus = formData.step3.cellNucleus ? 'YES' : 'NO';
      }
      assignIfPresent(serviceInfo, 'symptom', formData.step3.symptom);
      assignIfPresent(serviceInfo, 'diagnose', formData.step3.diagnose);
      assignIfPresent(serviceInfo, 'diagnoseImage', formData.step3.diagnoseImage);
      assignIfPresent(serviceInfo, 'testRelated', formData.step3.testRelated);
      assignIfPresent(serviceInfo, 'treatmentMethods', formData.step3.treatmentMethods);
      assignIfPresent(serviceInfo, 'treatmentTimeDay', formData.step3.treatmentTimeDay);
      assignIfPresent(serviceInfo, 'drugResistance', formData.step3.drugResistance);
      assignIfPresent(serviceInfo, 'relapse', formData.step3.relapse);
      if (Object.keys(serviceInfo).length > 0) {
        metadataFromSteps.push({ type: 'Thông tin nhóm xét nghiệm', data: serviceInfo });
      }
    }

    if (formData.step4) {
      const clinicalInfo: any = {};
      assignIfPresent(clinicalInfo, 'patientHeight', formData.step4.patientHeight);
      assignIfPresent(clinicalInfo, 'patientWeight', formData.step4.patientWeight);
      assignIfPresent(clinicalInfo, 'patientHistory', formData.step4.patientHistory);
      assignIfPresent(clinicalInfo, 'familyHistory', formData.step4.familyHistory);
      assignIfPresent(clinicalInfo, 'toxicExposure', formData.step4.toxicExposure);
      assignIfPresent(clinicalInfo, 'medicalHistory', formData.step4.medicalHistory);
      assignIfPresent(clinicalInfo, 'chronicDisease', formData.step4.chronicDisease);
      assignIfPresent(clinicalInfo, 'acuteDisease', formData.step4.acuteDisease);
      assignIfPresent(clinicalInfo, 'medicalUsing', formData.step4.medicalUsing);
      if (Object.keys(clinicalInfo).length > 0) {
        metadataFromSteps.push({ type: 'Thông tin lâm sàng', data: clinicalInfo });
      }
    }

    if (formData.step5) {
      const testInfo: any = {};
      if (formData.step5.testName) testInfo.testName = formData.step5.testName;
      if (formData.step5.testSample) testInfo.testSample = formData.step5.testSample;
      if (formData.step5.testContent) testInfo.testContent = formData.step5.testContent;
      if (Object.keys(testInfo).length > 0) {
        metadataFromSteps.push({ type: 'Thông tin xét nghiệm', data: testInfo });
      }
    }

    if (formData.step6) {
      const sampleInfo: any = {};
      assignIfPresent(sampleInfo, 'fastq', formData.step6.fastq);
      assignIfPresent(sampleInfo, 'samplingSite', formData.step6.samplingSite);
      assignIfPresent(sampleInfo, 'sampleCollectDate', formData.step6.sampleCollectDate);
      assignIfPresent(sampleInfo, 'embryoNumber', formData.step6.embryoNumber);
      assignIfPresent(sampleInfo, 'paymentAmount', formData.step6.paymentAmount);
      assignIfPresent(sampleInfo, 'paymentStatus', formData.step6.paymentStatus);
      assignIfPresent(sampleInfo, 'paymentType', formData.step6.paymentType);
      assignIfPresent(sampleInfo, 'invoiceLink', formData.step6.invoiceLink);
      assignIfPresent(sampleInfo, 'specifyVoteImagePath', formData.step6.specifyVoteImagePath);
      if (Object.keys(sampleInfo).length > 0) {
        metadataFromSteps.push({ type: 'Thông tin thanh toán & mẫu', data: sampleInfo });
      }
    }

    setPatientMetadataList(metadataFromSteps as any);

    if (!methods.getValues('step7.geneticTestResults')) {
      const testContent = formData.step5?.testContent || formData.step5?.testSample || '';
      if (testContent) {
        methods.setValue('step7.geneticTestResults', testContent, {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
    }

    if (!methods.getValues('step7.geneticTestResultsRelationship')) {
      const testName = formData.step5?.testName || formData.step2?.patientName || '';
      if (testName) {
        methods.setValue('step7.geneticTestResultsRelationship', testName, {
          shouldDirty: true,
          shouldTouch: true,
        });
      }
    }
  }, [currentStep, methods]);

  const getFieldErrorMessage = (path: string): string | undefined => {
    const parts = path.split('.');
    let current: any = methods.formState.errors;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[part];
    }
    const message = current?.message;
    return typeof message === 'string' ? message : undefined;
  };

  const showFirstStepError = (paths: string[], fallback = 'Vui lòng kiểm tra lại thông tin đã nhập') => {
    const firstError = paths.map((p) => getFieldErrorMessage(p)).find(Boolean);
    Alert.alert('Lỗi', firstError || fallback);
  };

  const validateStep1 = async () => {
    methods.clearErrors('step1');
    const step1Values = methods.getValues('step1');

    if (paymentStaffs.length > 0 && !String(step1Values.staffId ?? '').trim()) {
      methods.setError('step1.staffId', {
        type: 'manual',
        message: 'Vui lòng chọn người thu tiền',
      });
      Alert.alert('Lỗi', 'Vui lòng chọn người thu tiền');
      return false;
    }

    const requiredChecks: Array<{ key: keyof typeof step1Values; message: string }> = [
      { key: 'orderName', message: 'Vui lòng nhập tên đơn hàng' },
      { key: 'staffAnalystId', message: 'Vui lòng chọn nhân viên phụ trách' },
      { key: 'sampleCollectorId', message: 'Vui lòng chọn nhân viên thu mẫu' },
      { key: 'barcodeId', message: 'Vui lòng chọn mã Barcode PCĐ' },
    ];

    const firstMissing = requiredChecks.find(({ key }) => !String(step1Values[key] ?? '').trim());
    if (firstMissing) {
      methods.setError(`step1.${firstMissing.key}` as any, {
        type: 'manual',
        message: firstMissing.message,
      });
      Alert.alert('Lỗi', firstMissing.message);
      return false;
    }

    const fields = [
      'step1.orderName',
      'step1.staffAnalystId',
      'step1.sampleCollectorId',
      'step1.barcodeId',
    ];
    const isValid = await methods.trigger(fields as any);
    if (!isValid) {
      const errors = methods.formState.errors;
      if (errors.step1?.orderName) Alert.alert('Lỗi', 'Vui lòng nhập tên đơn hàng');
      else if (errors.step1?.staffAnalystId)
        Alert.alert('Lỗi', 'Vui lòng chọn nhân viên phụ trách');
      else if (errors.step1?.sampleCollectorId)
        Alert.alert('Lỗi', 'Vui lòng chọn nhân viên thu mẫu');
      else if (errors.step1?.barcodeId) Alert.alert('Lỗi', 'Vui lòng chọn mã Barcode PCĐ');
    }
    if (!isValid) return false;

    if (
      step1Values.staffId?.trim() &&
      !paymentStaffs.some((s) => s.staffId === step1Values.staffId?.trim())
    ) {
      Alert.alert('Lỗi', 'Người thu tiền phải có vai trò STAFF');
      methods.setError('step1.staffId', { type: 'manual', message: 'Người thu tiền phải là STAFF' });
      return false;
    }
    if (!analystStaffs.some((s) => s.staffId === step1Values.staffAnalystId?.trim())) {
      Alert.alert(
        'Lỗi',
        'Nhân viên phụ trách phải là bác sĩ (DOCTOR) thuộc bệnh viện trung tâm (hospital 1), giống trang quản trị web.'
      );
      methods.setError('step1.staffAnalystId', {
        type: 'manual',
        message: 'Nhân viên phụ trách không đúng vai trò/cơ sở',
      });
      return false;
    }
    {
      const cid = String(step1Values.sampleCollectorId || '').trim();
      const collectorStaff = staffs.find((s) => String(s.staffId).trim() === cid);
      if (!cid || !collectorStaff || !isLabPosition(collectorStaff.staffPosition)) {
        Alert.alert('Lỗi', 'Nhân viên thu mẫu phải có vai trò LAB');
        methods.setError('step1.sampleCollectorId', {
          type: 'manual',
          message: 'Nhân viên thu mẫu phải là LAB',
        });
        return false;
      }
    }

    return validateStep6();
  };

  const validateStep2 = async () => {
    const step1Doctor = String(methods.getValues('step1.doctorId') ?? '').trim();
    const step1Hospital = String(methods.getValues('step1.hospitalId') ?? '').trim();
    if (!step1Doctor) {
      methods.setError('step1.doctorId', { type: 'manual', message: 'Vui lòng chọn bác sĩ chỉ định' });
      Alert.alert('Lỗi', 'Vui lòng chọn bác sĩ chỉ định');
      return false;
    }
    if (!step1Hospital) {
      methods.setError('step1.hospitalId', { type: 'manual', message: 'Vui lòng chọn phòng khám/bệnh viện' });
      Alert.alert('Lỗi', 'Vui lòng chọn phòng khám/bệnh viện');
      return false;
    }
    methods.clearErrors('step1.doctorId');
    methods.clearErrors('step1.hospitalId');

    const fields = [
      'step1.doctorId',
      'step1.hospitalId',
      'step2.patientName',
      'step2.patientPhone',
      'step2.patientDob',
      'step2.patientGender',
      'step2.patientContactName',
      'step2.patientContactPhone',
      'step2.patientAddress',
    ] as const;
    const isValid = await methods.trigger(fields as any, { shouldFocus: true });
    const selectedGender = methods.getValues('step2.patientGender');
    let finalValid = isValid && !!selectedGender;
    if (!selectedGender) {
      methods.setError('step2.patientGender', {
        type: 'manual',
        message: 'Vui lòng chọn giới tính',
      });
      finalValid = false;
    }
    if (!finalValid) {
      showFirstStepError(
        [
          'step1.doctorId',
          'step1.hospitalId',
          'step2.patientName',
          'step2.patientPhone',
          'step2.patientDob',
          'step2.patientGender',
          'step2.patientContactName',
          'step2.patientContactPhone',
          'step2.patientAddress',
        ],
        'Vui lòng kiểm tra lại thông tin bệnh nhân'
      );
    }

    if (!finalValid) return false;

    // Giống web admin: bệnh nhân phải thuộc đúng BV/phòng khám của bác sĩ chỉ định.
    const patientId = String(methods.getValues('step2.patientId') ?? '').trim();
    if (patientId && step1Hospital) {
      try {
        const patientRes = await patientService.getById(patientId);
        const patientHospitalId = String((patientRes.success && patientRes.data?.hospitalId) || '').trim();
        if (patientHospitalId && patientHospitalId !== step1Hospital) {
          methods.setError('step2.patientId', {
            type: 'manual',
            message: 'Bệnh nhân không thuộc đúng phòng khám/bệnh viện đã chọn',
          });
          Alert.alert('Lỗi', 'Bệnh nhân không thuộc đúng phòng khám/bệnh viện của bác sĩ chỉ định');
          return false;
        }
      } catch {
        methods.setError('step2.patientId', {
          type: 'manual',
          message: 'Không xác thực được bệnh nhân theo phòng khám/bệnh viện',
        });
        Alert.alert('Lỗi', 'Không xác thực được bệnh nhân theo phòng khám/bệnh viện đã chọn');
        return false;
      }
    }

    return true;
  };

  const validateStep3 = async () => {
    methods.clearErrors('step3');
    const step3 = methods.getValues('step3');
    let hasError = false;

    const isBlank = (value?: string) => !String(value ?? '').trim();
    const toNumber = (value?: string) => {
      const n = Number(String(value ?? '').trim());
      return Number.isFinite(n) ? n : NaN;
    };

    const normalizeServiceType = (value?: string): 'reproduction' | 'embryo' | 'disease' | '' => {
      const v = String(value ?? '').trim().toLowerCase();
      if (!v) return '';
      if (v === 'reproduction' || v === 'sản' || v === 'san') return 'reproduction';
      if (v === 'embryo' || v === 'phôi' || v === 'phoi') return 'embryo';
      if (v === 'disease' || v === 'bệnh lý' || v === 'benh ly') return 'disease';
      return '';
    };

    const normalizedServiceType = normalizeServiceType(step3.serviceType);

    if (!normalizedServiceType) {
      methods.setError('step3.serviceType', { type: 'manual', message: 'Vui lòng chọn nhóm xét nghiệm' });
      return false;
    }

    /** Nhóm sản — khớp admin web (tuần 0–40, ngày thai 0–30, số thai chọn 1–3; CRL/NT/combined/siêu âm tuỳ chọn) */
    if (normalizedServiceType === 'reproduction') {
      if (isBlank(step3.fetusesNumber)) {
        methods.setError('step3.fetusesNumber', { type: 'manual', message: 'Vui lòng chọn số lượng thai' });
        hasError = true;
      } else {
        const v = toNumber(step3.fetusesNumber);
        if (!Number.isInteger(v) || v < 1 || v > 3) {
          methods.setError('step3.fetusesNumber', {
            type: 'manual',
            message: 'Số lượng thai: chọn 1, 2 hoặc 3 (giống web quản trị)',
          });
          hasError = true;
        }
      }

      if (isBlank(step3.fetusesWeek)) {
        methods.setError('step3.fetusesWeek', { type: 'manual', message: 'Vui lòng nhập tuần thai' });
        hasError = true;
      } else {
        const v = toNumber(step3.fetusesWeek);
        if (!Number.isInteger(v) || v < 0 || v > 40) {
          methods.setError('step3.fetusesWeek', { type: 'manual', message: 'Tuần thai phải là số nguyên từ 0 đến 40' });
          hasError = true;
        }
      }

      if (isBlank(step3.fetusesDay)) {
        methods.setError('step3.fetusesDay', { type: 'manual', message: 'Vui lòng nhập ngày thai' });
        hasError = true;
      } else {
        const v = toNumber(step3.fetusesDay);
        if (!Number.isInteger(v) || v < 0 || v > 30) {
          methods.setError('step3.fetusesDay', { type: 'manual', message: 'Ngày thai phải là số nguyên từ 0 đến 30' });
          hasError = true;
        }
      }

      if (!isBlank(step3.headRumpLength)) {
        const v = toNumber(step3.headRumpLength);
        if (Number.isNaN(v) || v < 0 || v > 100) {
          methods.setError('step3.headRumpLength', {
            type: 'manual',
            message: 'Chiều dài đầu mông phải trong khoảng 0 - 100 mm',
          });
          hasError = true;
        }
      }

      if (!isBlank(step3.neckLength)) {
        const v = toNumber(step3.neckLength);
        if (Number.isNaN(v) || v < 0 || v > 5) {
          methods.setError('step3.neckLength', {
            type: 'manual',
            message: 'Độ mờ da gáy phải trong khoảng 0 - 5 mm',
          });
          hasError = true;
        }
      }
    }

    /** Nhóm phôi — khớp web: không bắt buộc từng ô; số phôi tạo chỉ 1 / 2 / 3 nếu có */
    if (normalizedServiceType === 'embryo') {
      if (!isBlank(step3.embryoCreate)) {
        const v = toNumber(step3.embryoCreate);
        if (!Number.isInteger(v) || v < 1 || v > 3) {
          methods.setError('step3.embryoCreate', {
            type: 'manual',
            message: 'Số phôi tạo: chọn 1, 2 hoặc 3 (giống web quản trị)',
          });
          hasError = true;
        }
      }
    }

    /** Nhóm bệnh lý — khớp web: trường tuỳ chọn; số ngày điều trị ≥ 0 nếu nhập */
    if (normalizedServiceType === 'disease') {
      if (!isBlank(step3.treatmentTimeDay)) {
        const v = toNumber(step3.treatmentTimeDay);
        if (!Number.isInteger(v) || v < 0) {
          methods.setError('step3.treatmentTimeDay', {
            type: 'manual',
            message: 'Số ngày điều trị phải là số nguyên ≥ 0',
          });
          hasError = true;
        }
      }
    }

    if (hasError) {
      showFirstStepError(
        [
          'step3.serviceType',
          'step3.fetusesNumber',
          'step3.fetusesWeek',
          'step3.fetusesDay',
          'step3.headRumpLength',
          'step3.neckLength',
          'step3.combinedTestResult',
          'step3.ultrasoundResult',
          'step3.biospy',
          'step3.biospyDate',
          'step3.cellContainingSolution',
          'step3.embryoCreate',
          'step3.embryoStatus',
          'step3.morphologicalAssessment',
          'step3.cellNucleus',
          'step3.negativeControl',
          'step3.symptom',
          'step3.diagnose',
          'step3.diagnoseImage',
          'step3.testRelated',
          'step3.treatmentMethods',
          'step3.treatmentTimeDay',
          'step3.drugResistance',
          'step3.relapse',
        ],
        'Vui lòng kiểm tra lại thông tin nhóm xét nghiệm'
      );
    }
    return !hasError;
  };

  const validateStep5 = async () => {
    methods.clearErrors('step5');
    methods.clearErrors('step6');
    const step3Values = methods.getValues('step3');
    const step6Values = methods.getValues('step6');

    const fields: Array<
      | 'step5.genomeTestId'
      | 'step5.testName'
      | 'step5.testSample'
      | 'step6.samplingSite'
      | 'step6.sampleCollectDate'
      | 'step6.embryoNumber'
    > = [
      'step5.genomeTestId',
      'step5.testName',
      'step5.testSample',
      'step6.samplingSite',
      'step6.sampleCollectDate',
      'step6.embryoNumber',
    ];

    let isValid = await methods.trigger(fields as any, { shouldFocus: true });

    const samplingSiteTrim = String(step6Values.samplingSite ?? '').trim();
    if (!samplingSiteTrim) {
      methods.setError('step6.samplingSite', {
        type: 'manual',
        message: 'Vui lòng nhập nơi thu mẫu',
      });
      isValid = false;
    }

    const sampleDateRaw = String(step6Values.sampleCollectDate ?? '').trim();
    if (!sampleDateRaw) {
      methods.setError('step6.sampleCollectDate', {
        type: 'manual',
        message: 'Vui lòng chọn ngày thu mẫu',
      });
      isValid = false;
    } else if (!parseFlexibleDate(sampleDateRaw)) {
      methods.setError('step6.sampleCollectDate', {
        type: 'manual',
        message: 'Ngày thu mẫu không hợp lệ',
      });
      isValid = false;
    }

    const embryoValue = String(step6Values.embryoNumber ?? '').trim();
    const serviceType = String(step3Values.serviceType ?? '').trim().toLowerCase();

    if (serviceType === 'embryo' && !embryoValue) {
      methods.setError('step6.embryoNumber', {
        type: 'manual',
        message: 'Vui lòng nhập số lượng phôi',
      });
      isValid = false;
    } else if (embryoValue) {
      const embryoNum = Number(embryoValue);
      if (!Number.isInteger(embryoNum) || embryoNum < 1 || embryoNum > 3) {
        methods.setError('step6.embryoNumber', {
          type: 'manual',
          message: 'Số lượng phôi chỉ được chọn 1, 2 hoặc 3',
        });
        isValid = false;
      }
    }

    if (!isValid) {
      showFirstStepError(
        [
          'step5.genomeTestId',
          'step5.testName',
          'step5.testSample',
          'step6.samplingSite',
          'step6.sampleCollectDate',
          'step6.embryoNumber',
        ],
        'Vui lòng kiểm tra lại thông tin xét nghiệm'
      );
    }
    return isValid;
  };

  const validateStep4 = async () => {
    const fields: Array<
      | 'step4.patientHeight'
      | 'step4.patientWeight'
      | 'step4.patientHistory'
      | 'step4.acuteDisease'
      | 'step4.medicalUsing'
    > = [
      'step4.patientHeight',
      'step4.patientWeight',
      'step4.patientHistory',
      'step4.acuteDisease',
      'step4.medicalUsing',
    ];

    // Step 4 errors are shown inline at each field.
    const isValid = await methods.trigger(fields as any, { shouldFocus: true });
    if (!isValid) {
      showFirstStepError(
        ['step4.patientHeight', 'step4.patientWeight', 'step4.patientHistory', 'step4.acuteDisease', 'step4.medicalUsing'],
        'Vui lòng kiểm tra lại thông tin lâm sàng'
      );
    }
    return isValid;
  };

  const validateStep6 = async () => {
    const fastqVal = methods.getValues('step6.fastq');
    if (fastqVal !== 'YES' && fastqVal !== 'NO') {
      Alert.alert('Lỗi', 'Vui lòng chọn FastQ (Có / Không)');
      return false;
    }
    const paymentStatus = String(methods.getValues('step6.paymentStatus') ?? '').trim();
    if (paymentStatus !== 'UNPAID' && paymentStatus !== 'COMPLETED') {
      Alert.alert('Lỗi', 'Vui lòng chọn trạng thái thanh toán');
      return false;
    }
    if (paymentStatus === 'COMPLETED') {
      const paymentAmountInput = String(methods.getValues('step6.paymentAmount') ?? '').trim();
      const paymentAmount = parseVndAmountInput(paymentAmountInput);
      if (!paymentAmountInput || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        Alert.alert(
          'Lỗi',
          'Trạng thái "Đã thanh toán": vui lòng nhập số tiền đã thu hợp lệ trước khi sang bước tiếp theo.'
        );
        return false;
      }
      const invoice = String(methods.getValues('step6.invoiceLink') ?? '').trim();
      if (!invoice) {
        Alert.alert(
          'Lỗi',
          'Trạng thái "Đã thanh toán": vui lòng upload hóa đơn thanh toán (ảnh/PDF) trước khi sang bước tiếp theo.'
        );
        return false;
      }
    }

    if (methods.getValues('step6.fastq') === 'YES') {
      methods.setValue('step6.paymentType', 'ONLINE_PAYMENT', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      return true;
    }
    const isValid = await methods.trigger('step6.paymentType', { shouldFocus: true });
    if (!isValid) {
      showFirstStepError(['step6.paymentType'], 'Vui lòng chọn hình thức thanh toán');
    }
    return isValid;
  };

  const handlePickSpecifyVoteFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const selectedFile = result.assets[0];
      const fileMimeType = String(selectedFile.mimeType || '').toLowerCase();
      const fileName = String(selectedFile.name || '').trim();
      const lowerFileName = fileName.toLowerCase();
      const isPdf = fileMimeType === 'application/pdf' || lowerFileName.endsWith('.pdf');
      const isImage = fileMimeType.startsWith('image/');

      if (!isPdf && !isImage) {
        Alert.alert('Định dạng chưa hỗ trợ', 'Vui lòng chọn ảnh (JPG/PNG/WEBP) hoặc file PDF.');
        return;
      }

      if (
        typeof selectedFile.size === 'number' &&
        selectedFile.size > MAX_SPECIFY_UPLOAD_SIZE_BYTES
      ) {
        Alert.alert('File quá lớn', 'Vui lòng chọn file nhỏ hơn hoặc bằng 10MB.');
        return;
      }

      setIsUploadingSpecifyFile(true);
      const uploaded = await uploadFileToCloudinary(selectedFile.uri, {
        folder: 'specify-vote-files',
        mimeType: isPdf ? 'application/pdf' : fileMimeType || undefined,
        fileName: fileName || undefined,
      });

      methods.setValue('step6.specifyVoteImagePath', uploaded.secureUrl || uploaded.url, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      Alert.alert('Thành công', 'Đã tải file phiếu xét nghiệm lên thành công.');
    } catch (error: any) {
      Alert.alert('Lỗi', error?.message || 'Không thể tải file lên. Vui lòng thử lại.');
    } finally {
      setIsUploadingSpecifyFile(false);
    }
  };

  const handleClearSpecifyVoteFile = () => {
    methods.setValue('step6.specifyVoteImagePath', '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const handlePickInvoiceFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const selectedFile = result.assets[0];
      const fileMimeType = String(selectedFile.mimeType || '').toLowerCase();
      const fileName = String(selectedFile.name || '').trim();
      const lowerFileName = fileName.toLowerCase();
      const isPdf = fileMimeType === 'application/pdf' || lowerFileName.endsWith('.pdf');
      const isImage = fileMimeType.startsWith('image/');

      if (!isPdf && !isImage) {
        Alert.alert('Định dạng chưa hỗ trợ', 'Vui lòng chọn ảnh (JPG/PNG/WEBP) hoặc file PDF.');
        return;
      }

      if (
        typeof selectedFile.size === 'number' &&
        selectedFile.size > MAX_SPECIFY_UPLOAD_SIZE_BYTES
      ) {
        Alert.alert('File quá lớn', 'Vui lòng chọn file nhỏ hơn hoặc bằng 10MB.');
        return;
      }

      setIsUploadingInvoiceFile(true);
      const uploaded = await uploadFileToCloudinary(selectedFile.uri, {
        folder: 'order-invoices',
        mimeType: isPdf ? 'application/pdf' : fileMimeType || undefined,
        fileName: fileName || undefined,
      });

      methods.setValue('step6.invoiceLink', uploaded.secureUrl || uploaded.url, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      Alert.alert('Thành công', 'Đã tải hóa đơn lên thành công.');
    } catch (error: any) {
      Alert.alert('Lỗi', error?.message || 'Không thể tải file lên. Vui lòng thử lại.');
    } finally {
      setIsUploadingInvoiceFile(false);
    }
  };

  const handleClearInvoiceFile = () => {
    methods.setValue('step6.invoiceLink', '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const validateStep7 = async () => {
    return true;
  };

  const handleNext = async () => {
    let isValid = true;
    if (currentStep === 1) isValid = await validateStep1();
    else if (currentStep === 2) isValid = await validateStep2();
    else if (currentStep === 3) isValid = await validateStep3();
    else if (currentStep === 4) isValid = await validateStep4();
    else if (currentStep === 5) isValid = await validateStep5();
    else if (currentStep === 6) isValid = await validateStep7();
    if (!isValid) return;
    if (currentStep === 6) {
      await handleSubmit();
      return;
    }
    if (currentStep < TOTAL_STEPS) setCurrentStep(p => p + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(p => p - 1);
    else router.back();
  };

  const handleSubmit = async () => {
    try {
      const formData = methods.getValues();
      const normalizedOrderName =
        safeTrim(methods.getValues('step1.orderName')) ||
        safeTrim(formData.step1?.orderName) ||
        orderNameCacheRef.current;
      if (!normalizedOrderName) {
        await methods.trigger('step1.orderName');
        setCurrentStep(1);
        Alert.alert('Lỗi', 'Vui lòng nhập tên đơn hàng');
        return;
      }
      methods.setValue('step1.orderName', normalizedOrderName, {
        shouldDirty: true,
        shouldTouch: true,
      });
      orderNameCacheRef.current = normalizedOrderName;
      const resolvedPaymentType =
        formData.step6.fastq === 'YES' ? 'ONLINE_PAYMENT' : formData.step6.paymentType || 'CASH';

      let selectedCustomer: any = null;
      const customerId = formData.step1.customerId?.trim();
      if (customerId) {
        selectedCustomer = customers.find((c: any) => c.customerId === customerId);
        if (!selectedCustomer)
          return Alert.alert('Lỗi', 'Khách hàng được chọn không hợp lệ. Vui lòng chọn lại.');
        if (!selectedCustomer.userId)
          return Alert.alert(
            'Lỗi',
            `Khách hàng "${selectedCustomer.customerName}" không có userId.\n\nVui lòng chọn khách hàng khác hoặc để trống.`
          );
      }

      let finalSpecifyId = (formData.step2.specifyId || '').trim() || undefined;
      if (finalSpecifyId && usedSpecifyIdSet.has(finalSpecifyId)) {
        return Alert.alert(
          'Lỗi',
          'Mã phiếu chỉ định này đã được dùng cho đơn hàng khác. Mỗi phiếu chỉ gắn một đơn. Vui lòng chọn hoặc nhập mã phiếu chưa dùng.'
        );
      }
      let patientId = (formData.step2.patientId || '').trim();

      if (!patientId && safeTrim(formData.step2.patientName)) {
        const generateUUID = () =>
          'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

        patientId = generateUUID();

        const patientPayload: any = {
          patientId,
          patientName: safeTrim(formData.step2.patientName),
          patientPhone: String(formData.step2.patientPhone ?? '').trim() || '0000000000',
          patientDob: toISO(formData.step2.patientDob),
          gender: formData.step2.patientGender || undefined,
          patientEmail: formData.step2.patientEmail?.trim() || undefined,
          patientJob: formData.step2.patientJob?.trim() || undefined,
          patientContactName: formData.step2.patientContactName?.trim() || undefined,
          patientContactPhone: String(formData.step2.patientContactPhone ?? '').trim() || undefined,
          patientAddress: formData.step2.patientAddress?.trim() || undefined,
          hospitalId: formData.step1.hospitalId?.trim() || (user?.hospitalId ? String(user.hospitalId) : undefined),
        };

        const patientResponse = await patientService.create(patientPayload);
        if (!patientResponse.success)
          throw new Error(patientResponse.error || 'Không thể tạo bệnh nhân');
        methods.setValue('step2.patientId', patientId, { shouldDirty: true, shouldTouch: true });
      }

      const serviceType = formData.step3.serviceType?.toLowerCase();
      if (serviceType && patientId && patientId.trim() !== '') {
        const selectedService = services.find(s => {
          const serviceName = s.name?.toLowerCase();
          return (
            serviceName === serviceType ||
            (serviceType === 'reproduction' &&
              (serviceName === 'sản' || serviceName === 'reproduction')) ||
            (serviceType === 'embryo' && (serviceName === 'phôi' || serviceName === 'embryo')) ||
            (serviceType === 'disease' && (serviceName === 'bệnh lý' || serviceName === 'disease'))
          );
        });
        if (
          !selectedService ||
          !selectedService.serviceId ||
          selectedService.serviceId.trim() === ''
        ) {
          throw new Error('Không tìm thấy thông tin dịch vụ. Vui lòng chọn lại nhóm xét nghiệm.');
        }

        console.log('Creating service with:', {
          serviceType,
          serviceId: selectedService.serviceId,
          patientId,
        });

        if (serviceType === 'reproduction') {
          const reproductionPayload: any = {
            serviceId: selectedService.serviceId.trim(),
            patientId: patientId.trim(),
            fetusesNumber: formData.step3.fetusesNumber
              ? parseInt(String(formData.step3.fetusesNumber), 10)
              : undefined,
            fetusesWeek: formData.step3.fetusesWeek
              ? parseInt(String(formData.step3.fetusesWeek), 10)
              : undefined,
            fetusesDay: formData.step3.fetusesDay
              ? parseInt(String(formData.step3.fetusesDay), 10)
              : undefined,
            ultrasoundDay: toISO(formData.step3.ultrasoundDay),
            headRumpLength: formData.step3.headRumpLength
              ? parseFloat(String(formData.step3.headRumpLength))
              : undefined,
            neckLength: formData.step3.neckLength
              ? parseFloat(String(formData.step3.neckLength))
              : undefined,
            combinedTestResult: formData.step3.combinedTestResult?.trim() || undefined,
            ultrasoundResult: formData.step3.ultrasoundResult?.trim() || undefined,
          };

          console.log(
            'Reproduction service payload:',
            JSON.stringify(reproductionPayload, null, 2)
          );
          const reproductionResponse = await reproductionService.create(reproductionPayload);
          console.log('Reproduction service response:', reproductionResponse);
          if (!reproductionResponse.success) {
            throw new Error(reproductionResponse.error || 'Không thể tạo thông tin nhóm Sản');
          }
        } else if (serviceType === 'embryo') {
          const embryoPayload: any = {
            serviceId: selectedService.serviceId.trim(),
            patientId: patientId.trim(),
            biospy: formData.step3.biospy?.trim() || undefined,
            biospyDate: toISO(formData.step3.biospyDate),
            cellContainingSolution: formData.step3.cellContainingSolution?.trim() || undefined,
            embryoCreate: formData.step3.embryoCreate
              ? parseInt(String(formData.step3.embryoCreate), 10)
              : undefined,
            embryoStatus: formData.step3.embryoStatus?.trim() || undefined,
            morphologicalAssessment: formData.step3.morphologicalAssessment?.trim() || undefined,
            cellNucleus:
              formData.step3.cellNucleus !== undefined
                ? Boolean(formData.step3.cellNucleus)
                : undefined,
            negativeControl: formData.step3.negativeControl?.trim() || undefined,
          };

          const embryoResponse = await embryoService.create(embryoPayload);
          if (!embryoResponse.success) {
            throw new Error(embryoResponse.error || 'Không thể tạo thông tin nhóm Phôi');
          }
        } else if (serviceType === 'disease') {
          const diseasePayload: any = {
            serviceId: selectedService.serviceId.trim(),
            patientId: patientId.trim(),
            symptom: formData.step3.symptom?.trim() || undefined,
            diagnose: formData.step3.diagnose?.trim() || undefined,
            diagnoseImage: formData.step3.diagnoseImage?.trim() || undefined,
            testRelated: formData.step3.testRelated?.trim() || undefined,
            treatmentMethods: formData.step3.treatmentMethods?.trim() || undefined,
            treatmentTimeDay: formData.step3.treatmentTimeDay
              ? parseInt(String(formData.step3.treatmentTimeDay), 10)
              : undefined,
            drugResistance: formData.step3.drugResistance?.trim() || undefined,
            relapse: formData.step3.relapse?.trim() || undefined,
          };

          const diseaseResponse = await diseaseService.create(diseasePayload);
          if (!diseaseResponse.success) {
            throw new Error(diseaseResponse.error || 'Không thể tạo thông tin nhóm Bệnh lý');
          }
        }
      }

      if (
        !finalSpecifyId &&
        safeTrim(formData.step2.patientName) &&
        safeTrim(formData.step5.genomeTestId)
      ) {
        const selectedGenomeTest: any = genomeTests.find(
          (t: any) => t.testId === formData.step5.genomeTestId
        );
        if (!selectedGenomeTest) throw new Error('Không tìm thấy xét nghiệm đã chọn');
        if (!selectedGenomeTest.service?.serviceId)
          throw new Error('Xét nghiệm không có thông tin dịch vụ. Vui lòng chọn xét nghiệm khác.');

        const specifyPayload: any = {
          serviceId: selectedGenomeTest.service.serviceId,
          patientId,
          genomeTestId: safeTrim(formData.step5.genomeTestId),
          doctorId: formData.step1.doctorId?.trim() || undefined,
          hospitalId: formData.step1.hospitalId?.trim() || (user?.hospitalId ? String(user.hospitalId) : undefined),
          samplingSite: formData.step6.samplingSite?.trim() || undefined,
          sampleCollectDate: toISO(formData.step6.sampleCollectDate),
          embryoNumber: formData.step6.embryoNumber
            ? parseInt(String(formData.step6.embryoNumber), 10)
            : undefined,
          geneticTestResults: formData.step7.geneticTestResults?.trim() || undefined,
          geneticTestResultsRelationship:
            formData.step7.geneticTestResultsRelationship?.trim() || undefined,
          specifyNote: (formData.step2.specifyImagePath || '').trim() || undefined,
          sendEmailPatient: false,
        };

        const specifyResponse = await specifyVoteTestService.create(specifyPayload);
        if (!specifyResponse.success)
          throw new Error(specifyResponse.error || 'Không thể tạo phiếu chỉ định');
        finalSpecifyId =
          (specifyResponse.data as any)?.specifyVoteID || (specifyResponse.data as any)?.specifyId;
      }

      const payload: any = {
        orderName: normalizedOrderName,
        orderStatus: ORDER_STATUS_ON_CREATE,
        paymentStatus: formData.step6.paymentStatus || 'UNPAID',
        paymentType: resolvedPaymentType,
      };

      if (finalSpecifyId) payload.specifyId = finalSpecifyId;
      if (formData.step6.specifyVoteImagePath?.trim()) {
        payload.specifyVoteImagePath = formData.step6.specifyVoteImagePath.trim();
      }
      if (formData.step6.invoiceLink?.trim()) {
        payload.invoiceLink = formData.step6.invoiceLink.trim();
      }

      if (selectedCustomer?.userId) payload.customerId = String(selectedCustomer.userId).trim();
      if (formData.step1.staffId?.trim()) payload.staffId = formData.step1.staffId.trim();
      if (formData.step1.sampleCollectorId?.trim())
        payload.sampleCollectorId = formData.step1.sampleCollectorId.trim();
      if (formData.step1.staffAnalystId?.trim())
        payload.staffAnalystId = formData.step1.staffAnalystId.trim();
      if (formData.step1.barcodeId?.trim()) payload.barcodeId = formData.step1.barcodeId.trim();

      if (formData.step6.paymentAmount?.trim()) {
        const amount = parseVndAmountInput(formData.step6.paymentAmount);
        if (Number.isFinite(amount) && amount > 0) payload.paymentAmount = amount;
      }

      payload.customerFastq = formData.step6.fastq === 'YES';

      console.log('Order creation payload:', JSON.stringify(payload, null, 2));
      
      // Create order first
      const orderResponse = await orderService.create(payload);
      if (!orderResponse.success) {
        throw new Error(orderResponse.error || 'Không thể tạo đơn hàng');
      }
      
      console.log('Order created successfully:', orderResponse.data);

      if (finalSpecifyId?.trim()) {
        try {
          const specifyStatusNext = resolveSpecifyStatusAfterOrderCreate(formData);
          await specifyVoteTestService.updateStatus(
            finalSpecifyId.trim(),
            specifyStatusNext,
          );
        } catch (specifyErr) {
          console.warn('Failed to update specify status after order create:', specifyErr);
        }
      }

      // Patient metadata:
      // - CHỈ tạo khi đơn đã thanh toán COMPLETED.
      // - Không tạo chỉ vì chọn FASTQ=YES (FASTQ không được phép bypass thanh toán).
      const psNorm = String(formData.step6.paymentStatus ?? '')
        .trim()
        .toUpperCase();
      const shouldCreatePatientMetadataNow = psNorm === PaymentStatus.COMPLETED;

      if (
        shouldCreatePatientMetadataNow &&
        finalSpecifyId &&
        patientId &&
        patientId.trim() !== ''
      ) {
        try {
          const metaGenomeTest: { testSample?: string[] | string; testName?: string } | null =
            formData.step5.genomeTestId
              ? genomeTests.find((t: any) => t.testId === formData.step5.genomeTestId) ?? null
              : null;
          const sampleNames = resolveSampleNamesForPatientMetadata(
            metaGenomeTest,
            formData,
            normalizedOrderName,
          );

          const baseMeta: {
            specifyId: string;
            patientId: string;
            patientName?: string;
          } = {
            specifyId: finalSpecifyId,
            patientId: patientId.trim(),
            ...(formData.step2.patientName?.trim()
              ? { patientName: formData.step2.patientName.trim() }
              : {}),
          };

          const createdLabcodes: string[] = [];
          const namesToCreate = sampleNames.length > 0 ? sampleNames : [undefined as string | undefined];

          for (const sampleName of namesToCreate) {
            const metadataPayload: Record<string, unknown> = {
              ...baseMeta,
              ...(sampleName ? { sampleName } : {}),
            };

            /** Luôn `POST .../analyze` → `sample_waiting_analyze` (giống web). */
            console.log('Creating patient metadata (chờ phân tích):', metadataPayload);
            const metadataResponse =
              await patientMetadataService.createWithAnalyze(metadataPayload as any);
            if (metadataResponse.success && metadataResponse.data?.labcode) {
              createdLabcodes.push(metadataResponse.data.labcode);
              console.log('Patient metadata created:', metadataResponse.data.labcode, sampleName);
            } else {
              console.warn('Failed to create patient metadata:', metadataResponse.error, sampleName);
            }
          }

          if (createdLabcodes.length > 0) {
            const orderId = (orderResponse.data as any)?.orderId;
            if (orderId) {
              try {
                const updatePayload: any = {
                  orderName: normalizedOrderName,
                  orderStatus: ORDER_STATUS_ON_CREATE,
                  paymentStatus: formData.step6.paymentStatus || 'UNPAID',
                  paymentType: resolvedPaymentType,
                  patientMetadataIds: createdLabcodes,
                };
                
                if (finalSpecifyId) updatePayload.specifyId = finalSpecifyId;
                if (selectedCustomer?.userId) updatePayload.customerId = String(selectedCustomer.userId).trim();
                if (formData.step1.staffId?.trim()) updatePayload.staffId = formData.step1.staffId.trim();
                if (formData.step1.sampleCollectorId?.trim()) updatePayload.sampleCollectorId = formData.step1.sampleCollectorId.trim();
                if (formData.step1.staffAnalystId?.trim()) updatePayload.staffAnalystId = formData.step1.staffAnalystId.trim();
                if (formData.step1.barcodeId?.trim()) updatePayload.barcodeId = formData.step1.barcodeId.trim();
                if (formData.step6.paymentAmount?.trim()) {
                  const amount = parseVndAmountInput(formData.step6.paymentAmount);
                  if (Number.isFinite(amount) && amount > 0) updatePayload.paymentAmount = amount;
                }
                if (formData.step6.invoiceLink?.trim()) {
                  updatePayload.invoiceLink = formData.step6.invoiceLink.trim();
                }
                
                console.log('Updating order with metadata:', updatePayload);
                await orderService.update(orderId, updatePayload);
                console.log('Order updated with patient metadata successfully');
              } catch (updateError) {
                console.error('Error updating order with metadata:', updateError);
                // Don't throw - order was created successfully, metadata update is optional
              }
            }
          } else {
            console.warn('Không tạo được bản ghi patient metadata (labcode)');
          }
        } catch (metadataError) {
          console.error('Error creating patient metadata:', metadataError);
          // Don't throw - order was created successfully, metadata creation is optional
        }
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['barcodes'] });
      queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
      queryClient.invalidateQueries({ queryKey: ['specify-vote-tests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-specifies'] });
      setShowSuccessModal(true);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.');
    }
  };

  const renderStep1 = () => (
    <View className="bg-white rounded-3xl border border-slate-200 p-4">
      <FormInput
        name="step1.orderName"
        label="Tên đơn hàng"
        required
        placeholder="Nhập tên đơn hàng"
      />

      <FormSelect
        name="step1.staffId"
        label="Người thu tiền"
        required={paymentStaffs.length > 0}
        options={paymentStaffs}
        getLabel={s => s.staffName}
        getValue={s => s.staffId}
        placeholder="Lựa chọn"
        modalTitle="Chọn người thu tiền"
      />

      <FormSelect
        name="step1.barcodeId"
        label="Mã Barcode"
        required
        options={availableBarcodes}
        getLabel={b => b.barcode}
        getValue={b => b.barcode}
        placeholder="Lựa chọn"
        modalTitle="Chọn mã Barcode"
      />

      <FormSelect
        name="step1.staffAnalystId"
        label="Nhân viên phụ trách"
        required
        options={analystStaffs}
        getLabel={s => s.staffName}
        getValue={s => s.staffId}
        placeholder="Lựa chọn"
        modalTitle="Chọn nhân viên phụ trách (DOCTOR — BV trung tâm)"
      />

      <FormSelect
        name="step1.sampleCollectorId"
        label="Nhân viên thu mẫu"
        required
        options={collectorStaffs}
        getLabel={s => s.staffName}
        getValue={s => String(s.staffId ?? '').trim()}
        placeholder="Lựa chọn"
        modalTitle="Chọn nhân viên thu mẫu"
      />

      <View className="h-px bg-slate-100 my-4" />

      <FormSelect
        name="step6.fastq"
        label="FastQ"
        required
        options={[
          { value: 'NO', label: 'Không' },
          { value: 'YES', label: 'Có' },
        ]}
        getLabel={o => o.label}
        getValue={o => o.value}
        placeholder="Lựa chọn"
        modalTitle="Chọn FastQ"
      />
      <FormSelect
        name="step6.paymentStatus"
        label="Trạng thái thanh toán"
        required
        options={PAYMENT_STATUS_OPTIONS}
        getLabel={o => o.label}
        getValue={o => o.value}
        placeholder="Lựa chọn trạng thái thanh toán"
        modalTitle="Chọn trạng thái thanh toán"
      />

      {paymentStatusWatched === 'COMPLETED' && (
        <View className="mb-4">
          <Text className="text-[13px] font-extrabold text-slate-700 mb-2">Hóa đơn thanh toán</Text>
          <View className="bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3">
            <Text
              className={invoiceLinkWatched ? 'text-[13px] text-slate-700' : 'text-[13px] text-slate-400'}
            >
              {invoiceLinkWatched || 'Chưa có file hóa đơn (ảnh/PDF)'}
            </Text>
          </View>
          <View className="flex-row mt-3">
            <TouchableOpacity
              onPress={handlePickInvoiceFile}
              disabled={isUploadingInvoiceFile}
              className={`px-4 py-3 rounded-xl ${
                isUploadingInvoiceFile ? 'bg-slate-200' : 'bg-emerald-50 border border-emerald-200'
              }`}
              activeOpacity={0.8}
            >
              {isUploadingInvoiceFile ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#059669" />
                  <Text className="ml-2 text-[13px] font-bold text-emerald-800">Đang tải lên...</Text>
                </View>
              ) : (
                <Text className="text-[13px] font-bold text-emerald-800">Upload hóa đơn</Text>
              )}
            </TouchableOpacity>
            {!!invoiceLinkWatched && (
              <TouchableOpacity
                onPress={handleClearInvoiceFile}
                disabled={isUploadingInvoiceFile}
                className="ml-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200"
                activeOpacity={0.8}
              >
                <Text className="text-[13px] font-bold text-rose-700">Xóa file</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text className="mt-2 text-[11px] text-slate-500">PNG, JPG, PDF tối đa 10MB</Text>
        </View>
      )}

      <FormFieldGroup>
        {paymentStatusWatched !== 'UNPAID' && (
          <FormNumericInput
            name="step6.paymentAmount"
            label="Số tiền đã thu"
            type="currency"
            placeholder="Nhập vào số tiền (VNĐ)"
          />
        )}
        <FormSelect
          name="step6.paymentType"
          label="Hình thức thanh toán"
          required={!isFastqEnabled}
          options={PAYMENT_TYPE_OPTIONS}
          getLabel={o => o.label}
          getValue={o => o.value}
          placeholder={isFastqEnabled ? 'Tự động: Thanh toán online' : 'Tiền mặt'}
          modalTitle="Chọn hình thức thanh toán"
          disabled={isFastqEnabled}
          helperText={
            isFastqEnabled
              ? 'Đã chọn FastQ = Có nên hệ thống tự đặt hình thức thanh toán là Online.'
              : undefined
          }
        />
      </FormFieldGroup>

      <View className="mb-4">
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
          Hình ảnh phiếu xét nghiệm
        </Text>
        <View className="bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3">
          <Text
            className={specifyVoteImagePath ? 'text-[13px] text-slate-700' : 'text-[13px] text-slate-400'}
          >
            {specifyVoteImagePath || 'Chưa chọn file ảnh/PDF'}
          </Text>
        </View>
        <View className="flex-row mt-3">
          <TouchableOpacity
            onPress={handlePickSpecifyVoteFile}
            disabled={isUploadingSpecifyFile}
            className={`px-4 py-3 rounded-xl ${
              isUploadingSpecifyFile ? 'bg-slate-200' : 'bg-cyan-50 border border-cyan-200'
            }`}
            activeOpacity={0.8}
          >
            {isUploadingSpecifyFile ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#0891B2" />
                <Text className="ml-2 text-[13px] font-bold text-cyan-700">Đang tải lên...</Text>
              </View>
            ) : (
              <Text className="text-[13px] font-bold text-cyan-700">Chọn ảnh/PDF để upload</Text>
            )}
          </TouchableOpacity>
          {!!specifyVoteImagePath && (
            <TouchableOpacity
              onPress={handleClearSpecifyVoteFile}
              disabled={isUploadingSpecifyFile}
              className="ml-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200"
              activeOpacity={0.8}
            >
              <Text className="text-[13px] font-bold text-rose-700">Xóa file</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <FormInfoBox>PNG, JPG, PDF tối đa 10MB</FormInfoBox>
    </View>
  );

  const renderStep2 = () => {
    const step2SpecifyId = safeTrim(methods.watch('step2.specifyId'));
    const specifyIdErr = getFieldError(methods.formState.errors, 'step2.specifyId');
    const specifyIdBorder = specifyIdErr ? 'border-red-400' : 'border-slate-200';
    const setOpts = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

    return (
      <View className="bg-white rounded-3xl border border-slate-200 p-4">
        <View className="mb-4">
          <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
            Mã phiếu xét nghiệm <Text className="text-red-500">*</Text>
          </Text>
          <View className="flex-row gap-2 items-stretch">
            <Controller
              control={methods.control}
              name="step2.specifyId"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  className={`flex-1 bg-white rounded-2xl border px-3 py-3.5 ${specifyIdBorder}`}
                >
                  <TextInput
                    className="flex-1 min-h-[22px] text-[14px] font-bold text-slate-800"
                    placeholder="Nhập mã hoặc bấm Chọn"
                    placeholderTextColor="#94A3B8"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}
            />
            <TouchableOpacity
              onPress={() => {
                setSpecifyPickerQuery('');
                setSpecifyIdPickerOpen(true);
              }}
              disabled={specifyIdOptions.length === 0}
              className={`justify-center px-4 rounded-2xl border flex-row items-center gap-1 ${
                specifyIdOptions.length === 0
                  ? 'border-slate-100 bg-slate-50 opacity-60'
                  : 'border-slate-200 bg-white active:opacity-90'
              }`}
              activeOpacity={0.75}
            >
              <Text className="text-[13px] font-extrabold text-slate-700">Chọn</Text>
              <ChevronDown size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
          {specifyIdErr ? (
            <Text className="text-[11px] text-red-500 mt-1">
              {(specifyIdErr as FieldError)?.message?.toString() || 'Giá trị không hợp lệ'}
            </Text>
          ) : null}
        </View>

        <Modal
          visible={specifyIdPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSpecifyIdPickerOpen(false)}
        >
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-white rounded-t-3xl overflow-hidden">
              <View className="px-5 pt-4 pb-3 border-b border-slate-200 flex-row items-center justify-between">
                <Text className="text-[13px] font-extrabold text-slate-700">
                  Chọn mã phiếu xét nghiệm
                </Text>
                <TouchableOpacity
                  onPress={() => setSpecifyIdPickerOpen(false)}
                  className="w-10 h-10 rounded-2xl bg-slate-100 items-center justify-center"
                  activeOpacity={0.8}
                >
                  <X size={20} color="#334155" />
                </TouchableOpacity>
              </View>
              <View className="px-4 py-3 border-b border-slate-100">
                <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2.5">
                  <Search size={16} color="#64748B" />
                  <TextInput
                    className="flex-1 ml-2 text-[14px] text-slate-900"
                    placeholder="Tìm theo mã hoặc tên bệnh nhân..."
                    placeholderTextColor="#94A3B8"
                    value={specifyPickerQuery}
                    onChangeText={setSpecifyPickerQuery}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <ScrollView className="max-h-80">
                {filteredSpecifyPickOptions.length === 0 ? (
                  <View className="py-8 items-center px-4">
                    <Text className="text-[13px] text-slate-400 text-center">
                      {specifyIdOptions.length === 0
                        ? 'Không có phiếu chưa gắn đơn.'
                        : 'Không khớp từ khóa tìm kiếm.'}
                    </Text>
                  </View>
                ) : (
                  filteredSpecifyPickOptions.map((opt, index) => {
                    const selected = step2SpecifyId === safeTrim(opt.value);
                    return (
                      <TouchableOpacity
                        key={`${opt.value}-${index}`}
                        onPress={() => {
                          methods.setValue('step2.specifyId', opt.value, setOpts);
                          methods.clearErrors('step2.specifyId');
                          setSpecifyIdPickerOpen(false);
                          setSpecifyPickerQuery('');
                        }}
                        className={`px-5 py-3.5 flex-row items-center justify-between border-b border-slate-50 ${
                          selected ? 'bg-sky-50' : ''
                        }`}
                        activeOpacity={0.75}
                      >
                        <Text
                          className={`flex-1 pr-2 text-[14px] font-medium ${
                            selected ? 'text-sky-700' : 'text-slate-900'
                          }`}
                          numberOfLines={2}
                        >
                          {opt.label}
                        </Text>
                        {selected ? <Check size={18} color="#0284C7" /> : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {!step2SpecifyId && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/create-prescription-slip',
                params: source ? { source, quick: '1' } : { quick: '1' },
              } as any)
            }
            className="mb-4 py-3 px-4 rounded-2xl bg-cyan-50 border border-cyan-200"
            activeOpacity={0.85}
          >
            <Text className="text-[13px] font-extrabold text-cyan-700 text-center">
              Tạo nhanh phiếu xét nghiệm
            </Text>
          </TouchableOpacity>
        )}

        {hasPreviousOrders && (
          <View className="mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-2xl">
            <Text className="text-xs font-bold text-cyan-800">
              Bệnh nhân này đã có đơn hàng trước đó trong hệ thống. Thông tin bệnh nhân đã được tự
              động điền.
            </Text>
          </View>
        )}

        <FormSelect
          name="step1.doctorId"
          label="Bác sĩ chỉ định"
          required
          options={filteredDoctors}
          getLabel={d => d.doctorName}
          getValue={d => d.doctorId}
          placeholder="Lựa chọn"
          modalTitle="Chọn bác sĩ chỉ định"
        />

        <FormSelect
          name="step1.hospitalId"
          label="P.khám/Bệnh viện"
          required
          options={hospitalOptions}
          getLabel={h => h.label}
          getValue={h => h.value}
          placeholder="Lựa chọn"
          modalTitle="Chọn phòng khám/bệnh viện"
          disabled={!!step2SpecifyId}
          helperText={
            step2SpecifyId
              ? 'Đã gắn với mã phiếu — xóa mã phiếu nếu cần đổi cơ sở.'
              : undefined
          }
        />

        <FormInput
          name="step2.patientName"
          label="Họ tên"
          required
          placeholder="Nhập vào họ và tên"
          editable={!isLoadingPatient}
        />

        <FormFieldGroup>
          <FormNumericInput
            name="step2.patientPhone"
            label="Số điện thoại"
            required
            type="phone"
            placeholder="Nhập hoặc chọn SĐT - Tên bệnh nhân"
            disabled={isLoadingPatient}
          />
          <FormSelect
            name="step2.patientGender"
            label="Giới tính"
            required
            options={GENDER_OPTIONS}
            getLabel={o => o.label}
            getValue={o => o.value}
            placeholder="Lựa chọn"
            modalTitle="Chọn giới tính"
          />
        </FormFieldGroup>

        <FormFieldGroup>
          <FormDatePicker
            name="step2.patientDob"
            label="Ngày sinh"
            required
            placeholder="Chọn ngày sinh"
            maximumDate={new Date()}
            helperText="Bấm để chọn ngày trên lịch"
          />
          <FormInput
            name="step2.patientEmail"
            label="Email"
            placeholder="Nhập email (VD: example@gmail.com)"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </FormFieldGroup>

        <FormInput name="step2.patientJob" label="Nghề nghiệp" placeholder="Nhập nghề nghiệp" />

        <FormFieldGroup>
          <FormInput
            name="step2.patientContactName"
            label="Người liên hệ"
            required
            placeholder="Nhập người liên hệ"
          />
          <FormNumericInput
            name="step2.patientContactPhone"
            label="SĐT người liên hệ"
            required
            type="phone"
            placeholder="Nhập số điện thoại"
          />
        </FormFieldGroup>

        <FormTextarea
          name="step2.patientAddress"
          label="Địa chỉ bệnh nhân"
          required
          placeholder="Nhập địa chỉ (VD: 123 Nguyễn Trãi, Thanh Xuân, Hà Nội)"
          minHeight={110}
        />
      </View>
    );
  };

  const uploadStep3DiagnoseImageFromUri = useCallback(
    async (uri: string) => {
      setUploadingStep3DiagnoseImage(true);
      try {
        const uploaded = await uploadImageToCloudinary(uri, { folder: 'disease-diagnose-images' });
        const url = uploaded.secureUrl || uploaded.url;
        if (!url) throw new Error('Không lấy được URL ảnh sau khi upload');
        methods.setValue('step3.diagnoseImage', url, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      } finally {
        setUploadingStep3DiagnoseImage(false);
      }
    },
    [methods]
  );

  const pickStep3DiagnoseImageFromLibrary = useCallback(async () => {
    if (uploadingStep3DiagnoseImage) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Cần quyền thư viện ảnh để chọn hình chẩn đoán.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await uploadStep3DiagnoseImageFromUri(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể tải ảnh lên. Kiểm tra Cloudinary hoặc thử lại.');
    }
  }, [uploadingStep3DiagnoseImage, uploadStep3DiagnoseImageFromUri]);

  const pickStep3DiagnoseImageFromCamera = useCallback(async () => {
    if (uploadingStep3DiagnoseImage) return;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Cần quyền camera để chụp ảnh chẩn đoán.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await uploadStep3DiagnoseImageFromUri(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể chụp/tải ảnh. Vui lòng thử lại.');
    }
  }, [uploadingStep3DiagnoseImage, uploadStep3DiagnoseImageFromUri]);

  const clearStep3DiagnoseImage = useCallback(() => {
    methods.setValue('step3.diagnoseImage', '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [methods]);

  const renderStep3 = () => {
    const selectedServiceType = methods.watch('step3.serviceType');
    const step3DiagnoseImageUrl = methods.watch('step3.diagnoseImage');

    return (
      <View className="bg-white rounded-3xl border border-slate-200 p-4">
        <FormSelect
          name="step3.serviceType"
          label="Nhóm xét nghiệm"
          required
          options={serviceOptions}
          getLabel={o => o.label}
          getValue={o => o.value}
          placeholder="Lựa chọn"
          modalTitle="Chọn nhóm xét nghiệm"
        />

        {selectedServiceType === 'reproduction' && (
          <>
            <View className="h-px bg-slate-100 my-3" />
            <Text className="text-[14px] font-extrabold text-slate-900 mb-3">
              Nhóm sản
            </Text>
            <Text className="text-[12px] text-slate-500 mb-2">
              Giống web quản trị: bắt buộc tuần thai, ngày thai và số lượng thai; chiều dài đầu mông, độ mờ da gáy,
              combined test và siêu âm là tuỳ chọn.
            </Text>
            <FormNumericInput
              name="step3.fetusesWeek"
              label="Tuần thai *"
              type="integer"
              placeholder="0 – 40"
            />
            <FormNumericInput
              name="step3.fetusesDay"
              label="Ngày thai *"
              type="integer"
              placeholder="0 – 30"
            />
            <FormSelect
              name="step3.fetusesNumber"
              label="Số lượng thai *"
              options={[...STEP3_COUNT_123_OPTIONS]}
              getLabel={o => o.label}
              getValue={o => o.value}
              placeholder="Chọn số lượng thai"
              modalTitle="Chọn số lượng thai"
            />
            <FormNumericInput
              name="step3.headRumpLength"
              label="Chiều dài đầu mông (mm)"
              type="decimal"
              placeholder="0 – 100 (tuỳ chọn)"
            />
            <FormDatePicker
              name="step3.ultrasoundDay"
              label="Ngày siêu âm"
              placeholder="Chọn ngày siêu âm"
              helperText="Tuỳ chọn — bấm để chọn trên lịch"
            />
            <FormNumericInput
              name="step3.neckLength"
              label="Độ mờ da gáy (mm)"
              type="decimal"
              placeholder="0 – 5 (tuỳ chọn)"
            />
            <FormTextarea
              name="step3.combinedTestResult"
              label="Kết quả nguy cơ của combined test"
              placeholder="Nhập kết quả (tuỳ chọn)"
              minHeight={90}
            />
            <FormTextarea
              name="step3.ultrasoundResult"
              label="Kết quả siêu âm"
              placeholder="Nhập kết quả (tuỳ chọn)"
              minHeight={90}
            />
          </>
        )}

        {selectedServiceType === 'embryo' && (
          <>
            <View className="h-px bg-slate-100 my-3" />
            <Text className="text-[14px] font-extrabold text-slate-900 mb-3">
              Nhóm phôi
            </Text>
            <Text className="text-[12px] text-slate-500 mb-2">
              Giống web quản trị: các trường tuỳ chọn; số phôi tạo chọn 1, 2 hoặc 3.
            </Text>
            <FormInput
              name="step3.biospy"
              label="Sinh thiết"
              placeholder="Nhập thông tin sinh thiết"
            />
            <FormDatePicker
              name="step3.biospyDate"
              label="Ngày sinh thiết"
              placeholder="Chọn ngày sinh thiết"
              helperText="Tuỳ chọn — có thể chọn ngày trong tương lai"
            />
            <FormInput
              name="step3.cellContainingSolution"
              label="Dung dịch chứa tế bào"
              placeholder="Nhập dung dịch"
            />
            <FormSelect
              name="step3.embryoCreate"
              label="Số phôi tạo"
              options={[...STEP3_COUNT_123_OPTIONS]}
              getLabel={o => o.label}
              getValue={o => o.value}
              placeholder="Chọn 1, 2 hoặc 3"
              modalTitle="Chọn số phôi tạo"
            />
            <FormInput
              name="step3.embryoStatus"
              label="Trạng thái phôi"
              placeholder="Nhập trạng thái"
            />
            <FormTextarea
              name="step3.morphologicalAssessment"
              label="Đánh giá hình thái"
              placeholder="Nhập đánh giá"
              minHeight={90}
            />
            <FormSelect
              name="step3.cellNucleus"
              label="Nhân tế bào"
              options={[
                { value: true, label: 'Có' },
                { value: false, label: 'Không' },
              ]}
              getLabel={o => o.label}
              getValue={o => o.value}
              placeholder="Tuỳ chọn"
              modalTitle="Chọn nhân tế bào"
            />
            <FormInput
              name="step3.negativeControl"
              label="Đối chứng âm"
              placeholder="Nhập đối chứng"
            />
          </>
        )}

        {selectedServiceType === 'disease' && (
          <>
            <View className="h-px bg-slate-100 my-3" />
            <Text className="text-[14px] font-extrabold text-slate-900 mb-3">
              Nhóm bệnh lý
            </Text>
            <Text className="text-[12px] text-slate-500 mb-2">
              Giống web quản trị: điền theo thực tế; ảnh chẩn đoán có thể tải lên Cloudinary hoặc dán URL.
            </Text>
            <FormTextarea
              name="step3.symptom"
              label="Triệu chứng"
              placeholder="Nhập triệu chứng"
              minHeight={90}
            />
            <FormTextarea
              name="step3.diagnose"
              label="Chẩn đoán"
              placeholder="Nhập chẩn đoán"
              minHeight={90}
            />
            <View className="mt-1 mb-2">
              <Text className="text-slate-800 text-sm font-extrabold mb-2">Hình ảnh chẩn đoán</Text>
              {!!step3DiagnoseImageUrl?.trim() && (
                <View className="mb-3 rounded-xl border border-sky-200 overflow-hidden bg-sky-50 self-start">
                  <Image
                    source={{ uri: step3DiagnoseImageUrl.trim() }}
                    className="w-40 h-40"
                    resizeMode="cover"
                  />
                </View>
              )}
              <View className="flex-row flex-wrap gap-2 mb-2">
                <TouchableOpacity
                  onPress={pickStep3DiagnoseImageFromLibrary}
                  disabled={uploadingStep3DiagnoseImage}
                  className={`px-4 py-2.5 rounded-xl border ${
                    uploadingStep3DiagnoseImage ? 'bg-slate-200 border-slate-200' : 'bg-sky-600 border-sky-600'
                  }`}
                  activeOpacity={0.85}
                >
                  {uploadingStep3DiagnoseImage ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-xs font-extrabold">Chọn ảnh</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickStep3DiagnoseImageFromCamera}
                  disabled={uploadingStep3DiagnoseImage}
                  className={`px-4 py-2.5 rounded-xl border ${
                    uploadingStep3DiagnoseImage ? 'bg-slate-100 border-slate-200' : 'bg-white border-sky-300'
                  }`}
                  activeOpacity={0.85}
                >
                  <Text
                    className={`text-xs font-extrabold ${
                      uploadingStep3DiagnoseImage ? 'text-slate-400' : 'text-sky-700'
                    }`}
                  >
                    Chụp ảnh
                  </Text>
                </TouchableOpacity>
                {!!step3DiagnoseImageUrl?.trim() && (
                  <TouchableOpacity
                    onPress={clearStep3DiagnoseImage}
                    disabled={uploadingStep3DiagnoseImage}
                    className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50"
                    activeOpacity={0.85}
                  >
                    <Text className="text-red-700 text-xs font-extrabold">Xóa ảnh</Text>
                  </TouchableOpacity>
                )}
              </View>
              <FormInput
                name="step3.diagnoseImage"
                label="Hoặc dán URL ảnh"
                placeholder="https://..."
              />
            </View>
            <FormInput
              name="step3.testRelated"
              label="Xét nghiệm liên quan"
              placeholder="Nhập xét nghiệm"
            />
            <FormTextarea
              name="step3.treatmentMethods"
              label="Phương pháp điều trị"
              placeholder="Nhập phương pháp"
              minHeight={90}
            />
            <FormNumericInput
              name="step3.treatmentTimeDay"
              label="Số ngày điều trị"
              type="integer"
              placeholder="Tuỳ chọn — số nguyên ≥ 0"
            />
            <FormInput
              name="step3.drugResistance"
              label="Kháng thuốc"
              placeholder="Nhập thông tin kháng thuốc"
            />
            <FormInput
              name="step3.relapse"
              label="Tái phát"
              placeholder="Nhập thông tin tái phát"
            />
          </>
        )}

        {selectedServiceType && (
          <FormInfoBox>
            Nhóm sản: cần tuần thai, ngày thai và số lượng thai. Nhóm phôi / bệnh lý: tuỳ chọn từng trường như trên
            web quản trị.
          </FormInfoBox>
        )}
      </View>
    );
  };

  const renderStep4 = () => (
    <View className="bg-white rounded-3xl border border-slate-200 p-4">
      <FormFieldGroup>
        <FormNumericInput
          name="step4.patientHeight"
          label="Chiều cao (cm)"
          required
          type="decimal"
          placeholder="Nhập chiều cao"
          numericMax={200}
          helperText="0 – 200 cm (giống web đặt hàng)"
        />
        <FormNumericInput
          name="step4.patientWeight"
          label="Cân nặng (kg)"
          required
          type="decimal"
          placeholder="Nhập cân nặng"
          numericMax={100}
          helperText="0 – 100 kg (giống web đặt hàng)"
        />
      </FormFieldGroup>

      <FormTextarea
        name="step4.patientHistory"
        label="Tiền sử bệnh nhân"
        required
        placeholder="Nhập tiền sử bệnh nhân"
        minHeight={110}
      />
      <FormTextarea
        name="step4.familyHistory"
        label="Tiền sử gia đình"
        placeholder="Nhập tiền sử gia đình"
        minHeight={110}
      />
      <FormTextarea
        name="step4.toxicExposure"
        label="Tiếp xúc độc hại"
        placeholder="Nhập thông tin có tiếp xúc các yếu tố độc hại"
        minHeight={90}
      />
      <FormTextarea
        name="step4.medicalHistory"
        label="Tiền sử bệnh"
        placeholder="Nhập tiền sử bệnh"
        minHeight={110}
      />
      <FormTextarea
        name="step4.chronicDisease"
        label="Bệnh lý mãn tính"
        placeholder="Nhập bệnh lý mãn tính"
        minHeight={90}
      />
      <FormTextarea
        name="step4.acuteDisease"
        label="Bệnh lý cấp tính"
        required
        placeholder="Nhập bệnh cấp tính"
        minHeight={90}
      />
      <FormTextarea
        name="step4.medicalUsing"
        label="Thuốc đang dùng"
        required
        placeholder="Thuốc đang dùng"
        minHeight={90}
      />
    </View>
  );

  const renderStep5 = () => {
    const testName = methods.watch('step5.testName');
    const step5GenomeId = String(methods.watch('step5.genomeTestId') ?? '').trim();
    const lockTestDetails = !!step5GenomeId;
    return (
      <View className="bg-white rounded-3xl border border-slate-200 p-4">
        <View className="mb-4">
          <Text className="text-slate-700 font-medium mb-2">
            Mã xét nghiệm <Text className="text-red-500">*</Text>
          </Text>
          <FormSelect
            name="step5.genomeTestId"
            label=""
            required
            options={filteredGenomeTests}
            getLabel={t => t.testName}
            getValue={t => t.testId}
            placeholder="Lựa chọn"
            modalTitle="Chọn xét nghiệm"
          />
        </View>

        {lockTestDetails ? (
          <FormInfoBox>
            Đã chọn mã xét nghiệm: tên, mẫu và nội dung xét nghiệm khớp theo danh mục — không chỉnh sửa.
          </FormInfoBox>
        ) : null}

        {!!(testName || lockTestDetails) && <View className="h-px bg-slate-100 my-2" />}

        <FormInput
          name="step5.testName"
          label="Tên xét nghiệm"
          required
          placeholder="Nhập tên xét nghiệm"
          editable={!lockTestDetails}
        />
        <FormInput
          name="step5.testSample"
          label="Mẫu xét nghiệm"
          required
          placeholder="Lựa chọn"
          editable={!lockTestDetails}
        />
        <FormTextarea
          name="step5.testContent"
          label="Nội dung xét nghiệm"
          placeholder="Nội dung xét nghiệm sẽ tự động điền khi chọn mã xét nghiệm"
          minHeight={90}
          disabled={lockTestDetails}
        />

        <FormInput
          name="step6.samplingSite"
          label="Nơi thu mẫu"
          required
          placeholder="Nhập nơi thu mẫu"
        />
        <FormFieldGroup>
          <FormDatePicker
            name="step6.sampleCollectDate"
            label="Ngày thu mẫu"
            required
            placeholder="Chọn ngày thu mẫu"
            helperText="Bấm để chọn ngày trên lịch (bắt buộc)"
          />
          <FormSelect
            name="step6.embryoNumber"
            label="Số lượng phôi"
            options={EMBRYO_COUNT_OPTIONS}
            getLabel={o => o.label}
            getValue={o => o.value}
            placeholder="Chọn 1, 2 hoặc 3"
            modalTitle="Số lượng phôi"
            helperText="Nhóm phôi: chọn 1 – 3 (giống web)"
          />
        </FormFieldGroup>
      </View>
    );
  };

  const renderStep7 = () => {
    const formData = methods.getValues();
    const hasPreviousData =
      formData.step2?.patientName || formData.step3?.serviceType || formData.step5?.testName;

    return (
      <View className="bg-white rounded-3xl border border-slate-200 p-4">
        {hasPreviousData ? (
          <>
            {patientMetadataList.length > 0 ? (
              <>
                <View className="mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-2xl">
                  <Text className="text-xs font-bold text-cyan-800 mb-2">
                    Thông tin đã nhập từ các bước trước ({patientMetadataList.length} nhóm thông
                    tin)
                  </Text>
                  {patientMetadataList.map((metadata: any, index: number) => (
                    <View
                      key={index}
                      className="mt-2 p-2 bg-white rounded-lg border border-cyan-100"
                    >
                      <Text className="text-xs font-semibold text-slate-700 mb-1">
                        {metadata.type}
                      </Text>
                      {Object.entries(metadata.data || {}).map(([key, value]: [string, any]) => {
                        if (!value || value === '' || value === undefined) return null;
                        return (
                          <Text key={key} className="text-xs text-slate-600 mt-0.5">
                            {key}: {String(value)}
                          </Text>
                        );
                      })}
                    </View>
                  ))}
                  <Text className="text-xs text-cyan-700 mt-2">
                    Các trường có sẵn đã được tự động điền vào form bên dưới. Bạn có thể chỉnh sửa
                    nếu cần.
                  </Text>
                </View>
              </>
            ) : (
              <View className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-2xl">
                <Text className="text-xs font-bold text-yellow-800">
                  Chưa có thông tin từ các bước trước. Vui lòng điền thông tin thủ công.
                </Text>
              </View>
            )}
          </>
        ) : (
          <View className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-2xl">
            <Text className="text-xs font-bold text-yellow-800">
              Vui lòng hoàn thành các bước trước để có thông tin tự động điền.
            </Text>
          </View>
        )}

        <FormTextarea
          name="step7.geneticTestResults"
          label="Kết quả xét nghiệm di truyền - Bản thân"
          placeholder="Nhập kết quả xét nghiệm bản thân"
          minHeight={110}
        />

        <FormTextarea
          name="step7.geneticTestResultsRelationship"
          label="Kết quả xét nghiệm di truyền - Người thân"
          placeholder="Nhập kết quả xét nghiệm người thân"
          minHeight={110}
        />
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep7();
      default:
        return (
          <View className="bg-white rounded-3xl border border-slate-200 p-8 items-center">
            <Text className="text-sm font-bold text-slate-500">
              Bước {currentStep} - Đang phát triển
            </Text>
          </View>
        );
    }
  };

  return (
    <FormProvider {...methods}>
      <View className="flex-1 bg-slate-50">
        <View className="pt-14 pb-4 px-5 bg-white border-b border-slate-200">
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
                Thêm đơn hàng
              </Text>
              <Text className="mt-0.5 text-[11px] font-bold text-slate-500" numberOfLines={1}>
                Hoàn thiện theo từng bước
              </Text>
            </View>

            <View className="w-11 h-11" />
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
          <View className="mt-4 h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <View
              className="h-full bg-cyan-600 rounded-full"
              style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 2, gap: 8 }}
          >
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === currentStep;
              const isDone = stepNum < currentStep;

              return (
                <View
                  key={i}
                  className={`flex-row items-center px-3 py-2 rounded-full border ${
                    isActive
                      ? 'bg-cyan-600 border-sky-700'
                      : isDone
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'bg-white border-slate-200'
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full items-center justify-center ${isActive ? 'bg-white/20' : isDone ? 'bg-white/20' : 'bg-slate-100'}`}
                  >
                    {isDone ? (
                      <Check size={12} color="#fff" strokeWidth={3} />
                    ) : (
                      <Text
                        className={`text-[11px] font-extrabold ${isActive ? 'text-white' : 'text-slate-600'}`}
                      >
                        {stepNum}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ 
            padding: 16, 
            paddingBottom: isKeyboardVisible
              ? (Platform.OS === 'android' ? 220 : 260)
              : (Platform.OS === 'android' ? 100 : 120)
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="bg-white rounded-2xl border border-slate-200 p-4">
            {renderCurrentStep()}
          </View>
        </ScrollView>

        {!isKeyboardVisible && (
          <View 
            className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200"
            style={{ 
              paddingBottom: Platform.OS === 'android' ? 8 : 20,
              paddingTop: 16,
              paddingHorizontal: 16,
              zIndex: 1000,
              elevation: Platform.OS === 'android' ? 8 : 0,
              shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0,
              shadowRadius: Platform.OS === 'ios' ? 4 : 0,
            }}
          >
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 h-12 rounded-2xl items-center justify-center bg-white border border-slate-200"
                onPress={handleBack}
                activeOpacity={0.8}
              >
                <Text className="text-[15px] font-extrabold text-slate-700">
                  {currentStep === 1 ? 'Huỷ' : 'Quay lại'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 h-12 rounded-2xl items-center justify-center bg-cyan-600"
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text className="text-[15px] font-extrabold text-white">
                  {currentStep === TOTAL_STEPS ? 'Hoàn thành' : 'Tiếp theo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Modal
          visible={showSuccessModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowSuccessModal(false);
            setListFreshOnNextFocus(targetOrdersRoute === '/admin/orders' ? 'admin-orders' : 'orders');
            router.back();
          }}
        >
          <View className="flex-1 bg-black/60 justify-center items-center p-5">
            <View className="bg-white rounded-3xl w-full max-w-[420px] overflow-hidden border border-slate-200">
              <View className="items-center p-6">
                <View className="w-16 h-16 rounded-2xl bg-emerald-500/12 border border-emerald-200 items-center justify-center">
                  <Check size={30} color="#22C55E" strokeWidth={3} />
                </View>

                <Text className="mt-4 text-[16px] font-extrabold text-slate-900">
                  Tạo đơn thành công
                </Text>
                <Text className="mt-2 text-[12px] font-bold text-slate-500 text-center leading-5">
                  Đơn hàng đã được lưu. Bạn có thể xem trong danh sách đơn hàng.
                </Text>
              </View>

              <View className="flex-row p-4 gap-3 border-t border-slate-200 bg-slate-50">
                <TouchableOpacity
                  className="flex-1 h-12 rounded-2xl items-center justify-center bg-white border border-slate-200"
                  onPress={() => {
                    setShowSuccessModal(false);
                    setListFreshOnNextFocus(targetOrdersRoute === '/admin/orders' ? 'admin-orders' : 'orders');
                    router.back();
                  }}
                  activeOpacity={0.85}
                >
                  <Text className="text-[14px] font-extrabold text-slate-700">Xem danh sách</Text>
                </TouchableOpacity>

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
      </View>
    </FormProvider>
  );
}
