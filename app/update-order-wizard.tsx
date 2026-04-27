import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
import { SelectionModal, type SelectionOption } from '@/components/modals/SelectionModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  createOrderDefaultValues,
  createOrderSchema,
  GENDER_OPTIONS,
  EMBRYO_COUNT_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  SERVICE_TYPE_OPTIONS,
  type CreateOrderFormData,
} from '@/lib/schemas/order-schemas';
import { getBarcodeStringFromOrder } from '@/utils/order-barcode';
import { formatVndAmountFromNumber, parseVndAmountInput } from '@/utils/money';
import { isLabPosition, isStaffAnalystWebRule, isStaffPosition } from '@/utils/hospital-staff-position';
import {
  getOrderStatusBadge,
  ORDER_STATUS_DEFAULT,
  orderStatusForUpdatePayload,
} from '@/lib/constants/order-status';
import { getPaymentStatusBadge } from '@/lib/constants/payment-status';
import { OrderStatus } from '@/types';
import { BarcodeResponse, barcodeService } from '@/services/barcodeService';
import { DoctorResponse, doctorService } from '@/services/doctorService';
import { GenomeTestResponse, genomeTestService } from '@/services/genomeTestService';
import { HospitalStaffResponse, hospitalStaffService } from '@/services/hospitalStaffService';
import { getApiResponseData } from '@/lib/types/api-types';
import { OrderResponse, orderService, pickOrderSampleCollector } from '@/services/orderService';
import { patientClinicalService } from '@/services/patientClinicalService';
import { patientService } from '@/services/patientService';
import { ServiceResponse, serviceService } from '@/services/serviceService';
import {
  type SpecifyVoteTestResponse,
  specifyVoteTestService,
} from '@/services/specifyVoteTestService';
import { reproductionService } from '@/services/reproductionService';
import { embryoService } from '@/services/embryoService';
import { diseaseService } from '@/services/diseaseService';
import { uploadFileToCloudinary, uploadImageToCloudinary } from '@/utils/cloudinary';
import { ensurePatientMetadataForOrder } from '@/utils/ensurePatientMetadataForOrder';

const TOTAL_STEPS = 6;
/** Giống `create-order.tsx` — cùng thứ tự 6 bước */
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

const formatDateInput = (isoDate?: string): string => {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const STEP3_COUNT_123_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
] as const;

const safeTrim = (value: unknown): string => String(value ?? '').trim();

const normalizeServiceType = (value?: string): 'reproduction' | 'embryo' | 'disease' | '' => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'reproduction' || v === 'sản' || v === 'san') return 'reproduction';
  if (v === 'embryo' || v === 'phôi' || v === 'phoi') return 'embryo';
  if (v === 'disease' || v === 'bệnh lý' || v === 'benh ly') return 'disease';
  return '';
};

/** Từ object xét nghiệm (API / nested) — không phụ thuộc danh sách genomeTests đã tải */
const serviceTypeFromGenomeTestObj = (test: any): 'reproduction' | 'embryo' | 'disease' | '' => {
  const name = String(test?.service?.name || '').toLowerCase();
  if (name.includes('embryo')) return 'embryo';
  if (name.includes('disease')) return 'disease';
  if (name.includes('reproduction') || name.includes('sản') || name.includes('san')) return 'reproduction';
  return '';
};

/** Điền step4 từ payload lâm sàng (API patient-clinical hoặc object lồng trong chỉ định) */
const applyClinicalDataToStep4 = (
  methods: { setValue: (n: any, v: any, o?: any) => void },
  clinicalData: any,
  setOpts: { shouldDirty: boolean; shouldValidate: boolean }
) => {
  const emptyStep4 = createOrderDefaultValues.step4;
  if (!clinicalData) {
    (Object.keys(emptyStep4) as Array<keyof typeof emptyStep4>).forEach(key => {
      methods.setValue(`step4.${key}`, emptyStep4[key], setOpts);
    });
    return;
  }
  if (clinicalData.patientHeight !== undefined && clinicalData.patientHeight !== null) {
    methods.setValue('step4.patientHeight', String(clinicalData.patientHeight), setOpts);
  } else {
    methods.setValue('step4.patientHeight', emptyStep4.patientHeight, setOpts);
  }
  if (clinicalData.patientWeight !== undefined && clinicalData.patientWeight !== null) {
    methods.setValue('step4.patientWeight', String(clinicalData.patientWeight), setOpts);
  } else {
    methods.setValue('step4.patientWeight', emptyStep4.patientWeight, setOpts);
  }
  methods.setValue(
    'step4.patientHistory',
    safeTrim(clinicalData.patientHistory) || emptyStep4.patientHistory,
    setOpts
  );
  methods.setValue(
    'step4.familyHistory',
    safeTrim(clinicalData.familyHistory) || emptyStep4.familyHistory,
    setOpts
  );
  methods.setValue(
    'step4.toxicExposure',
    safeTrim(clinicalData.toxicExposure) || emptyStep4.toxicExposure,
    setOpts
  );
  methods.setValue(
    'step4.medicalHistory',
    safeTrim(clinicalData.medicalHistory) || emptyStep4.medicalHistory,
    setOpts
  );
  methods.setValue(
    'step4.chronicDisease',
    safeTrim(clinicalData.chronicDisease) || emptyStep4.chronicDisease,
    setOpts
  );
  methods.setValue(
    'step4.acuteDisease',
    safeTrim(clinicalData.acuteDisease) || emptyStep4.acuteDisease,
    setOpts
  );
  const medicalUsingText = Array.isArray(clinicalData.medicalUsing)
    ? clinicalData.medicalUsing.map((item: string) => safeTrim(item)).filter(Boolean).join(', ')
    : safeTrim(clinicalData.medicalUsing as any);
  methods.setValue(
    'step4.medicalUsing',
    medicalUsingText || emptyStep4.medicalUsing,
    setOpts
  );
};

const pickLatestPatientService = <T extends { patientId?: string; serviceId?: string; createdAt?: string }>(
  records: T[],
  patientId: string,
  serviceId?: string
): T | undefined => {
  if (!Array.isArray(records) || !patientId) return undefined;
  const np = safeTrim(patientId);
  const ns = safeTrim(serviceId);
  const filtered = records.filter((item) => {
    if (safeTrim(item.patientId) !== np) return false;
    if (!ns) return true;
    return safeTrim(item.serviceId) === ns;
  });
  if (!filtered.length) return undefined;
  return filtered.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  })[0];
};

const EMPTY_DOCTORS: DoctorResponse[] = [];
const EMPTY_STAFFS: HospitalStaffResponse[] = [];
const EMPTY_BARCODES: BarcodeResponse[] = [];
const EMPTY_GENOME_TESTS: GenomeTestResponse[] = [];
const EMPTY_SERVICES: ServiceResponse[] = [];
const MAX_INVOICE_UPLOAD_BYTES = 10 * 1024 * 1024;

const looksLikeHttpUrl = (s: string): boolean => {
  const t = String(s || '').trim().toLowerCase();
  return t.startsWith('http://') || t.startsWith('https://');
};

async function openExternalUrl(raw: string): Promise<void> {
  const url = String(raw || '').trim();
  if (!looksLikeHttpUrl(url)) {
    Alert.alert('Không mở được', 'Chỉ hỗ trợ liên kết bắt đầu bằng http:// hoặc https://.');
    return;
  }
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Không thể mở', 'Thiết bị không mở được liên kết này.');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Lỗi', 'Không thể mở liên kết. Vui lòng thử lại.');
  }
}

function OpenableUrlText({
  value,
  numberOfLines = 6,
  emptyMessage,
  emptyClassName,
  filledClassName,
}: {
  value: string;
  numberOfLines?: number;
  emptyMessage: string;
  emptyClassName: string;
  filledClassName: string;
}) {
  const v = String(value || '').trim();
  if (!v) {
    return (
      <Text className={emptyClassName} numberOfLines={numberOfLines}>
        {emptyMessage}
      </Text>
    );
  }
  if (looksLikeHttpUrl(v)) {
    return (
      <TouchableOpacity onPress={() => void openExternalUrl(v)} activeOpacity={0.75}>
        <Text
          className={`${filledClassName} text-blue-700`}
          style={{ textDecorationLine: 'underline' }}
          numberOfLines={numberOfLines}
        >
          {v}
        </Text>
      </TouchableOpacity>
    );
  }
  return (
    <Text className={filledClassName} numberOfLines={numberOfLines} selectable>
      {v}
    </Text>
  );
}

