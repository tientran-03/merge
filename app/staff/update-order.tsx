import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, ChevronDown, ChevronUp } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  FormFieldGroup,
  FormInfoBox,
  FormInput,
  FormNumericInput,
  FormReadOnly,
  FormSelect,
  FormTextarea,
} from "@/components/form";
import { InvoiceModal } from "@/components/modals";
import { ORDER_STATUS_DEFAULT } from "@/lib/constants/order-status";
import { ensureSinglePaidOrderPatientMetadataLikeWeb } from "@/lib/ensurePaidOrderPatientMetadataWebStyle";
import { presentFeedbackError, presentFeedbackSuccess } from "@/lib/feedbackModal";
import {
  cashierStaffOptionsForOrder,
  sampleCollectorOptionsForOrder,
  staffAnalystOptionsForOrderWithFallback
} from "@/lib/hospitalStaffOrderOptions";
import { orderHasSpecifyAndPatientForInvoice } from "@/lib/orderSpecifyLink";
import {
  createOrderDefaultValues,
  createOrderSchema,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  SERVICE_TYPE_MAPPER,
  SERVICE_TYPE_OPTIONS,
  toFormPaymentStatus,
  type CreateOrderFormData
} from "@/lib/schemas/order-schemas";
import { OrderStatus } from "@/types";

import { useAuth } from "@/contexts/AuthContext";
import {
  BarcodeStatus,
  getStaffPositionDisplayName,
  OrderStatus as OrderStatusEnum,
  SpecifyStatus,
} from "@/lib/schemas/order-form-schema";
import { normalizeVnMobileDigits } from "@/lib/schemas/patient-field-rules";
import { barcodeService, type BarcodeResponse } from "@/services/barcodeService";
import { customerService, type CustomerResponse } from "@/services/customerService";
import { doctorService, type DoctorResponse } from "@/services/doctorService";
import { genomeTestService, type GenomeTestResponse } from "@/services/genomeTestService";
import { hospitalStaffService, type HospitalStaffResponse } from "@/services/hospitalStaffService";
import { orderService, type OrderResponse } from "@/services/orderService";
import { patientClinicalService } from "@/services/patientClinicalService";
import { patientMetadataService } from "@/services/patientMetadataService";
import { patientService } from "@/services/patientService";
import { serviceService, type ServiceResponse } from "@/services/serviceService";
import { specifyVoteTestService } from "@/services/specifyVoteTestService";
import { uploadImageToCloudinary } from "@/utils/cloudinary";
import { pickInvoiceImageOnWeb } from "@/utils/webInvoicePick";

const EMPTY_CUSTOMERS: CustomerResponse[] = [];
const EMPTY_GENOME_TESTS: GenomeTestResponse[] = [];
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SEARCH_DEBOUNCE_MS = 400;
const MIN_PHONE_SEARCH_LENGTH = 2;

const EDITABLE = {
  step1: {
    orderName: true,
    doctorId: true,
    customerId: false,
    staffId: true,
    barcodeId: true,
    staffAnalystId: true,
    sampleCollectorId: true,
    orderStatus: false,
    paymentStatus: true,
  },
  step2: {
    all: false,
  },
  step3: {
    genomeTestId: false,
  },
  step4: {
    all: false,
  },
  step5: {
    serviceType: false,
  },
  step6: {
    paymentAmount: false,
    paymentType: true,
    samplingSite: false,
    sampleCollectDate: false,
    embryoNumber: false,
    specifyVoteImagePath: true,
  },
  step7: {
    geneticTestResults: true,
    geneticTestResultsRelationship: true,
    orderNote: true,
  },
};

const TOTAL_STEPS = 7;
function labelForPaymentType(v?: string | null): string {
  const raw = (v || "").toUpperCase();
  const o = PAYMENT_TYPE_OPTIONS.find((p) => String(p.value).toUpperCase() === raw);
  return o?.label || v || "—";
}

function labelForPaymentStatus(v?: string | null): string {
  const raw = (v || "").toUpperCase();
  const o = PAYMENT_STATUS_OPTIONS.find((p) => String(p.value).toUpperCase() === raw);
  if (o) return o.label;
  if (raw === "PENDING" || raw === "FAILED") return "Chưa thanh toán";
  return v || "—";
}
function hasUsableInvoiceLink(link: string | null | undefined): boolean {
  const s = String(link ?? "").trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower === "null" || lower === "undefined") return false;
  return /^https?:\/\//i.test(s);
}
function phoneSuffixForDisplay(stored: string): string {
  const s = normalizeVnMobileDigits(stored || "");
  if (s.startsWith("0") && s.length >= 2) return s.slice(1);
  return s.replace(/\D/g, "").replace(/^0/, "");
}
function storedFromSuffixInput(suffix: string): string {
  const rawDigits = String(suffix || "").replace(/\D/g, "");
  const digits = rawDigits.startsWith("0") ? rawDigits.slice(1) : rawDigits;
  const d = digits.slice(0, 9);
  if (!d) return "";
  return `0${d}`;
}

function canRunStaffApprovalWizardForOrder(order: OrderResponse | undefined, role?: string): boolean {
  const isStaffApprover = role === "ROLE_STAFF" || role === "ROLE_ADMIN";
  if (!isStaffApprover || !order) return false;

  const orderStatusLower = (order.orderStatus || "").toLowerCase();
  const payTypeUpper = (order.paymentType || "").toUpperCase();
  const payStatusUpper = (order.paymentStatus || "").toUpperCase();

  const staffInitiationCash = orderStatusLower === "initiation" && payTypeUpper === "CASH";
  const staffForwardCashUnpaid =
    orderStatusLower === "forward_analysis" &&
    payTypeUpper === "CASH" &&
    payStatusUpper !== "COMPLETED";
  const staffForwardReadyToAccept =
    orderStatusLower === "forward_analysis" &&
    (payTypeUpper !== "CASH" || payStatusUpper === "COMPLETED");
  const staffInitiationOnlineRejectOnly =
    orderStatusLower === "initiation" && payTypeUpper !== "CASH";

  return (
    staffInitiationCash ||
    staffForwardCashUnpaid ||
    staffForwardReadyToAccept ||
    staffInitiationOnlineRejectOnly
  );
}

const STEP_TITLES = [
  "Thông tin đơn hàng & thanh toán",
  "Thông tin người làm xét nghiệm",
  "Thông tin nhóm xét nghiệm",
  "Thông tin lâm sàng",
  "Thông tin xét nghiệm",
  "Thanh toán & mẫu xét nghiệm",
  "Kết quả xét nghiệm di truyền",
];