export default function UpdateOrderWizardScreen() {
  const router = useRouter();
  const { orderId, source } = useLocalSearchParams<{ orderId: string; source?: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const targetAfterSave = source === 'admin' ? '/admin/orders' : '/pending-orders';

  const [currentStep, setCurrentStep] = useState(1);
  // Giữ footer cố định để tránh nháy nút "Huỷ / Tiếp theo" khi cuộn sát đáy.
  const showFooter = true;
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadingStep3DiagnoseImage, setUploadingStep3DiagnoseImage] = useState(false);
  const [isUploadingInvoiceFile, setIsUploadingInvoiceFile] = useState(false);
  const [showSpecifyIdModal, setShowSpecifyIdModal] = useState(false);
  const [pickingSpecify, setPickingSpecify] = useState(false);
  const serviceGroupRowIdsRef = useRef<{ reproduction?: string; embryo?: string; disease?: string }>({});
  const lastStaffAnalystIdRef = useRef('');
  const lastSampleCollectorIdRef = useRef('');
  /** Khi user xóa SĐT (từ 10 số hợp lệ → không hợp lệ): không cho useEffect hydrate từ GET order ghi đè lại BN. */
  const skipOrderPatientRehydrateRef = useRef(false);
  const prevHadValidStep2PhoneRef = useRef(false);
  const lastPatientLookupPhoneRef = useRef('');

  const methods = useForm<CreateOrderFormData>({
    resolver: zodResolver(createOrderSchema),
    mode: 'onTouched',
    shouldUnregister: false,
    defaultValues: createOrderDefaultValues,
  });

  const { data: orderResponse, isLoading: isLoadingOrder } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderService.getById(orderId!),
    enabled: !!orderId,
  });

  const { data: doctorsResponse } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorService.getAll(),
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

  const { data: servicesResponse } = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceService.getAll(),
    retry: false,
  });

  const { data: specifyListForPickResponse } = useQuery({
    queryKey: ['specify-vote-tests', 'order-wizard-pick'],
    queryFn: () => specifyVoteTestService.getAll({ page: 0, size: 300 }),
    enabled: !!orderId,
    retry: false,
  });

  /** Dùng mảng rỗng module-level — tránh `[]` mới mỗi render → useEffect + setValue lặp vô hạn */
  const doctors = useMemo(() => {
    if (!(doctorsResponse as any)?.success) return EMPTY_DOCTORS;
    return ((doctorsResponse as any).data as DoctorResponse[]) || EMPTY_DOCTORS;
  }, [doctorsResponse]);

  const staffs = useMemo(() => {
    if (!(staffResponse as any)?.success) return EMPTY_STAFFS;
    return ((staffResponse as any).data as HospitalStaffResponse[]) || EMPTY_STAFFS;
  }, [staffResponse]);

  const allBarcodes = useMemo(() => {
    if (!(barcodesResponse as any)?.success) return EMPTY_BARCODES;
    return ((barcodesResponse as any).data as BarcodeResponse[]) || EMPTY_BARCODES;
  }, [barcodesResponse]);

  const genomeTests = useMemo(() => {
    if (!genomeTestsResponse?.success) return EMPTY_GENOME_TESTS;
    return (genomeTestsResponse.data as GenomeTestResponse[]) || EMPTY_GENOME_TESTS;
  }, [genomeTestsResponse]);

  const services = useMemo(() => {
    if (!(servicesResponse as any)?.success) return EMPTY_SERVICES;
    return ((servicesResponse as any).data as ServiceResponse[]) || EMPTY_SERVICES;
  }, [servicesResponse]);

  const watchedStep2SpecifyId = methods.watch('step2.specifyId');
  const watchedStep2PatientPhone = methods.watch('step2.patientPhone');

  /** Mã phiếu đã gắn đơn khác — không hiện trong danh sách đổi phiếu (trừ phiếu đang gắn đơn này, xử lý ở dưới). */
  const usedSpecifyVoteIds = useMemo(() => {
    const used = new Set<string>();
    const currentOrderId = String(orderId || '').trim();
    if ((ordersResponse as any)?.success && (ordersResponse as any).data) {
      ((ordersResponse as any).data as any[]).forEach((o: any) => {
        if (String(o?.orderId || '').trim() === currentOrderId) return;
        const sid =
          typeof o?.specifyId === 'string'
            ? String(o.specifyId).trim()
            : String(o?.specifyId?.specifyVoteID ?? '').trim();
        if (sid) used.add(sid);
      });
    }
    return used;
  }, [ordersResponse, orderId]);

  const specifyPickOptions = useMemo((): SelectionOption[] => {
    const rows = getApiResponseData<SpecifyVoteTestResponse>(specifyListForPickResponse);
    const map = new Map<string, string>();
    for (const s of rows) {
      const id = String(s.specifyVoteID || '').trim();
      if (!id) continue;
      if (usedSpecifyVoteIds.has(id)) continue;
      const label = [id, s.patient?.patientName, s.genomeTest?.testName].filter(Boolean).join(' — ');
      map.set(id, label);
    }
    const cur = String(watchedStep2SpecifyId || '').trim();
    if (cur && !map.has(cur)) {
      map.set(
        cur,
        usedSpecifyVoteIds.has(cur)
          ? `${cur} — đã gắn đơn khác, chọn phiếu khác`
          : `${cur} (phiếu hiện tại)`
      );
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [specifyListForPickResponse, watchedStep2SpecifyId, usedSpecifyVoteIds]);

  const loadedOrder = useMemo((): OrderResponse | null => {
    if (!(orderResponse as any)?.success || !(orderResponse as any).data) return null;
    return (orderResponse as any).data as OrderResponse;
  }, [orderResponse]);

  const orderStatusBadge = useMemo(
    () => getOrderStatusBadge(String(loadedOrder?.orderStatus || ORDER_STATUS_DEFAULT)),
    [loadedOrder?.orderStatus]
  );

  const paymentStatusBadge = useMemo(
    () => getPaymentStatusBadge(String(loadedOrder?.paymentStatus || 'PENDING')),
    [loadedOrder?.paymentStatus]
  );

  /** Đơn đã COMPLETED trên server — không cho đổi trạng thái thanh toán */
  const orderPaidLocked = useMemo(() => {
    const s = String(loadedOrder?.paymentStatus || '').trim().toUpperCase();
    return s === 'COMPLETED';
  }, [loadedOrder?.paymentStatus]);

  /** Đơn đã gắn phiếu chỉ định — chỉ sửa đúng phiếu đó, không đổi sang phiếu khác */
  const orderSpecifyLocked = useMemo(
    () => Boolean(String(loadedOrder?.specifyId?.specifyVoteID || '').trim()),
    [loadedOrder?.specifyId?.specifyVoteID]
  );

  const orderLockedPaymentTypeLabel = useMemo(() => {
    const v = String(loadedOrder?.paymentType || '').trim().toUpperCase();
    const key = v === 'ONLINE_PAYMENT' || v === 'CASH' ? v : 'CASH';
    return PAYMENT_TYPE_OPTIONS.find(o => o.value === key)?.label ?? 'Tiền mặt';
  }, [loadedOrder?.paymentType]);

  const watchedPaymentStatus = methods.watch('step6.paymentStatus');
  const watchedPaymentType = methods.watch('step6.paymentType');
  const invoiceLinkWatched = String(methods.watch('step6.invoiceLink') || '').trim();
  const watchedSpecifyVoteImagePath = String(methods.watch('step6.specifyVoteImagePath') || '').trim();

  const watchedSampleCollectorId = methods.watch('step1.sampleCollectorId');
  const watchedStaffAnalystId = methods.watch('step1.staffAnalystId');
  const watchedStaffId = methods.watch('step1.staffId');
  const watchedBarcodeId = methods.watch('step1.barcodeId');
  const watchedOrderName = methods.watch('step1.orderName');
  const selectedHospitalId = methods.watch('step1.hospitalId');
  const selectedDoctorId = methods.watch('step1.doctorId');

  useEffect(() => {
    const v = String(watchedStaffAnalystId || '').trim();
    if (v) lastStaffAnalystIdRef.current = v;
  }, [watchedStaffAnalystId]);

  useEffect(() => {
    const v = String(watchedSampleCollectorId || '').trim();
    if (v) lastSampleCollectorIdRef.current = v;
  }, [watchedSampleCollectorId]);

  // Guard chống mất dữ liệu khi đổi bước: nếu bị ghi rỗng ngoài ý muốn thì phục hồi giá trị cuối hợp lệ.
  useEffect(() => {
    const opts = { shouldDirty: false, shouldTouch: false, shouldValidate: false } as const;
    if (currentStep !== 1) {
      const analyst = String(methods.getValues('step1.staffAnalystId') || '').trim();
      if (!analyst && lastStaffAnalystIdRef.current) {
        methods.setValue('step1.staffAnalystId', lastStaffAnalystIdRef.current, opts);
      }
      const collector = String(methods.getValues('step1.sampleCollectorId') || '').trim();
      if (!collector && lastSampleCollectorIdRef.current) {
        methods.setValue('step1.sampleCollectorId', lastSampleCollectorIdRef.current, opts);
      }
    }
  }, [currentStep, methods]);

  const barcodeReadOnlyLabel = useMemo(() => {
    const id = String(watchedBarcodeId || '').trim();
    if (!id) return '';
    const b = allBarcodes.find(x => String(x.barcode).trim() === id);
    return b?.barcode || id;
  }, [watchedBarcodeId, allBarcodes]);

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
    const hid = String(selectedHospitalId || '').trim();
    let list: DoctorResponse[] = !hid
      ? doctors
      : doctors.filter((doctor: any) => String(doctor.hospitalId || '').trim() === hid);
    const did = String(selectedDoctorId || '').trim();
    if (did && !list.some((d: any) => String(d.doctorId || '').trim() === did)) {
      const fromList = doctors.find((d: any) => String(d.doctorId || '').trim() === did);
      if (fromList) {
        list = [...list, fromList];
      } else {
        const spec: any = loadedOrder?.specifyId;
        const nested = spec?.doctor as DoctorResponse | undefined;
        if (nested && String(nested.doctorId || '').trim() === did) {
          list = [...list, nested];
        }
      }
    }
    return list;
  }, [doctors, selectedHospitalId, selectedDoctorId, loadedOrder?.specifyId]);

  const analystStaffs = useMemo(() => {
    const filtered = staffs.filter(s => isStaffAnalystWebRule(s as HospitalStaffResponse));
    const id = String(watchedStaffAnalystId || '').trim();
    if (!id) return filtered;
    if (filtered.some(s => String(s.staffId).trim() === id)) return filtered;
    const current = staffs.find(s => String(s.staffId).trim() === id);
    if (current) return [...filtered, current];
    const oid = String(loadedOrder?.staffAnalystId || '').trim();
    if (oid === id) {
      return [
        ...filtered,
        {
          staffId: id,
          staffName: String(loadedOrder?.staffAnalystName || id).trim() || id,
          staffPosition: 'doctor',
        } as HospitalStaffResponse,
      ];
    }
    return filtered;
  }, [staffs, watchedStaffAnalystId, loadedOrder?.staffAnalystId, loadedOrder?.staffAnalystName]);

  const paymentStaffs = useMemo(
    () => staffs.filter(s => isStaffPosition((s as HospitalStaffResponse).staffPosition)),
    [staffs]
  );

  /** Giống create-order / collector: giữ option hiển thị khi id đơn có sẵn nhưng lọc vai trò lệch API */
  const paymentStaffSelectOptions = useMemo(() => {
    const filtered = staffs.filter(s =>
      isStaffPosition((s as HospitalStaffResponse).staffPosition)
    );
    const id = String(watchedStaffId || '').trim();
    if (!id) return filtered;
    if (filtered.some(s => String(s.staffId).trim() === id)) return filtered;
    const current = staffs.find(s => String(s.staffId).trim() === id);
    if (current) return [...filtered, current];
    const oid = String(loadedOrder?.staffId || '').trim();
    const name = String(loadedOrder?.staffName || '').trim();
    if (oid === id) {
      return [
        ...filtered,
        {
          staffId: id,
          staffName: name || id,
          staffPosition: 'staff',
        } as HospitalStaffResponse,
      ];
    }
    return filtered;
  }, [staffs, watchedStaffId, loadedOrder?.staffId, loadedOrder?.staffName]);

  const collectorStaffs = useMemo(() => {
    const filtered = staffs.filter(s =>
      isLabPosition((s as HospitalStaffResponse).staffPosition)
    );
    const picked = pickOrderSampleCollector(loadedOrder);
    const idWatch = String(watchedSampleCollectorId || '').trim();
    /** Form có thể chưa hydrate — luôn gộp id từ GET đơn (phẳng hoặc lồng) */
    const id = idWatch || picked.id;
    if (!id) return filtered;
    if (filtered.some(s => String(s.staffId).trim() === id)) return filtered;
    const current = staffs.find(s => String(s.staffId).trim() === id);
    if (current) return [...filtered, current];
    const staffName = id === picked.id && picked.name ? picked.name : id;
    return [
      ...filtered,
      {
        staffId: id,
        staffName,
        staffPosition: 'sample_collector',
      } as HospitalStaffResponse,
    ];
  }, [staffs, watchedSampleCollectorId, loadedOrder]);

  const usedBarcodeIds = useMemo(() => {
    const used = new Set<string>();
    const raw = (ordersResponse as { success?: boolean; data?: unknown })?.data;
    if (!Array.isArray(raw)) return used;
    const oid = String(orderId || '').trim();
    raw.forEach((o: unknown) => {
      const otherId = String((o as { orderId?: string })?.orderId ?? '').trim();
      if (otherId && oid && otherId === oid) return;
      const code = getBarcodeStringFromOrder(o);
      if (code) used.add(code);
    });
    return used;
  }, [ordersResponse, orderId]);

  const availableBarcodes = useMemo(() => {
    const ord = (orderResponse as { success?: boolean; data?: unknown })?.data;
    const currentOrderBarcode = getBarcodeStringFromOrder(ord) ?? '';
    return allBarcodes.filter(b => {
      const barcode = String(b.barcode).trim();
      return !usedBarcodeIds.has(barcode) || (currentOrderBarcode && barcode === currentOrderBarcode);
    });
  }, [allBarcodes, usedBarcodeIds, orderResponse]);

  const serviceTypeStep3 = methods.watch('step3.serviceType');
  const serviceTypeStep5 = methods.watch('step5.serviceType');
  const serviceType = String(serviceTypeStep3 || serviceTypeStep5 || '')
    .trim()
    .toLowerCase();

  const filteredGenomeTests = useMemo(() => {
    if (!serviceType) return genomeTests;
    return genomeTests.filter(test => {
      const serviceName = test.service?.name?.toLowerCase();
      return serviceName === serviceType;
    });
  }, [genomeTests, serviceType]);

  useEffect(() => {
    skipOrderPatientRehydrateRef.current = false;
  }, [orderId]);

  /**
   * Giống create-order: khi xóa SĐT (đủ 10 số → không còn hợp lệ), xóa các trường autofill BN
   * và chặt hydrate lại từ API đơn hàng cho tới khi đổi phiếu / đổi đơn.
   */
  useEffect(() => {
    const digits = String(watchedStep2PatientPhone ?? '').replace(/[^\d]/g, '');
    const hasValid = /^0\d{9}$/.test(digits);

    if (prevHadValidStep2PhoneRef.current && !hasValid) {
      const o = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;
      methods.setValue('step2.patientName', '', o);
      methods.setValue('step2.patientDob', '', o);
      methods.setValue('step2.patientGender', '' as any, o);
      methods.setValue('step2.patientEmail', '', o);
      methods.setValue('step2.patientJob', '', o);
      methods.setValue('step2.patientContactName', '', o);
      methods.setValue('step2.patientContactPhone', '', o);
      methods.setValue('step2.patientAddress', '', o);
      methods.setValue('step2.patientId', '', o);
      skipOrderPatientRehydrateRef.current = true;
    }
    prevHadValidStep2PhoneRef.current = hasValid;
  }, [watchedStep2PatientPhone, methods]);

  useEffect(() => {
    const normalizedPhone = String(watchedStep2PatientPhone ?? '').replace(/[^\d]/g, '').slice(0, 10);
    const hasValid = /^0\d{9}$/.test(normalizedPhone);
    if (!hasValid) {
      lastPatientLookupPhoneRef.current = '';
      return;
    }

    const scopeHospitalId = String(
      (doctors.find((d: any) => String(d.doctorId || '').trim() === String(selectedDoctorId || '').trim()) as any)
        ?.hospitalId ?? ''
    ).trim();
    if (!scopeHospitalId) return;
    if (normalizedPhone === lastPatientLookupPhoneRef.current) return;

    let cancelled = false;
    const setOpts = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

    void (async () => {
      try {
        const res = await patientService.getByPhone(normalizedPhone);
        if (cancelled) return;
        if (!res.success || !res.data) {
          return;
        }

        const p: any = res.data;
        const pHospitalId = String(p.hospitalId || '').trim();
        if (!pHospitalId || pHospitalId !== scopeHospitalId) {
          return;
        }

        lastPatientLookupPhoneRef.current = normalizedPhone;
        skipOrderPatientRehydrateRef.current = false;

        methods.setValue('step2.patientId', String(p.patientId || '').trim(), setOpts);
        methods.setValue('step2.patientName', String(p.patientName || '').trim(), setOpts);
        methods.setValue('step2.patientDob', formatDateInput(p.patientDob), setOpts);
        methods.setValue('step2.patientGender', String(p.gender || '').trim() as any, setOpts);
        methods.setValue('step2.patientEmail', String(p.patientEmail || '').trim(), setOpts);
        methods.setValue('step2.patientJob', String(p.patientJob || '').trim(), setOpts);
        methods.setValue(
          'step2.patientContactName',
          String(p.patientContactName || p.patientName || '').trim(),
          setOpts
        );
        methods.setValue(
          'step2.patientContactPhone',
          String(p.patientContactPhone || p.patientPhone || '').trim(),
          setOpts
        );
        methods.setValue('step2.patientAddress', String(p.patientAddress || '').trim(), setOpts);

        const pid = String(p.patientId || '').trim();
        if (pid) {
          try {
            const clinicalRes = await patientClinicalService.getByPatientId(pid);
            if (cancelled) return;
            const clinicalData = clinicalRes.success && clinicalRes.data ? clinicalRes.data : undefined;
            applyClinicalDataToStep4(methods, clinicalData, setOpts);
          } catch {
            /* không chặn flow */
          }
        }
      } catch {
        /* không chặn flow */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [watchedStep2PatientPhone, selectedDoctorId, doctors, methods]);

  /** `step5.serviceType` đồng bộ từ `step3.serviceType` (chọn nhóm ở bước 3, giống create-order) */
  useEffect(() => {
    const v = String(serviceTypeStep3 || '').trim();
    if (!v) return;
    const cur = String(methods.getValues('step5.serviceType') || '').trim();
    if (cur === v) return;
    methods.setValue('step5.serviceType', v as 'embryo' | 'disease' | 'reproduction', {
      shouldValidate: false,
    });
  }, [serviceTypeStep3]);

  /** Tải chi tiết nhóm sản/phôi/bệnh lý theo BN + serviceId (giống create-order / web) */
  useEffect(() => {
    if (!(orderResponse as any)?.success || !(orderResponse as any).data) return;
    const order = (orderResponse as any).data as OrderResponse;
    const specify = order.specifyId as any;
    if (!specify?.patientId || !specify.genomeTestId) return;
    const nestedTest = specify.genomeTest as any;
    const test =
      genomeTests.find((t: any) => String(t.testId || '').trim() === String(specify.genomeTestId).trim()) ||
      (nestedTest && String(nestedTest.testId || '').trim() === String(specify.genomeTestId).trim()
        ? nestedTest
        : null);
    const serviceId = String(test?.service?.serviceId || specify.serviceID || '').trim();
    if (!serviceId) return;
    const stFromForm =
      normalizeServiceType(methods.getValues('step3.serviceType')) ||
      normalizeServiceType(methods.getValues('step5.serviceType'));
    const st =
      stFromForm ||
      serviceTypeFromGenomeTestObj(test) ||
      normalizeServiceType(String(specify.serviceType || ''));
    if (!st) return;

    let cancelled = false;
    const setOpts = { shouldDirty: false, shouldValidate: false } as const;

    (async () => {
      try {
        serviceGroupRowIdsRef.current = {};
        if (st === 'reproduction') {
          const res = await reproductionService.getAll();
          const list = res.success && Array.isArray(res.data) ? res.data : [];
          const row = pickLatestPatientService(list, specify.patientId!, serviceId);
          if (cancelled || !row) return;
          serviceGroupRowIdsRef.current.reproduction = row.id;
          methods.setValue(
            'step3.fetusesNumber',
            row.fetusesNumber != null ? String(row.fetusesNumber) : '',
            setOpts
          );
          methods.setValue(
            'step3.fetusesWeek',
            row.fetusesWeek != null ? String(row.fetusesWeek) : '',
            setOpts
          );
          methods.setValue(
            'step3.fetusesDay',
            row.fetusesDay != null ? String(row.fetusesDay) : '',
            setOpts
          );
          methods.setValue(
            'step3.ultrasoundDay',
            row.ultrasoundDay ? formatDateInput(String(row.ultrasoundDay)) : '',
            setOpts
          );
          methods.setValue(
            'step3.headRumpLength',
            row.headRumpLength != null ? String(row.headRumpLength) : '',
            setOpts
          );
          methods.setValue(
            'step3.neckLength',
            row.neckLength != null ? String(row.neckLength) : '',
            setOpts
          );
          methods.setValue('step3.combinedTestResult', row.combinedTestResult || '', setOpts);
          methods.setValue('step3.ultrasoundResult', row.ultrasoundResult || '', setOpts);
        } else if (st === 'embryo') {
          const res = await embryoService.getAll();
          const list = res.success && Array.isArray(res.data) ? res.data : [];
          const row = pickLatestPatientService(list, specify.patientId!, serviceId);
          if (cancelled || !row) return;
          serviceGroupRowIdsRef.current.embryo = row.id;
          methods.setValue('step3.biospy', safeTrim(row.biospy), setOpts);
          methods.setValue(
            'step3.biospyDate',
            row.biospyDate ? formatDateInput(String(row.biospyDate)) : '',
            setOpts
          );
          methods.setValue('step3.cellContainingSolution', safeTrim(row.cellContainingSolution), setOpts);
          methods.setValue(
            'step3.embryoCreate',
            row.embryoCreate != null ? String(row.embryoCreate) : '',
            setOpts
          );
          methods.setValue('step3.embryoStatus', safeTrim(row.embryoStatus), setOpts);
          methods.setValue('step3.morphologicalAssessment', safeTrim(row.morphologicalAssessment), setOpts);
          if (row.cellNucleus !== undefined && row.cellNucleus !== null) {
            methods.setValue('step3.cellNucleus', Boolean(row.cellNucleus), setOpts);
          }
          methods.setValue('step3.negativeControl', safeTrim(row.negativeControl), setOpts);
        } else if (st === 'disease') {
          const res = await diseaseService.getAll();
          const list = res.success && Array.isArray(res.data) ? res.data : [];
          const row = pickLatestPatientService(list, specify.patientId!, serviceId);
          if (cancelled || !row) return;
          serviceGroupRowIdsRef.current.disease = row.id;
          methods.setValue('step3.symptom', safeTrim(row.symptom), setOpts);
          methods.setValue('step3.diagnose', safeTrim(row.diagnose), setOpts);
          methods.setValue('step3.diagnoseImage', safeTrim(row.diagnoseImage), setOpts);
          methods.setValue('step3.testRelated', safeTrim(row.testRelated), setOpts);
          methods.setValue('step3.treatmentMethods', safeTrim(row.treatmentMethods), setOpts);
          methods.setValue(
            'step3.treatmentTimeDay',
            row.treatmentTimeDay != null ? String(row.treatmentTimeDay) : '',
            setOpts
          );
          methods.setValue('step3.drugResistance', safeTrim(row.drugResistance), setOpts);
          methods.setValue('step3.relapse', safeTrim(row.relapse), setOpts);
        }
      } catch {
        /* bỏ qua — không chặn mở wizard */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderResponse, genomeTests, serviceTypeStep3, serviceTypeStep5]);

  useEffect(() => {
    if (!(orderResponse as any)?.success || !(orderResponse as any).data) return;

    const order: OrderResponse = (orderResponse as any).data;

    methods.setValue('step1.orderName', order.orderName || '');
    methods.setValue('step1.staffId', String(order.staffId || '').trim());
    const specify = order.specifyId;
    const rawDoctorId = String(specify?.doctorId || '').trim();
    methods.setValue('step1.doctorId', rawDoctorId);
    if (rawDoctorId) {
      const doctor = doctors.find((d: any) => String(d.doctorId || '').trim() === rawDoctorId);
      const hid = String(
        (doctor as any)?.hospitalId ?? specify?.hospitalId ?? ''
      ).trim();
      if (hid) methods.setValue('step1.hospitalId', hid);
    } else if (specify?.hospitalId) {
      methods.setValue('step1.hospitalId', String(specify.hospitalId).trim());
    }
    const incomingStaffAnalystId = String(order.staffAnalystId || '').trim();
    const currentStaffAnalystId = String(methods.getValues('step1.staffAnalystId') || '').trim();
    if (incomingStaffAnalystId || !currentStaffAnalystId) {
      methods.setValue('step1.staffAnalystId', incomingStaffAnalystId);
      if (incomingStaffAnalystId) lastStaffAnalystIdRef.current = incomingStaffAnalystId;
    }

    const incomingSampleCollectorId = String(pickOrderSampleCollector(order).id || '').trim();
    const currentSampleCollectorId = String(methods.getValues('step1.sampleCollectorId') || '').trim();
    if (incomingSampleCollectorId || !currentSampleCollectorId) {
      methods.setValue('step1.sampleCollectorId', incomingSampleCollectorId);
      if (incomingSampleCollectorId) lastSampleCollectorIdRef.current = incomingSampleCollectorId;
    }
    methods.setValue('step1.barcodeId', String(order.barcodeId || '').trim());
    methods.setValue('step6.fastq', 'NO');
    const ps = String(order.paymentStatus || 'UNPAID').trim().toUpperCase();
    methods.setValue('step6.paymentStatus', ps === 'COMPLETED' ? 'COMPLETED' : 'UNPAID');

    if (order.specifyId?.specifyVoteID) {
      methods.setValue('step2.specifyId', order.specifyId.specifyVoteID);
    }

    methods.setValue(
      'step6.paymentAmount',
      formatVndAmountFromNumber(order.paymentAmount ?? 0) || ''
    );
    methods.setValue('step6.paymentType', (order.paymentType as any) || 'CASH');
    methods.setValue('step6.samplingSite', order.specifyId?.samplingSite || '');
    methods.setValue(
      'step6.sampleCollectDate',
      formatDateInput(order.specifyId?.sampleCollectDate)
    );
    methods.setValue('step6.embryoNumber', order.specifyId?.embryoNumber?.toString() || '');
    methods.setValue('step6.specifyVoteImagePath', order.specifyVoteImagePath || '');
    methods.setValue('step6.invoiceLink', order.invoiceLink || '');

    methods.setValue('step7.geneticTestResults', order.specifyId?.geneticTestResults || '');
    methods.setValue(
      'step7.geneticTestResultsRelationship',
      order.specifyId?.geneticTestResultsRelationship || ''
    );

    if (order.specifyId) {
      const specify = order.specifyId;
      const sx = specify as unknown as Record<string, unknown>;
      const syncOpts = { shouldDirty: false, shouldValidate: false } as const;

      methods.setValue('step2.specifyImagePath', String(specify.specifyNote || ''), syncOpts);

      const allowPatientHydrateFromOrder = !skipOrderPatientRehydrateRef.current;

      const nestedPatient = sx.patient as Record<string, unknown> | undefined;
      if (allowPatientHydrateFromOrder && nestedPatient && typeof nestedPatient === 'object') {
        if (nestedPatient.patientName != null)
          methods.setValue('step2.patientName', String(nestedPatient.patientName), syncOpts);
        if (nestedPatient.patientPhone != null)
          methods.setValue('step2.patientPhone', String(nestedPatient.patientPhone), syncOpts);
        if (nestedPatient.patientDob != null)
          methods.setValue('step2.patientDob', formatDateInput(String(nestedPatient.patientDob)), syncOpts);
        if (nestedPatient.gender != null)
          methods.setValue('step2.patientGender', String(nestedPatient.gender) as any, syncOpts);
        if (nestedPatient.patientEmail != null)
          methods.setValue('step2.patientEmail', String(nestedPatient.patientEmail), syncOpts);
        if (nestedPatient.patientJob != null)
          methods.setValue('step2.patientJob', String(nestedPatient.patientJob), syncOpts);
        if (nestedPatient.patientContactName != null)
          methods.setValue('step2.patientContactName', String(nestedPatient.patientContactName), syncOpts);
        if (nestedPatient.patientContactPhone != null)
          methods.setValue('step2.patientContactPhone', String(nestedPatient.patientContactPhone), syncOpts);
        if (nestedPatient.patientAddress != null)
          methods.setValue('step2.patientAddress', String(nestedPatient.patientAddress), syncOpts);
        if (nestedPatient.patientId != null)
          methods.setValue('step2.patientId', String(nestedPatient.patientId), syncOpts);
      }

      const nestedClinical = sx.patientClinical as Record<string, unknown> | undefined;
      if (allowPatientHydrateFromOrder && nestedClinical && typeof nestedClinical === 'object') {
        applyClinicalDataToStep4(methods, nestedClinical, syncOpts);
      }

      const gid = safeTrim(specify.genomeTestId);
      if (gid) {
        const nestedGt = sx.genomeTest as any;
        const test =
          genomeTests.find((t: any) => safeTrim(t.testId) === gid) ||
          (nestedGt && safeTrim(nestedGt.testId) === gid ? nestedGt : null);
        methods.setValue('step3.genomeTestId', gid, syncOpts);
        methods.setValue('step5.genomeTestId', gid, syncOpts);
        const tn = String(test?.testName || nestedGt?.testName || '').trim();
        const rawSample = test?.testSample ?? nestedGt?.testSample;
        const ts = Array.isArray(rawSample)
          ? rawSample.map((x: unknown) => safeTrim(x)).filter(Boolean).join(', ')
          : safeTrim(rawSample);
        const tc = String(test?.testDescription || nestedGt?.testDescription || '').trim();
        if (tn) methods.setValue('step3.testName', tn, syncOpts);
        if (ts) methods.setValue('step3.testSample', ts, syncOpts);
        if (tc) methods.setValue('step3.testContent', tc, syncOpts);
        if (tn) methods.setValue('step5.testName', tn, syncOpts);
        if (ts) methods.setValue('step5.testSample', ts, syncOpts);
        if (tc) methods.setValue('step5.testContent', tc, syncOpts);

        const stResolved =
          serviceTypeFromGenomeTestObj(test) || normalizeServiceType(String(specify.serviceType || ''));
        if (stResolved) {
          methods.setValue('step3.serviceType', stResolved, syncOpts);
          methods.setValue('step5.serviceType', stResolved, syncOpts);
        } else if (test?.service?.name) {
          const serviceName = String(test.service.name).toLowerCase();
          const st =
            serviceName.includes('embryo') || serviceName === 'embryo'
              ? 'embryo'
              : serviceName.includes('disease') || serviceName === 'disease'
                ? 'disease'
                : 'reproduction';
          methods.setValue('step5.serviceType', st, syncOpts);
          methods.setValue('step3.serviceType', st, syncOpts);
        }
      } else {
        const stOnly = normalizeServiceType(String(specify.serviceType || ''));
        if (stOnly) {
          methods.setValue('step3.serviceType', stOnly, syncOpts);
          methods.setValue('step5.serviceType', stOnly, syncOpts);
        }
      }

      if (specify.patientId && allowPatientHydrateFromOrder) {
        const patientId = specify.patientId;
        const setOpts = { shouldDirty: false, shouldValidate: false } as const;

        void (async () => {
          try {
            if (skipOrderPatientRehydrateRef.current) return;
            const patientResponse = await patientService.getById(patientId);
            if (skipOrderPatientRehydrateRef.current) return;
            if (patientResponse.success && patientResponse.data) {
              const patient = patientResponse.data as any;
              methods.setValue('step2.patientName', patient.patientName || '', setOpts);
              methods.setValue('step2.patientPhone', patient.patientPhone || '', setOpts);
              methods.setValue('step2.patientDob', formatDateInput(patient.patientDob), setOpts);
              methods.setValue('step2.patientGender', patient.gender || '', setOpts);
              methods.setValue('step2.patientEmail', patient.patientEmail || '', setOpts);
              methods.setValue('step2.patientJob', patient.patientJob || '', setOpts);
              methods.setValue(
                'step2.patientContactName',
                patient.patientContactName || patient.patientName || '',
                setOpts
              );
              methods.setValue(
                'step2.patientContactPhone',
                patient.patientContactPhone || patient.patientPhone || '',
                setOpts
              );
              methods.setValue('step2.patientAddress', patient.patientAddress || '', setOpts);
              methods.setValue('step2.specifyId', specify.specifyVoteID, setOpts);
              methods.setValue('step2.specifyImagePath', specify.specifyNote || '', setOpts);
              methods.setValue('step2.patientId', patient.patientId, setOpts);
            }

            if (skipOrderPatientRehydrateRef.current) return;
            const clinicalResponse = await patientClinicalService.getByPatientId(patientId);
            const clinicalData =
              clinicalResponse.success && clinicalResponse.data ? clinicalResponse.data : undefined;
            if (!skipOrderPatientRehydrateRef.current) {
              applyClinicalDataToStep4(methods, clinicalData, setOpts);
            }
          } catch {
            /* bỏ qua — không chặn mở wizard */
          }
        })();
      }

      if (specify.embryoNumber) {
        methods.setValue('step6.embryoNumber', specify.embryoNumber?.toString() || '');
      }
    }
  }, [orderResponse, genomeTests, doctors]);

  useEffect(() => {
    const did = String(selectedDoctorId || '').trim();
    if (!did) return;
    const doctor = doctors.find((d: any) => String(d.doctorId || '').trim() === did);
    const doctorHospitalId = String((doctor as any)?.hospitalId || '').trim();
    const hid = String(selectedHospitalId || '').trim();
    if (doctorHospitalId && doctorHospitalId !== hid) {
      methods.setValue('step1.hospitalId', doctorHospitalId, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }, [selectedDoctorId, selectedHospitalId, doctors]);

  const genomeTestId = methods.watch('step3.genomeTestId');
  useEffect(() => {
    if (!genomeTestId) return;
    const test = genomeTests.find((t: any) => t.testId === genomeTestId);
    if (!test) return;
    const setOpts = { shouldValidate: false, shouldDirty: false } as const;
    methods.setValue('step3.testName', test.testName || '', setOpts);
    methods.setValue(
      'step3.testSample',
      Array.isArray(test.testSample) ? test.testSample.join(', ') : test.testSample || '',
      setOpts
    );
    methods.setValue('step3.testContent', test.testDescription || '', setOpts);
    methods.setValue('step5.genomeTestId', test.testId || '', setOpts);
    methods.setValue('step5.testName', test.testName || '', setOpts);
    methods.setValue(
      'step5.testSample',
      Array.isArray(test.testSample) ? test.testSample.join(', ') : test.testSample || '',
      setOpts
    );
    methods.setValue('step5.testContent', test.testDescription || '', setOpts);
  }, [genomeTestId, genomeTests]);

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

  const handlePickInvoiceFile = useCallback(async () => {
    if (orderPaidLocked) return;
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

      if (typeof selectedFile.size === 'number' && selectedFile.size > MAX_INVOICE_UPLOAD_BYTES) {
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
  }, [methods, orderPaidLocked]);

  const handleClearInvoiceFile = useCallback(() => {
    if (orderPaidLocked) return;
    methods.setValue('step6.invoiceLink', '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [methods, orderPaidLocked]);

  /** Khớp validate bước nhóm xét nghiệm trên `create-order` (step3) */
  const validateStep5 = async () => {
    methods.clearErrors('step3');
    const step3 = methods.getValues('step3');
    let hasError = false;

    const isBlank = (value?: string) => !String(value ?? '').trim();
    const toNumber = (value?: string) => {
      const n = Number(String(value ?? '').trim());
      return Number.isFinite(n) ? n : NaN;
    };

    const normalizedServiceType = normalizeServiceType(
      step3.serviceType || methods.getValues('step5.serviceType')
    );

    if (!normalizedServiceType) {
      methods.setError('step3.serviceType', { type: 'manual', message: 'Vui lòng chọn nhóm xét nghiệm' });
      Alert.alert('Lỗi', 'Vui lòng chọn nhóm xét nghiệm');
      return false;
    }

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
          methods.setError('step3.fetusesWeek', {
            type: 'manual',
            message: 'Tuần thai phải là số nguyên từ 0 đến 40',
          });
          hasError = true;
        }
      }
      if (isBlank(step3.fetusesDay)) {
        methods.setError('step3.fetusesDay', { type: 'manual', message: 'Vui lòng nhập ngày thai' });
        hasError = true;
      } else {
        const v = toNumber(step3.fetusesDay);
        if (!Number.isInteger(v) || v < 0 || v > 30) {
          methods.setError('step3.fetusesDay', {
            type: 'manual',
            message: 'Ngày thai phải là số nguyên từ 0 đến 30',
          });
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
      Alert.alert('Lỗi', 'Vui lòng kiểm tra lại thông tin nhóm xét nghiệm (bước 3).');
    }
    return !hasError;
  };

  /** Phiếu chỉ định chỉ gắn 1 đơn — gọi API để chắc chắn (getAll có thể phân trang / thiếu bản ghi). */
  const verifySpecifyIdAvailableForThisOrder = useCallback(
    async (specifyId: string): Promise<boolean> => {
      const sid = String(specifyId || '').trim();
      if (!sid) return true;
      try {
        const res = await orderService.getBySpecifyId(sid);
        if (!res.success || res.data == null) return true;
        const rows = Array.isArray(res.data) ? res.data : [res.data as OrderResponse];
        const curOid = String(orderId || '').trim();
        const other = rows.find(o => {
          const oid = String(o.orderId || '').trim();
          return oid.length > 0 && oid !== curOid;
        });
        if (other) {
          Alert.alert(
            'Phiếu đã có đơn hàng',
            `Mã phiếu ${sid} đã gắn đơn ${other.orderName || other.orderId}. Chọn phiếu chưa dùng hoặc giữ phiếu của đơn này.`
          );
          return false;
        }
      } catch {
        /* không chặn cứng khi không gọi được API */
      }
      return true;
    },
    [orderId]
  );

  /** Bước 1: đơn + thanh toán (tên đơn & barcode chỉ đọc; nhóm xét nghiệm chọn ở bước 3) */
  const validateStep1 = async () => {
    methods.clearErrors('step1');
    methods.clearErrors('step6.invoiceLink');
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
      { key: 'orderName', message: 'Thiếu tên đơn hàng' },
      { key: 'staffAnalystId', message: 'Vui lòng chọn nhân viên phụ trách' },
      { key: 'sampleCollectorId', message: 'Vui lòng chọn nhân viên thu mẫu' },
      { key: 'barcodeId', message: 'Thiếu mã Barcode PCĐ' },
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
      ...(orderPaidLocked ? [] : (['step6.paymentStatus', 'step6.paymentType'] as const)),
    ];
    const isValid = await methods.trigger(fields as any);
    if (!isValid) {
      const errors = methods.formState.errors;
      if (errors.step1?.orderName) Alert.alert('Lỗi', 'Thiếu tên đơn hàng');
      else if (errors.step1?.staffAnalystId)
        Alert.alert('Lỗi', 'Vui lòng chọn nhân viên phụ trách');
      else if (errors.step1?.sampleCollectorId)
        Alert.alert('Lỗi', 'Vui lòng chọn nhân viên thu mẫu');
      else if (errors.step1?.barcodeId) Alert.alert('Lỗi', 'Thiếu mã Barcode PCĐ');
      else if (errors.step1?.staffId) Alert.alert('Lỗi', String(errors.step1.staffId.message || 'Vui lòng chọn người thu tiền'));
      else if (errors.step6?.paymentStatus) Alert.alert('Lỗi', 'Vui lòng chọn trạng thái thanh toán');
      else if (errors.step6?.paymentType) Alert.alert('Lỗi', 'Vui lòng chọn hình thức thanh toán');
      else if (errors.step6?.invoiceLink) Alert.alert('Lỗi', String(errors.step6.invoiceLink.message || 'Thiếu hóa đơn'));
    }
    if (!isValid) return false;

    if (
      step1Values.staffId?.trim() &&
      !paymentStaffs.some(
        s => String(s.staffId).trim() === String(step1Values.staffId ?? '').trim()
      )
    ) {
      const sid = step1Values.staffId.trim();
      const st = staffs.find(s => String(s.staffId).trim() === sid);
      if (st && !isStaffPosition(st.staffPosition)) {
        Alert.alert('Lỗi', 'Người thu tiền phải có vai trò STAFF');
        methods.setError('step1.staffId', {
          type: 'manual',
          message: 'Người thu tiền phải là STAFF',
        });
        return false;
      }
      if (!st) {
        const oid = String(loadedOrder?.staffId || '').trim();
        if (sid !== oid) {
          Alert.alert('Lỗi', 'Người thu tiền không hợp lệ');
          methods.setError('step1.staffId', {
            type: 'manual',
            message: 'Người thu tiền không hợp lệ',
          });
          return false;
        }
      }
    }

    const analystId = String(step1Values.staffAnalystId ?? '').trim();
    if (!analystStaffs.some(s => String(s.staffId).trim() === analystId)) {
      const st = staffs.find(s => String(s.staffId).trim() === analystId);
      const loadedAnalystId = String(loadedOrder?.staffAnalystId || '').trim();
      const allowLoadedAnalystFallback = !!analystId && analystId === loadedAnalystId;
      if (st && !isStaffAnalystWebRule(st as HospitalStaffResponse) && !allowLoadedAnalystFallback) {
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
      if (!st && !allowLoadedAnalystFallback) {
        Alert.alert('Lỗi', 'Nhân viên phụ trách không hợp lệ.');
        methods.setError('step1.staffAnalystId', {
          type: 'manual',
          message: 'Nhân viên phụ trách không hợp lệ',
        });
        return false;
      }
    }

    const collectorId = String(step1Values.sampleCollectorId ?? '').trim();
    if (!collectorStaffs.some(s => String(s.staffId).trim() === collectorId)) {
      const st = staffs.find(s => String(s.staffId).trim() === collectorId);
      const loadedCollectorId = String(pickOrderSampleCollector(loadedOrder).id || '').trim();
      const allowLoadedCollectorFallback = !!collectorId && collectorId === loadedCollectorId;
      if (st && !isLabPosition(st.staffPosition) && !allowLoadedCollectorFallback) {
        Alert.alert('Lỗi', 'Nhân viên thu mẫu phải có vai trò kỹ thuật viên lab (LAB).');
        methods.setError('step1.sampleCollectorId', {
          type: 'manual',
          message: 'Nhân viên thu mẫu phải là LAB',
        });
        return false;
      }
      if (!st && !allowLoadedCollectorFallback) {
        Alert.alert('Lỗi', 'Nhân viên thu mẫu không hợp lệ.');
        methods.setError('step1.sampleCollectorId', {
          type: 'manual',
          message: 'Nhân viên thu mẫu không hợp lệ',
        });
        return false;
      }
    }

    if (
      !orderPaidLocked &&
      String(methods.getValues('step6.paymentStatus') || '').trim() === 'COMPLETED' &&
      String(methods.getValues('step6.paymentType') || '').trim().toUpperCase() === 'ONLINE_PAYMENT'
    ) {
      const inv = String(methods.getValues('step6.invoiceLink') || '').trim();
      if (!inv) {
        methods.setError('step6.invoiceLink', {
          type: 'manual',
          message: 'Vui lòng upload hoặc dán link hóa đơn thanh toán',
        });
        Alert.alert(
          'Lỗi',
          'Đã thanh toán + thanh toán online: vui lòng upload hóa đơn (ảnh/PDF) hoặc nhập link hóa đơn trước khi sang bước tiếp theo.'
        );
        return false;
      }
    }

    if (!orderPaidLocked && String(methods.getValues('step6.paymentStatus') || '').trim() === 'COMPLETED') {
      const paymentAmountInput = String(methods.getValues('step6.paymentAmount') || '').trim();
      const paymentAmount = parseVndAmountInput(paymentAmountInput);
      if (!paymentAmountInput || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        methods.setError('step6.paymentAmount', {
          type: 'manual',
          message: 'Vui lòng nhập số tiền đã thu hợp lệ',
        });
        Alert.alert(
          'Lỗi',
          'Trạng thái "Đã thanh toán": vui lòng nhập số tiền đã thu hợp lệ trước khi sang bước tiếp theo.'
        );
        return false;
      }
      methods.clearErrors('step6.paymentAmount');
    }

    return true;
  };

  /** Bước 2 giống create-order: bác sĩ, BV, bệnh nhân */
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
      Alert.alert('Lỗi', 'Vui lòng kiểm tra lại thông tin bệnh nhân');
      return false;
    }

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

    const specifySid = String(methods.getValues('step2.specifyId') || '').trim();
    if (specifySid) {
      const ok = await verifySpecifyIdAvailableForThisOrder(specifySid);
      if (!ok) return false;
    }
    return true;
  };

  /** Bước 4 giống create-order: lâm sàng */
  const validateStep4 = async () => {
    const fields = [
      'step4.patientHeight',
      'step4.patientWeight',
      'step4.patientHistory',
      'step4.acuteDisease',
      'step4.medicalUsing',
    ] as const;
    const isValid = await methods.trigger(fields as any, { shouldFocus: true });
    if (!isValid) {
      Alert.alert('Lỗi', 'Vui lòng kiểm tra lại thông tin lâm sàng');
    }
    return isValid;
  };

  /** Bước 5 giống create-order `validateStep5`: XN + nơi/ngày thu mẫu (dùng step3 + step6) */
  const validateTestDetailsStep = async () => {
    methods.clearErrors('step3');
    methods.clearErrors('step6');
    const step3Svc = String(methods.getValues('step3.serviceType') || '').trim().toLowerCase();

    const gid = String(methods.getValues('step3.genomeTestId') || '').trim();
    if (!gid) {
      methods.setError('step3.genomeTestId', { type: 'manual', message: 'Vui lòng chọn xét nghiệm' });
      Alert.alert('Lỗi', 'Vui lòng chọn xét nghiệm');
      return false;
    }
    if (!String(methods.getValues('step3.testName') || '').trim()) {
      methods.setError('step3.testName', { type: 'manual', message: 'Vui lòng nhập tên xét nghiệm' });
      Alert.alert('Lỗi', 'Vui lòng nhập tên xét nghiệm');
      return false;
    }
    if (!String(methods.getValues('step3.testSample') || '').trim()) {
      methods.setError('step3.testSample', { type: 'manual', message: 'Vui lòng nhập mẫu xét nghiệm' });
      Alert.alert('Lỗi', 'Vui lòng nhập mẫu xét nghiệm');
      return false;
    }
    if (!String(methods.getValues('step6.samplingSite') || '').trim()) {
      methods.setError('step6.samplingSite', { type: 'manual', message: 'Vui lòng nhập nơi thu mẫu' });
      Alert.alert('Lỗi', 'Vui lòng nhập nơi thu mẫu');
      return false;
    }

    const fields = [
      'step3.genomeTestId',
      'step3.testName',
      'step3.testSample',
      'step6.samplingSite',
      'step6.embryoNumber',
    ] as const;
    let isValid = await methods.trigger(fields as any, { shouldFocus: true });
    const embryoValue = String(methods.getValues('step6.embryoNumber') ?? '').trim();

    if (step3Svc === 'embryo' && !embryoValue) {
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
      Alert.alert('Lỗi', 'Vui lòng kiểm tra lại thông tin xét nghiệm');
    }
    return isValid;
  };

  const validateStep6Genetic = async () => true;

  const handleNext = async () => {
    console.log('[UpdateOrderWizard] handleNext called, currentStep:', currentStep);
    let isValid = true;
    if (currentStep === 1) {
      console.log('[UpdateOrderWizard] Validating step 1...');
      isValid = await validateStep1();
      console.log('[UpdateOrderWizard] Step 1 validation result:', isValid);
    } else if (currentStep === 2) {
      isValid = await validateStep2();
    } else if (currentStep === 3) {
      isValid = await validateStep5();
    } else if (currentStep === 4) {
      isValid = await validateStep4();
    } else if (currentStep === 5) {
      isValid = await validateTestDetailsStep();
    } else if (currentStep === 6) {
      isValid = await validateStep6Genetic();
    }

    if (!isValid) {
      console.log('[UpdateOrderWizard] Validation failed, returning early');
      return;
    }

    if (currentStep === TOTAL_STEPS) {
      console.log('[UpdateOrderWizard] At final step, preparing to submit...');
      // Validate before submit
      const formData = methods.getValues();
      const currentOrderData = (orderResponse as any)?.data as OrderResponse | undefined;
      const orderName = formData.step1.orderName?.trim() || currentOrderData?.orderName?.trim();
      if (!orderName) {
        console.log('[UpdateOrderWizard] Order name missing!');
        Alert.alert('Lỗi', 'Vui lòng nhập tên đơn hàng');
        return;
      }
      console.log('[UpdateOrderWizard] Calling handleSubmit...');
      await handleSubmit();
      return;
    }
    if (currentStep < TOTAL_STEPS) {
      console.log('[UpdateOrderWizard] Moving to next step...');
      setCurrentStep(p => p + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(p => p - 1);
    else router.back();
  };

  const handleStepChipPress = async (targetStep: number) => {
    if (targetStep === currentStep) return;
    if (targetStep < currentStep) {
      setCurrentStep(targetStep);
      return;
    }

    let isValid = true;
    if (currentStep === 1) isValid = await validateStep1();
    else if (currentStep === 2) isValid = await validateStep2();
    else if (currentStep === 3) isValid = await validateStep5();
    else if (currentStep === 4) isValid = await validateStep4();
    else if (currentStep === 5) isValid = await validateTestDetailsStep();
    else if (currentStep === 6) isValid = await validateStep6Genetic();

    if (!isValid) return;
    setCurrentStep(targetStep);
  };

  const updateOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await orderService.update(orderId!, data);
      if (response.success) return response;

      const errText = `${response.error || ''} ${response.message || ''}`.toLowerCase();
      const isCustomerNotFound =
        errText.includes('customer_001') || errText.includes('không tìm thấy khách hàng');

      if (isCustomerNotFound) {
        // Backend có thể đang giữ customerId cũ đã mất; thử ghi đè customerId rỗng/null để cứu luồng update.
        const basePayload = { ...(data || {}) };
        const retryCandidates = [{ ...basePayload, customerId: null }, { ...basePayload, customerId: '' }];
        for (const retryPayload of retryCandidates) {
          const retryRes = await orderService.update(orderId!, retryPayload);
          if (retryRes.success) return retryRes;
        }
      }

      throw new Error(response.error || 'Không thể cập nhật đơn hàng');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: any) => {
      Alert.alert(
        'Lỗi cập nhật đơn hàng',
        error?.message || 'Không thể cập nhật đơn hàng. Vui lòng thử lại.'
      );
    },
  });

  const handleSubmit = async () => {
    try {
      console.log('[UpdateOrderWizard] Starting submit...');
      const formData = methods.getValues();
      console.log('[UpdateOrderWizard] Form data:', JSON.stringify(formData, null, 2));

      // Get current order data for fallback values
      const currentOrderData = (orderResponse as any)?.data as OrderResponse | undefined;
      const currentSpecifyId = currentOrderData?.specifyId?.specifyVoteID;
      const currentPatientId = currentOrderData?.specifyId?.patientId;

      if (!(await validateStep1())) return;
      if (!(await validateStep2())) return;
      if (!(await validateStep5())) return;
      if (!(await validateStep4())) return;
      if (!(await validateTestDetailsStep())) return;

      const patientHospitalId =
        formData.step1.hospitalId?.trim() ||
        String(currentOrderData?.specifyId?.hospitalId || '').trim() ||
        (user?.hospitalId ? String(user.hospitalId) : undefined);

      let finalSpecifyId = (formData.step2.specifyId || '').trim() || currentSpecifyId || undefined;

      if (finalSpecifyId && !(await verifySpecifyIdAvailableForThisOrder(finalSpecifyId))) {
        return;
      }

      const genomeTestId = formData.step3.genomeTestId?.trim();
      // --- Patient: create/update (optional) ---
      let patientId = (formData.step2.patientId || '').trim() || currentPatientId || '';
      const patientName = (formData.step2.patientName || '').trim();
      const patientPhone = (formData.step2.patientPhone || '').trim();

      const generateUUID = () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

      // Only create patient if user actually entered patient info and we don't have an id yet
      if (!patientId && patientName && genomeTestId) {
        patientId = generateUUID();
        const patientPayload = {
          patientId,
          patientName,
          patientPhone: patientPhone || '0000000000',
          patientDob: toISO(formData.step2.patientDob),
          gender: formData.step2.patientGender || undefined,
          patientEmail: formData.step2.patientEmail?.trim() || undefined,
          patientJob: formData.step2.patientJob?.trim() || undefined,
          patientContactName: formData.step2.patientContactName?.trim() || undefined,
          patientContactPhone: formData.step2.patientContactPhone?.trim() || undefined,
          patientAddress: formData.step2.patientAddress?.trim() || undefined,
          hospitalId: patientHospitalId,
        };

        const patientResponse = await patientService.create(patientPayload);
        if (!patientResponse.success) {
          throw new Error(patientResponse.error || 'Không thể tạo bệnh nhân');
        }
      }

      // Update patient if we have an id and required minimum fields
      if (patientId && patientName && patientPhone) {
        const patientUpdatePayload = {
          patientId,
          patientName,
          patientPhone,
          patientDob: toISO(formData.step2.patientDob),
          gender: formData.step2.patientGender || undefined,
          patientEmail: formData.step2.patientEmail?.trim() || undefined,
          patientJob: formData.step2.patientJob?.trim() || undefined,
          patientContactName: formData.step2.patientContactName?.trim() || undefined,
          patientContactPhone: formData.step2.patientContactPhone?.trim() || undefined,
          patientAddress: formData.step2.patientAddress?.trim() || undefined,
          hospitalId: patientHospitalId,
        };

        const patientUpdateResp = await patientService.update(patientId, patientUpdatePayload);
        if (!patientUpdateResp.success) {
          throw new Error(patientUpdateResp.error || 'Không thể cập nhật thông tin bệnh nhân');
        }
      }

      // --- Patient clinical (Step 4): create/update (optional) ---
      if (patientId) {
        const s4 = formData.step4;
        const hasClinical =
          !!(s4.patientHeight || '').trim() ||
          !!(s4.patientWeight || '').trim() ||
          !!(s4.patientHistory || '').trim() ||
          !!(s4.familyHistory || '').trim() ||
          !!(s4.toxicExposure || '').trim() ||
          !!(s4.medicalHistory || '').trim() ||
          !!(s4.chronicDisease || '').trim() ||
          !!(s4.acuteDisease || '').trim() ||
          !!(s4.medicalUsing || '').trim();

        if (hasClinical) {
          const parseMaybeNumber = (v?: string) => {
            const n = parseFloat(String(v || '').trim());
            return Number.isFinite(n) ? n : undefined;
          };

          const clinicalPayload: any = {
            patientId,
            patientHeight: parseMaybeNumber(s4.patientHeight),
            patientWeight: parseMaybeNumber(s4.patientWeight),
            patientHistory: (s4.patientHistory || '').trim() || undefined,
            familyHistory: (s4.familyHistory || '').trim() || undefined,
            toxicExposure: (s4.toxicExposure || '').trim() || undefined,
            medicalHistory: (s4.medicalHistory || '').trim() || undefined,
            chronicDisease: (s4.chronicDisease || '').trim() || undefined,
            acuteDisease: (s4.acuteDisease || '').trim() || undefined,
          };

          const medUsing = (s4.medicalUsing || '').trim();
          if (medUsing) {
            // Accept comma/newline separated input
            clinicalPayload.medicalUsing = medUsing
              .split(/[,\\n]/g)
              .map(x => x.trim())
              .filter(Boolean);
          }

          // Kiểm tra xem đã có patient clinical chưa
          const clinicalExisting = await patientClinicalService.getByPatientId(patientId);
          let clinicalId: string | undefined = undefined;
          
          if (clinicalExisting.success && clinicalExisting.data) {
            // Thử lấy ID từ nhiều field có thể có
            const data = clinicalExisting.data as any;
            clinicalId = data?.patientClinicalId || data?.id;
          }
          
          // Nếu có ID hợp lệ, update
          if (clinicalId && clinicalId !== 'undefined' && clinicalId.trim()) {
            const upd = await patientClinicalService.update(clinicalId, clinicalPayload);
            if (!upd.success) {
              throw new Error(upd.error || 'Không thể cập nhật thông tin lâm sàng');
            }
          } else {
            // Thử tạo mới, nếu đã tồn tại thì lấy lại và update
            try {
              const created = await patientClinicalService.create(clinicalPayload);
              if (!created.success) {
                // Nếu lỗi là "already exists", thử lại get và update
                const errorMsg = created.error?.toLowerCase() || '';
                if (errorMsg.includes('already exists') || errorMsg.includes('đã tồn tại') || errorMsg.includes('exists')) {
                  const retryGet = await patientClinicalService.getByPatientId(patientId);
                  if (retryGet.success && retryGet.data) {
                    const retryData = retryGet.data as any;
                    const retryId = retryData?.patientClinicalId || retryData?.id;
                    if (retryId && retryId !== 'undefined' && retryId.trim()) {
                      const retryUpdate = await patientClinicalService.update(retryId, clinicalPayload);
                      if (!retryUpdate.success) {
                        throw new Error(retryUpdate.error || 'Không thể cập nhật thông tin lâm sàng');
                      }
                    } else {
                      // Nếu không lấy được ID, bỏ qua việc lưu patient clinical (không bắt buộc)
                      console.warn('[UpdateOrderWizard] Không thể lấy ID của patient clinical, bỏ qua việc lưu thông tin lâm sàng');
                    }
                  } else {
                    // Nếu không get được, bỏ qua (không bắt buộc)
                    console.warn('[UpdateOrderWizard] Không thể lấy patient clinical để cập nhật, bỏ qua');
                  }
                } else {
                  throw new Error(created.error || 'Không thể tạo thông tin lâm sàng');
                }
              }
            } catch (error: any) {
              // Nếu lỗi là "already exists", thử lại get và update
              const errorMsg = error?.message?.toLowerCase() || '';
              if (errorMsg.includes('already exists') || errorMsg.includes('đã tồn tại') || errorMsg.includes('exists')) {
                try {
                  const retryGet = await patientClinicalService.getByPatientId(patientId);
                  if (retryGet.success && retryGet.data) {
                    const retryData = retryGet.data as any;
                    const retryId = retryData?.patientClinicalId || retryData?.id;
                    if (retryId && retryId !== 'undefined' && retryId.trim()) {
                      const retryUpdate = await patientClinicalService.update(retryId, clinicalPayload);
                      if (!retryUpdate.success) {
                        throw new Error(retryUpdate.error || 'Không thể cập nhật thông tin lâm sàng');
                      }
                    } else {
                      // Nếu không lấy được ID, bỏ qua (không bắt buộc)
                      console.warn('[UpdateOrderWizard] Không thể lấy ID của patient clinical, bỏ qua việc lưu thông tin lâm sàng');
                    }
                  } else {
                    // Nếu không get được, bỏ qua (không bắt buộc)
                    console.warn('[UpdateOrderWizard] Không thể lấy patient clinical để cập nhật, bỏ qua');
                  }
                } catch (retryError) {
                  // Nếu retry cũng fail, bỏ qua (không bắt buộc)
                  console.warn('[UpdateOrderWizard] Lỗi khi retry patient clinical:', retryError);
                }
              } else {
                // Nếu không phải lỗi "already exists", bỏ qua (không bắt buộc)
                console.warn('[UpdateOrderWizard] Lỗi khi lưu patient clinical (không bắt buộc):', error?.message);
              }
            }
          }
        }
      }

      // --- Specify vote test: update if exists, otherwise create (Step 3/6/7) ---
      if (genomeTestId && patientId) {
        const selectedGenomeTest: any = genomeTests.find((t: any) => t.testId === genomeTestId);
        if (!selectedGenomeTest) throw new Error('Không tìm thấy xét nghiệm đã chọn');
        if (!selectedGenomeTest.service?.serviceId) throw new Error('Xét nghiệm không có thông tin dịch vụ.');

        const specifyPayload: any = {
          serviceId: selectedGenomeTest.service.serviceId,
          patientId,
          genomeTestId,
          doctorId: formData.step1.doctorId?.trim() || undefined,
          hospitalId: patientHospitalId,
          samplingSite: formData.step6.samplingSite?.trim() || undefined,
          sampleCollectDate: toISO(formData.step6.sampleCollectDate),
          embryoNumber: formData.step6.embryoNumber ? parseInt(formData.step6.embryoNumber) : undefined,
          geneticTestResults: formData.step7.geneticTestResults?.trim() || undefined,
          geneticTestResultsRelationship: formData.step7.geneticTestResultsRelationship?.trim() || undefined,
          specifyNote: (formData.step2.specifyImagePath || '').trim() || undefined,
          sendEmailPatient: false,
        };

        if (finalSpecifyId) {
          const updSpecify = await specifyVoteTestService.update(finalSpecifyId, specifyPayload);
          if (!updSpecify.success) {
            throw new Error(updSpecify.error || 'Không thể cập nhật phiếu chỉ định');
          }
        } else {
          const createdSpecify = await specifyVoteTestService.create(specifyPayload);
          if (!createdSpecify.success) {
            throw new Error(createdSpecify.error || 'Không thể tạo phiếu chỉ định');
          }
          finalSpecifyId = (createdSpecify.data as any)?.specifyVoteID || (createdSpecify.data as any)?.specifyId;
        }
      }

      // --- Nhóm sản / phôi / bệnh lý: create hoặc update (khớp create-order + web quản trị) ---
      if (genomeTestId && patientId) {
        const selectedGenomeTest: any = genomeTests.find((t: any) => t.testId === genomeTestId);
        if (!selectedGenomeTest?.service?.serviceId) {
          throw new Error('Xét nghiệm không có thông tin dịch vụ.');
        }
        const selectedService = services.find((s: any) => {
          const sid = String(s.serviceId || '').trim();
          return sid === String(selectedGenomeTest.service.serviceId).trim();
        });
        if (!selectedService?.serviceId) {
          throw new Error('Không tìm thấy thông tin dịch vụ. Vui lòng chọn lại nhóm / xét nghiệm.');
        }
        const serviceTypeNorm = normalizeServiceType(
          formData.step5.serviceType || formData.step3.serviceType
        );
        const svcId = String(selectedService.serviceId).trim();
        const pid = String(patientId).trim();

        const reproductionPayload: any = {
          serviceId: svcId,
          patientId: pid,
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
        const embryoPayload: any = {
          serviceId: svcId,
          patientId: pid,
          biospy: formData.step3.biospy?.trim() || undefined,
          biospyDate: toISO(formData.step3.biospyDate),
          cellContainingSolution: formData.step3.cellContainingSolution?.trim() || undefined,
          embryoCreate: formData.step3.embryoCreate
            ? parseInt(String(formData.step3.embryoCreate), 10)
            : undefined,
          embryoStatus: formData.step3.embryoStatus?.trim() || undefined,
          morphologicalAssessment: formData.step3.morphologicalAssessment?.trim() || undefined,
          cellNucleus:
            formData.step3.cellNucleus !== undefined ? Boolean(formData.step3.cellNucleus) : undefined,
          negativeControl: formData.step3.negativeControl?.trim() || undefined,
        };
        const diseasePayload: any = {
          serviceId: svcId,
          patientId: pid,
          symptom: formData.step3.symptom?.trim() || undefined,
          diagnose: formData.step3.diagnose?.trim() || undefined,
          diagnoseImage: formData.step3.diagnoseImage?.trim() || undefined,
          testRelated: formData.step3.testRelated?.trim() || undefined,
          treatmentMethods: formData.step3.treatmentMethods?.trim() || undefined,
          treatmentTimeDay:
            String(formData.step3.treatmentTimeDay ?? '').trim() !== ''
              ? parseInt(String(formData.step3.treatmentTimeDay), 10)
              : undefined,
          drugResistance: formData.step3.drugResistance?.trim() || undefined,
          relapse: formData.step3.relapse?.trim() || undefined,
        };

        if (serviceTypeNorm === 'reproduction') {
          const rid = serviceGroupRowIdsRef.current.reproduction;
          if (rid) {
            const u = await reproductionService.update(rid, reproductionPayload);
            if (!u.success) throw new Error(u.error || 'Không thể cập nhật thông tin nhóm Sản');
          } else {
            const c = await reproductionService.create(reproductionPayload);
            if (!c.success) throw new Error(c.error || 'Không thể tạo thông tin nhóm Sản');
            const nid = (c.data as any)?.id;
            if (nid) serviceGroupRowIdsRef.current.reproduction = String(nid);
          }
        } else if (serviceTypeNorm === 'embryo') {
          const eid = serviceGroupRowIdsRef.current.embryo;
          if (eid) {
            const u = await embryoService.update(eid, embryoPayload);
            if (!u.success) throw new Error(u.error || 'Không thể cập nhật thông tin nhóm Phôi');
          } else {
            const c = await embryoService.create(embryoPayload);
            if (!c.success) throw new Error(c.error || 'Không thể tạo thông tin nhóm Phôi');
            const nid = (c.data as any)?.id;
            if (nid) serviceGroupRowIdsRef.current.embryo = String(nid);
          }
        } else if (serviceTypeNorm === 'disease') {
          const did = serviceGroupRowIdsRef.current.disease;
          if (did) {
            const u = await diseaseService.update(did, diseasePayload);
            if (!u.success) throw new Error(u.error || 'Không thể cập nhật thông tin nhóm Bệnh lý');
          } else {
            const c = await diseaseService.create(diseasePayload);
            if (!c.success) throw new Error(c.error || 'Không thể tạo thông tin nhóm Bệnh lý');
            const nid = (c.data as any)?.id;
            if (nid) serviceGroupRowIdsRef.current.disease = String(nid);
          }
        }
      }

      // Validate required fields - use fallback from current order if form is empty
      const orderName = formData.step1.orderName?.trim() || currentOrderData?.orderName?.trim();
      if (!orderName) {
        throw new Error('Vui lòng nhập tên đơn hàng');
      }

      const orderStatusValue = orderStatusForUpdatePayload(currentOrderData?.orderStatus);
      const paymentStatusValue =
        String(formData.step6.paymentStatus || '').trim() ||
        currentOrderData?.paymentStatus ||
        'UNPAID';
      const paymentTypeValue = formData.step6.paymentType || currentOrderData?.paymentType || 'CASH';

      console.log('[UpdateOrderWizard] Validated values:', {
        orderName: orderName,
        orderStatus: orderStatusValue,
        paymentStatus: paymentStatusValue,
        paymentType: paymentTypeValue,
      });

      const payload: any = {
        orderName: orderName,
        orderStatus: orderStatusValue,
        paymentStatus: paymentStatusValue,
        paymentType: paymentTypeValue,
        specifyVoteImagePath: (formData.step6.specifyVoteImagePath || '').trim() || undefined,
      };

      if (formData.step6.invoiceLink?.trim()) {
        payload.invoiceLink = formData.step6.invoiceLink.trim();
      }

      {
        const loadedS = String(currentSpecifyId || '').trim();
        const finalS = String(finalSpecifyId || '').trim();
        if (finalS && finalS !== loadedS) {
          payload.specifyId = finalS;
        }
      }

      // Không gửi customerId khi sửa đơn:
      // backend updateOrder sẽ validate customer theo userId nếu field này có mặt và dễ nổ CUSTOMER_001
      // với dữ liệu cũ lệch mapping. Luồng sửa đơn mobile không đổi khách hàng, nên bỏ hẳn field này.
      if (formData.step1.sampleCollectorId?.trim())
        payload.sampleCollectorId = formData.step1.sampleCollectorId.trim();
      if (formData.step1.staffAnalystId?.trim())
        payload.staffAnalystId = formData.step1.staffAnalystId.trim();
      if (formData.step1.staffId?.trim()) payload.staffId = formData.step1.staffId.trim();
      if (formData.step1.barcodeId?.trim()) payload.barcodeId = formData.step1.barcodeId.trim();

      if (formData.step6.paymentAmount?.trim()) {
        const amount = parseVndAmountInput(formData.step6.paymentAmount);
        if (Number.isFinite(amount) && amount > 0) payload.paymentAmount = amount;
      }

      console.log('[UpdateOrderWizard] Final payload:', JSON.stringify(payload, null, 2));
      console.log('[UpdateOrderWizard] Calling mutation...');
      
      const result = await updateOrderMutation.mutateAsync(payload);
      console.log('[UpdateOrderWizard] Mutation success:', result);

      // Khi chuyển trạng thái thanh toán sang COMPLETED trong luồng sửa đơn,
      // tự động tạo/đồng bộ patient metadata template giống web.
      try {
        const prevPs = String(currentOrderData?.paymentStatus || '').trim().toUpperCase();
        const nextPs = String(paymentStatusValue || '').trim().toUpperCase();
        if (nextPs === 'COMPLETED' && prevPs !== 'COMPLETED') {
          const fallbackSpecifyId = String(finalSpecifyId || currentSpecifyId || '').trim() || undefined;
          await ensurePatientMetadataForOrder(orderId!, fallbackSpecifyId);
          queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
        }
      } catch (e) {
        console.warn('[UpdateOrderWizard] ensurePatientMetadataForOrder failed:', e);
      }
      
      // Sau khi lưu thành công, tự động quay về trang đơn hàng chờ cập nhật sau 0.5 giây
      // Clear timeout cũ nếu có
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
      
      // Tự động quay về sau 0.5 giây
      navigateTimeoutRef.current = setTimeout(() => {
        console.log('[UpdateOrderWizard] Navigating after save:', targetAfterSave);
        router.replace(targetAfterSave as any);
        navigateTimeoutRef.current = null;
      }, 500);
    } catch (e: any) {
      console.error('[UpdateOrderWizard] Submit error:', e);
      console.error('[UpdateOrderWizard] Error stack:', e?.stack);
      const errorMessage = e?.message || e?.error || 'Không thể cập nhật đơn hàng. Vui lòng thử lại.';
      Alert.alert('❌ Lỗi', errorMessage);
    }
  };

  /** Bước 1 — giống create-order: đơn + thanh toán (tên đơn & barcode cố định theo đơn) */
  const renderStep1 = () => (
    <View className="bg-white rounded-3xl border border-slate-200 p-4">
      <FormReadOnly label="Tên đơn hàng" value={watchedOrderName || '—'} />

      <FormSelect
        name="step1.staffId"
        label="Người thu tiền"
        required={paymentStaffs.length > 0}
        options={paymentStaffSelectOptions}
        getLabel={s => s.staffName}
        getValue={s => String(s.staffId ?? '').trim()}
        placeholder="Lựa chọn"
        modalTitle="Chọn người thu tiền"
      />

      <FormReadOnly label="Mã Barcode PCĐ" value={barcodeReadOnlyLabel || '—'} />

      <FormSelect
        name="step1.staffAnalystId"
        label="Nhân viên phụ trách"
        options={analystStaffs}
        getLabel={s => s.staffName}
        getValue={s => String(s.staffId ?? '').trim()}
        placeholder="Lựa chọn"
        modalTitle="Chọn nhân viên phụ trách (DOCTOR — BV trung tâm)"
      />

      <FormSelect
        name="step1.sampleCollectorId"
        label="Nhân viên thu mẫu"
        options={collectorStaffs}
        getLabel={s => s.staffName}
        getValue={s => String(s.staffId ?? '').trim()}
        placeholder="Lựa chọn"
        modalTitle="Chọn nhân viên thu mẫu (LAB)"
      />

      <View className="h-px bg-slate-100 my-4" />

      {orderPaidLocked ? (
        <>
          <FormReadOnly label="Trạng thái thanh toán" value="Đã thanh toán" />
          <View className="mb-4">
            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">Hóa đơn thanh toán</Text>
            <View className="bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3">
              <OpenableUrlText
                value={invoiceLinkWatched}
                numberOfLines={6}
                emptyMessage="Chưa có file hóa đơn trên hệ thống."
                emptyClassName="text-[13px] text-slate-400"
                filledClassName="text-[13px] text-slate-700"
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <FormSelect
            name="step6.paymentStatus"
            label="Trạng thái thanh toán"
            required
            options={[...PAYMENT_STATUS_OPTIONS]}
            getLabel={o => o.label}
            getValue={o => o.value}
            placeholder="Lựa chọn trạng thái thanh toán"
            modalTitle="Chọn trạng thái thanh toán"
          />
        </>
      )}

      <FormFieldGroup>
        {String(watchedPaymentStatus || '').trim() !== 'UNPAID' && (
          <FormNumericInput
            name="step6.paymentAmount"
            label="Số tiền đã thu (VNĐ)"
            type="currency"
            placeholder="Nhập vào số tiền (VNĐ)"
          />
        )}
        {orderPaidLocked ? (
          <FormReadOnly label="Hình thức thanh toán" value={orderLockedPaymentTypeLabel} />
        ) : (
          <FormSelect
            name="step6.paymentType"
            label="Hình thức thanh toán"
            required
            options={PAYMENT_TYPE_OPTIONS}
            getLabel={o => o.label}
            getValue={o => o.value}
            placeholder="Tiền mặt"
            modalTitle="Chọn hình thức thanh toán"
          />
        )}
      </FormFieldGroup>

      {!orderPaidLocked &&
        String(watchedPaymentStatus || '').trim() === 'COMPLETED' &&
        String(watchedPaymentType || '').trim().toUpperCase() === 'ONLINE_PAYMENT' && (
          <View className="mb-4">
            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">Hóa đơn thanh toán *</Text>
            <View className="bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3">
              <OpenableUrlText
                value={invoiceLinkWatched}
                numberOfLines={6}
                emptyMessage="Bắt buộc với thanh toán online: upload ảnh/PDF hoặc dán link hóa đơn."
                emptyClassName="text-[13px] text-amber-800 font-semibold"
                filledClassName="text-[13px] text-slate-700"
              />
            </View>
            <View className="flex-row flex-wrap mt-3 gap-2">
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
                  className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200"
                  activeOpacity={0.8}
                >
                  <Text className="text-[13px] font-bold text-rose-700">Xóa file</Text>
                </TouchableOpacity>
              )}
            </View>
            <FormInput
              name="step6.invoiceLink"
              label="Hoặc dán link hóa đơn"
              placeholder="https://..."
              autoCapitalize="none"
            />
            <Text className="mt-2 text-[11px] text-slate-500">PNG, JPG, PDF tối đa 10MB</Text>
          </View>
        )}

      {!orderPaidLocked &&
        String(watchedPaymentStatus || '').trim() === 'COMPLETED' &&
        String(watchedPaymentType || '').trim().toUpperCase() === 'CASH' && (
          <FormInfoBox>
            Đã thanh toán bằng tiền mặt: không bắt buộc đính kèm hóa đơn để sang bước tiếp theo.
          </FormInfoBox>
        )}

      <FormInput
        name="step6.specifyVoteImagePath"
        label="Đường dẫn ảnh phiếu chỉ định"
        placeholder="Nhập đường dẫn ảnh (nếu có)"
        autoCapitalize="none"
      />
      {looksLikeHttpUrl(watchedSpecifyVoteImagePath) ? (
        <TouchableOpacity
          onPress={() => void openExternalUrl(watchedSpecifyVoteImagePath)}
          className="mb-4 px-4 py-3 rounded-2xl bg-sky-50 border border-sky-200 active:opacity-80"
          activeOpacity={0.85}
        >
          <Text className="text-[13px] font-bold text-sky-800">Mở liên kết phiếu chỉ định trong trình duyệt</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  /** Bước 2 — giống create-order: phiếu, bác sĩ, BV, bệnh nhân */
  const renderStep2 = () => {
    const specifyIdVal = String(methods.watch('step2.specifyId') || '').trim();
    return (
      <View className="bg-white rounded-3xl border border-slate-200 p-4">
        <FormInfoBox>
          {orderSpecifyLocked
            ? 'Đơn đã gắn phiếu chỉ định — chỉ sửa nội dung theo đúng phiếu này, không đổi sang phiếu khác.'
            : 'Chọn mã phiếu xét nghiệm — form sẽ tải lại theo phiếu đã chọn trước khi lưu.'}
        </FormInfoBox>
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2 mt-1">Mã phiếu xét nghiệm</Text>
        <TouchableOpacity
          className={`h-12 rounded-2xl border px-3 flex-row items-center justify-between mb-4 ${
            orderSpecifyLocked ? 'border-slate-200 bg-slate-100' : 'border-sky-100 bg-slate-50'
          }`}
          onPress={() => {
            if (!orderSpecifyLocked) setShowSpecifyIdModal(true);
          }}
          activeOpacity={orderSpecifyLocked ? 1 : 0.75}
          disabled={orderSpecifyLocked || !specifyPickOptions.length || pickingSpecify}
        >
          <Text className="flex-1 text-[14px] font-semibold text-slate-900 pr-2" numberOfLines={1}>
            {specifyPickOptions.find(o => o.value === specifyIdVal)?.label ||
              specifyIdVal ||
              'Đang tải danh sách…'}
          </Text>
          {pickingSpecify ? (
            <ActivityIndicator color="#0284C7" />
          ) : orderSpecifyLocked ? (
            <Text className="text-slate-400 text-[11px] font-bold">Cố định</Text>
          ) : (
            <Text className="text-sky-600 text-[12px] font-extrabold">Đổi</Text>
          )}
        </TouchableOpacity>

        <FormSelect
          name="step1.doctorId"
          label="Bác sĩ chỉ định"
          options={filteredDoctors}
          getLabel={d => d.doctorName}
          getValue={d => d.doctorId}
          placeholder="Lựa chọn"
          modalTitle="Chọn bác sĩ chỉ định"
        />

        <FormSelect
          name="step1.hospitalId"
          label="P.khám/Bệnh viện"
          options={hospitalOptions}
          getLabel={h => h.label}
          getValue={h => h.value}
          placeholder="Lựa chọn"
          modalTitle="Chọn phòng khám/bệnh viện"
        />

        <FormInput name="step2.patientName" label="Họ tên" required placeholder="Nhập vào họ và tên" />

        <FormFieldGroup>
          <FormNumericInput
            name="step2.patientPhone"
            label="Số điện thoại"
            required
            type="phone"
            placeholder="Nhập số điện thoại"
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
          <FormInput name="step2.patientContactName" label="Người liên hệ" required placeholder="Nhập người liên hệ" />
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

  /** Bước 3 — chọn nhóm xét nghiệm + form chi tiết theo nhóm */
  const renderStep3 = () => {
    const selectedServiceType = String(
      methods.watch('step3.serviceType') || methods.watch('step5.serviceType') || ''
    ).trim();
    const step3DiagnoseImageUrl = methods.watch('step3.diagnoseImage');

    return (
      <View className="bg-white rounded-3xl border border-slate-200 p-4">
        <FormSelect
          name="step3.serviceType"
          label="Nhóm xét nghiệm"
          required
          options={SERVICE_TYPE_OPTIONS}
          getLabel={o => o.label}
          getValue={o => o.value}
          placeholder="Lựa chọn"
          modalTitle="Chọn nhóm dịch vụ"
        />

        <FormInfoBox>
          Chọn nhóm ở trên, sau đó điền chi tiết theo nhóm. Giống màn tạo đơn / web quản trị.
        </FormInfoBox>

        {selectedServiceType === 'reproduction' && (
          <>
            <View className="h-px bg-slate-100 my-3" />
            <Text className="text-[14px] font-extrabold text-slate-900 mb-3">Nhóm sản</Text>
            <Text className="text-[12px] text-slate-500 mb-2">
              Bắt buộc: tuần thai, ngày thai, số lượng thai (1–3). CRL, độ mờ da gáy, combined test, siêu âm tuỳ chọn.
            </Text>
            <FormNumericInput name="step3.fetusesWeek" label="Tuần thai *" type="integer" placeholder="0 – 40" />
            <FormNumericInput name="step3.fetusesDay" label="Ngày thai *" type="integer" placeholder="0 – 30" />
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
              helperText="Tuỳ chọn"
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
              placeholder="Tuỳ chọn"
              minHeight={90}
            />
            <FormTextarea name="step3.ultrasoundResult" label="Kết quả siêu âm" placeholder="Tuỳ chọn" minHeight={90} />
          </>
        )}

        {selectedServiceType === 'embryo' && (
          <>
            <View className="h-px bg-slate-100 my-3" />
            <Text className="text-[14px] font-extrabold text-slate-900 mb-3">Nhóm phôi</Text>
            <Text className="text-[12px] text-slate-500 mb-2">Các trường tuỳ chọn; số phôi tạo chọn 1, 2 hoặc 3.</Text>
            <FormInput name="step3.biospy" label="Sinh thiết" placeholder="Nhập thông tin sinh thiết" />
            <FormDatePicker
              name="step3.biospyDate"
              label="Ngày sinh thiết"
              placeholder="Chọn ngày sinh thiết"
              helperText="Tuỳ chọn — có thể chọn ngày trong tương lai"
            />
            <FormInput name="step3.cellContainingSolution" label="Dung dịch chứa tế bào" placeholder="Nhập dung dịch" />
            <FormSelect
              name="step3.embryoCreate"
              label="Số phôi tạo"
              options={[...STEP3_COUNT_123_OPTIONS]}
              getLabel={o => o.label}
              getValue={o => o.value}
              placeholder="Chọn 1, 2 hoặc 3"
              modalTitle="Chọn số phôi tạo"
            />
            <FormInput name="step3.embryoStatus" label="Trạng thái phôi" placeholder="Nhập trạng thái" />
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
            <FormInput name="step3.negativeControl" label="Đối chứng âm" placeholder="Nhập đối chứng" />
          </>
        )}

        {selectedServiceType === 'disease' && (
          <>
            <View className="h-px bg-slate-100 my-3" />
            <Text className="text-[14px] font-extrabold text-slate-900 mb-3">Nhóm bệnh lý</Text>
            <Text className="text-[12px] text-slate-500 mb-2">
              Các trường tuỳ chọn; ảnh chẩn đoán: tải lên Cloudinary hoặc dán URL.
            </Text>
            <FormTextarea name="step3.symptom" label="Triệu chứng" placeholder="Nhập triệu chứng" minHeight={90} />
            <FormTextarea name="step3.diagnose" label="Chẩn đoán" placeholder="Nhập chẩn đoán" minHeight={90} />
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
              <FormInput name="step3.diagnoseImage" label="Hoặc dán URL ảnh" placeholder="https://..." />
            </View>
            <FormInput name="step3.testRelated" label="Xét nghiệm liên quan" placeholder="Nhập xét nghiệm" />
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
            <FormInput name="step3.drugResistance" label="Kháng thuốc" placeholder="Nhập thông tin kháng thuốc" />
            <FormInput name="step3.relapse" label="Tái phát" placeholder="Nhập thông tin tái phát" />
          </>
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
          type="decimal"
          placeholder="VD: 165"
          numericMax={200}
          helperText="0 – 200 cm (giống web đặt hàng)"
        />
        <FormNumericInput
          name="step4.patientWeight"
          label="Cân nặng (kg)"
          type="decimal"
          placeholder="VD: 60"
          numericMax={100}
          helperText="0 – 100 kg (giống web đặt hàng)"
        />
      </FormFieldGroup>

      <FormTextarea
        name="step4.patientHistory"
        label="Tiền sử bệnh nhân"
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
        label="Tiếp xúc độc tố"
        placeholder="Nhập thông tin tiếp xúc độc tố"
        minHeight={90}
      />

      <FormTextarea
        name="step4.medicalHistory"
        label="Tiền sử y tế"
        placeholder="Nhập tiền sử y tế"
        minHeight={110}
      />

      <FormTextarea
        name="step4.chronicDisease"
        label="Bệnh mãn tính"
        placeholder="Nhập bệnh mãn tính"
        minHeight={90}
      />

      <FormTextarea
        name="step4.acuteDisease"
        label="Bệnh cấp tính"
        placeholder="Nhập bệnh cấp tính"
        minHeight={90}
      />

      <FormTextarea
        name="step4.medicalUsing"
        label="Thuốc đang sử dụng"
        placeholder="Nhập thuốc đang sử dụng"
        minHeight={90}
      />
    </View>
  );

  /** Bước 5 — giống create-order: mã XN, mô tả mẫu, nơi/ngày thu mẫu */
  const renderStep5 = () => {
    const testName = methods.watch('step3.testName');
    const genomeTestIdWatch = methods.watch('step3.genomeTestId');
    const lockTestDetails = !!String(genomeTestIdWatch ?? '').trim();
    return (
      <View className="bg-white rounded-3xl border border-slate-200 p-4">
        <View className="mb-4">
          <Text className="text-slate-700 font-medium mb-2">
            Mã xét nghiệm <Text className="text-red-500">*</Text>
          </Text>
          <FormSelect
            name="step3.genomeTestId"
            label=""
            required
            options={filteredGenomeTests}
            getLabel={t => t.testName}
            getValue={t => t.testId}
            placeholder="Lựa chọn"
            modalTitle={`Chọn xét nghiệm${
              serviceType && filteredGenomeTests.length > 0
                ? ` (${filteredGenomeTests.length} xét nghiệm)`
                : genomeTests.length > 0
                  ? ` (${genomeTests.length} xét nghiệm)`
                  : ''
            }`}
          />
        </View>

        {lockTestDetails ? (
          <FormInfoBox>
            Đã chọn mã xét nghiệm: tên, mẫu và nội dung xét nghiệm khớp theo danh mục — không chỉnh sửa.
          </FormInfoBox>
        ) : null}

        {!!(testName || lockTestDetails) && <View className="h-px bg-slate-100 my-2" />}

        <FormInput
          name="step3.testName"
          label="Tên xét nghiệm"
          required
          placeholder="Nhập tên xét nghiệm"
          editable={!lockTestDetails}
        />
        <FormInput
          name="step3.testSample"
          label="Mẫu xét nghiệm"
          required
          placeholder="Nhập mẫu xét nghiệm"
          editable={!lockTestDetails}
        />
        <FormTextarea
          name="step3.testContent"
          label="Nội dung xét nghiệm"
          required
          placeholder="Nội dung tự điền khi chọn mã xét nghiệm"
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
            placeholder="Chọn ngày thu mẫu"
            helperText="Bấm để chọn ngày trên lịch (cho phép cả ngày tương lai)"
          />
          <FormSelect
            name="step6.embryoNumber"
            label="Số lượng phôi"
            options={EMBRYO_COUNT_OPTIONS}
            getLabel={o => o.label}
            getValue={o => o.value}
            placeholder="Chọn 1, 2 hoặc 3"
            modalTitle="Số lượng phôi"
            helperText="Nhóm phôi: chọn 1 – 3"
          />
        </FormFieldGroup>
        {!genomeTestIdWatch ? (
          <FormInfoBox>Chọn nhóm xét nghiệm ở bước 3 để lọc danh sách xét nghiệm phù hợp.</FormInfoBox>
        ) : null}
      </View>
    );
  };

  /** Bước 6 — kết quả di truyền (giống create-order bước 6) */
  const renderStep6 = () => (
    <View className="bg-white rounded-3xl border border-slate-200 p-4">
      <FormInfoBox>Cập nhật kết quả xét nghiệm di truyền cho đơn hàng này.</FormInfoBox>

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
        return renderStep6();
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

  if (isLoadingOrder) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#0891B2" />
        <Text className="mt-3 text-slate-600 text-xs font-bold">Đang tải đơn hàng...</Text>
      </View>
    );
  }

  return (
    <FormProvider {...methods}>
      <View className="flex-1 bg-slate-50">
        <Stack.Screen options={{ headerShown: false }} />
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
                Cập nhật đơn hàng
              </Text>
              <Text className="mt-0.5 text-[11px] font-bold text-slate-500" numberOfLines={1}>
                Hoàn thiện theo từng bước
              </Text>
              {loadedOrder?.orderId ? (
                <Text className="mt-1 text-[10px] font-bold text-slate-400" numberOfLines={1}>
                  Mã đơn: {loadedOrder.orderId}
                </Text>
              ) : null}
              <View className="mt-2 flex-row flex-wrap items-center justify-center gap-2">
                <View
                  className={`px-2.5 py-1 rounded-full border ${orderStatusBadge.bg} ${orderStatusBadge.bd}`}
                >
                  <Text className={`text-[10px] font-extrabold ${orderStatusBadge.fg}`}>
                    {orderStatusBadge.label}
                  </Text>
                </View>
                <View
                  className={`px-2.5 py-1 rounded-full border ${paymentStatusBadge.bg} ${paymentStatusBadge.bd}`}
                >
                  <Text className={`text-[10px] font-extrabold ${paymentStatusBadge.fg}`}>
                    {paymentStatusBadge.label}
                  </Text>
                </View>
              </View>
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
              <Text className="mt-1 text-[11px] text-slate-500">
                Chạm chip bước bên dưới để mở đúng phần cần sửa.
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
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.75}
                  onPress={() => {
                    void handleStepChipPress(stepNum);
                  }}
                  className={`flex-row items-center px-3 py-2 rounded-full border ${
                    isActive
                      ? 'bg-cyan-600 border-sky-700'
                      : isDone
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'bg-white border-slate-200'
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full items-center justify-center ${
                      isActive ? 'bg-white/20' : isDone ? 'bg-white/20' : 'bg-slate-100'
                    }`}
                  >
                    {isDone ? (
                      <Check size={12} color="#fff" strokeWidth={3} />
                    ) : (
                      <Text
                        className={`text-[11px] font-extrabold ${
                          isActive ? 'text-white' : 'text-slate-600'
                        }`}
                      >
                        {stepNum}
                      </Text>
                    )}
                  </View>

                  <Text
                    className={`ml-2 text-[11px] font-extrabold ${
                      isActive || isDone ? 'text-white' : 'text-slate-600'
                    }`}
                    numberOfLines={1}
                  >
                    {`B${stepNum}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ 
            padding: 16, 
            paddingBottom: showFooter ? (Platform.OS === 'android' ? 100 : 120) : 16
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-white rounded-2xl border border-slate-200 p-4">
            {renderCurrentStep()}
          </View>
        </ScrollView>

        {showFooter && (
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
                className={`flex-1 h-12 rounded-2xl items-center justify-center ${
                  updateOrderMutation.isPending ? 'bg-cyan-400' : 'bg-cyan-600'
                }`}
                onPress={async () => {
                  try {
                    await handleNext();
                  } catch (error: any) {
                    console.error('[UpdateOrderWizard] Error in onPress:', error);
                    Alert.alert('❌ Lỗi', error?.message || 'Có lỗi xảy ra khi xử lý. Vui lòng thử lại.');
                  }
                }}
                activeOpacity={0.85}
                disabled={updateOrderMutation.isPending}
              >
                {updateOrderMutation.isPending ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator color="#fff" size="small" />
                    <Text className="text-[15px] font-extrabold text-white">Đang lưu...</Text>
                  </View>
                ) : (
                  <Text className="text-[15px] font-extrabold text-white">
                    {currentStep === TOTAL_STEPS ? 'Lưu thay đổi' : 'Tiếp theo'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>

      <SelectionModal
        visible={showSpecifyIdModal}
        title="Chọn mã phiếu xét nghiệm"
        options={specifyPickOptions}
        selectedValue={String(watchedStep2SpecifyId || '').trim()}
        onSelect={v => {
          void (async () => {
            setShowSpecifyIdModal(false);
            setPickingSpecify(true);
            const setOpts = { shouldDirty: true, shouldValidate: true } as const;
            try {
              skipOrderPatientRehydrateRef.current = false;
              methods.setValue('step2.specifyId', v, setOpts);
              const res = await specifyVoteTestService.getById(v);
              if (!res.success || !res.data) {
                throw new Error(res.error || 'Không tải được phiếu chỉ định');
              }
              const spec = res.data as SpecifyVoteTestResponse;

              const did = String(spec.doctorId || '').trim();
              if (did) methods.setValue('step1.doctorId', did, setOpts);
              const hid = String(spec.hospitalId || '').trim();
              if (hid) methods.setValue('step1.hospitalId', hid, setOpts);

              const p = spec.patient;
              if (p) {
                if (p.patientId) methods.setValue('step2.patientId', String(p.patientId), setOpts);
                if (p.patientName != null) methods.setValue('step2.patientName', String(p.patientName), setOpts);
                if (p.patientPhone != null) methods.setValue('step2.patientPhone', String(p.patientPhone), setOpts);
                if (p.patientDob != null) {
                  methods.setValue('step2.patientDob', formatDateInput(String(p.patientDob)), setOpts);
                }
                if (p.gender != null) methods.setValue('step2.patientGender', String(p.gender) as any, setOpts);
                if (p.patientEmail != null) methods.setValue('step2.patientEmail', String(p.patientEmail), setOpts);
                if (p.patientJob != null) methods.setValue('step2.patientJob', String(p.patientJob), setOpts);
                if (p.patientContactName != null) {
                  methods.setValue('step2.patientContactName', String(p.patientContactName), setOpts);
                }
                if (p.patientContactPhone != null) {
                  methods.setValue('step2.patientContactPhone', String(p.patientContactPhone), setOpts);
                }
                if (p.patientAddress != null) {
                  methods.setValue('step2.patientAddress', String(p.patientAddress), setOpts);
                }
              }

              const gid = safeTrim(spec.genomeTestId);
              if (gid) {
                const nestedGt = spec.genomeTest;
                const test =
                  genomeTests.find((t: any) => safeTrim(t.testId) === gid) ||
                  (nestedGt && safeTrim(nestedGt.testId) === gid ? nestedGt : null);
                methods.setValue('step3.genomeTestId', gid, setOpts);
                methods.setValue('step5.genomeTestId', gid, setOpts);
                const tn = String(test?.testName || nestedGt?.testName || '').trim();
                const rawSample = test?.testSample ?? nestedGt?.testSample;
                const ts = Array.isArray(rawSample)
                  ? rawSample.map((x: unknown) => safeTrim(x)).filter(Boolean).join(', ')
                  : safeTrim(rawSample);
                const tc = String(test?.testDescription || nestedGt?.testDescription || '').trim();
                if (tn) methods.setValue('step3.testName', tn, setOpts);
                if (ts) methods.setValue('step3.testSample', ts, setOpts);
                if (tc) methods.setValue('step3.testContent', tc, setOpts);
                if (tn) methods.setValue('step5.testName', tn, setOpts);
                if (ts) methods.setValue('step5.testSample', ts, setOpts);
                if (tc) methods.setValue('step5.testContent', tc, setOpts);

                const stResolved =
                  serviceTypeFromGenomeTestObj(test as any) ||
                  normalizeServiceType(String(spec.serviceType || ''));
                if (stResolved) {
                  methods.setValue('step3.serviceType', stResolved, setOpts);
                  methods.setValue('step5.serviceType', stResolved, setOpts);
                } else if ((test as any)?.service?.name) {
                  const serviceName = String((test as any).service.name).toLowerCase();
                  const st =
                    serviceName.includes('embryo') || serviceName === 'embryo'
                      ? 'embryo'
                      : serviceName.includes('disease') || serviceName === 'disease'
                        ? 'disease'
                        : 'reproduction';
                  methods.setValue('step5.serviceType', st, setOpts);
                  methods.setValue('step3.serviceType', st, setOpts);
                }
              }

              methods.setValue('step2.specifyImagePath', String(spec.specifyNote || ''), setOpts);
              methods.setValue('step6.samplingSite', spec.samplingSite || '', setOpts);
              methods.setValue('step6.sampleCollectDate', formatDateInput(spec.sampleCollectDate), setOpts);
              methods.setValue(
                'step6.embryoNumber',
                spec.embryoNumber != null ? String(spec.embryoNumber) : '',
                setOpts
              );
              methods.setValue('step7.geneticTestResults', spec.geneticTestResults || '', setOpts);
              methods.setValue(
                'step7.geneticTestResultsRelationship',
                spec.geneticTestResultsRelationship || '',
                setOpts
              );

              const pid = String(spec.patientId || '').trim();
              if (pid) {
                const clinicalResponse = await patientClinicalService.getByPatientId(pid);
                const clinicalData =
                  clinicalResponse.success && clinicalResponse.data ? clinicalResponse.data : undefined;
                applyClinicalDataToStep4(methods, clinicalData as any, setOpts);
              }
            } catch (e: any) {
              Alert.alert('Không tải phiếu', e?.message || 'Vui lòng thử lại.');
            } finally {
              setPickingSpecify(false);
            }
          })();
        }}
        onClose={() => setShowSpecifyIdModal(false)}
      />
    </FormProvider>
  );
}