const formatDateInput = (isoDate?: string): string => {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
};
function patientClinicalToStep4(
  clinical: {
    patientHeight?: number | null;
    patientWeight?: number | null;
    patientHistory?: string | null;
    familyHistory?: string | null;
    toxicExposure?: string | null;
    medicalHistory?: string | null;
    chronicDisease?: string | null;
    acuteDisease?: string | null;
    medicalUsing?: string | string[] | null;
  }
): CreateOrderFormData["step4"] {
  const mu = clinical.medicalUsing;
  const medicalUsingStr = Array.isArray(mu)
    ? mu.join(", ")
    : mu != null && String(mu).trim() !== ""
      ? String(mu)
      : "";
  return {
    patientHeight: clinical.patientHeight != null ? String(clinical.patientHeight) : "",
    patientWeight: clinical.patientWeight != null ? String(clinical.patientWeight) : "",
    patientHistory: clinical.patientHistory ?? "",
    familyHistory: clinical.familyHistory ?? "",
    toxicExposure: clinical.toxicExposure ?? "",
    medicalHistory: clinical.medicalHistory ?? "",
    chronicDisease: clinical.chronicDisease ?? "",
    acuteDisease: clinical.acuteDisease ?? "",
    medicalUsing: medicalUsingStr,
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
          width: totalSteps <= 1 ? "0%" : `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
        }}
      />
      <View className="flex-row items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          const circleBg = isDone ? "bg-cyan-600" : "bg-white";
          const circleBorder = isDone
            ? "border-cyan-600"
            : isActive
              ? "border-cyan-600"
              : "border-slate-300";

          const textColor = isDone ? "text-white" : isActive ? "text-cyan-700" : "text-slate-500";

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
              <View className={`w-8 h-8 rounded-full items-center justify-center border-2 ${circleBg} ${circleBorder}`}>
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
function LockedField({
  locked,
  children,
}: {
  locked: boolean;
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <View pointerEvents="none" className="opacity-60">
      {children}
    </View>
  );
}

export default function UpdateOrderWizardRestrictedScreen() {
  const router = useRouter();
  const { orderId, approval } = useLocalSearchParams<{ orderId: string; approval?: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoiceLinkOverride, setInvoiceLinkOverride] = useState<string | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingSampleImage, setUploadingSampleImage] = useState(false);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [showPatientPhoneDropdown, setShowPatientPhoneDropdown] = useState(false);
  const [debouncedPatientPhoneSearch, setDebouncedPatientPhoneSearch] = useState("");

  const lastStablePaymentStatusRef = useRef<string | undefined>(undefined);
  const hydratedOrderIdRef = useRef<string | null>(null);
  const patientPhoneBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const methods = useForm<CreateOrderFormData>({
    resolver: zodResolver(createOrderSchema),
    mode: "onTouched",
    defaultValues: createOrderDefaultValues,
  });
  const { data: orderResponse, isLoading: isLoadingOrder } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderService.getById(orderId!),
    enabled: !!orderId,
  });

  const orderNeedsStaffApprovalWizard = useMemo(() => {
    const data = (orderResponse as any)?.data as OrderResponse | undefined;
    return canRunStaffApprovalWizardForOrder(data, user?.role);
  }, [user?.role, orderResponse]);

  const approvalParamRaw = Array.isArray(approval) ? approval[0] : approval;
  const isPendingApprovalListEntry =
    approvalParamRaw === "1" || String(approvalParamRaw ?? "").toLowerCase() === "true";
  const isApprovalFlow = isPendingApprovalListEntry || orderNeedsStaffApprovalWizard;
  const showHeaderExit = !isApprovalFlow || !isPendingApprovalListEntry;

  const { data: doctorsResponse } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => doctorService.getAll(),
    retry: false,
  });

  const { data: customersResponse } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customerService.getAll(),
    retry: false,
  });

  const { data: staffResponse } = useQuery({
    queryKey: ["hospital-staffs"],
    queryFn: () => hospitalStaffService.getAll(),
    retry: false,
  });

  const { data: barcodesResponse } = useQuery({
    queryKey: ["barcodes"],
    queryFn: () => barcodeService.getAll(),
    retry: false,
  });

  const { data: ordersResponse } = useQuery({
    queryKey: ["orders"],
    queryFn: () => orderService.getAll(),
    retry: false,
  });

  const { data: genomeTestsResponse } = useQuery({
    queryKey: ["genome-tests"],
    queryFn: () => genomeTestService.getAll(),
    retry: false,
  });

  const { data: servicesResponse } = useQuery({
    queryKey: ["services"],
    queryFn: () => serviceService.getAll(),
    retry: false,
  });

  const doctors = (doctorsResponse as any)?.success ? (((doctorsResponse as any).data as DoctorResponse[]) || []) : [];
  const customers = useMemo((): CustomerResponse[] => {
    return (customersResponse as any)?.success
      ? (((customersResponse as any).data as CustomerResponse[]) || [])
      : EMPTY_CUSTOMERS;
  }, [customersResponse]);
  const staffs = (staffResponse as any)?.success ? (((staffResponse as any).data as HospitalStaffResponse[]) || []) : [];
  const sampleCollectorIdWatch = methods.watch("step1.sampleCollectorId");
  const staffIdWatch = methods.watch("step1.staffId");

  const orderDataForDisplay = (orderResponse as any)?.data as OrderResponse | undefined;

  const barcodeIdWatch = useWatch({ control: methods.control, name: "step1.barcodeId" });
  const serverBarcodeLocked = useMemo(() => {
    const bid = String(orderDataForDisplay?.barcodeId ?? "").trim();
    return bid.length > 0;
  }, [orderDataForDisplay?.barcodeId]);
  const barcodeSelectionLocked = useMemo(() => {
    if (serverBarcodeLocked) return true;
    return String(barcodeIdWatch ?? "").trim().length > 0;
  }, [serverBarcodeLocked, barcodeIdWatch]);

  const staffAnalystIdWatch = methods.watch("step1.staffAnalystId");
  const staffAnalystOptions = useMemo(() => {
    const currentId = (orderResponse as any)?.data?.staffAnalystId as string | undefined;
    const wid = staffAnalystIdWatch || currentId;
    return staffAnalystOptionsForOrderWithFallback(staffs, wid);
  }, [staffs, orderResponse, staffAnalystIdWatch]);
  const sampleCollectorOptions = useMemo(
    () => sampleCollectorOptionsForOrder(staffs, sampleCollectorIdWatch),
    [staffs, sampleCollectorIdWatch]
  );

  const staffListForCashier = useMemo(() => {
    const currentId = (orderResponse as any)?.data?.staffId as string | undefined;
    const wid = staffIdWatch || currentId;
    return cashierStaffOptionsForOrder(staffs, wid);
  }, [staffs, orderResponse, staffIdWatch]);

  const doctorIdWatch = methods.watch("step1.doctorId");
  const selectedDoctor = useMemo((): DoctorResponse | undefined => {
    const id = String(doctorIdWatch ?? "").trim();
    if (!id) return undefined;
    return doctors.find((d) => String(d.doctorId).trim() === id);
  }, [doctors, doctorIdWatch]);

  const clinicLineLabel = useMemo(() => {
    const fromDoctor = selectedDoctor?.hospitalName?.trim();
    if (fromDoctor) return fromDoctor;
    const fromOrder = orderDataForDisplay?.specifyId?.hospital?.hospitalName?.trim();
    const orderDocId = orderDataForDisplay?.specifyId?.doctorId;
    if (
      fromOrder &&
      orderDocId &&
      String(orderDocId).trim() === String(doctorIdWatch ?? "").trim()
    ) {
      return fromOrder;
    }
    return fromOrder || "—";
  }, [selectedDoctor, orderDataForDisplay, doctorIdWatch]);

  const hasDoctorSelected = Boolean(String(doctorIdWatch ?? "").trim());

  const displayInvoiceLink =
    invoiceLinkOverride ??
    (typeof orderDataForDisplay?.invoiceLink === "string" ? orderDataForDisplay.invoiceLink : null);
  const hasInvoice = hasUsableInvoiceLink(displayInvoiceLink);
  const serverPaymentCompleted = orderDataForDisplay?.paymentStatus?.toUpperCase() === "COMPLETED";
  const step1PaymentStatusWatch = methods.watch("step1.paymentStatus");
  const step2PatientNameWatch = methods.watch("step2.patientName");
  const step2PatientPhoneWatch = methods.watch("step2.patientPhone");
  const step2PatientDobWatch = methods.watch("step2.patientDob");
  const step2PatientGenderWatch = methods.watch("step2.patientGender");
  const step2PatientEmailWatch = methods.watch("step2.patientEmail");
  const step2PatientContactNameWatch = methods.watch("step2.patientContactName");
  const step2PatientContactPhoneWatch = methods.watch("step2.patientContactPhone");
  const step2PatientAddressWatch = methods.watch("step2.patientAddress");

  const patientPhoneSearchTerm = useMemo(
    () => normalizeVnMobileDigits(step2PatientPhoneWatch || ""),
    [step2PatientPhoneWatch]
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPatientPhoneSearch(patientPhoneSearchTerm);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [patientPhoneSearchTerm]);

  const invoicePrerequisitesOk = useMemo(
    () =>
      orderHasSpecifyAndPatientForInvoice(orderDataForDisplay, {
        name: step2PatientNameWatch,
        phone: step2PatientPhoneWatch,
      }),
    [orderDataForDisplay, step2PatientNameWatch, step2PatientPhoneWatch]
  );

  const serverHasStep2Data = useMemo(() => {
    const p = orderDataForDisplay?.specifyId?.patient as any;
    return Boolean(
      String(p?.patientId || orderDataForDisplay?.specifyId?.patientId || "").trim() ||
      String(p?.patientPhone || "").trim() ||
      String(p?.patientName || "").trim() ||
      String(p?.patientAddress || "").trim()
    );
  }, [orderDataForDisplay]);

  const canEditStep2Patient = !serverHasStep2Data;

  const { data: patientSearchResponse, isLoading: isSearchingPatients } = useQuery({
    queryKey: ["patients", "search", debouncedPatientPhoneSearch, "update-order"],
    queryFn: () => patientService.search(debouncedPatientPhoneSearch),
    enabled: canEditStep2Patient && debouncedPatientPhoneSearch.length >= MIN_PHONE_SEARCH_LENGTH,
    staleTime: 30000,
  });
  const patientSearchResults = useMemo(() => {
    return (patientSearchResponse as any)?.success
      ? ((((patientSearchResponse as any).data as any[]) || []).filter(Boolean))
      : [];
  }, [patientSearchResponse]);

  const paymentStatusSelectOptions = useMemo(() => {
    const cur = String(step1PaymentStatusWatch ?? "").toUpperCase();
    if (invoicePrerequisitesOk || cur === "COMPLETED") {
      return [...PAYMENT_STATUS_OPTIONS];
    }
    return PAYMENT_STATUS_OPTIONS.filter((o) => String(o.value).toUpperCase() !== "COMPLETED");
  }, [invoicePrerequisitesOk, step1PaymentStatusWatch]);
  const paymentPaidUiLocked =
    hasInvoice &&
    (serverPaymentCompleted || step1PaymentStatusWatch === "COMPLETED");

  const handlePaymentStatusChange = useCallback(
    (
      newVal: string | number | boolean,
      _item?: unknown,
      previousValue?: string | number | boolean
    ): boolean | void => {
      const norm = (v: string | number | boolean | undefined) =>
        String(v ?? "")
          .trim()
          .toUpperCase();
      const newCode = norm(newVal);
      const oldCode = norm(
        previousValue ??
        lastStablePaymentStatusRef.current ??
        orderDataForDisplay?.paymentStatus ??
        "UNPAID"
      );
      if (newCode === "COMPLETED" && oldCode !== "COMPLETED") {
        const ok = orderHasSpecifyAndPatientForInvoice(orderDataForDisplay, {
          name: methods.getValues("step2.patientName"),
          phone: methods.getValues("step2.patientPhone"),
        });
        if (!ok) {
          presentFeedbackError({
            title: "Chưa đủ thông tin",
            message:
              "Đơn cần có phiếu xét nghiệm và thông tin bệnh nhân (họ tên, số điện thoại) trước khi chọn đã thanh toán / tạo hóa đơn.",
          });
          return false;
        }
      }
      if (newCode === "COMPLETED" && oldCode !== "COMPLETED" && !hasInvoice) {
        setUploadingInvoice(true);

        const finishUpload = async (assetUri: string) => {
          setUploadingInvoice(true);
          try {
            const res = await uploadImageToCloudinary(assetUri, { folder: "invoices" });
            const url = res.secureUrl || res.url;
            if (!url) throw new Error("Không nhận được link sau khi upload");
            await orderService.updateInvoiceLink(orderId!, url);
            setInvoiceLinkOverride(url);
            methods.setValue("step1.paymentStatus", "COMPLETED");
            lastStablePaymentStatusRef.current = "COMPLETED";
            void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
            presentFeedbackSuccess({
              title: "Đã upload",
              message: "Hóa đơn đã được lưu. Trạng thái thanh toán: Đã thanh toán.",
            });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Upload thất bại";
            presentFeedbackError({ title: "Không lưu được hóa đơn", message: msg });
          } finally {
            if (Platform.OS === "web" && assetUri.startsWith("blob:")) {
              try {
                URL.revokeObjectURL(assetUri);
              } catch {
                /* ignore */
              }
            }
            setUploadingInvoice(false);
          }
        };

        if (Platform.OS === "web") {
          pickInvoiceImageOnWeb()
            .then((uri) => {
              if (!uri) {
                setUploadingInvoice(false);
                return;
              }
              void finishUpload(uri);
            })
            .catch((e: unknown) => {
              setUploadingInvoice(false);
              const msg = e instanceof Error ? e.message : "Không mở được chọn ảnh";
              presentFeedbackError({ title: "Chọn ảnh thất bại", message: msg });
            });
        } else {
          const runNativeInvoicePicker = async () => {
            try {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) {
                setUploadingInvoice(false);
                Alert.alert("Cần quyền", "Vui lòng cho phép truy cập ảnh để upload hóa đơn thanh toán.");
                return;
              }

              const PICKER_TIMEOUT_MS = 120_000;
              const pick = await Promise.race([
                ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.9,
                }),
                new Promise<Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>>(
                  (_, reject) =>
                    setTimeout(() => reject(new Error("PICKER_TIMEOUT")), PICKER_TIMEOUT_MS)
                ),
              ]);

              if (pick.canceled || !pick.assets?.[0]?.uri) {
                setUploadingInvoice(false);
                return;
              }
              await finishUpload(pick.assets[0].uri);
            } catch (e: unknown) {
              setUploadingInvoice(false);
              const isTimeout = e instanceof Error && e.message === "PICKER_TIMEOUT";
              const msg = isTimeout
                ? "Thư viện ảnh không phản hồi (quá lâu). Hãy đóng và chọn “Đã thanh toán” lại."
                : e instanceof Error
                  ? e.message
                  : "Upload thất bại";
              presentFeedbackError({
                title: isTimeout ? "Hết thời gian chờ thư viện ảnh" : "Không lưu được hóa đơn",
                message: msg,
              });
            }
          };

          const delayMs = Platform.OS === "ios" ? 720 : 420;
          InteractionManager.runAfterInteractions(() => {
            setTimeout(() => {
              void runNativeInvoicePicker();
            }, delayMs);
          });
        }
        return false;
      }
      lastStablePaymentStatusRef.current = toFormPaymentStatus(newCode);
    },
    [hasInvoice, methods, orderDataForDisplay, orderId, queryClient]
  );

  const handlePickSampleSpecimenImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Cần quyền", "Vui lòng cho phép truy cập ảnh để tải ảnh mẫu xét nghiệm.");
        return;
      }
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (pick.canceled || !pick.assets?.[0]?.uri) return;
      setUploadingSampleImage(true);
      const res = await uploadImageToCloudinary(pick.assets[0].uri, { folder: "specimen-samples" });
      const url = res.secureUrl || res.url;
      if (!url) throw new Error("Không nhận được link sau khi upload");
      methods.setValue("step6.specifyVoteImagePath", url);
      presentFeedbackSuccess({ title: "Đã tải ảnh", message: "Ảnh mẫu xét nghiệm đã được lưu trên Cloudinary." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload thất bại";
      presentFeedbackError({ title: "Không tải được ảnh", message: msg });
    } finally {
      setUploadingSampleImage(false);
    }
  }, [methods]);

  const allBarcodes = (barcodesResponse as any)?.success ? (((barcodesResponse as any).data as BarcodeResponse[]) || []) : [];
  const genomeTests = useMemo((): GenomeTestResponse[] => {
    return genomeTestsResponse?.success
      ? ((genomeTestsResponse.data as GenomeTestResponse[]) || [])
      : EMPTY_GENOME_TESTS;
  }, [genomeTestsResponse]);
  const services = (servicesResponse as any)?.success ? (((servicesResponse as any).data as ServiceResponse[]) || []) : [];

  const serviceOptions = useMemo(
    () =>
      SERVICE_TYPE_OPTIONS.map((s) => ({
        value: s.value,
        label: s.label,
        serviceId: s.value,
        uniqueKey: `svc-${s.value}`,
      })),
    []
  );
  const orderDataForEdit = (orderResponse as any)?.data as OrderResponse | undefined;
  const serverServiceId = String(orderDataForEdit?.specifyId?.serviceID || "").trim();
  const serverGenomeTestId = String(orderDataForEdit?.specifyId?.genomeTestId || "").trim();
  const localServiceType = String(methods.watch("step5.serviceType") || "").trim();
  const localGenomeTestId = String(methods.watch("step3.genomeTestId") || "").trim();
  const canEditServiceType = true;
  const canEditGenomeTest = true;
  const allowEditServiceAndGenomeWhenMissing = canEditServiceType || canEditGenomeTest;
  const selectedServiceType = methods.watch("step5.serviceType");
  const selectedServiceTypeWatch = useWatch({ control: methods.control, name: "step5.serviceType" });
  const filteredGenomeTestsForService = useMemo(() => {
    const normalizeServiceType = (raw?: string | null): string => {
      const v = String(raw || "").trim().toLowerCase();
      if (!v) return "";
      if (v.includes("embryo") || v === "phôi" || v === "phoi") return "embryo";
      if (v.includes("disease") || v.includes("bệnh") || v.includes("benh")) return "disease";
      return "reproduction";
    };
    const selected = normalizeServiceType(selectedServiceType);
    if (!selected) return genomeTests;
    return genomeTests.filter((t) => normalizeServiceType(t.service?.name) === selected);
  }, [genomeTests, selectedServiceType]);
  const genomeTestOptions = useMemo(
    () =>
      filteredGenomeTestsForService.map((t) => ({
        value: t.testId,
        label: t.code ? `${t.code} - ${t.testName}` : `${t.testId} - ${t.testName}`,
      })),
    [filteredGenomeTestsForService]
  );

  const usedBarcodeIds = useMemo(() => {
    const used = new Set<string>();
    if ((ordersResponse as any)?.success && (ordersResponse as any).data) {
      ((ordersResponse as any).data as any[]).forEach((o) => {
        if (o.barcodeId && o.orderId !== orderId) used.add(String(o.barcodeId).trim());
      });
    }
    return used;
  }, [ordersResponse, orderId]);

  const availableBarcodes = useMemo(() => {
    const currentOrderBarcode = String(
      (orderResponse as any)?.data?.barcodeId ?? barcodeIdWatch ?? ""
    ).trim();
    return allBarcodes.filter((b) => {
      const barcode = String(b.barcode).trim();
      return !usedBarcodeIds.has(barcode) || barcode === currentOrderBarcode;
    });
  }, [allBarcodes, usedBarcodeIds, orderResponse, barcodeIdWatch]);

  const findServiceIdByType = useCallback(
    (type?: string) => {
      const normalizeText = (v: string) =>
        String(v || "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      const normalized = normalizeText(String(type || ""));
      if (!normalized) return undefined;

      const aliases: Record<string, string[]> = {
        embryo: ["embryo", "phoi", "phôi"],
        disease: ["disease", "benh", "bệnh", "benh ly", "bệnh lý"],
        reproduction: ["reproduction", "san", "sản", "san khoa", "sản khoa"],
      };
      const candidateKeys = aliases[normalized] || [normalized];

      const byAlias = services.find((s) => {
        const serviceName = normalizeText(String(s.name || ""));
        return candidateKeys.some((k) => serviceName === normalizeText(k) || serviceName.includes(normalizeText(k)));
      });
      if (byAlias?.serviceId) return byAlias.serviceId;

      const mappedServiceName = SERVICE_TYPE_MAPPER[normalized];
      const byMappedName = mappedServiceName
        ? services.find((s) => normalizeText(String(s.name || "")) === normalizeText(mappedServiceName))
        : undefined;
      if (byMappedName?.serviceId) return byMappedName.serviceId;

      return undefined;
    },
    [services]
  );
  useEffect(() => {
    if (!allowEditServiceAndGenomeWhenMissing) return;
    const selectedId = String(methods.getValues("step3.genomeTestId") || "").trim();
    if (!selectedId) return;
    const selectedTest = genomeTests.find((t) => t.testId === selectedId);
    if (!selectedTest) return;
    methods.setValue("step3.testName", selectedTest.testName || "");
    methods.setValue(
      "step3.testSample",
      Array.isArray(selectedTest.testSample) ? selectedTest.testSample.join(", ") : ""
    );
    methods.setValue("step3.testContent", selectedTest.testDescription || "");
  }, [allowEditServiceAndGenomeWhenMissing, genomeTests, methods, selectedServiceType]);
  useEffect(() => {
    if (!(orderResponse as any)?.success || !(orderResponse as any).data) return;
    const order: OrderResponse = (orderResponse as any).data;
    const hydrationKey = String(order.orderId || orderId || "").trim();
    if (!hydrationKey) return;
    if (hydratedOrderIdRef.current === hydrationKey) return;
    hydratedOrderIdRef.current = hydrationKey;

    const matchedCustomer = customers.find((c: any) => c.customerId === order.customerId);
    const customerUserId = (matchedCustomer as any)?.userId || (matchedCustomer as any)?.user?.userId || "";
    methods.setValue("step1.orderName", order.orderName || "");
    methods.setValue("step1.doctorId", order.specifyId?.doctorId || "");
    methods.setValue("step1.customerId", customerUserId || "");
    methods.setValue("step1.staffId", order.staffId || "");
    methods.setValue("step1.staffAnalystId", order.staffAnalystId || "");
    methods.setValue("step1.sampleCollectorId", order.sampleCollectorId || "");
    methods.setValue("step1.barcodeId", order.barcodeId || "");
    methods.setValue("step1.orderStatus", (order.orderStatus as OrderStatus) || ORDER_STATUS_DEFAULT);
    const normalizedPay = toFormPaymentStatus(order.paymentStatus);
    methods.setValue("step1.paymentStatus", normalizedPay);
    lastStablePaymentStatusRef.current = normalizedPay;
    if (order.invoiceLink) setInvoiceLinkOverride(String(order.invoiceLink));
    else setInvoiceLinkOverride(null);
    methods.setValue("step6.paymentAmount", "");
    methods.setValue("step6.paymentType", (order.paymentType as any) || "CASH");
    methods.setValue("step6.samplingSite", order.specifyId?.samplingSite || "");
    methods.setValue("step6.sampleCollectDate", formatDateInput(order.specifyId?.sampleCollectDate));
    methods.setValue("step6.embryoNumber", order.specifyId?.embryoNumber?.toString() || "");
    methods.setValue("step6.specifyVoteImagePath", order.specifyVoteImagePath || "");
    methods.setValue("step7.geneticTestResults", order.specifyId?.geneticTestResults || "");
    methods.setValue("step7.geneticTestResultsRelationship", order.specifyId?.geneticTestResultsRelationship || "");
    methods.setValue("step7.orderNote", order.orderNote || "");

    const specify = order.specifyId;
    const nestedClinical = specify?.patientClinical;
    if (nestedClinical) {
      const s4 = patientClinicalToStep4(nestedClinical);
      (Object.keys(s4) as (keyof typeof s4)[]).forEach((k) => {
        methods.setValue(`step4.${k}`, s4[k]);
      });
    } else if (specify?.patientId) {
      const emptyStep4 = createOrderDefaultValues.step4;
      (Object.keys(emptyStep4) as (keyof typeof emptyStep4)[]).forEach((k) => {
        methods.setValue(`step4.${k}`, emptyStep4[k] ?? "");
      });
      const capturedOrderId = order.orderId;
      patientClinicalService.getByPatientId(specify.patientId).then((res) => {
        if (capturedOrderId !== orderId) return;
        if (res.success && res.data) {
          const s4 = patientClinicalToStep4(res.data as any);
          (Object.keys(s4) as (keyof typeof s4)[]).forEach((k) => {
            methods.setValue(`step4.${k}`, s4[k]);
          });
        } else {
          const empty = createOrderDefaultValues.step4;
          (Object.keys(empty) as (keyof typeof empty)[]).forEach((k) => {
            methods.setValue(`step4.${k}`, empty[k] ?? "");
          });
        }
      });
    } else {
      const empty = createOrderDefaultValues.step4;
      (Object.keys(empty) as (keyof typeof empty)[]).forEach((k) => {
        methods.setValue(`step4.${k}`, empty[k] ?? "");
      });
    }

    if (order.specifyId?.genomeTestId) {
      const test = genomeTests.find((t: any) => t.testId === order.specifyId?.genomeTestId);
      if (test) {
        methods.setValue("step3.genomeTestId", test.testId || "");
        methods.setValue("step3.testName", test.testName || "");
        methods.setValue("step3.testSample", Array.isArray(test.testSample) ? test.testSample.join(", ") : test.testSample || "");
        methods.setValue("step3.testContent", test.testDescription || "");

        if (test?.service?.name) {
          const serviceName = String(test.service.name).toLowerCase();
          if (serviceName.includes("embryo") || serviceName === "embryo") methods.setValue("step5.serviceType", "embryo");
          else if (serviceName.includes("disease") || serviceName === "disease") methods.setValue("step5.serviceType", "disease");
          else methods.setValue("step5.serviceType", "reproduction");
        }
      }
    }

    if (order.specifyId?.patientId) {
      patientService.getById(order.specifyId.patientId).then((patientResponse) => {
        if (patientResponse.success && patientResponse.data) {
          const p = patientResponse.data as any;
          methods.setValue("step2.patientName", p.patientName || "");
          methods.setValue("step2.patientPhone", p.patientPhone || "");
          methods.setValue("step2.patientDob", formatDateInput(p.patientDob));
          methods.setValue("step2.patientGender", p.gender || "");
          methods.setValue("step2.patientEmail", p.patientEmail || "");
          methods.setValue("step2.patientJob", p.patientJob || "");
          methods.setValue("step2.patientContactName", p.patientContactName || "");
          methods.setValue("step2.patientContactPhone", p.patientContactPhone || "");
          methods.setValue("step2.patientAddress", p.patientAddress || "");
          methods.setValue("step2.patientId", p.patientId);
        }
      });
    }
    // methods (useForm) không đưa vào deps — setValue đã ổn định; thêm methods dễ gây vòng lặp với một số bản RHF.
  }, [orderResponse, customers, genomeTests, orderId]);

  const validateStep1 = async () => {
    const fields: ("step1.orderName" | "step6.paymentType" | "step1.doctorId")[] = [
      "step1.orderName",
      "step6.paymentType",
    ];
    if (EDITABLE.step1.doctorId) fields.push("step1.doctorId");
    const ok = await methods.trigger(fields);
    if (!ok) {
      Alert.alert(
        "Lỗi",
        EDITABLE.step1.doctorId
          ? "Vui lòng kiểm tra tên đơn, bác sĩ chỉ định và hình thức thanh toán"
          : "Vui lòng kiểm tra tên đơn hàng và hình thức thanh toán"
      );
      return false;
    }
    if (EDITABLE.step1.doctorId && !String(methods.getValues("step1.doctorId") ?? "").trim()) {
      Alert.alert("Lỗi", "Vui lòng chọn bác sĩ chỉ định.");
      return false;
    }
    const currentOrderData = (orderResponse as any)?.data as OrderResponse | undefined;
    if (!currentOrderData) return true;
    const prevOs = (currentOrderData.orderStatus || "").toLowerCase();
    const step1 = methods.getValues("step1");
    const targetOs = isApprovalFlow
      ? "accepted"
      : (currentOrderData.orderStatus || "").toLowerCase();

    if ((prevOs === "forward_analysis" || prevOs === "sample_addition" || prevOs === "initiation") && targetOs === "accepted") {
      if (!step1.staffAnalystId?.trim() || !step1.sampleCollectorId?.trim() || !step1.barcodeId?.trim()) {
        Alert.alert(
          "Thiếu thông tin",
          "Vui lòng chọn nhân viên phụ trách, nhân viên thu mẫu và mã barcode trước khi tiếp tục."
        );
        return false;
      }
      if (!staffAnalystOptions.some((s) => s.staffId === step1.staffAnalystId?.trim())) {
        Alert.alert(
          "Không hợp lệ",
          "Nhân viên phụ trách phải là bác sĩ thuộc HT Genetic (vị trí DOCTOR, cơ sở HTG)."
        );
        return false;
      }
      if (!sampleCollectorOptions.some((s) => s.staffId === step1.sampleCollectorId?.trim())) {
        Alert.alert(
          "Không hợp lệ",
          "Nhân viên thu mẫu phải có vị trí kỹ thuật viên lab (LAB_TECHNICIAN)."
        );
        return false;
      }
    }
    if (
      prevOs === "initiation" &&
      (currentOrderData.paymentType || "").toUpperCase() === "CASH" &&
      targetOs === "forward_analysis"
    ) {
      if (!step1.staffAnalystId?.trim() || !step1.sampleCollectorId?.trim()) {
        Alert.alert("Thiếu thông tin", "Vui lòng chọn nhân viên phụ trách và nhân viên thu mẫu.");
        return false;
      }
      if (!staffAnalystOptions.some((s) => s.staffId === step1.staffAnalystId?.trim())) {
        Alert.alert(
          "Không hợp lệ",
          "Nhân viên phụ trách phải là bác sĩ thuộc HT Genetic (vị trí DOCTOR, cơ sở HTG)."
        );
        return false;
      }
      if (!sampleCollectorOptions.some((s) => s.staffId === step1.sampleCollectorId?.trim())) {
        Alert.alert(
          "Không hợp lệ",
          "Nhân viên thu mẫu phải có vị trí kỹ thuật viên lab (LAB_TECHNICIAN)."
        );
        return false;
      }
    }
    return true;
  };
  const validateStep2 = async () => {
    if (!canEditStep2Patient) return true;
    const patientPhone = normalizeVnMobileDigits(methods.getValues("step2.patientPhone") || "");
    const patientName = String(methods.getValues("step2.patientName") || "").trim();
    const patientDob = String(methods.getValues("step2.patientDob") || "").trim();
    const patientGender = String(methods.getValues("step2.patientGender") || "").trim();
    const patientEmail = String(methods.getValues("step2.patientEmail") || "").trim();
    const contactName = String(methods.getValues("step2.patientContactName") || "").trim();
    const contactPhone = normalizeVnMobileDigits(methods.getValues("step2.patientContactPhone") || "");
    const patientAddress = String(methods.getValues("step2.patientAddress") || "").trim();

    if (!/^0[35789]\d{8}$/.test(patientPhone)) {
      Alert.alert("Thiếu thông tin", "Số điện thoại bệnh nhân không hợp lệ (đầu số 03/05/07/08/09, đủ 10 số).");
      return false;
    }
    if (!patientName) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập họ tên bệnh nhân.");
      return false;
    }
    if (!patientDob) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập ngày sinh bệnh nhân.");
      return false;
    }
    if (!patientGender) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn giới tính bệnh nhân.");
      return false;
    }
    if (patientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
      Alert.alert("Thiếu thông tin", "Email bệnh nhân không đúng định dạng.");
      return false;
    }
    if (!contactName) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên người liên hệ.");
      return false;
    }
    if (contactPhone && !/^0[35789]\d{8}$/.test(contactPhone)) {
      Alert.alert("Thiếu thông tin", "SĐT người liên hệ không hợp lệ.");
      return false;
    }
    if (!patientAddress) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập địa chỉ bệnh nhân.");
      return false;
    }
    return true;
  };
  const validateStep6 = async () => {
    const ok = await methods.trigger("step6.paymentType");
    if (!ok) Alert.alert("Lỗi", "Vui lòng chọn hình thức thanh toán");
    return ok;
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((p) => p - 1);
    else router.back();
  };

  const handleNext = async () => {
    let ok = true;
    if (currentStep === 1) ok = await validateStep1();
    if (currentStep === 2) ok = await validateStep2();
    if (currentStep === 6 && EDITABLE.step6.paymentType) ok = await validateStep6();
    if (!ok) return;

    if (currentStep === TOTAL_STEPS) {
      await handleSubmit();
      return;
    }
    setCurrentStep((p) => p + 1);
  };
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const formData = methods.getValues();
      // Always re-read latest server state before approving/updating to avoid stale-step bypass.
      const latestOrderRes = await orderService.getById(orderId!);
      const currentOrderData =
        latestOrderRes?.success && (latestOrderRes as any)?.data
          ? ((latestOrderRes as any).data as OrderResponse)
          : ((orderResponse as any)?.data as OrderResponse | undefined);
      if (!currentOrderData) throw new Error("Không tải được dữ liệu đơn hàng");

      if (isPendingApprovalListEntry) {
        const allowed = canRunStaffApprovalWizardForOrder(currentOrderData, user?.role);
        if (!allowed) {
          throw new Error(
            "Đơn hàng không còn ở trạng thái chờ phê duyệt. Vui lòng tải lại danh sách trước khi thao tác."
          );
        }
      }

      const payStSubmit = String(formData.step1.paymentStatus || "").toUpperCase();
      if (payStSubmit === "COMPLETED") {
        if (
          !orderHasSpecifyAndPatientForInvoice(currentOrderData, {
            name: formData.step2.patientName,
            phone: formData.step2.patientPhone,
          })
        ) {
          throw new Error(
            "Đã thanh toán / hóa đơn: đơn cần có phiếu xét nghiệm và họ tên, SĐT bệnh nhân trước khi lưu."
          );
        }
        const effectiveInvoice =
          invoiceLinkOverride ??
          (typeof currentOrderData.invoiceLink === "string" ? currentOrderData.invoiceLink : null);
        if (!hasUsableInvoiceLink(effectiveInvoice)) {
          throw new Error("Đã thanh toán: vui lòng upload ảnh hóa đơn thanh toán trước khi lưu.");
        }
      }

      const prevStatus = (currentOrderData.orderStatus || "").toLowerCase();
      const targetFromForm = isApprovalFlow
        ? "accepted"
        : (currentOrderData.orderStatus || "").toLowerCase();
      if (
        (prevStatus === "forward_analysis" || prevStatus === "sample_addition" || prevStatus === "initiation") &&
        targetFromForm === "accepted"
      ) {
        const s1 = formData.step1;
        if (!s1.staffAnalystId?.trim() || !s1.sampleCollectorId?.trim() || !s1.barcodeId?.trim()) {
          throw new Error(
            "Vui lòng chọn nhân viên phụ trách, nhân viên thu mẫu và mã barcode trước khi hoàn tất."
          );
        }
        if (!staffAnalystOptions.some((s) => s.staffId === s1.staffAnalystId?.trim())) {
          throw new Error(
            "Nhân viên phụ trách phải là bác sĩ thuộc HT Genetic (DOCTOR, cơ sở HTG)."
          );
        }
        if (!sampleCollectorOptions.some((s) => s.staffId === s1.sampleCollectorId?.trim())) {
          throw new Error("Nhân viên thu mẫu phải là kỹ thuật viên lab (LAB_TECHNICIAN).");
        }
      }
      if (
        prevStatus === "initiation" &&
        (currentOrderData.paymentType || "").toUpperCase() === "CASH" &&
        targetFromForm === "forward_analysis"
      ) {
        const s1 = formData.step1;
        if (!s1.staffAnalystId?.trim() || !s1.sampleCollectorId?.trim()) {
          throw new Error("Vui lòng chọn nhân viên phụ trách và nhân viên thu mẫu.");
        }
        if (!staffAnalystOptions.some((s) => s.staffId === s1.staffAnalystId?.trim())) {
          throw new Error(
            "Nhân viên phụ trách phải là bác sĩ thuộc HT Genetic (DOCTOR, cơ sở HTG)."
          );
        }
        if (!sampleCollectorOptions.some((s) => s.staffId === s1.sampleCollectorId?.trim())) {
          throw new Error("Nhân viên thu mẫu phải là kỹ thuật viên lab (LAB_TECHNICIAN).");
        }
      }

      const specifyVoteID =
        currentOrderData?.specifyId?.specifyVoteID ||
        (currentOrderData?.specifyId as { specifyVoteId?: string })?.specifyVoteId;
      if (!specifyVoteID) throw new Error("Đơn hàng chưa có specifyVoteID");
      const lockedServiceType = methods.getValues("step5.serviceType");
      const serviceIdFromType = findServiceIdByType(lockedServiceType);

      const patientId = currentOrderData.specifyId?.patientId;
      const selectedGenomeTestId = String(methods.getValues("step3.genomeTestId") || "").trim();
      const genomeTestId = selectedGenomeTestId || currentOrderData.specifyId?.genomeTestId;
      const selectedGenomeTest = genomeTests.find((t) => String(t.testId) === String(genomeTestId || ""));
      const serviceIdFromGenome = selectedGenomeTest?.service?.serviceId;
      const serviceId = serviceIdFromGenome || serviceIdFromType || currentOrderData.specifyId?.serviceID;
      if (!patientId) throw new Error("Không tìm thấy patientId");

      const submitPaymentStatus = String(
        (EDITABLE.step1.paymentStatus
          ? formData.step1.paymentStatus
          : currentOrderData.paymentStatus) || "UNPAID"
      ).toUpperCase();
      const isPaymentCompletedOnSubmit = submitPaymentStatus === "COMPLETED";
      const orderReq: any = {
        orderName: formData.step1.orderName.trim(),
      };

      const doctorIdFromOrder = currentOrderData.specifyId?.doctorId?.trim() || "";
      const formDoctorId = formData.step1.doctorId?.trim() || "";
      const doctorRowForHospital = formDoctorId
        ? doctors.find((d) => String(d.doctorId).trim() === formDoctorId)
        : undefined;
      if (EDITABLE.step1.doctorId) {
        orderReq.doctorId = formDoctorId || undefined;
      } else if (doctorIdFromOrder) {
        orderReq.doctorId = doctorIdFromOrder;
      }
      if (EDITABLE.step1.customerId) orderReq.customerId = formData.step1.customerId?.trim() || undefined;
      if (EDITABLE.step1.staffId) orderReq.staffId = formData.step1.staffId?.trim() || undefined;
      if (EDITABLE.step1.sampleCollectorId) orderReq.sampleCollectorId = formData.step1.sampleCollectorId?.trim() || undefined;
      if (EDITABLE.step1.staffAnalystId) orderReq.staffAnalystId = formData.step1.staffAnalystId?.trim() || undefined;
      const prevServerBarcode = String(currentOrderData.barcodeId ?? "").trim();
      if (EDITABLE.step1.barcodeId && !prevServerBarcode) {
        orderReq.barcodeId = formData.step1.barcodeId?.trim() || undefined;
      }
      if (
        isApprovalFlow &&
        (prevStatus === "forward_analysis" || prevStatus === "sample_addition")
      ) {
        orderReq.orderStatus = OrderStatusEnum.ACCEPTED;
      } else {
        orderReq.orderStatus = (currentOrderData.orderStatus || ORDER_STATUS_DEFAULT) as any;
      }
      if (EDITABLE.step6.paymentType) orderReq.paymentType = (formData.step6.paymentType || currentOrderData.paymentType || "CASH") as any;
      if (EDITABLE.step6.specifyVoteImagePath)
        orderReq.specifyVoteImagePath = formData.step6.specifyVoteImagePath?.trim() || undefined;
      if (EDITABLE.step7.orderNote) orderReq.orderNote = formData.step7.orderNote?.trim() || undefined;
      orderReq.specifyId = specifyVoteID;
      if (EDITABLE.step1.paymentStatus) {
        orderReq.paymentStatus = (formData.step1.paymentStatus || currentOrderData.paymentStatus || "UNPAID") as any;
      } else {
        orderReq.paymentStatus = (currentOrderData.paymentStatus || "UNPAID") as any;
      }
      orderReq.invoiceLink =
        (invoiceLinkOverride ?? currentOrderData.invoiceLink) || undefined;
      const specifyReq: any = {
        serviceId,
        patientId,
        genomeTestId,
        hospitalId:
          EDITABLE.step1.doctorId && doctorRowForHospital?.hospitalId
            ? doctorRowForHospital.hospitalId
            : currentOrderData.specifyId?.hospitalId || undefined,
        sendEmailPatient: false,
      };
      if (EDITABLE.step1.doctorId) {
        specifyReq.doctorId = formDoctorId || undefined;
      } else if (doctorIdFromOrder) {
        specifyReq.doctorId = doctorIdFromOrder;
      }
      if (EDITABLE.step6.samplingSite) specifyReq.samplingSite = formData.step6.samplingSite?.trim() || undefined;
      if (EDITABLE.step6.sampleCollectDate)
        specifyReq.sampleCollectDate = formData.step6.sampleCollectDate?.trim()
          ? new Date(formData.step6.sampleCollectDate.trim()).toISOString()
          : undefined;
      if (EDITABLE.step6.embryoNumber)
        specifyReq.embryoNumber = formData.step6.embryoNumber?.trim() ? Number(formData.step6.embryoNumber) : undefined;
      if (EDITABLE.step7.geneticTestResults) specifyReq.geneticTestResults = formData.step7.geneticTestResults?.trim() || undefined;
      if (EDITABLE.step7.geneticTestResultsRelationship)
        specifyReq.geneticTestResultsRelationship = formData.step7.geneticTestResultsRelationship?.trim() || undefined;

      const normalizeMaybe = (v: unknown) => String(v ?? "").trim();
      const currentSpecify = currentOrderData.specifyId;
      const nextServiceId = normalizeMaybe(serviceId);
      const prevServiceId = normalizeMaybe(currentSpecify?.serviceID);
      const nextGenomeTestId = normalizeMaybe(genomeTestId);
      const prevGenomeTestId = normalizeMaybe(currentSpecify?.genomeTestId);
      const shouldUpdateSpecify =
        nextServiceId !== prevServiceId ||
        nextGenomeTestId !== prevGenomeTestId ||
        normalizeMaybe(formData.step6.samplingSite) !== normalizeMaybe(currentSpecify?.samplingSite) ||
        normalizeMaybe(formData.step6.sampleCollectDate) !==
        normalizeMaybe(formatDateInput(currentSpecify?.sampleCollectDate)) ||
        normalizeMaybe(formData.step6.embryoNumber) !== normalizeMaybe(currentSpecify?.embryoNumber) ||
        normalizeMaybe(formData.step7.geneticTestResults) !==
        normalizeMaybe(currentSpecify?.geneticTestResults) ||
        normalizeMaybe(formData.step7.geneticTestResultsRelationship) !==
        normalizeMaybe(currentSpecify?.geneticTestResultsRelationship);
      // Ưu tiên serviceId mới từ genome/serviceType; chỉ fallback cũ khi không resolve được.
      specifyReq.serviceId = serviceId || currentOrderData.specifyId?.serviceID;
      specifyReq.genomeTestId = genomeTestId || currentOrderData.specifyId?.genomeTestId;

      const orderUpdateRes = await orderService.update(orderId!, orderReq);
      if (!orderUpdateRes?.success) throw new Error(orderUpdateRes?.error || orderUpdateRes?.message || "Cập nhật đơn hàng thất bại");

      // Avoid full specify update when user only updates payment/invoice.
      // Some backend implementations may recompute specify status on full updates.
      if (shouldUpdateSpecify) {
        const specifyUpdateRes = await specifyVoteTestService.update(specifyVoteID, specifyReq);
        if (!specifyUpdateRes?.success) throw new Error(specifyUpdateRes?.error || specifyUpdateRes?.message || "Cập nhật phiếu chỉ định thất bại");
      }
      if (orderReq.barcodeId) {
        try {
          await barcodeService.update(orderReq.barcodeId, { status: BarcodeStatus.NOT_PRINTED });
        } catch { }
      }

      const orderStatusString = typeof orderReq.orderStatus === "string" ? orderReq.orderStatus : String(orderReq.orderStatus);
      const newStatus = String(orderStatusString || "").toLowerCase();
      const staffHospitalId =
        user?.hospitalId != null && user.hospitalId !== "" ? String(user.hospitalId) : null;
      let ensureMetadataResult: { createdLabRows: number; linkedOrders: number } = {
        createdLabRows: 0,
        linkedOrders: 0,
      };

      if (!isApprovalFlow && prevStatus !== newStatus) {
        if (newStatus === OrderStatusEnum.FORWARD_ANALYSIS && specifyVoteID) {
          try {
            await specifyVoteTestService.updateStatus(specifyVoteID, SpecifyStatus.FORWARD_ANALYSIS);
          } catch { }
        }
        if (newStatus === OrderStatusEnum.ACCEPTED && specifyVoteID) {
          try {
            await specifyVoteTestService.updateStatus(specifyVoteID, "accepted");
          } catch { }
        }
      }

      if (
        isApprovalFlow &&
        (prevStatus === "forward_analysis" || prevStatus === "sample_addition") &&
        newStatus === "accepted" &&
        specifyVoteID
      ) {
        try {
          await specifyVoteTestService.updateStatus(specifyVoteID, "accepted");
        } catch { }
      }

      // Với đơn tạo nhanh đã ở trạng thái accepted, vẫn cần tạo metadata khi đã cập nhật đủ dữ liệu.
      // Chạy best-effort sau khi update order/specify thành công, không phụ thuộc đổi trạng thái.
      if (specifyVoteID && staffHospitalId) {
        try {
          ensureMetadataResult = await ensureSinglePaidOrderPatientMetadataLikeWeb(orderId!, staffHospitalId);
        } catch {
          ensureMetadataResult = { createdLabRows: 0, linkedOrders: 0 };
        }
      }

      let patientMetadataToUpdate = currentOrderData.patientMetadata || [];
      const metadataStatusOnApprove = "sample_waiting_analyze";
      if (prevStatus !== "accepted" && newStatus === "accepted" && isPaymentCompletedOnSubmit) {
        if (ensureMetadataResult.createdLabRows > 0 || ensureMetadataResult.linkedOrders > 0) {
          const refreshedOrderRes = await orderService.getById(orderId!);
          if (refreshedOrderRes?.success && (refreshedOrderRes as any).data) {
            patientMetadataToUpdate = (((refreshedOrderRes as any).data as OrderResponse).patientMetadata || []);
          }
        }
        if (patientMetadataToUpdate.length === 0 && specifyVoteID) {
          try {
            const bySpecifyRes = await patientMetadataService.getBySpecifyId(specifyVoteID);
            const existingBySpecify =
              bySpecifyRes.success && Array.isArray(bySpecifyRes.data) ? bySpecifyRes.data : [];
            if (existingBySpecify.length === 0) {
              const specifyRes = await specifyVoteTestService.getById(specifyVoteID);
              if (specifyRes.success && specifyRes.data) {
                const spec = specifyRes.data as any;
                const patient = spec.patient || {};
                const gt = spec.genomeTest || {};
                const sampleNames: string[] = Array.isArray(gt.testSample)
                  ? gt.testSample.map((x: any) => String(x || "").trim()).filter(Boolean)
                  : [];
                const finalSampleNames =
                  sampleNames.length > 0
                    ? sampleNames
                    : [String(gt.testName || "Mẫu xét nghiệm").trim() || "Mẫu xét nghiệm"];
                for (const sampleName of finalSampleNames) {
                  await patientMetadataService.create({
                    specifyId: specifyVoteID,
                    patientId:
                      patient.patientId ||
                      currentOrderData.specifyId?.patientId ||
                      undefined,
                    patientName: patient.patientName || undefined,
                    sampleName,
                  });
                }
              }
            }
            const refreshedBySpecifyRes = await patientMetadataService.getBySpecifyId(specifyVoteID);
            const refreshedBySpecify =
              refreshedBySpecifyRes.success && Array.isArray(refreshedBySpecifyRes.data)
                ? refreshedBySpecifyRes.data
                : [];
            if (refreshedBySpecify.length > 0) {
              patientMetadataToUpdate = refreshedBySpecify as any;
            }
          } catch { }
        }
        for (const pm of patientMetadataToUpdate) {
          if (pm.labcode) await patientMetadataService.updateStatus(pm.labcode, metadataStatusOnApprove).catch(() => { });
        }
      }
      if (isApprovalFlow && specifyVoteID && isPaymentCompletedOnSubmit) {
        try {
          await specifyVoteTestService.updateStatus(specifyVoteID, "accepted");
          const bySpecifyRes = await patientMetadataService.getBySpecifyId(specifyVoteID);
          const bySpecify =
            bySpecifyRes.success && Array.isArray(bySpecifyRes.data) ? bySpecifyRes.data : [];
          for (const pm of bySpecify) {
            if (pm.labcode) await patientMetadataService.updateStatus(pm.labcode, metadataStatusOnApprove).catch(() => { });
          }
        } catch { }
      }
      if (!isApprovalFlow && isPaymentCompletedOnSubmit && specifyVoteID) {
        try {
          await specifyVoteTestService.updateStatus(specifyVoteID, "accepted");
          const bySpecifyRes = await patientMetadataService.getBySpecifyId(specifyVoteID);
          const bySpecify =
            bySpecifyRes.success && Array.isArray(bySpecifyRes.data) ? bySpecifyRes.data : [];
          for (const pm of bySpecify) {
            if (pm.labcode) await patientMetadataService.updateStatus(pm.labcode, "accepted").catch(() => { });
          }
        } catch { }
      }

      if (
        prevStatus === "initiation" &&
        newStatus === "forward_analysis" &&
        (currentOrderData.paymentType || "").toUpperCase() === "CASH"
      ) {
        for (const pm of currentOrderData.patientMetadata || []) {
          if (pm.labcode) await patientMetadataService.updateStatus(pm.labcode, "sample_run").catch(() => { });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-pending"] });
      queryClient.invalidateQueries({ queryKey: ["specify-vote-tests"] });
      if (prevStatus !== "accepted" && newStatus === "accepted") {
        queryClient.invalidateQueries({ queryKey: ["patient-metadatas"] });
      }
      if (prevStatus === "initiation" && newStatus === "forward_analysis") {
        queryClient.invalidateQueries({ queryKey: ["patient-metadatas"] });
      }

      setShowSuccessModal(true);
    } catch (error: any) {
      Alert.alert(
        isPendingApprovalListEntry ? "Lỗi phê duyệt" : "Lỗi cập nhật",
        error?.message ||
        (isPendingApprovalListEntry
          ? "Không thể phê duyệt đơn. Vui lòng thử lại."
          : "Không thể cập nhật. Vui lòng thử lại.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveNow = async () => {
    if (isSubmitting) return;
    const ok = await validateStep1();
    if (!ok) return;
    await handleSubmit();
  };

  const renderStep1 = () => (
    <View className="bg-white rounded-3xl border border-slate-200 p-4">
      <LockedField locked={!EDITABLE.step1.orderName}>
        <FormInput name="step1.orderName" label="Tên đơn hàng" required placeholder="Nhập tên đơn hàng" />
      </LockedField>

      <View className="mb-5 rounded-2xl border border-slate-100 bg-slate-50/90 p-4">
        <Text className="mb-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Theo phiếu chỉ định
        </Text>
        <LockedField locked={!EDITABLE.step1.doctorId}>
          <FormSelect
            name="step1.doctorId"
            label="Bác sĩ chỉ định"
            required
            options={doctors}
            getLabel={(d: DoctorResponse) => d.doctorName || d.doctorId}
            getValue={(d: DoctorResponse) => d.doctorId}
            placeholder="Chọn bác sĩ"
            modalTitle="Chọn bác sĩ chỉ định"
            searchable
          />
        </LockedField>
        {hasDoctorSelected ? (
          <FormReadOnly label="Phòng khám / BV" value={clinicLineLabel} containerClassName="!mt-3 !mb-0" />
        ) : null}
        <FormInfoBox containerClassName="!mt-3 mb-0">
          Chọn bác sĩ chỉ định để xem phòng khám / bệnh viện gắn với bác sĩ. Có thể đổi bác sĩ khi cần.
        </FormInfoBox>
      </View>

      <LockedField locked={!EDITABLE.step1.staffId}>
        <FormSelect
          name="step1.staffId"
          label="Người thu tiền"
          options={staffListForCashier}
          getLabel={(s: any) =>
            `${s.staffName} — ${getStaffPositionDisplayName(s.staffPosition)}`
          }
          getValue={(s: any) => s.staffId}
          placeholder="Lựa chọn"
          modalTitle="Chọn người thu tiền"
        />
      </LockedField>

      <LockedField locked={!EDITABLE.step1.staffAnalystId}>
        <FormSelect
          name="step1.staffAnalystId"
          label="Nhân viên phụ trách"
          options={staffAnalystOptions}
          getLabel={(s: any) =>
            `${s.staffName} — ${getStaffPositionDisplayName(s.staffPosition)}`
          }
          getValue={(s: any) => s.staffId}
          placeholder="Lựa chọn"
          modalTitle="Chọn nhân viên phụ trách (bác sĩ HTG)"
        />
      </LockedField>

      <LockedField locked={!EDITABLE.step1.sampleCollectorId}>
        <FormSelect
          name="step1.sampleCollectorId"
          label="Nhân viên thu mẫu"
          options={sampleCollectorOptions}
          getLabel={(s: any) =>
            `${s.staffName} — ${getStaffPositionDisplayName(s.staffPosition)}`
          }
          getValue={(s: any) => s.staffId}
          placeholder="Lựa chọn"
          modalTitle="Chọn nhân viên thu mẫu (LAB_TECHNICIAN)"
        />
      </LockedField>

      <LockedField locked={barcodeSelectionLocked}>
        <FormSelect
          name="step1.barcodeId"
          label="Mã Barcode PCĐ"
          options={availableBarcodes}
          getLabel={(b: any) => b.barcode}
          getValue={(b: any) => b.barcode}
          placeholder="Lựa chọn"
          disabled={barcodeSelectionLocked}
          modalTitle={`Chọn mã Barcode PCĐ (${availableBarcodes.length} mã có sẵn)`}
        />
      </LockedField>

      {paymentPaidUiLocked ? (
        <FormFieldGroup>
          <FormReadOnly
            label="Hình thức thanh toán"
            value={labelForPaymentType(methods.watch("step6.paymentType"))}
          />
          <FormReadOnly
            label="Trạng thái thanh toán"
            value={labelForPaymentStatus(methods.watch("step1.paymentStatus"))}
          />
        </FormFieldGroup>
      ) : (
        <FormFieldGroup>
          <LockedField locked={!EDITABLE.step6.paymentType}>
            <FormSelect
              name="step6.paymentType"
              label="Hình thức thanh toán"
              required
              options={PAYMENT_TYPE_OPTIONS}
              getLabel={(o: any) => o.label}
              getValue={(o: any) => o.value}
              placeholder="Tiền mặt"
              modalTitle="Chọn hình thức thanh toán"
            />
          </LockedField>

          <LockedField
            locked={
              !EDITABLE.step1.paymentStatus ||
              (isApprovalFlow && serverPaymentCompleted && hasInvoice)
            }
          >
            <FormSelect
              name="step1.paymentStatus"
              label="Trạng thái thanh toán"
              options={paymentStatusSelectOptions}
              getLabel={(opt: any) => opt.label}
              getValue={(opt: any) => opt.value}
              placeholder="Chọn trạng thái"
              modalTitle="Chọn trạng thái thanh toán"
              disabled={uploadingInvoice}
              onValueChange={handlePaymentStatusChange}
            />
          </LockedField>
        </FormFieldGroup>
      )}

      {hasInvoice ? (
        <TouchableOpacity
          className="mb-4 py-3 px-4 rounded-2xl bg-sky-50 border border-sky-200 active:bg-sky-100"
          onPress={() => setInvoiceModalOpen(true)}
          activeOpacity={0.85}
        >
          <Text className="text-[13px] font-extrabold text-sky-800 text-center">
            Xem hoá đơn thanh toán
          </Text>
        </TouchableOpacity>
      ) : null}

      {uploadingInvoice ? (
        <View className="mb-4 flex-row items-center gap-2 px-1">
          <ActivityIndicator size="small" color="#0891B2" />
          <Text className="text-xs font-bold text-slate-600">
            Đang mở thư viện ảnh / tải hóa đơn…
          </Text>
        </View>
      ) : null}

      {!paymentPaidUiLocked ? (
        <FormInfoBox containerClassName="!mt-4 mb-0">
          Chọn &quot;Đã thanh toán&quot; sẽ mở thư viện ảnh để upload hóa đơn (bắt buộc khi chưa có hóa đơn).
          {!invoicePrerequisitesOk ? (
            <>
              {" "}
              Hiện đơn chưa có đủ phiếu xét nghiệm hoặc họ tên/SĐT bệnh nhân — không thể chọn &quot;Đã thanh toán&quot;
              cho đến khi bổ sung (giống web).
            </>
          ) : null}
        </FormInfoBox>
      ) : null}
    </View>
  );

  const renderStep2 = () => (
    <View className="bg-white rounded-3xl border border-slate-200 p-4">
      <FormInfoBox containerClassName="!mt-0 mb-4">
        {canEditStep2Patient
          ? "Đơn chưa có dữ liệu bệnh nhân: nhập mới hoặc chọn nhanh theo số điện thoại."
          : "Thông tin người làm xét nghiệm (chỉ xem)."}
      </FormInfoBox>

      {canEditStep2Patient ? (
        <>
          <View className="mb-4">
            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
              Số điện thoại <Text className="text-red-500">*</Text>
            </Text>
            <Controller
              control={methods.control}
              name="step2.patientPhone"
              render={({ field: { onChange, value } }) => (
                <View>
                  <View className="bg-white rounded-2xl border border-slate-200 flex-row items-center overflow-hidden">
                    <Text className="pl-4 pr-1 text-[14px] font-bold text-slate-600">+84</Text>
                    <TextInput
                      value={phoneSuffixForDisplay(String(value || ""))}
                      onChangeText={(v) => {
                        const rawDigits = v.replace(/\D/g, "");
                        const stored = storedFromSuffixInput(rawDigits);
                        onChange(stored);
                        methods.setValue("step2.patientId", "");
                        setShowPatientPhoneDropdown(true);
                      }}
                      onFocus={() => {
                        if (patientPhoneBlurTimerRef.current) clearTimeout(patientPhoneBlurTimerRef.current);
                        setShowPatientPhoneDropdown(true);
                      }}
                      onBlur={() => {
                        patientPhoneBlurTimerRef.current = setTimeout(
                          () => setShowPatientPhoneDropdown(false),
                          300
                        );
                      }}
                      placeholder="912345678"
                      keyboardType="phone-pad"
                      maxLength={9}
                      className="flex-1 py-3.5 pr-4 text-[14px] font-bold text-slate-800"
                    />
                  </View>
                  <Text className="text-[11px] text-slate-500 mt-1">
                    Nhập 9 số sau +84. Ví dụ: +84 912345678.
                  </Text>
                  {showPatientPhoneDropdown ? (
                    <View
                      className="mt-2 rounded-2xl border border-slate-200 bg-white overflow-hidden"
                      style={{ maxHeight: SCREEN_HEIGHT * 0.45 }}
                    >
                      <ScrollView keyboardShouldPersistTaps="handled">
                        {patientPhoneSearchTerm.length < MIN_PHONE_SEARCH_LENGTH &&
                          patientPhoneSearchTerm.length > 0 ? (
                          <Text className="p-3 text-slate-500">Nhập thêm số để tìm bệnh nhân</Text>
                        ) : null}
                        {isSearchingPatients ? (
                          <View className="p-4 items-center">
                            <ActivityIndicator />
                          </View>
                        ) : null}
                        {patientPhoneSearchTerm.length >= MIN_PHONE_SEARCH_LENGTH && !isSearchingPatients
                          ? patientSearchResults.map((p: any) => (
                            <TouchableOpacity
                              key={String(p.patientId || p.id || p.patientPhone)}
                              onPress={() => {
                                if (patientPhoneBlurTimerRef.current) clearTimeout(patientPhoneBlurTimerRef.current);
                                methods.setValue("step2.patientId", String(p.patientId || ""));
                                methods.setValue("step2.patientPhone", normalizeVnMobileDigits(p.patientPhone || ""));
                                methods.setValue("step2.patientName", String(p.patientName || ""));
                                methods.setValue("step2.patientDob", formatDateInput(p.patientDob));
                                methods.setValue(
                                  "step2.patientGender",
                                  (String(p.gender || "") as "male" | "female" | "other" | "")
                                );
                                methods.setValue("step2.patientEmail", String(p.patientEmail || ""));
                                methods.setValue("step2.patientJob", String(p.patientJob || ""));
                                methods.setValue("step2.patientContactName", String(p.patientContactName || ""));
                                methods.setValue("step2.patientContactPhone", String(p.patientContactPhone || ""));
                                methods.setValue("step2.patientAddress", String(p.patientAddress || ""));
                                setShowPatientPhoneDropdown(false);
                                Keyboard.dismiss();
                              }}
                              className="p-3 border-b border-slate-100"
                            >
                              <Text className="font-semibold text-slate-800">{String(p.patientName || "—")}</Text>
                              <Text className="text-xs text-slate-500">{String(p.patientPhone || "")}</Text>
                            </TouchableOpacity>
                          ))
                          : null}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>
              )}
            />
          </View>
          <FormInput name="step2.patientName" label="Họ tên" required placeholder="Nhập họ tên" />
          <FormFieldGroup>
            <FormInput name="step2.patientDob" label="Ngày sinh" required placeholder="YYYY-MM-DD" />
            <FormSelect
              name="step2.patientGender"
              label="Giới tính"
              required
              options={[
                { value: "male", label: "Nam" },
                { value: "female", label: "Nữ" },
                { value: "other", label: "Khác" },
              ]}
              getLabel={(o: any) => o.label}
              getValue={(o: any) => o.value}
              placeholder="Chọn giới tính"
              modalTitle="Chọn giới tính"
            />
          </FormFieldGroup>
          <FormInput
            name="step2.patientEmail"
            label="Email"
            placeholder="Nhập email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FormFieldGroup>
            <FormInput name="step2.patientContactName" label="Người liên hệ" required placeholder="Nhập tên liên hệ" />
            <FormInput
              name="step2.patientContactPhone"
              label="SĐT liên hệ"
              placeholder="Nhập số điện thoại"
              keyboardType="phone-pad"
              formatter={(v) => v.replace(/\D/g, "")}
            />
          </FormFieldGroup>
          <FormInput name="step2.patientAddress" label="Địa chỉ" required placeholder="Nhập địa chỉ" />
        </>
      ) : (
        <>
          <FormReadOnly label="Tên người làm xét nghiệm" value={methods.watch("step2.patientName") || ""} />
          <FormFieldGroup>
            <FormReadOnly label="Số điện thoại" value={methods.watch("step2.patientPhone") || ""} />
            <FormReadOnly label="Giới tính" value={methods.watch("step2.patientGender") || ""} />
          </FormFieldGroup>

          <FormFieldGroup>
            <FormReadOnly label="Ngày sinh" value={methods.watch("step2.patientDob") || ""} />
            <FormReadOnly label="Email" value={methods.watch("step2.patientEmail") || ""} />
          </FormFieldGroup>

          <FormReadOnly label="Địa chỉ" value={methods.watch("step2.patientAddress") || ""} />
        </>
      )}
    </View>
  );

  const renderGenomeTestStep = () => (
    <View className="bg-white rounded-3xl border border-slate-200 p-4">
      <FormInfoBox containerClassName="!mt-0 mb-4">
        Có thể chọn lại mã phiếu xét nghiệm khi cần hoàn thiện đơn.
      </FormInfoBox>

      {canEditGenomeTest ? (
        <View className="mb-4">
          <Text className="text-[13px] font-bold text-slate-800 mb-2">Mã phiếu xét nghiệm</Text>
          <View className="max-h-56 rounded-2xl border border-slate-200 bg-white">
            <ScrollView nestedScrollEnabled>
              {genomeTestOptions.length === 0 ? (
                <Text className="px-4 py-3 text-[13px] font-semibold text-slate-400">
                  Chưa có danh sách mã xét nghiệm phù hợp với nhóm đã chọn.
                </Text>
              ) : (
                genomeTestOptions.map((o) => {
                  const isSelected =
                    String(methods.watch("step3.genomeTestId") || "") === String(o.value);
                  return (
                    <TouchableOpacity
                      key={o.value}
                      className={`px-4 py-3 border-b border-slate-100 ${isSelected ? "bg-cyan-50" : "bg-white"}`}
                      activeOpacity={0.85}
                      onPress={() => methods.setValue("step3.genomeTestId", String(o.value))}
                    >
                      <Text className={`text-[13px] font-semibold ${isSelected ? "text-cyan-700" : "text-slate-700"}`}>
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      ) : null}
      <FormReadOnly label="Tên xét nghiệm" value={methods.watch("step3.testName") || ""} />
      <FormReadOnly label="Mẫu xét nghiệm" value={methods.watch("step3.testSample") || ""} />
      <FormReadOnly label="Nội dung xét nghiệm" value={methods.watch("step3.testContent") || ""} />
    </View>
  );

  const renderStep4 = () => (
    <View className="bg-white rounded-3xl border border-slate-200 p-4">
      <FormInfoBox containerClassName="!mt-0 mb-4">Thông tin lâm sàng (chỉ xem).</FormInfoBox>

      <FormReadOnly label="Chiều cao (cm)" value={methods.watch("step4.patientHeight")?.toString?.() || ""} />
      <FormReadOnly label="Cân nặng (kg)" value={methods.watch("step4.patientWeight")?.toString?.() || ""} />
      <FormReadOnly label="Tiền sử bệnh nhân" value={methods.watch("step4.patientHistory") || ""} />
      <FormReadOnly label="Tiền sử gia đình" value={methods.watch("step4.familyHistory") || ""} />
      <FormReadOnly label="Tiếp xúc độc tố" value={methods.watch("step4.toxicExposure") || ""} />
      <FormReadOnly label="Tiền sử y tế" value={methods.watch("step4.medicalHistory") || ""} />
      <FormReadOnly label="Bệnh mãn tính" value={methods.watch("step4.chronicDisease") || ""} />
      <FormReadOnly label="Bệnh cấp tính" value={methods.watch("step4.acuteDisease") || ""} />
      <FormReadOnly label="Thuốc đang sử dụng" value={methods.watch("step4.medicalUsing") || ""} />
    </View>
  );

  const renderServiceGroupStep = () => {
    const selectedValue = String(selectedServiceTypeWatch || "").toLowerCase();
    const selectedLabel =
      serviceOptions.find((s) => String(s.value).toLowerCase() === selectedValue)?.label || "";

    return (
      <View className="bg-white rounded-3xl border border-slate-200 p-4">
        <FormInfoBox containerClassName="!mt-0 mb-4">
          Chọn nhóm xét nghiệm để lọc danh sách mã phiếu ở bước tiếp theo.
        </FormInfoBox>
        <View className="mb-2">
          <Text className="text-[13px] font-extrabold text-slate-700 mb-2">Nhóm xét nghiệm</Text>
          <View className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setServiceDropdownOpen((prev) => !prev)}
              className="px-4 py-3 flex-row items-center justify-between"
            >
              <Text className={`text-[13px] font-bold ${selectedLabel ? "text-slate-800" : "text-slate-400"}`}>
                {selectedLabel || "Chọn nhóm dịch vụ"}
              </Text>
              {serviceDropdownOpen ? (
                <ChevronUp size={18} color="#64748B" />
              ) : (
                <ChevronDown size={18} color="#64748B" />
              )}
            </TouchableOpacity>

            {serviceDropdownOpen ? (
              <View className="border-t border-slate-100">
                {serviceOptions.map((s, idx) => {
                  const optionValue = String(s.value).toLowerCase();
                  const isSelected = selectedValue === optionValue;
                  const isLast = idx === serviceOptions.length - 1;
                  return (
                    <TouchableOpacity
                      key={s.uniqueKey}
                      activeOpacity={0.85}
                      onPress={() => {
                        methods.setValue(
                          "step5.serviceType",
                          optionValue as "embryo" | "disease" | "reproduction",
                          { shouldDirty: true, shouldTouch: true, shouldValidate: false }
                        );
                        setServiceDropdownOpen(false);
                      }}
                      className={`px-4 py-3 flex-row items-center justify-between ${isSelected ? "bg-cyan-50" : "bg-white"
                        } ${!isLast ? "border-b border-slate-100" : ""}`}
                    >
                      <Text className={`text-[13px] font-bold ${isSelected ? "text-cyan-700" : "text-slate-700"}`}>
                        {s.label}
                      </Text>
                      {isSelected ? <Check size={16} color="#0E7490" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const renderStep6 = () => {
    const sampleImgUrl = methods.watch("step6.specifyVoteImagePath");
    return (
      <View className="bg-white rounded-3xl border border-slate-200 p-4">
        <FormInfoBox containerClassName="!mt-0 mb-4">
          Số tiền và hình thức thanh toán đã nhập ở bước 1.
        </FormInfoBox>

        <LockedField locked={!EDITABLE.step6.samplingSite}>
          <FormInput name="step6.samplingSite" label="Địa điểm lấy mẫu" placeholder="Nhập địa điểm lấy mẫu" />
        </LockedField>

        <FormFieldGroup>
          <LockedField locked={!EDITABLE.step6.sampleCollectDate}>
            <FormInput name="step6.sampleCollectDate" label="Ngày lấy mẫu" placeholder="YYYY-MM-DD" />
          </LockedField>

          <LockedField locked={!EDITABLE.step6.embryoNumber}>
            <FormNumericInput name="step6.embryoNumber" label="Số phôi (nếu có)" type="integer" placeholder="VD: 2" />
          </LockedField>
        </FormFieldGroup>

        <LockedField locked={!EDITABLE.step6.specifyVoteImagePath}>
          <View className="mb-1">
            <Text className="text-[13px] font-bold text-slate-800 mb-2">Ảnh mẫu xét nghiệm</Text>
            <Text className="text-[11px] font-semibold text-slate-500 mb-3">
              Tải ảnh từ thư viện — lưu trên Cloudinary và gắn vào đơn.
            </Text>
            <TouchableOpacity
              className="py-3 px-4 rounded-2xl bg-emerald-50 border border-emerald-200 active:bg-emerald-100"
              onPress={handlePickSampleSpecimenImage}
              disabled={uploadingSampleImage}
              activeOpacity={0.85}
            >
              {uploadingSampleImage ? (
                <ActivityIndicator color="#059669" />
              ) : (
                <Text className="text-[13px] font-extrabold text-emerald-800 text-center">
                  Chọn ảnh mẫu xét nghiệm
                </Text>
              )}
            </TouchableOpacity>
            {sampleImgUrl ? (
              <View className="mt-4">
                <Image
                  source={{ uri: String(sampleImgUrl) }}
                  style={{ width: "100%", height: 200, borderRadius: 16 }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  className="mt-2 py-2"
                  onPress={() => methods.setValue("step6.specifyVoteImagePath", "")}
                  activeOpacity={0.8}
                >
                  <Text className="text-xs font-bold text-rose-600 text-center">Xóa ảnh</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </LockedField>
      </View>
    );
  };

  const renderStep7 = () => (
    <View className="bg-white rounded-3xl border border-slate-200 p-4">
      <FormInfoBox containerClassName="!mt-0 mb-4">
        Cập nhật kết quả xét nghiệm di truyền (nếu được phép).
      </FormInfoBox>

      <LockedField locked={!EDITABLE.step7.geneticTestResults}>
        <FormTextarea
          name="step7.geneticTestResults"
          label="Kết quả xét nghiệm di truyền"
          placeholder="Nhập kết quả"
          minHeight={120}
        />
      </LockedField>

      <LockedField locked={!EDITABLE.step7.geneticTestResultsRelationship}>
        <FormInput name="step7.geneticTestResultsRelationship" label="Mối quan hệ" placeholder="Nhập mối quan hệ" />
      </LockedField>

      <View className="h-px bg-slate-100 my-5" />

      <LockedField locked={!EDITABLE.step7.orderNote}>
        <FormTextarea
          name="step7.orderNote"
          label="Ghi chú đơn hàng"
          placeholder="Nhập ghi chú cho đơn hàng (nếu có)"
          minHeight={120}
          maxLength={500}
        />
      </LockedField>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderServiceGroupStep();
      case 4:
        return renderStep4();
      case 5:
        return renderGenomeTestStep();
      case 6:
        return renderStep6();
      case 7:
        return renderStep7();
      default:
        return renderStep1();
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
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" />

        <View className="pb-4 px-5 bg-white border-b border-slate-200">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={handleBack}
              className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-100 items-center justify-center"
              activeOpacity={0.75}
              disabled={isSubmitting}
            >
              <ArrowLeft size={22} color="#0891B2" strokeWidth={2.5} />
            </TouchableOpacity>


            {showHeaderExit ? (
              <TouchableOpacity
                onPress={() => router.back()}
                className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200"
                activeOpacity={0.75}
                disabled={isSubmitting}
              >
                <Text className="text-sm font-extrabold text-slate-700">Thoát</Text>
              </TouchableOpacity>
            ) : (
              <View className="w-11 h-11" />
            )}
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

          <Stepper totalSteps={TOTAL_STEPS} currentStep={currentStep} onStepPress={(s) => setCurrentStep(s)} />
          {isPendingApprovalListEntry && currentStep === 1 && (
            <View className="mt-4 rounded-2xl border border-cyan-200/90 bg-cyan-50/95 px-4 py-3">
              <Text className="text-[13px] font-semibold text-cyan-900 leading-[1.45]">
                Bạn có thể nhấn &quot;Phê duyệt ngay&quot; ở dưới để hoàn tất mà không cần xem các bước còn lại.
              </Text>
            </View>
          )}
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 140 + insets.bottom,
          }}
        >
          {renderCurrentStep()}
        </ScrollView>

        <View
          pointerEvents="box-none"
          style={{
            position: isWeb ? ("fixed" as any) : "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderTopWidth: 1,
              borderTopColor: "#E2E8F0",
              padding: 16,
              paddingBottom: Math.max(16, insets.bottom),
              flexDirection: isPendingApprovalListEntry && currentStep === 1 ? "column" : "row",
              gap: 12,
            }}
          >
            {isPendingApprovalListEntry && currentStep === 1 ? (
              <TouchableOpacity
                style={{
                  height: 48,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSubmitting ? "#34D399" : "#059669",
                }}
                onPress={handleApproveNow}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                <Text style={{ fontSize: 15, fontWeight: "800", color: "white" }}>
                  Phê duyệt ngay (bỏ qua các bước)
                </Text>
              </TouchableOpacity>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                gap: 12,
                flex: isPendingApprovalListEntry && currentStep === 1 ? undefined : 1,
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "white",
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                }}
                onPress={handleBack}
                activeOpacity={0.8}
                disabled={isSubmitting}
              >
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#334155" }}>
                  {currentStep === 1 ? "Huỷ" : "Quay lại"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSubmitting ? "#22D3EE" : "#0891B2",
                }}
                onPress={handleNext}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "white" }}>
                    {currentStep === TOTAL_STEPS
                      ? isPendingApprovalListEntry
                        ? "Phê duyệt đơn hàng"
                        : "Cập nhật đơn hàng"
                      : "Tiếp theo"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Modal
          visible={showSuccessModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowSuccessModal(false);
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
                  {isPendingApprovalListEntry ? "Phê duyệt thành công" : "Cập nhật thành công"}
                </Text>
                <Text className="mt-2 text-[12px] font-bold text-slate-500 text-center leading-5">
                  {isPendingApprovalListEntry
                    ? "Đơn hàng đã được phê duyệt. Bạn có thể xem trong danh sách đơn hàng."
                    : "Đơn hàng đã được cập nhật. Bạn có thể xem trong danh sách đơn hàng."}
                </Text>
              </View>
              <View className="flex-row p-4 gap-3 border-t border-slate-200 bg-slate-50">
                <TouchableOpacity
                  className="flex-1 h-12 rounded-2xl items-center justify-center bg-white border border-slate-200"
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.push("/staff/orders");
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

        <InvoiceModal
          visible={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          invoiceLink={displayInvoiceLink ? String(displayInvoiceLink) : null}
          orderId={orderId ?? ""}
        />
      </SafeAreaView>
    </FormProvider>
  );
}

