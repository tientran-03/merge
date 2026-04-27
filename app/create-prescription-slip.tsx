import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Image,
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

import {
  FormDatePicker,
  FormFieldGroup,
  FormInfoBox,
  FormInput,
  FormNumericInput,
  FormSelect,
  FormTextarea,
} from "@/components/form";
import { useAuth } from "@/contexts/AuthContext";
import { setListFreshOnNextFocus } from "@/lib/list-navigation-flags";
import { GENDER_OPTIONS, SERVICE_TYPE_MAPPER } from "@/lib/schemas/order-schemas";
import { getApiResponseData } from "@/lib/types/api-types";
import {
  getProvinceSelectOptions,
  loadWardSelectOptions,
  mergeWardSelectOptions,
  parseStoredPatientAddress,
  resolveProvinceIndexKey,
  resolveWardValueFromParsed,
  type AddressSelectOption
} from "@/lib/vn-address";
import { diseaseService } from "@/services/diseaseService";
import { doctorService } from "@/services/doctorService";
import { embryoService } from "@/services/embryoService";
import { genomeTestService } from "@/services/genomeTestService";
import {
  patientClinicalService,
  type PatientClinicalResponse,
} from "@/services/patientClinicalService";
import { patientService, type PatientResponse } from "@/services/patientService";
import { reproductionService } from "@/services/reproductionService";
import { ServiceResponse, serviceService } from "@/services/serviceService";
import { SpecifyVoteTestRequest, specifyVoteTestService } from "@/services/specifyVoteTestService";
import { uploadImageToCloudinary } from "@/utils/cloudinary";

/** Bước 2 tạo phiếu — chỉ Nam / Nữ (không « Khác »). */
const PRESCRIPTION_SLIP_GENDER_OPTIONS = GENDER_OPTIONS.filter((o) => o.value !== "other");

const normalizeGenderForPrescriptionSlip = (raw?: string): "male" | "female" | "" => {
  const g = String(raw || "").toLowerCase();
  if (g === "male" || g === "female") return g;
  return "";
};

const VN_PHONE_REGEX = /^0\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DMY_DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;
const MAX_NAME_LENGTH = 120;
const MAX_JOB_LENGTH = 120;
const MAX_ADDRESS_PART_LENGTH = 160;
const MAX_ADDRESS_WARD_VALUE_LENGTH = 200;
const MAX_ADDRESS_DETAIL_LENGTH = 255;
const MAX_TEXTAREA_LENGTH = 2000;
const MAX_NOTE_LENGTH = 1000;
const MAX_TEST_NAME_LENGTH = 180;
const MAX_TEST_SAMPLE_LENGTH = 255;
const MAX_TEST_DESC_LENGTH = 1000;
const MAX_SAMPLING_SITE_LENGTH = 160;

const parseFlexibleDate = (raw?: string): Date | null => {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (ISO_DATE_REGEX.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) return d;
    return null;
  }
  if (DMY_DATE_REGEX.test(value)) {
    const [day, month, year] = value.split("/").map(Number);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) return d;
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isNonEmpty = (value?: string) => String(value || "").trim().length > 0;
const requiredTrimmedString = (message: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(max, `Tối đa ${max} ký tự`);
const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự`)
    .optional()
    .or(z.literal(""));

const toNumeric = (raw?: string) => {
  const value = String(raw || "").trim().replace(",", ".");
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};
const SPECIFY_FORM_STEPS = [
  "Chọn nhóm dịch vụ",
  "Thông tin người làm xét nghiệm",
  "Thông tin xét nghiệm",
  "Thông tin lâm sàng",
  "Thông tin nhóm xét nghiệm",
  "Ghi chú",
] as const;

const SPECIFY_FORM_STEP_COUNT = SPECIFY_FORM_STEPS.length;

const formatPhoneInput = (raw: string) => raw.replace(/[^\d]/g, "").slice(0, 10);


const formatPatientNameInput = (raw: string) => raw.replace(/\d/g, "");


const EMBRYO_CREATE_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
] as const;

const YES_NO_OPTIONS = [
  { value: "NO", label: "Không" },
  { value: "YES", label: "Có" },
] as const;

const normalizeServiceType = (value?: string): "reproduction" | "embryo" | "disease" | "" => {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "";
  if (v.includes("reproduction") || v.includes("sản") || v.includes("san")) return "reproduction";
  if (v.includes("embryo") || v.includes("phôi") || v.includes("phoi")) return "embryo";
  if (v.includes("disease") || v.includes("bệnh lý") || v.includes("benh ly")) return "disease";
  return "";
};

const formSchema = z
  .object({
    serviceType: z.enum(["reproduction", "embryo", "disease"], {
      required_error: "Vui lòng chọn nhóm dịch vụ",
    }),
    sendEmailPatient: z.enum(["NO", "YES"]).default("NO"),

    patientPhone: z
      .string()
      .transform((v) => v.replace(/[^\d]/g, "").trim())
      .refine((v) => VN_PHONE_REGEX.test(v), "Số điện thoại phải đủ 10 số và bắt đầu bằng 0"),
    patientName: requiredTrimmedString("Vui lòng nhập họ tên", MAX_NAME_LENGTH).refine(
      (v) => !/\d/.test(v),
      "Họ tên không được chứa số"
    ),
    patientDob: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => !!v, "Vui lòng nhập ngày sinh")
      .refine(
        (v) => !!parseFlexibleDate(v),
        "Ngày sinh phải đúng định dạng dd/MM/yyyy hoặc yyyy-MM-dd"
      )
      .refine((v) => {
        const d = parseFlexibleDate(v);
        return d ? d.getTime() <= Date.now() : false;
      }, "Ngày sinh không được lớn hơn ngày hiện tại"),
    patientGender: z.enum(["male", "female", ""], {
      required_error: "Vui lòng chọn giới tính",
    }),
    patientEmail: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => !v || EMAIL_REGEX.test(v), "Email không đúng định dạng")
      .optional()
      .or(z.literal("")),
    patientJob: optionalTrimmedString(MAX_JOB_LENGTH),
    patientContactName: requiredTrimmedString("Vui lòng nhập người liên hệ", MAX_NAME_LENGTH).refine(
      (v) => !/^\d+$/.test(v),
      "Tên người liên hệ không được chỉ gồm số"
    ),
    patientContactPhone: z
      .string()
      .transform((v) => v.replace(/[^\d]/g, "").trim())
      .refine((v) => VN_PHONE_REGEX.test(v), "SĐT liên hệ phải đủ 10 số và bắt đầu bằng 0"),
    patientAddress: requiredTrimmedString("Vui lòng nhập địa chỉ bệnh nhân", MAX_ADDRESS_DETAIL_LENGTH),
    patientAddressProvince: optionalTrimmedString(MAX_ADDRESS_PART_LENGTH),
    patientAddressWard: optionalTrimmedString(MAX_ADDRESS_WARD_VALUE_LENGTH),
    patientAddressDetail: optionalTrimmedString(MAX_ADDRESS_DETAIL_LENGTH),

    genomeTestId: requiredTrimmedString("Vui lòng chọn mã xét nghiệm", 100),
    testName: requiredTrimmedString("Vui lòng nhập tên xét nghiệm", MAX_TEST_NAME_LENGTH),
    testDescription: optionalTrimmedString(MAX_TEST_DESC_LENGTH),
    testSample: requiredTrimmedString("Vui lòng nhập mẫu xét nghiệm", MAX_TEST_SAMPLE_LENGTH),
    serviceId: z.string().trim().optional().or(z.literal("")),
    patientId: z.string().trim().optional().or(z.literal("")),
    embryoNumber: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => {
        if (!v) return true;
        const n = toNumeric(v);
        return n !== null && Number.isInteger(n) && n >= 1 && n <= 3;
      }, "Số phôi tạo chọn 1, 2 hoặc 3")
      .optional()
      .or(z.literal("")),
    doctorId: requiredTrimmedString("Vui lòng chọn bác sĩ chỉ định", 100),
    samplingSite: requiredTrimmedString("Vui lòng nhập nơi thu mẫu", MAX_SAMPLING_SITE_LENGTH),
    sampleCollectDate: z.string().transform((v) => String(v ?? "").trim()),

    patientHeight: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => {
        if (!v) return true;
        const n = toNumeric(v);
        return n !== null && n >= 0 && n <= 200;
      }, "Chiều cao phải từ 0 đến 200 cm")
      .optional()
      .or(z.literal("")),
    patientHistory: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    medicalHistory: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    acuteDisease: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    medicalUsing: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    patientWeight: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => {
        if (!v) return true;
        const n = toNumeric(v);
        return n !== null && n >= 0 && n <= 100;
      }, "Cân nặng phải từ 0 đến 100 kg")
      .optional()
      .or(z.literal("")),
    familyHistory: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    chronicDisease: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    toxicExposure: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    geneticTestResults: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    geneticTestResultsRelationship: optionalTrimmedString(MAX_TEXTAREA_LENGTH),

    fetusesNumber: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => {
        if (!v) return true;
        const n = toNumeric(v);
        return n !== null && Number.isInteger(n) && n >= 1 && n <= 3;
      }, "Số thai chỉ được chọn từ 1 đến 3")
      .optional()
      .or(z.literal("")),
    fetusesWeek: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => {
        if (!v) return true;
        const n = toNumeric(v);
        return n !== null && Number.isInteger(n) && n >= 0 && n <= 40;
      }, "Tuần thai từ 0 đến 40 (không quá 40 tuần)")
      .optional()
      .or(z.literal("")),
    fetusesDay: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => {
        if (!v) return true;
        const n = toNumeric(v);
        return n !== null && Number.isInteger(n) && n >= 0 && n <= 30;
      }, "Ngày thai từ 0 đến 30 (không quá 30 ngày)")
      .optional()
      .or(z.literal("")),
    /** Ngày siêu âm: không bắt buộc, không chặn định dạng/ngày (theo yêu cầu bỏ validate chọn ngày). */
    ultrasoundDay: z.string().transform((v) => String(v ?? "").trim()).optional().or(z.literal("")),
    headRumpLength: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => {
        if (!v) return true;
        const n = toNumeric(v);
        return n !== null && n >= 0 && n <= 100;
      }, "Chiều dài đầu mông (CRL) phải từ 0 đến 100 mm")
      .optional()
      .or(z.literal("")),
    neckLength: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => {
        if (!v) return true;
        const n = toNumeric(v);
        return n !== null && n >= 0 && n <= 5;
      }, "Độ mờ da gáy phải từ 0 đến 5 mm")
      .optional()
      .or(z.literal("")),
    combinedTestResult: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    ultrasoundResult: optionalTrimmedString(MAX_TEXTAREA_LENGTH),

    embryoBiospy: optionalTrimmedString(255),
    /** Ngày sinh thiết: tùy chọn, không validate định dạng/ngày trên schema. */
    embryoBiospyDate: z.string().transform((v) => String(v ?? "").trim()).optional().or(z.literal("")),
    embryoCellContainingSolution: optionalTrimmedString(255),
    embryoStatus: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    embryoMorphologicalAssessment: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    embryoCellNucleus: z.enum(["YES", "NO"]).default("NO"),
    embryoNegativeControl: optionalTrimmedString(255),

    diseaseSymptom: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    diseaseDiagnose: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    diseaseDiagnoseImage: optionalTrimmedString(2000),
    diseaseTestRelated: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    diseaseTreatmentMethods: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    diseaseTreatmentTimeDay: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => {
        if (!v) return true;
        const n = toNumeric(v);
        return n !== null && Number.isInteger(n) && n >= 0;
      }, "Thời gian điều trị (ngày) phải là số nguyên ≥ 0")
      .optional()
      .or(z.literal("")),
    diseaseDrugResistance: optionalTrimmedString(MAX_TEXTAREA_LENGTH),
    diseaseRelapse: optionalTrimmedString(MAX_TEXTAREA_LENGTH),

    specifyNote: optionalTrimmedString(MAX_NOTE_LENGTH),
  })
  .superRefine((data, ctx) => {
    if (!data.patientGender) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng chọn giới tính",
        path: ["patientGender"],
      });
    }

    const clinicalRequired: Array<{
      field:
      | "patientHeight"
      | "patientWeight"
      | "patientHistory"
      | "acuteDisease"
      | "medicalUsing";
      message: string;
    }> = [
        { field: "patientHeight", message: "Vui lòng nhập chiều cao bệnh nhân" },
        { field: "patientWeight", message: "Vui lòng nhập cân nặng bệnh nhân" },
        { field: "patientHistory", message: "Vui lòng nhập tiền sử bệnh nhân" },
        { field: "acuteDisease", message: "Vui lòng nhập bệnh lý cấp tính" },
        { field: "medicalUsing", message: "Vui lòng nhập thuốc đang dùng" },
      ];
    clinicalRequired.forEach(({ field, message }) => {
      if (!isNonEmpty(String(data[field] || ""))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
          path: [field],
        });
      }
    });

    const clinicalStep4Extended: Array<{
      field:
      | "medicalHistory"
      | "familyHistory"
      | "chronicDisease"
      | "toxicExposure";
      message: string;
    }> = [
        { field: "medicalHistory", message: "Vui lòng nhập tiền sử bệnh" },
        { field: "familyHistory", message: "Vui lòng nhập tiền sử gia đình" },
        { field: "chronicDisease", message: "Vui lòng nhập bệnh lý mãn tính" },
        { field: "toxicExposure", message: "Vui lòng nhập tiếp xúc độc hại" },
      ];
    clinicalStep4Extended.forEach(({ field, message }) => {
      if (!isNonEmpty(String(data[field] || ""))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
          path: [field],
        });
      }
    });

    if (data.serviceType === "reproduction") {
      const reproductionRequired: Array<{
        field:
        | "fetusesNumber"
        | "fetusesWeek"
        | "fetusesDay"
        | "headRumpLength"
        | "neckLength"
        | "combinedTestResult"
        | "ultrasoundResult";
        message: string;
      }> = [
          { field: "fetusesNumber", message: "Vui lòng chọn số thai (1–3)" },
          { field: "fetusesWeek", message: "Vui lòng nhập tuần thai" },
          { field: "fetusesDay", message: "Vui lòng nhập ngày thai" },
          { field: "headRumpLength", message: "Vui lòng nhập chiều dài đầu mông (CRL)" },
          { field: "neckLength", message: "Vui lòng nhập độ mờ da gáy" },
          { field: "combinedTestResult", message: "Vui lòng nhập kết quả combined test" },
          { field: "ultrasoundResult", message: "Vui lòng nhập kết quả siêu âm" },
        ];

      reproductionRequired.forEach(({ field, message }) => {
        if (!isNonEmpty(String(data[field] || ""))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message,
            path: [field],
          });
        }
      });
    }

    const embRaw = String(data.embryoNumber || "").trim();
    if (!isNonEmpty(embRaw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng chọn số lượng phôi (1–3)",
        path: ["embryoNumber"],
      });
    } else {
      const n = toNumeric(embRaw);
      if (n === null || !Number.isInteger(n) || n < 1 || n > 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Số lượng phôi phải là 1, 2 hoặc 3",
          path: ["embryoNumber"],
        });
      }
    }
  });

type FormData = z.infer<typeof formSchema>;

const defaultValues: FormData = {
  serviceType: "reproduction",
  sendEmailPatient: "NO",

  patientPhone: "",
  patientName: "",
  patientDob: "",
  patientGender: "",
  patientEmail: "",
  patientJob: "",
  patientContactName: "",
  patientContactPhone: "",
  patientAddress: "",
  patientAddressProvince: "",
  patientAddressWard: "",
  patientAddressDetail: "",

  genomeTestId: "",
  testName: "",
  testDescription: "",
  testSample: "",
  serviceId: "",
  patientId: "",
  embryoNumber: "",
  doctorId: "",
  samplingSite: "",
  sampleCollectDate: "",

  patientHeight: "",
  patientHistory: "",
  medicalHistory: "",
  acuteDisease: "",
  medicalUsing: "",
  patientWeight: "",
  familyHistory: "",
  chronicDisease: "",
  toxicExposure: "",
  geneticTestResults: "",
  geneticTestResultsRelationship: "",

  fetusesNumber: "",
  fetusesWeek: "",
  fetusesDay: "",
  ultrasoundDay: "",
  headRumpLength: "",
  neckLength: "",
  combinedTestResult: "",
  ultrasoundResult: "",

  embryoBiospy: "",
  embryoBiospyDate: "",
  embryoCellContainingSolution: "",
  embryoStatus: "",
  embryoMorphologicalAssessment: "",
  embryoCellNucleus: "NO",
  embryoNegativeControl: "",

  diseaseSymptom: "",
  diseaseDiagnose: "",
  diseaseDiagnoseImage: "",
  diseaseTestRelated: "",
  diseaseTreatmentMethods: "",
  diseaseTreatmentTimeDay: "",
  diseaseDrugResistance: "",
  diseaseRelapse: "",

  specifyNote: "",
};

const parseDateToISO = (raw?: string) => {
  const d = parseFlexibleDate(raw);
  return d ? d.toISOString() : undefined;
};

const formatDateForInput = (raw?: string) => {
  const d = parseFlexibleDate(raw);
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const toNumber = (v?: string) => {
  if (!v) return undefined;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

const toInt = (v?: string) => {
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
};

/** Giống web specify-new: mã bệnh nhân dạng PAT-... */
const generatePatientId = () =>
  `PAT-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

export default function CreatePrescriptionSlipScreen() {
  const router = useRouter();
  const { source, specifyVoteID, quick } = useLocalSearchParams<{
    source?: string;
    specifyVoteID?: string | string[];
    quick?: string;
  }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const routeSpecifyVoteId = useMemo(() => {
    const raw = specifyVoteID;
    if (raw == null || raw === "") return "";
    const s = Array.isArray(raw) ? raw[0] : raw;
    return String(s ?? "").trim();
  }, [specifyVoteID]);
  const isEditMode = !!routeSpecifyVoteId;
  const isQuickMode = !isEditMode && (quick === "1" || quick === "true" || quick === "quick");
  const isStepFormMode = !isQuickMode;
  const targetRoute = source === "admin" ? "/admin/specifies" : "/prescription-slips";
  const hydratedRef = useRef(false);
  const lastAutofilledGenomeTestIdRef = useRef("");
  const lastPatientLookupPhoneRef = useRef("");
  const prevHadValidPatientPhoneRef = useRef(false);
  const prevDoctorIdForPatientScopeRef = useRef<string | undefined>(undefined);
  const prevQuickDoctorIdRef = useRef("");
  const [isAutoFillingPatient, setIsAutoFillingPatient] = useState(false);
  const [uploadingDiseaseDiagnoseImage, setUploadingDiseaseDiagnoseImage] = useState(false);
  const [currentFormStep, setCurrentFormStep] = useState(1);
  const [showPatientPhoneSuggestions, setShowPatientPhoneSuggestions] = useState(false);

  const methods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    shouldUnregister: false,
    defaultValues,
  });

  const { data: servicesResponse } = useQuery({
    queryKey: ["services"],
    queryFn: () => serviceService.getAll(),
  });
  const { data: genomeTestsResponse } = useQuery({
    queryKey: ["genome-tests"],
    queryFn: () => genomeTestService.getAll(),
  });
  const { data: doctorsResponse } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => doctorService.getAll(),
  });
  const { data: specifyDetailResponse, isFetching: specifyDetailFetching } = useQuery({
    queryKey: ["specify-vote-test", routeSpecifyVoteId],
    queryFn: () => specifyVoteTestService.getById(routeSpecifyVoteId!),
    enabled: isEditMode && !!routeSpecifyVoteId,
  });

  useEffect(() => {
    if (!isEditMode || !routeSpecifyVoteId) return;
    hydratedRef.current = false;
  }, [routeSpecifyVoteId, isEditMode]);

  const services = getApiResponseData<ServiceResponse>(servicesResponse) || [];
  const genomeTests = getApiResponseData(genomeTestsResponse) || [];
  const doctors = getApiResponseData(doctorsResponse) || [];

  const watchedDoctorId = methods.watch("doctorId");
  const doctorHospitalIdQuick = useMemo(() => {
    const d = doctors.find((x: any) => x.doctorId === watchedDoctorId);
    return String(d?.hospitalId ?? "").trim();
  }, [doctors, watchedDoctorId]);

  const { data: patientsByHospitalResponse } = useQuery({
    queryKey: ["patients", "hospital", doctorHospitalIdQuick],
    queryFn: () => patientService.getByHospitalId(doctorHospitalIdQuick),
    enabled: !!doctorHospitalIdQuick,
  });

  const patients = useMemo(
    () => getApiResponseData<PatientResponse>(patientsByHospitalResponse) || [],
    [patientsByHospitalResponse]
  );

  const selectedServiceType = methods.watch("serviceType");
  const selectedGenomeTestId = methods.watch("genomeTestId");
  const genomeTestFieldsLocked = useMemo(
    () => Boolean(String(selectedGenomeTestId ?? "").trim()),
    [selectedGenomeTestId]
  );
  const watchedPatientPhone = methods.watch("patientPhone");
  const watchedPatientAddressProvince = methods.watch("patientAddressProvince");
  const watchedPatientAddressWard = methods.watch("patientAddressWard");
  const selectedQuickServiceId = methods.watch("serviceId");
  const currentSpecify = specifyDetailResponse?.success ? specifyDetailResponse.data : undefined;
  const currentPatientId = currentSpecify?.patientId;
  const patientPhoneSuggestions = useMemo(() => {
    const typed = String(watchedPatientPhone || "").replace(/[^\d]/g, "").trim();
    const seen = new Set<string>();
    return patients
      .filter((p) => {
        const phone = String(p.patientPhone || "").replace(/[^\d]/g, "").trim();
        if (!phone || seen.has(phone)) return false;
        if (typed && !phone.startsWith(typed)) return false;
        seen.add(phone);
        return true;
      })
      .slice(0, 8)
      .map((p) => ({
        phone: String(p.patientPhone || "").replace(/[^\d]/g, "").trim(),
        patientName: String(p.patientName || "").trim(),
      }));
  }, [patients, watchedPatientPhone]);

  const provinceSelectOptions = useMemo(() => getProvinceSelectOptions(), []);
  const [wardSelectOptions, setWardSelectOptions] = useState<AddressSelectOption[]>([]);
  const [wardOptionsLoading, setWardOptionsLoading] = useState(false);
  const prevPatientProvinceRef = useRef<string | undefined>(undefined);

  const syncPatientAddressFields = useCallback(
    async (rawAddress: string, fieldOpts?: { shouldDirty?: boolean }) => {
      const shouldDirty = fieldOpts?.shouldDirty !== false;
      const o = { shouldDirty, shouldTouch: shouldDirty, shouldValidate: true as const };
      const parsed = parseStoredPatientAddress(String(rawAddress || ""));
      const normProvince = parsed.province
        ? resolveProvinceIndexKey(parsed.province)?.trim().replace(/\s+/g, " ") ||
        parsed.province.trim().replace(/\s+/g, " ")
        : "";
      methods.setValue("patientAddress", String(rawAddress || "").trim(), o);
      methods.setValue("patientAddressDetail", parsed.detail, o);
      methods.setValue("patientAddressProvince", normProvince, o);
      if (!normProvince || !parsed.wardLabel) {
        methods.setValue("patientAddressWard", "", o);
        return;
      }
      try {
        const opts = await loadWardSelectOptions(normProvince);
        setWardSelectOptions(opts);
        methods.setValue("patientAddressWard", resolveWardValueFromParsed(parsed.wardLabel, opts), o);
      } catch {
        methods.setValue("patientAddressWard", parsed.wardLabel, o);
      }
    },
    [methods]
  );

  const clearStep2PatientAutofillFields = useCallback(() => {
    const o = { shouldDirty: true, shouldTouch: true, shouldValidate: true as const };
    methods.setValue("patientName", "", o);
    methods.setValue("patientDob", "", o);
    methods.setValue("patientGender", "", o);
    methods.setValue("patientEmail", "", o);
    methods.setValue("patientJob", "", o);
    methods.setValue("patientContactName", "", o);
    methods.setValue("patientContactPhone", "", o);
    methods.setValue("patientAddress", "", o);
    methods.setValue("patientAddressProvince", "", o);
    methods.setValue("patientAddressWard", "", o);
    methods.setValue("patientAddressDetail", "", o);
    methods.setValue("patientId", "", o);
    methods.setValue("patientHeight", "", o);
    methods.setValue("patientWeight", "", o);
    methods.setValue("patientHistory", "", o);
    methods.setValue("medicalHistory", "", o);
    methods.setValue("acuteDisease", "", o);
    methods.setValue("medicalUsing", "", o);
    methods.setValue("familyHistory", "", o);
    methods.setValue("chronicDisease", "", o);
    methods.setValue("toxicExposure", "", o);
    methods.setValue("geneticTestResults", "", o);
    methods.setValue("geneticTestResultsRelationship", "", o);
  }, [methods]);

  const wardSelectOptionsMerged = useMemo(() => {
    return mergeWardSelectOptions(wardSelectOptions, String(watchedPatientAddressWard || ""));
  }, [wardSelectOptions, watchedPatientAddressWard]);

  useEffect(() => {
    const p = String(watchedPatientAddressProvince || "").trim().replace(/\s+/g, " ");
    const prev = prevPatientProvinceRef.current;
    prevPatientProvinceRef.current = p;
    // Chỉ xóa phường khi đổi tỉnh thật (không xóa khi autofill: "" → tỉnh mới).
    if (prev && prev !== p) {
      methods.setValue("patientAddressWard", "", {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [watchedPatientAddressProvince, methods]);

  useEffect(() => {
    let cancelled = false;
    const p = String(watchedPatientAddressProvince || "").trim().replace(/\s+/g, " ");
    if (!p) {
      setWardSelectOptions([]);
      setWardOptionsLoading(false);
      return;
    }
    setWardOptionsLoading(true);
    loadWardSelectOptions(p)
      .then((opts) => {
        if (!cancelled) setWardSelectOptions(opts);
      })
      .catch(() => {
        if (!cancelled) {
          setWardSelectOptions([]);
          Alert.alert("Lỗi", "Không tải được danh sách phường/xã. Kiểm tra kết nối mạng và thử lại.");
        }
      })
      .finally(() => {
        if (!cancelled) setWardOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [watchedPatientAddressProvince]);

  const { data: patientClinicalResponse } = useQuery({
    queryKey: ["patient-clinical", currentPatientId],
    queryFn: () => patientClinicalService.getByPatientId(currentPatientId!),
    enabled: isEditMode && !!currentPatientId,
  });
  const { data: currentPatientResponse } = useQuery({
    queryKey: ["patient", currentPatientId],
    queryFn: () => patientService.getById(currentPatientId!),
    enabled: isEditMode && !!currentPatientId,
  });
  const { data: reproductionResponse } = useQuery({
    queryKey: ["reproduction-services"],
    queryFn: () => reproductionService.getAll(),
    enabled: isEditMode && !!currentPatientId && selectedServiceType === "reproduction",
  });
  const { data: embryoResponse } = useQuery({
    queryKey: ["embryo-services"],
    queryFn: () => embryoService.getAll(),
    enabled: isEditMode && !!currentPatientId && selectedServiceType === "embryo",
  });
  const { data: diseaseResponse } = useQuery({
    queryKey: ["disease-services"],
    queryFn: () => diseaseService.getAll(),
    enabled: isEditMode && !!currentPatientId && selectedServiceType === "disease",
  });

  const currentReproduction = useMemo(() => {
    if (!currentPatientId || !reproductionResponse?.success) return undefined;
    const items = (reproductionResponse.data || []).filter((item: any) => item.patientId === currentPatientId);
    return items.sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )[0];
  }, [reproductionResponse, currentPatientId]);

  const currentEmbryo = useMemo(() => {
    if (!currentPatientId || !embryoResponse?.success) return undefined;
    const items = (embryoResponse.data || []).filter((item: any) => item.patientId === currentPatientId);
    return items.sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )[0];
  }, [embryoResponse, currentPatientId]);

  const currentDisease = useMemo(() => {
    if (!currentPatientId || !diseaseResponse?.success) return undefined;
    const items = (diseaseResponse.data || []).filter((item: any) => item.patientId === currentPatientId);
    return items.sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )[0];
  }, [diseaseResponse, currentPatientId]);

  const validateDoctorHospitalPatientConsistency = useCallback((): string | null => {
    if (!isEditMode) return null;

    const doctorId = String(methods.getValues("doctorId") || "").trim();
    if (!doctorId) return "Vui lòng chọn bác sĩ chỉ định";

    const doctor = doctors.find((d: any) => String(d.doctorId || "").trim() === doctorId);
    const doctorHospitalId = String((doctor as any)?.hospitalId || "").trim();
    if (!doctorHospitalId) return "Bác sĩ chưa gắn phòng khám/bệnh viện hợp lệ.";

    const patientHospitalId = String(
      (currentPatientResponse?.success ? currentPatientResponse.data?.hospitalId : "") ||
      currentSpecify?.hospitalId ||
      ""
    ).trim();
    if (patientHospitalId && patientHospitalId !== doctorHospitalId) {
      return "Bệnh nhân hiện tại không thuộc cùng phòng khám/bệnh viện với bác sĩ chỉ định.";
    }

    const specifyHospitalId = String(currentSpecify?.hospitalId || "").trim();
    if (specifyHospitalId && doctorHospitalId !== specifyHospitalId) {
      return "Bác sĩ chỉ định phải thuộc đúng phòng khám/bệnh viện của phiếu xét nghiệm.";
    }

    return null;
  }, [isEditMode, methods, doctors, currentPatientResponse, currentSpecify]);

  const diseaseDiagnoseImageUrl = methods.watch("diseaseDiagnoseImage");

  const uploadDiseaseDiagnoseImageFromUri = useCallback(
    async (localUri: string) => {
      setUploadingDiseaseDiagnoseImage(true);
      try {
        const uploaded = await uploadImageToCloudinary(localUri, {
          folder: "disease-diagnose-images",
        });
        const url = uploaded.secureUrl || uploaded.url;
        if (!url) throw new Error("Không lấy được URL ảnh sau khi upload");
        methods.setValue("diseaseDiagnoseImage", url, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      } finally {
        setUploadingDiseaseDiagnoseImage(false);
      }
    },
    [methods]
  );

  const pickDiseaseDiagnoseImageFromLibrary = useCallback(async () => {
    if (uploadingDiseaseDiagnoseImage) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện ảnh để chọn hình chẩn đoán.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await uploadDiseaseDiagnoseImageFromUri(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể tải ảnh lên. Kiểm tra Cloudinary hoặc thử lại.");
    }
  }, [uploadingDiseaseDiagnoseImage, uploadDiseaseDiagnoseImageFromUri]);

  const pickDiseaseDiagnoseImageFromCamera = useCallback(async () => {
    if (uploadingDiseaseDiagnoseImage) return;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Quyền truy cập", "Cần quyền camera để chụp ảnh chẩn đoán.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      await uploadDiseaseDiagnoseImageFromUri(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể chụp/tải ảnh. Vui lòng thử lại.");
    }
  }, [uploadingDiseaseDiagnoseImage, uploadDiseaseDiagnoseImageFromUri]);

  const clearDiseaseDiagnoseImage = useCallback(() => {
    methods.setValue("diseaseDiagnoseImage", "", {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [methods]);

  const filteredServices = useMemo(() => {
    const map: Record<string, string[]> = {
      reproduction: ["reproduction", "sản"],
      embryo: ["embryo", "phôi"],
      disease: ["disease", "bệnh lý"],
    };
    const keys = map[selectedServiceType] || [];
    return services.filter((s) => keys.some((k) => s.name?.toLowerCase().includes(k)));
  }, [services, selectedServiceType]);

  const filteredGenomeTests = useMemo(() => {
    if (!filteredServices.length) return genomeTests;
    const serviceIds = new Set(filteredServices.map((s) => s.serviceId));
    return genomeTests.filter((t: any) => serviceIds.has(t.service?.serviceId));
  }, [genomeTests, filteredServices]);

  useEffect(() => {
    if (!selectedGenomeTestId) {
      lastAutofilledGenomeTestIdRef.current = "";
      return;
    }
    const test: any = genomeTests.find((t: any) => t.testId === selectedGenomeTestId);
    if (!test) return;
    if (lastAutofilledGenomeTestIdRef.current === selectedGenomeTestId) return;
    lastAutofilledGenomeTestIdRef.current = selectedGenomeTestId;
    methods.setValue("testName", test.testName || "");
    methods.setValue("testDescription", test.testDescription || "");
    methods.setValue(
      "testSample",
      Array.isArray(test.testSample) ? test.testSample.join(", ") : test.testSample || ""
    );
  }, [selectedGenomeTestId, genomeTests, methods]);

  useEffect(() => {
    if (isQuickMode) return;
    const prevDoc = prevDoctorIdForPatientScopeRef.current;
    const curDoc = String(watchedDoctorId || "").trim();
    if (prevDoc && curDoc && prevDoc !== curDoc) {
      clearStep2PatientAutofillFields();
      if (isEditMode) {
        methods.setValue("patientPhone", "", {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
      lastPatientLookupPhoneRef.current = "";
    }
    prevDoctorIdForPatientScopeRef.current = curDoc || undefined;
  }, [watchedDoctorId, isQuickMode, isEditMode, clearStep2PatientAutofillFields, methods]);

  useEffect(() => {
    if (isQuickMode) return;
    const normalizedPhone = String(watchedPatientPhone || "").replace(/[^\d]/g, "").slice(0, 10);
    const hasValidPatientPhone = VN_PHONE_REGEX.test(normalizedPhone);
    const scopeHospitalId = String(
      (doctors.find((d: any) => d.doctorId === watchedDoctorId) as any)?.hospitalId ?? ""
    ).trim();

    if (prevHadValidPatientPhoneRef.current && !hasValidPatientPhone) {
      clearStep2PatientAutofillFields();
      lastPatientLookupPhoneRef.current = "";
    }
    prevHadValidPatientPhoneRef.current = hasValidPatientPhone;

    if (!normalizedPhone || normalizedPhone.length < 10) {
      lastPatientLookupPhoneRef.current = "";
      return;
    }
    if (!scopeHospitalId) {
      return;
    }
    if (normalizedPhone === lastPatientLookupPhoneRef.current) return;

    let cancelled = false;
    const lookupPatientByPhone = async () => {
      setIsAutoFillingPatient(true);
      try {
        const response = await patientService.getByPhone(normalizedPhone);
        if (cancelled) return;

        const stillCurrent = String(methods.getValues("patientPhone") || "")
          .replace(/[^\d]/g, "")
          .slice(0, 10);
        if (stillCurrent !== normalizedPhone) return;

        const stillDoctor = String(methods.getValues("doctorId") || "").trim();
        const stillScope = String(
          (doctors.find((d: any) => d.doctorId === stillDoctor) as any)?.hospitalId ?? ""
        ).trim();
        if (!stillScope || stillScope !== scopeHospitalId) return;

        if (!response.success || !response.data) {
          lastPatientLookupPhoneRef.current = normalizedPhone;
          const co = { shouldDirty: true, shouldTouch: true, shouldValidate: true as const };
          methods.setValue("patientId", "", co);
          methods.setValue("patientHeight", "", co);
          methods.setValue("patientWeight", "", co);
          methods.setValue("patientHistory", "", co);
          methods.setValue("medicalHistory", "", co);
          methods.setValue("acuteDisease", "", co);
          methods.setValue("medicalUsing", "", co);
          methods.setValue("familyHistory", "", co);
          methods.setValue("chronicDisease", "", co);
          methods.setValue("toxicExposure", "", co);
          methods.setValue("geneticTestResults", "", co);
          methods.setValue("geneticTestResultsRelationship", "", co);
          return;
        }

        const patient = response.data;
        const currentSpecifyPatientId = String(currentSpecify?.patientId || "").trim();
        const foundPatientId = String(patient.patientId || "").trim();
        if (isEditMode && currentSpecifyPatientId && foundPatientId !== currentSpecifyPatientId) {
          clearStep2PatientAutofillFields();
          lastPatientLookupPhoneRef.current = normalizedPhone;
          return;
        }
        const patientHospitalId = String(patient.hospitalId ?? "").trim();
        if (patientHospitalId !== scopeHospitalId) {
          clearStep2PatientAutofillFields();
          lastPatientLookupPhoneRef.current = normalizedPhone;
          return;
        }

        lastPatientLookupPhoneRef.current = normalizedPhone;

        const name = String(patient.patientName || "").trim();
        if (name) {
          methods.setValue("patientName", name, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }
        const dobStr = formatDateForInput(patient.patientDob);
        if (dobStr) {
          methods.setValue("patientDob", dobStr, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }
        const g = normalizeGenderForPrescriptionSlip(patient.gender);
        if (g) {
          methods.setValue("patientGender", g, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }
        const email = String(patient.patientEmail || "").trim();
        if (email) {
          methods.setValue("patientEmail", email, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }
        const job = String(patient.patientJob || "").trim();
        if (job) {
          methods.setValue("patientJob", job, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }
        const contactName = String(patient.patientContactName || "").trim();
        if (contactName) {
          methods.setValue("patientContactName", formatPatientNameInput(contactName), {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }
        const contactPhone = String(patient.patientContactPhone || "").replace(/[^\d]/g, "").trim();
        if (contactPhone) {
          methods.setValue("patientContactPhone", contactPhone, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }

        const patientAddress = String(patient.patientAddress || "").trim();
        if (patientAddress) {
          await syncPatientAddressFields(patientAddress);
        } else {
          const o = { shouldDirty: true, shouldTouch: true, shouldValidate: true };
          methods.setValue("patientAddress", "", o);
          methods.setValue("patientAddressProvince", "", o);
          methods.setValue("patientAddressWard", "", o);
          methods.setValue("patientAddressDetail", "", o);
        }

        const pid = String(patient.patientId || "").trim();
        const co = { shouldDirty: true, shouldTouch: true, shouldValidate: true as const };
        if (pid) {
          methods.setValue("patientId", pid, co);
          try {
            const clinRes = await patientClinicalService.getByPatientId(pid);
            if (cancelled) return;
            if (clinRes.success && clinRes.data) {
              const c = clinRes.data as PatientClinicalResponse;
              methods.setValue(
                "patientHeight",
                c.patientHeight !== undefined && c.patientHeight !== null ? String(c.patientHeight) : "",
                co
              );
              methods.setValue(
                "patientWeight",
                c.patientWeight !== undefined && c.patientWeight !== null ? String(c.patientWeight) : "",
                co
              );
              methods.setValue("patientHistory", String(c.patientHistory ?? "").trim(), co);
              methods.setValue("medicalHistory", String(c.medicalHistory ?? "").trim(), co);
              methods.setValue("acuteDisease", String(c.acuteDisease ?? "").trim(), co);
              methods.setValue(
                "medicalUsing",
                Array.isArray(c.medicalUsing)
                  ? c.medicalUsing.map((x) => String(x).trim()).filter(Boolean).join(", ")
                  : String(c.medicalUsing ?? "").trim(),
                co
              );
              methods.setValue("familyHistory", String(c.familyHistory ?? "").trim(), co);
              methods.setValue("chronicDisease", String(c.chronicDisease ?? "").trim(), co);
              methods.setValue("toxicExposure", String(c.toxicExposure ?? "").trim(), co);
            } else {
              methods.setValue("patientHeight", "", co);
              methods.setValue("patientWeight", "", co);
              methods.setValue("patientHistory", "", co);
              methods.setValue("medicalHistory", "", co);
              methods.setValue("acuteDisease", "", co);
              methods.setValue("medicalUsing", "", co);
              methods.setValue("familyHistory", "", co);
              methods.setValue("chronicDisease", "", co);
              methods.setValue("toxicExposure", "", co);
            }
            methods.setValue("geneticTestResults", "", co);
            methods.setValue("geneticTestResultsRelationship", "", co);
          } catch {
            methods.setValue("patientHeight", "", co);
            methods.setValue("patientWeight", "", co);
            methods.setValue("patientHistory", "", co);
            methods.setValue("medicalHistory", "", co);
            methods.setValue("acuteDisease", "", co);
            methods.setValue("medicalUsing", "", co);
            methods.setValue("familyHistory", "", co);
            methods.setValue("chronicDisease", "", co);
            methods.setValue("toxicExposure", "", co);
            methods.setValue("geneticTestResults", "", co);
            methods.setValue("geneticTestResultsRelationship", "", co);
          }
        } else {
          methods.setValue("patientId", "", co);
        }
      } catch {
        // patient not found is acceptable; keep manual input flow
      } finally {
        if (!cancelled) setIsAutoFillingPatient(false);
      }
    };

    lookupPatientByPhone();
    return () => {
      cancelled = true;
    };
  }, [
    watchedPatientPhone,
    watchedDoctorId,
    doctors,
    isQuickMode,
    isEditMode,
    currentSpecify?.patientId,
    methods,
    syncPatientAddressFields,
    clearStep2PatientAutofillFields,
  ]);

  useEffect(() => {
    if (!isEditMode || !currentSpecify || hydratedRef.current) return;

    const patientAddress = currentSpecify.patient?.patientAddress || "";
    const parsedAddr = parseStoredPatientAddress(patientAddress);
    const normProvince = parsedAddr.province
      ? resolveProvinceIndexKey(parsedAddr.province)?.trim().replace(/\s+/g, " ") ||
      parsedAddr.province.trim().replace(/\s+/g, " ")
      : "";
    const clinical = patientClinicalResponse?.success ? patientClinicalResponse.data : undefined;

    methods.reset({
      ...defaultValues,
      serviceType: (currentSpecify.serviceType as FormData["serviceType"]) || "reproduction",
      sendEmailPatient: currentSpecify.sendEmailPatient ? "YES" : "NO",
      patientPhone: currentSpecify.patient?.patientPhone || "",
      patientName: currentSpecify.patient?.patientName || "",
      patientDob: formatDateForInput(currentSpecify.patient?.patientDob),
      patientGender: normalizeGenderForPrescriptionSlip(currentSpecify.patient?.gender),
      patientEmail: currentSpecify.patient?.patientEmail || "",
      patientJob: currentSpecify.patient?.patientJob || "",
      patientContactName: formatPatientNameInput(currentSpecify.patient?.patientContactName || ""),
      patientContactPhone: currentSpecify.patient?.patientContactPhone || "",
      patientAddress: patientAddress,
      patientAddressProvince: normProvince,
      patientAddressWard: "",
      patientAddressDetail: parsedAddr.detail,
      genomeTestId: currentSpecify.genomeTestId || "",
      testName: currentSpecify.genomeTest?.testName || "",
      testDescription: currentSpecify.genomeTest?.testDescription || "",
      testSample: Array.isArray(currentSpecify.genomeTest?.testSample)
        ? currentSpecify.genomeTest?.testSample.join(", ")
        : "",
      embryoNumber: (() => {
        const raw = currentSpecify.embryoNumber;
        if (raw === undefined || raw === null) return "";
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 1 || n > 3) return "";
        return String(Math.floor(n));
      })(),
      doctorId: currentSpecify.doctorId || "",
      samplingSite: currentSpecify.samplingSite || "",
      sampleCollectDate: formatDateForInput(currentSpecify.sampleCollectDate),
      patientHeight: clinical?.patientHeight !== undefined ? String(clinical.patientHeight) : "",
      patientHistory: clinical?.patientHistory || "",
      medicalHistory: clinical?.medicalHistory || "",
      acuteDisease: clinical?.acuteDisease || "",
      medicalUsing: clinical?.medicalUsing?.join(", ") || "",
      patientWeight: clinical?.patientWeight !== undefined ? String(clinical.patientWeight) : "",
      familyHistory: clinical?.familyHistory || "",
      chronicDisease: clinical?.chronicDisease || "",
      toxicExposure: clinical?.toxicExposure || "",
      geneticTestResults: currentSpecify.geneticTestResults || "",
      geneticTestResultsRelationship: currentSpecify.geneticTestResultsRelationship || "",
      fetusesNumber: currentReproduction?.fetusesNumber !== undefined ? String(currentReproduction.fetusesNumber) : "",
      fetusesWeek: currentReproduction?.fetusesWeek !== undefined ? String(currentReproduction.fetusesWeek) : "",
      fetusesDay: currentReproduction?.fetusesDay !== undefined ? String(currentReproduction.fetusesDay) : "",
      ultrasoundDay: formatDateForInput(currentReproduction?.ultrasoundDay),
      headRumpLength:
        currentReproduction?.headRumpLength !== undefined ? String(currentReproduction.headRumpLength) : "",
      neckLength: currentReproduction?.neckLength !== undefined ? String(currentReproduction.neckLength) : "",
      combinedTestResult: currentReproduction?.combinedTestResult || "",
      ultrasoundResult: currentReproduction?.ultrasoundResult || "",
      specifyNote: currentSpecify.specifyNote || "",
    });
    hydratedRef.current = true;
    void syncPatientAddressFields(patientAddress, { shouldDirty: false });
  }, [
    isEditMode,
    currentSpecify,
    patientClinicalResponse,
    currentReproduction,
    methods,
    syncPatientAddressFields,
  ]);

  useEffect(() => {
    if (!isEditMode || !currentEmbryo) return;
    if (currentEmbryo.embryoCreate !== undefined && currentEmbryo.embryoCreate !== null) {
      methods.setValue("embryoNumber", String(currentEmbryo.embryoCreate), { shouldDirty: false });
    }
    methods.setValue("embryoBiospy", currentEmbryo.biospy ?? "", { shouldDirty: false });
    methods.setValue("embryoBiospyDate", formatDateForInput(currentEmbryo.biospyDate), { shouldDirty: false });
    methods.setValue("embryoCellContainingSolution", currentEmbryo.cellContainingSolution ?? "", {
      shouldDirty: false,
    });
    methods.setValue("embryoStatus", currentEmbryo.embryoStatus ?? "", { shouldDirty: false });
    methods.setValue("embryoMorphologicalAssessment", currentEmbryo.morphologicalAssessment ?? "", {
      shouldDirty: false,
    });
    methods.setValue("embryoCellNucleus", currentEmbryo.cellNucleus ? "YES" : "NO", { shouldDirty: false });
    methods.setValue("embryoNegativeControl", currentEmbryo.negativeControl ?? "", { shouldDirty: false });
  }, [isEditMode, currentEmbryo, methods]);

  useEffect(() => {
    if (!isEditMode || !currentDisease) return;
    methods.setValue("diseaseSymptom", currentDisease.symptom ?? "", { shouldDirty: false });
    methods.setValue("diseaseDiagnose", currentDisease.diagnose ?? "", { shouldDirty: false });
    methods.setValue("diseaseDiagnoseImage", currentDisease.diagnoseImage ?? "", { shouldDirty: false });
    methods.setValue("diseaseTestRelated", currentDisease.testRelated ?? "", { shouldDirty: false });
    methods.setValue("diseaseTreatmentMethods", currentDisease.treatmentMethods ?? "", { shouldDirty: false });
    methods.setValue(
      "diseaseTreatmentTimeDay",
      currentDisease.treatmentTimeDay !== undefined && currentDisease.treatmentTimeDay !== null
        ? String(currentDisease.treatmentTimeDay)
        : "",
      { shouldDirty: false }
    );
    methods.setValue("diseaseDrugResistance", currentDisease.drugResistance ?? "", { shouldDirty: false });
    methods.setValue("diseaseRelapse", currentDisease.relapse ?? "", { shouldDirty: false });
  }, [isEditMode, currentDisease, methods]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isQuickMode) {
        const selectedDoctor: any = doctors.find((d: any) => d.doctorId === data.doctorId);
        const selectedPatient = patients.find((p) => p.patientId === data.patientId);
        const selectedService: any = services.find((s: any) => s.serviceId === data.serviceId);
        const selectedGenomeTest: any = genomeTests.find((t: any) => t.testId === data.genomeTestId);

        if (!selectedDoctor) throw new Error("Vui lòng chọn bác sĩ chỉ định");
        if (!selectedPatient) throw new Error("Vui lòng chọn bệnh nhân");
        if (!selectedService) throw new Error("Vui lòng chọn dịch vụ");
        if (!selectedGenomeTest) throw new Error("Vui lòng chọn xét nghiệm");

        const quickEmbryo = toInt(String(data.embryoNumber || "").trim());
        const submitData: SpecifyVoteTestRequest = {
          serviceId: selectedService.serviceId,
          patientId: selectedPatient.patientId,
          genomeTestId: selectedGenomeTest.testId,
          hospitalId:
            selectedDoctor?.hospitalId ||
            selectedPatient?.hospitalId ||
            (user?.hospitalId ? String(user.hospitalId) : undefined),
          doctorId: selectedDoctor.doctorId,
          embryoNumber:
            quickEmbryo !== undefined && Number.isFinite(quickEmbryo) ? quickEmbryo : undefined,
          samplingSite:
            String(data.samplingSite || "").trim() ||
            String(selectedDoctor?.hospitalName || "").trim() ||
            undefined,
          sampleCollectDate: new Date().toISOString(),
          specifyNote: data.specifyNote?.trim() || undefined,
          sendEmailPatient: false,
        };

        const response = await specifyVoteTestService.create(submitData);
        if (!response.success) {
          throw new Error(response.error || response.message || "Không thể tạo phiếu chỉ định");
        }
        return response;
      }

      const phone = String(data.patientPhone || "").replace(/[^\d]/g, "").trim();
      let patientId = currentSpecify?.patientId || "";
      const selectedDoctorForPatient: any = doctors.find((d: any) => d.doctorId === data.doctorId);
      const doctorScopeHospitalId = String(selectedDoctorForPatient?.hospitalId ?? "").trim();

      if (isEditMode && phone && doctorScopeHospitalId) {
        try {
          const byPhone = await patientService.getByPhone(phone);
          if (byPhone.success && byPhone.data?.patientId) {
            const found = byPhone.data as PatientResponse;
            const foundPatientId = String(found.patientId || "").trim();
            const foundHospitalId = String(found.hospitalId || "").trim();
            const currentId = String(currentSpecify?.patientId || "").trim();
            if (foundPatientId && currentId && foundPatientId !== currentId) {
              throw new Error(
                "SĐT này đang thuộc bệnh nhân khác. Vui lòng dùng đúng bệnh nhân của phiếu hoặc đổi SĐT phù hợp."
              );
            }
            if (foundHospitalId && foundHospitalId !== doctorScopeHospitalId) {
              throw new Error(
                "Bệnh nhân theo SĐT không thuộc cùng phòng khám/bệnh viện với bác sĩ chỉ định."
              );
            }
          }
        } catch (e: any) {
          throw new Error(e?.message || "Không xác thực được bệnh nhân theo SĐT cho phòng khám/bệnh viện đã chọn.");
        }
      }

      if (!isEditMode) {
        try {
          const byPhone = await patientService.getByPhone(phone);
          if (byPhone.success && byPhone.data?.patientId) {
            const foundH = String((byPhone.data as PatientResponse).hospitalId ?? "").trim();
            if (!doctorScopeHospitalId || foundH === doctorScopeHospitalId) {
              patientId = byPhone.data.patientId;
            }
          }
        } catch {
          // ignore lookup error; create new below
        }
      }

      const existingPatientId = String(patientId || "").trim();
      /** BN mới: luôn mint một mã PAT- một lần; BN cũ: giữ id từ tra cứu / phiếu sửa */
      const patientIdForPayload = existingPatientId || generatePatientId();

      const patientPayload: any = {
        patientId: patientIdForPayload,
        patientName: data.patientName.trim(),
        patientPhone: phone,
        patientDob: parseDateToISO(data.patientDob),
        gender: data.patientGender || undefined,
        patientEmail: data.patientEmail?.trim() || undefined,
        patientJob: data.patientJob?.trim() || undefined,
        patientContactName: data.patientContactName.trim(),
        patientContactPhone: String(data.patientContactPhone || "").replace(/[^\d]/g, "").trim(),
        patientAddress: String(data.patientAddress || "").trim(),
        hospitalId:
          doctorScopeHospitalId ||
          (user?.hospitalId ? String(user.hospitalId) : undefined),
      };

      if (existingPatientId) {
        const updateRes = await patientService.update(existingPatientId, patientPayload);
        if (!updateRes.success) {
          throw new Error(updateRes.error || "Không thể cập nhật bệnh nhân");
        }
        patientId = existingPatientId;
      } else {
        const createPatientRes = await patientService.create(patientPayload);
        if (!createPatientRes.success) {
          throw new Error(createPatientRes.error || "Không thể tạo bệnh nhân");
        }
        const created = createPatientRes.data as PatientResponse | undefined;
        /** Ưu tiên patientId server trả về; thường trùng mã PAT vừa gửi */
        patientId = String(created?.patientId ?? patientIdForPayload).trim();
      }

      const hasClinical =
        !!data.patientHeight ||
        !!data.patientWeight ||
        !!data.patientHistory ||
        !!data.medicalHistory ||
        !!data.familyHistory ||
        !!data.chronicDisease ||
        !!data.acuteDisease ||
        !!data.toxicExposure ||
        !!data.medicalUsing;

      if (hasClinical) {
        const clinicalPayload: any = {
          patientId,
          patientHeight: toNumber(data.patientHeight),
          patientWeight: toNumber(data.patientWeight),
          patientHistory: data.patientHistory?.trim() || undefined,
          familyHistory: data.familyHistory?.trim() || undefined,
          toxicExposure: data.toxicExposure?.trim() || undefined,
          medicalHistory: data.medicalHistory?.trim() || undefined,
          chronicDisease: data.chronicDisease?.trim() || undefined,
          acuteDisease: data.acuteDisease?.trim() || undefined,
          medicalUsing: data.medicalUsing
            ? data.medicalUsing
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
            : undefined,
        };

        const existingClinical = await patientClinicalService.getByPatientId(patientId);
        const existingData = existingClinical.success ? (existingClinical.data as any) : undefined;
        const clinicalIdRaw =
          existingData?.patientClinicalId || existingData?.id;
        const clinicalId =
          clinicalIdRaw && String(clinicalIdRaw).trim() && String(clinicalIdRaw) !== "undefined"
            ? String(clinicalIdRaw).trim()
            : undefined;

        if (clinicalId) {
          const upd = await patientClinicalService.update(clinicalId, clinicalPayload);
          if (!upd.success) {
            throw new Error(upd.error || upd.message || "Không thể cập nhật thông tin lâm sàng");
          }
        } else {
          const created = await patientClinicalService.create(clinicalPayload);
          if (!created.success) {
            const errLower = String(created.error || "").toLowerCase();
            const isDuplicate =
              errLower.includes("đã tồn tại") ||
              errLower.includes("already exists") ||
              errLower.includes("exists") ||
              errLower.includes("pc_002");
            if (isDuplicate) {
              const retryGet = await patientClinicalService.getByPatientId(patientId);
              const retryData = retryGet.success ? (retryGet.data as any) : undefined;
              const retryIdRaw = retryData?.patientClinicalId || retryData?.id;
              const retryId =
                retryIdRaw && String(retryIdRaw).trim() && String(retryIdRaw) !== "undefined"
                  ? String(retryIdRaw).trim()
                  : undefined;
              if (retryId) {
                const retryUpd = await patientClinicalService.update(retryId, clinicalPayload);
                if (!retryUpd.success) {
                  throw new Error(
                    retryUpd.error || retryUpd.message || "Không thể cập nhật thông tin lâm sàng"
                  );
                }
              } else {
                throw new Error(created.error || created.message || "Không thể lưu thông tin lâm sàng");
              }
            } else {
              throw new Error(created.error || created.message || "Không thể tạo thông tin lâm sàng");
            }
          }
        }
      }

      const selectedGenomeTest: any = genomeTests.find((t: any) => t.testId === data.genomeTestId);
      const serviceId =
        selectedGenomeTest?.service?.serviceId || filteredServices[0]?.serviceId || undefined;
      if (!serviceId) {
        throw new Error("Không tìm thấy serviceId cho nhóm dịch vụ đã chọn");
      }

      if (data.serviceType === "reproduction") {
        const hasReproductionData =
          !!data.fetusesNumber ||
          !!data.fetusesWeek ||
          !!data.fetusesDay ||
          !!data.ultrasoundDay ||
          !!data.headRumpLength ||
          !!data.neckLength ||
          !!data.combinedTestResult ||
          !!data.ultrasoundResult;
        if (hasReproductionData) {
          const reproductionPayload = {
            serviceId,
            patientId,
            fetusesNumber: toInt(data.fetusesNumber),
            fetusesWeek: toInt(data.fetusesWeek),
            fetusesDay: toInt(data.fetusesDay),
            ultrasoundDay: parseDateToISO(data.ultrasoundDay),
            headRumpLength: toNumber(data.headRumpLength),
            neckLength: toNumber(data.neckLength),
            combinedTestResult: data.combinedTestResult?.trim() || undefined,
            ultrasoundResult: data.ultrasoundResult?.trim() || undefined,
          };

          const existingReproductions = await reproductionService.getAll();
          const existingReproduction =
            existingReproductions.success && Array.isArray(existingReproductions.data)
              ? existingReproductions.data.find((item: any) => item.patientId === patientId)
              : undefined;

          if (existingReproduction?.id) {
            const updateReproductionRes = await reproductionService.update(
              existingReproduction.id,
              reproductionPayload
            );
            if (!updateReproductionRes.success) {
              throw new Error(
                updateReproductionRes.error ||
                updateReproductionRes.message ||
                "Không thể cập nhật thông tin nhóm Sản"
              );
            }
          } else {
            const createReproductionRes = await reproductionService.create(reproductionPayload);
            if (!createReproductionRes.success) {
              throw new Error(
                createReproductionRes.error ||
                createReproductionRes.message ||
                "Không thể tạo thông tin nhóm Sản"
              );
            }
          }
        }
      } else if (data.serviceType === "embryo") {
        const embryoPayload = {
          serviceId,
          patientId,
          embryoCreate: toInt(data.embryoNumber),
          biospy: data.embryoBiospy?.trim() || undefined,
          biospyDate: parseDateToISO(data.embryoBiospyDate),
          cellContainingSolution: data.embryoCellContainingSolution?.trim() || undefined,
          embryoStatus: data.embryoStatus?.trim() || undefined,
          morphologicalAssessment: data.embryoMorphologicalAssessment?.trim() || undefined,
          cellNucleus: data.embryoCellNucleus === "YES",
          negativeControl: data.embryoNegativeControl?.trim() || undefined,
        };

        const existingEmbryos = await embryoService.getAll();
        const existingEmbryo =
          existingEmbryos.success && Array.isArray(existingEmbryos.data)
            ? existingEmbryos.data.find((item: any) => item.patientId === patientId)
            : undefined;

        if (existingEmbryo?.id) {
          const updateEmbryoRes = await embryoService.update(existingEmbryo.id, embryoPayload);
          if (!updateEmbryoRes.success) {
            throw new Error(
              updateEmbryoRes.error ||
              updateEmbryoRes.message ||
              "Không thể cập nhật thông tin nhóm Phôi"
            );
          }
        } else {
          const createEmbryoRes = await embryoService.create(embryoPayload);
          if (!createEmbryoRes.success) {
            throw new Error(
              createEmbryoRes.error ||
              createEmbryoRes.message ||
              "Không thể tạo thông tin nhóm Phôi"
            );
          }
        }
      } else if (data.serviceType === "disease") {
        const diseasePayload = {
          serviceId,
          patientId,
          symptom: data.diseaseSymptom?.trim() || undefined,
          diagnose: data.diseaseDiagnose?.trim() || undefined,
          diagnoseImage: data.diseaseDiagnoseImage?.trim() || undefined,
          testRelated: data.diseaseTestRelated?.trim() || undefined,
          treatmentMethods: data.diseaseTreatmentMethods?.trim() || undefined,
          treatmentTimeDay: toInt(data.diseaseTreatmentTimeDay),
          drugResistance: data.diseaseDrugResistance?.trim() || undefined,
          relapse: data.diseaseRelapse?.trim() || undefined,
        };

        const existingDiseases = await diseaseService.getAll();
        const existingDisease =
          existingDiseases.success && Array.isArray(existingDiseases.data)
            ? existingDiseases.data.find((item: any) => item.patientId === patientId)
            : undefined;

        if (existingDisease?.id) {
          const updateDiseaseRes = await diseaseService.update(existingDisease.id, diseasePayload);
          if (!updateDiseaseRes.success) {
            throw new Error(
              updateDiseaseRes.error ||
              updateDiseaseRes.message ||
              "Không thể cập nhật thông tin nhóm bệnh lý"
            );
          }
        } else {
          const createDiseaseRes = await diseaseService.create(diseasePayload);
          if (!createDiseaseRes.success) {
            throw new Error(
              createDiseaseRes.error ||
              createDiseaseRes.message ||
              "Không thể tạo thông tin nhóm bệnh lý"
            );
          }
        }
      }

      const selectedDoctor: any = doctors.find((d: any) => d.doctorId === data.doctorId);
      const submitData: SpecifyVoteTestRequest = {
        serviceId,
        patientId,
        genomeTestId: data.genomeTestId,
        hospitalId: selectedDoctor?.hospitalId || (user?.hospitalId ? String(user.hospitalId) : undefined),
        doctorId: data.doctorId || undefined,
        embryoNumber: toInt(data.embryoNumber),
        samplingSite: data.samplingSite?.trim() || undefined,
        sampleCollectDate: parseDateToISO(data.sampleCollectDate),
        geneticTestResults: data.geneticTestResults?.trim() || undefined,
        geneticTestResultsRelationship: data.geneticTestResultsRelationship?.trim() || undefined,
        specifyNote: data.specifyNote?.trim() || undefined,
        sendEmailPatient: data.sendEmailPatient === "YES",
      };

      const response = isEditMode && routeSpecifyVoteId
        ? await specifyVoteTestService.update(routeSpecifyVoteId, submitData)
        : await specifyVoteTestService.create(submitData);
      if (!response.success) {
        throw new Error(
          response.error || response.message || (isEditMode ? "Không thể cập nhật phiếu chỉ định" : "Không thể tạo phiếu chỉ định")
        );
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specify-vote-tests"] });
      queryClient.invalidateQueries({ queryKey: ["prescription-slips"] });
      queryClient.invalidateQueries({ queryKey: ["admin-specifies"] });
      if (routeSpecifyVoteId) {
        queryClient.invalidateQueries({ queryKey: ["specify-vote-test", routeSpecifyVoteId] });
      }
      Alert.alert("Thành công", isEditMode ? "Phiếu chỉ định đã được cập nhật thành công" : "Phiếu chỉ định đã được tạo thành công", [
        {
          text: "OK",
          onPress: () => {
            if (isEditMode && routeSpecifyVoteId) {
              router.replace({
                pathname: "/prescription-slip-detail",
                params: { specifyVoteID: routeSpecifyVoteId, source },
              });
              return;
            }
            /** `back()` tránh `replace` cùng route → 2 màn danh sách trên stack. Cờ reset list ở `list-navigation-flags`. */
            setListFreshOnNextFocus(source === "admin" ? "admin-specifies" : "prescription-slips");
            router.back();
          },
        },
      ]);
    },
    onError: (error: any) => {
      const errorMessage =
        error?.message || error?.error || (isEditMode ? "Không thể cập nhật phiếu chỉ định" : "Không thể tạo phiếu chỉ định");
      Alert.alert(isEditMode ? "Lỗi cập nhật phiếu chỉ định" : "Lỗi tạo phiếu chỉ định", errorMessage);
    },
  });

  const getFormErrorMessage = (path: string): string | undefined => {
    const segments = path.split(".");
    let current: any = methods.formState.errors;
    for (const segment of segments) {
      if (!current || typeof current !== "object") return undefined;
      current = current[segment];
    }
    const message = current?.message;
    return typeof message === "string" ? message : undefined;
  };

  const getStepFields = (step: number): Array<keyof FormData> => {
    if (step === 1) {
      return ["serviceType", "sendEmailPatient"];
    }
    if (step === 2) {
      return ["patientName"];
    }
    if (step === 3) {
      return [
        "genomeTestId",
        "testName",
        "testDescription",
        "testSample",
        "embryoNumber",
        "samplingSite",
        "sampleCollectDate",
      ];
    }
    if (step === 4) {
      return [
        "patientHeight",
        "patientWeight",
        "patientHistory",
        "acuteDisease",
        "medicalUsing",
        "medicalHistory",
        "familyHistory",
        "chronicDisease",
        "toxicExposure",
        "geneticTestResults",
      ];
    }
    if (step === 5) {
      if (selectedServiceType === "reproduction") {
        return [
          "fetusesNumber",
          "fetusesWeek",
          "fetusesDay",
          "headRumpLength",
          "neckLength",
          "combinedTestResult",
          "ultrasoundResult",
          "ultrasoundDay",
        ];
      }
      if (selectedServiceType === "embryo") {
        return [
          "embryoBiospy",
          "embryoBiospyDate",
          "embryoCellContainingSolution",
          "embryoStatus",
          "embryoMorphologicalAssessment",
          "embryoCellNucleus",
          "embryoNegativeControl",
        ];
      }
      if (selectedServiceType === "disease") {
        return [
          "diseaseSymptom",
          "diseaseDiagnose",
          "diseaseDiagnoseImage",
          "diseaseTestRelated",
          "diseaseTreatmentMethods",
          "diseaseTreatmentTimeDay",
          "diseaseDrugResistance",
          "diseaseRelapse",
        ];
      }
      return [];
    }
    return ["specifyNote"];
  };

  const validateWizardStep = async (step: number) => {
    const data = methods.getValues();
    let isValid = true;

    const setFieldError = (field: keyof FormData, message: string) => {
      methods.setError(field as any, { type: "manual", message });
      isValid = false;
    };
    const isBlank = (value?: string) => !String(value || "").trim();

    if (step === 1) {
      methods.clearErrors(["serviceType", "sendEmailPatient"]);
      if (isBlank(data.serviceType)) setFieldError("serviceType", "Vui lòng chọn nhóm dịch vụ");
    }

    if (step === 2) {
      methods.clearErrors(["patientName", "patientPhone", "patientEmail"]);
      const nameTrimmed = String(data.patientName || "").trim();
      if (isBlank(data.patientName)) setFieldError("patientName", "Vui lòng nhập họ tên");
      else if (/\d/.test(nameTrimmed)) {
        setFieldError("patientName", "Họ tên không được chứa số");
      }
      if (isBlank(data.patientPhone)) {
        setFieldError("patientPhone", "Vui lòng nhập số điện thoại bệnh nhân");
      }
      if (String(data.sendEmailPatient || "NO") === "YES" && isBlank(data.patientEmail)) {
        setFieldError("patientEmail", "Vui lòng nhập email bệnh nhân để gửi thông báo");
      }
      const consistencyError = validateDoctorHospitalPatientConsistency();
      if (consistencyError) setFieldError("doctorId", consistencyError);
    }

    if (step === 3) {
      methods.clearErrors([
        "genomeTestId",
        "doctorId",
        "patientAddress",
        "samplingSite",
        "embryoNumber",
      ]);
      if (isBlank(data.genomeTestId)) setFieldError("genomeTestId", "Vui lòng chọn mã xét nghiệm");
      if (isBlank(data.doctorId)) setFieldError("doctorId", "Vui lòng chọn bác sĩ chỉ định");
      if (isBlank(data.patientAddress)) setFieldError("patientAddress", "Vui lòng nhập địa chỉ bệnh nhân");

      const selectedGenomeTest = genomeTests.find((t: any) => t.testId === data.genomeTestId);
      const normalizedService = normalizeServiceType(data.serviceType);
      const normalizedTestService = normalizeServiceType(selectedGenomeTest?.service?.name);
      if (
        selectedGenomeTest &&
        normalizedService &&
        normalizedTestService &&
        normalizedService !== normalizedTestService
      ) {
        setFieldError("genomeTestId", "Xét nghiệm phải thuộc đúng nhóm dịch vụ đã chọn");
      }
    }

    if (step === 4) {
      methods.clearErrors(["patientHeight", "patientWeight"]);
      if (!isBlank(data.patientHeight)) {
        const h = toNumeric(data.patientHeight);
        if (h === null || h < 0) {
          setFieldError("patientHeight", "Chiều cao không được âm");
        }
      }
      if (!isBlank(data.patientWeight)) {
        const w = toNumeric(data.patientWeight);
        if (w === null || w < 0) {
          setFieldError("patientWeight", "Cân nặng không được âm");
        }
      }
    }

    if (step === 5) {
      methods.clearErrors([
        "fetusesNumber",
        "fetusesWeek",
        "fetusesDay",
        "ultrasoundDay",
        "headRumpLength",
        "neckLength",
        "combinedTestResult",
        "ultrasoundResult",
        "embryoBiospy",
        "embryoBiospyDate",
        "embryoCellContainingSolution",
        "embryoStatus",
        "embryoMorphologicalAssessment",
        "embryoCellNucleus",
        "embryoNegativeControl",
        "diseaseSymptom",
        "diseaseDiagnose",
        "diseaseDiagnoseImage",
        "diseaseTestRelated",
        "diseaseTreatmentMethods",
        "diseaseTreatmentTimeDay",
        "diseaseDrugResistance",
        "diseaseRelapse",
      ]);
      if (!isBlank(data.embryoNumber)) {
        const embryoNum = toNumeric(data.embryoNumber);
        if (embryoNum === null || embryoNum < 0) {
          setFieldError("embryoNumber", "Số lượng phôi không được âm");
        }
      }
      if (!isBlank(data.diseaseTreatmentTimeDay)) {
        const t = toNumeric(data.diseaseTreatmentTimeDay);
        if (t === null || t < 0) {
          setFieldError("diseaseTreatmentTimeDay", "Thời gian điều trị không được âm");
        }
      }
    }

    if (step === 6) {
      methods.clearErrors(["specifyNote"]);
      const note = String(data.specifyNote || "").trim();
      if (note.length > MAX_NOTE_LENGTH) {
        setFieldError("specifyNote", `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự`);
      }
    }

    return isValid;
  };

  const handleNextWizardStep = async () => {
    const isStepValid = await validateWizardStep(currentFormStep);
    if (!isStepValid) {
      const stepFields = getStepFields(currentFormStep);
      const firstErrorMessage =
        stepFields.map((field) => getFormErrorMessage(String(field))).find(Boolean) ||
        "Vui lòng kiểm tra lại thông tin ở bước hiện tại.";
      const firstBad = stepFields.find((f) => getFormErrorMessage(String(f)));
      if (firstBad) {
        try {
          methods.setFocus(firstBad as any);
        } catch {
          // một số field không hỗ trợ focus
        }
      }
      Alert.alert("Lỗi", firstErrorMessage);
      return;
    }
    setCurrentFormStep((prev) => Math.min(prev + 1, SPECIFY_FORM_STEP_COUNT));
  };

  const handleSubmit = async () => {
    if (isQuickMode) {
      const values = methods.getValues();
      methods.clearErrors();

      const requiredChecks: Array<{ field: keyof FormData; message: string }> = [
        { field: "doctorId", message: "Vui lòng chọn bác sĩ chỉ định" },
        { field: "patientId", message: "Vui lòng chọn bệnh nhân" },
        { field: "serviceId", message: "Vui lòng chọn dịch vụ" },
        { field: "genomeTestId", message: "Vui lòng chọn xét nghiệm" },
      ];

      const firstMissing = requiredChecks.find(({ field }) => !String(values[field] || "").trim());
      if (firstMissing) {
        methods.setError(firstMissing.field as any, {
          type: "manual",
          message: firstMissing.message,
        });
        Alert.alert("Lỗi", firstMissing.message);
        return;
      }

      const samplingSite = String(values.samplingSite || "").trim();
      if (samplingSite && samplingSite.length > MAX_SAMPLING_SITE_LENGTH) {
        methods.setError("samplingSite", {
          type: "manual",
          message: `Nơi thu mẫu tối đa ${MAX_SAMPLING_SITE_LENGTH} ký tự`,
        });
        Alert.alert("Lỗi", `Nơi thu mẫu tối đa ${MAX_SAMPLING_SITE_LENGTH} ký tự`);
        return;
      }

      const note = String(values.specifyNote || "").trim();
      if (note.length > MAX_NOTE_LENGTH) {
        methods.setError("specifyNote", {
          type: "manual",
          message: `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự`,
        });
        Alert.alert("Lỗi", `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự`);
        return;
      }

      const selectedGenomeTest = genomeTests.find((t: any) => t.testId === values.genomeTestId);
      if (!selectedGenomeTest) {
        methods.setError("genomeTestId", {
          type: "manual",
          message: "Xét nghiệm không hợp lệ. Vui lòng chọn lại",
        });
        Alert.alert("Lỗi", "Xét nghiệm không hợp lệ. Vui lòng chọn lại");
        return;
      }
      if (
        String(values.serviceId || "").trim() &&
        selectedGenomeTest?.service?.serviceId !== values.serviceId
      ) {
        methods.setError("genomeTestId", {
          type: "manual",
          message: "Xét nghiệm phải thuộc đúng dịch vụ đã chọn",
        });
        Alert.alert("Lỗi", "Xét nghiệm phải thuộc đúng dịch vụ đã chọn");
        return;
      }
      if (String(values.serviceId || "").trim() && quickGenomeTestOptions.length === 0) {
        methods.setError("serviceId", {
          type: "manual",
          message: "Dịch vụ này chưa có xét nghiệm phù hợp",
        });
        Alert.alert("Lỗi", "Dịch vụ này chưa có xét nghiệm phù hợp");
        return;
      }

      createMutation.mutate(values);
      return;
    }

    if (isStepFormMode) {
      for (let s = 1; s <= SPECIFY_FORM_STEP_COUNT; s++) {
        if (!(await validateWizardStep(s))) {
          setCurrentFormStep(s);
          Alert.alert(
            "Lỗi",
            isEditMode
              ? `Vui lòng hoàn tất và sửa các lỗi ở bước ${s} trước khi cập nhật phiếu.`
              : `Vui lòng hoàn tất và sửa các lỗi ở bước ${s} trước khi tạo phiếu.`
          );
          return;
        }
      }
    }

    const values = methods.getValues();
    const consistencyError = validateDoctorHospitalPatientConsistency();
    if (consistencyError) {
      methods.setError("doctorId", {
        type: "manual",
        message: consistencyError,
      });
      Alert.alert("Lỗi", consistencyError);
      return;
    }
    const selectedGenomeTest = genomeTests.find((t: any) => t.testId === values.genomeTestId);
    const normalizedService = normalizeServiceType(values.serviceType);
    const normalizedTestService = normalizeServiceType(selectedGenomeTest?.service?.name);
    if (!selectedGenomeTest || !selectedGenomeTest?.service?.serviceId) {
      methods.setError("genomeTestId", {
        type: "manual",
        message: "Xét nghiệm không hợp lệ. Vui lòng chọn lại",
      });
      Alert.alert("Lỗi", "Xét nghiệm không hợp lệ. Vui lòng chọn lại");
      return;
    }
    if (normalizedService && normalizedTestService && normalizedService !== normalizedTestService) {
      methods.setError("genomeTestId", {
        type: "manual",
        message: "Xét nghiệm phải thuộc đúng nhóm dịch vụ đã chọn",
      });
      Alert.alert("Lỗi", "Xét nghiệm phải thuộc đúng nhóm dịch vụ đã chọn");
      return;
    }

    createMutation.mutate(methods.getValues());
  };

  const serviceTypeOptions = [
    { value: "reproduction", label: "Nhóm sản" },
    { value: "embryo", label: "Nhóm phôi" },
    { value: "disease", label: "Nhóm bệnh lý" },
  ] as const;

  const emailOptions = [
    { value: "NO", label: "Không gửi email cho bệnh nhân" },
    { value: "YES", label: "Gửi email cho bệnh nhân" },
  ] as const;

  const doctorOptions = doctors.map((d: any) => ({
    value: d.doctorId,
    label: [d.doctorName || d.doctorId, d.hospitalName].filter(Boolean).join(" - "),
  }));

  const genomeTestOptions = filteredGenomeTests.map((test: any) => ({
    value: test.testId,
    label: `${test.testId} - ${test.testName || ""}`.trim(),
  }));

  const selectedQuickDoctor = useMemo(
    () => doctors.find((d: any) => d.doctorId === watchedDoctorId),
    [doctors, watchedDoctorId]
  );

  const quickServiceOptions = useMemo(
    () =>
      services.map((service: any) => ({
        value: service.serviceId,
        label: service.serviceName || service.name || service.serviceId,
      })),
    [services]
  );

  const quickPatientOptions = useMemo(
    () =>
      patients.map((patient) => ({
        value: patient.patientId,
        label: [patient.patientName, patient.patientPhone].filter(Boolean).join(" - ") || patient.patientId,
      })),
    [patients]
  );

  const quickGenomeTestOptions = useMemo(
    () =>
      genomeTests
        .filter((test: any) => !selectedQuickServiceId || test?.service?.serviceId === selectedQuickServiceId)
        .map((test: any) => ({
          value: test.testId,
          label: `${test.testId} - ${test.testName || ""}`.trim(),
        })),
    [genomeTests, selectedQuickServiceId]
  );

  useEffect(() => {
    if (!isQuickMode) return;
    const selectedTest = genomeTests.find((test: any) => test.testId === selectedGenomeTestId);
    if (selectedTest && selectedQuickServiceId && selectedTest?.service?.serviceId !== selectedQuickServiceId) {
      methods.setValue("genomeTestId", "");
    }
  }, [isQuickMode, genomeTests, selectedGenomeTestId, selectedQuickServiceId, methods]);

  useEffect(() => {
    if (!isQuickMode) return;
    const cur = String(watchedDoctorId || "").trim();
    if (prevQuickDoctorIdRef.current && prevQuickDoctorIdRef.current !== cur) {
      methods.setValue("patientId", "", {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
    prevQuickDoctorIdRef.current = cur;
  }, [isQuickMode, watchedDoctorId, methods]);

  useEffect(() => {
    if (!isQuickMode) return;
    const currentSamplingSite = String(methods.getValues("samplingSite") || "").trim();
    const defaultSamplingSite = String(selectedQuickDoctor?.hospitalName || "").trim();
    if (!currentSamplingSite && defaultSamplingSite) {
      methods.setValue("samplingSite", defaultSamplingSite);
    }
  }, [isQuickMode, selectedQuickDoctor, methods]);

  return (
    <FormProvider {...methods}>
      <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
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
              <Text className="text-slate-900 text-lg font-extrabold">
                {isEditMode
                  ? "Sửa phiếu xét nghiệm"
                  : isQuickMode
                    ? "Tạo nhanh phiếu xét nghiệm"
                    : "Tạo mới phiếu xét nghiệm"}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                {isEditMode
                  ? "Cập nhật đầy đủ thông tin phiếu"
                  : isQuickMode
                    ? "Điền thông tin để tạo phiếu xét nghiệm mới"
                    : "Thông tin tạo phiếu như web"}
              </Text>
            </View>
          </View>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 20}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isQuickMode ? (
              <View className="bg-white rounded-2xl border border-sky-100 p-4">
                <Text className="text-slate-900 text-[14px] font-extrabold">
                  Tạo nhanh phiếu xét nghiệm
                </Text>
                <Text className="text-slate-500 text-[12px] mt-1 mb-4">
                  Điền thông tin để tạo phiếu xét nghiệm mới
                </Text>

                <FormSelect
                  name="doctorId"
                  label="Bác sĩ chỉ định"
                  required
                  options={doctorOptions}
                  getLabel={(o) => o.label}
                  getValue={(o) => o.value}
                  placeholder="Chọn bác sĩ chỉ định"
                  modalTitle="Chọn bác sĩ chỉ định"
                />

                <View className="mb-4">
                  <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
                    Phòng khám / Bệnh viện
                  </Text>
                  <View className="bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3">
                    <Text className="text-[14px] font-semibold text-slate-700">
                      {selectedQuickDoctor?.hospitalName || "Chọn bác sĩ chỉ định trước"}
                    </Text>
                  </View>
                </View>

                <FormSelect
                  name="patientId"
                  label="Bệnh nhân"
                  required
                  options={quickPatientOptions}
                  getLabel={(o) => o.label}
                  getValue={(o) => o.value}
                  placeholder="Chọn bệnh nhân"
                  modalTitle="Chọn bệnh nhân"
                />

                <FormSelect
                  name="serviceId"
                  label="Dịch vụ"
                  required
                  options={quickServiceOptions}
                  getLabel={(o) => o.label}
                  getValue={(o) => o.value}
                  placeholder="Chọn dịch vụ"
                  modalTitle="Chọn dịch vụ"
                />

                <FormSelect
                  name="genomeTestId"
                  label="Xét nghiệm"
                  required
                  options={quickGenomeTestOptions}
                  getLabel={(o) => o.label}
                  getValue={(o) => o.value}
                  placeholder={selectedQuickServiceId ? "Chọn xét nghiệm" : "Vui lòng chọn dịch vụ trước"}
                  modalTitle="Chọn xét nghiệm"
                  disabled={!selectedQuickServiceId}
                />

                <FormInput
                  name="samplingSite"
                  label="Nơi thu mẫu"
                  placeholder={selectedQuickDoctor?.hospitalName || "Nhập nơi thu mẫu"}
                  maxLength={MAX_SAMPLING_SITE_LENGTH}
                />

                <FormTextarea
                  name="specifyNote"
                  label="Ghi chú"
                  placeholder="Nhập ghi chú (không bắt buộc)"
                  minHeight={90}
                  maxLength={MAX_NOTE_LENGTH}
                  helperText={`Tối đa ${MAX_NOTE_LENGTH} ký tự`}
                />
              </View>
            ) : (
              <View className="bg-white rounded-2xl border border-sky-100 p-4">
                {isEditMode && (
                  <View className="mb-4">
                    <FormInfoBox>
                      Chỉ sửa đúng phiếu bạn đã chọn từ danh sách — không đổi sang phiếu khác tại màn hình này.
                    </FormInfoBox>
                    <Text className="text-[13px] font-extrabold text-slate-700 mb-2 mt-3">Mã phiếu xét nghiệm</Text>
                    <View className="min-h-12 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 flex-row items-center mb-1">
                      {specifyDetailFetching ? (
                        <ActivityIndicator color="#0284C7" />
                      ) : (
                        <Text className="flex-1 text-[14px] font-semibold text-slate-900 pr-2" numberOfLines={3}>
                          {[
                            routeSpecifyVoteId,
                            currentSpecify?.patient?.patientName,
                            currentSpecify?.genomeTest?.testName,
                          ]
                            .filter(Boolean)
                            .join(" — ") || routeSpecifyVoteId}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
                {isStepFormMode && (
                  <View className="mb-4">
                    <Text className="text-slate-700 text-[12px] font-bold mb-2">
                      Bước {currentFormStep}/{SPECIFY_FORM_STEP_COUNT}:{" "}
                      {SPECIFY_FORM_STEPS[currentFormStep - 1]}
                    </Text>
                    <Text className="text-slate-500 text-[11px] mb-2">
                      Chạm ô bước (1–6) để mở nhanh — không bắt buộc đi lần lượt.
                    </Text>
                    <View className="flex-row gap-2">
                      {SPECIFY_FORM_STEPS.map((step, index) => {
                        const stepNumber = index + 1;
                        const isActive = stepNumber === currentFormStep;
                        const isDone = stepNumber < currentFormStep;
                        return (
                          <TouchableOpacity
                            key={step}
                            activeOpacity={0.75}
                            onPress={() => setCurrentFormStep(stepNumber)}
                            className={`flex-1 rounded-xl px-2 py-2 border ${isActive
                                ? "bg-sky-600 border-sky-600"
                                : isDone
                                  ? "bg-emerald-50 border-emerald-200"
                                  : "bg-slate-50 border-slate-200"
                              }`}
                          >
                            <Text
                              className={`text-[11px] font-extrabold text-center ${isActive
                                  ? "text-white"
                                  : isDone
                                    ? "text-emerald-700"
                                    : "text-slate-500"
                                }`}
                            >
                              {stepNumber}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {(!isStepFormMode || currentFormStep === 1) && (
                  <>
                    <FormSelect
                      name="serviceType"
                      label="Chọn nhóm dịch vụ"
                      required
                      options={serviceTypeOptions}
                      getLabel={(o) => o.label}
                      getValue={(o) => o.value}
                      placeholder="Lựa chọn"
                      modalTitle="Chọn nhóm dịch vụ"
                    />
                    <FormSelect
                      name="sendEmailPatient"
                      label="Gửi email cho bệnh nhân"
                      options={emailOptions}
                      getLabel={(o) => o.label}
                      getValue={(o) => o.value}
                      placeholder="Lựa chọn"
                      modalTitle="Chọn gửi email"
                    />
                  </>
                )}

                {(!isStepFormMode || currentFormStep === 2) && (
                  <>
                    <Text className="text-slate-900 text-[14px] font-extrabold mt-2 mb-3">Thông tin chung</Text>
                    <Text className="text-slate-700 text-[13px] font-bold mb-2">Bác sĩ chỉ định & phòng khám</Text>

                    <FormSelect
                      name="doctorId"
                      label="Bác sĩ chỉ định"
                      required
                      options={doctorOptions}
                      getLabel={(o) => o.label}
                      getValue={(o) => o.value}
                      placeholder="Chọn bác sĩ chỉ định"
                      modalTitle="Chọn bác sĩ chỉ định"
                    />

                    <View className="mb-4">
                      <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
                        Phòng khám / Bệnh viện <Text className="text-red-500">*</Text>
                      </Text>
                      <View className="bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3">
                        <Text className="text-[14px] font-semibold text-slate-700">
                          {selectedQuickDoctor?.hospitalName?.trim() ||
                            (selectedQuickDoctor?.hospitalId
                              ? `Mã BV: ${selectedQuickDoctor.hospitalId}`
                              : "Chọn bác sĩ — hiển thị theo phòng khám của bác sĩ")}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-slate-700 text-[13px] font-bold mb-2">Thông tin người làm xét nghiệm</Text>

                    {/* NOTE: Keep phone + name in 1 column.
               2-column layout intermittently collapses after selecting a phone suggestion (autofill),
               causing label/helper text to wrap vertically on iOS. */}
                    <View className="gap-3">
                      <FormInput
                        name="patientPhone"
                        label="Số điện thoại"
                        required
                        placeholder="Nhập số điện thoại (VD: 0901234567)"
                        keyboardType="phone-pad"
                        formatter={formatPhoneInput}
                        maxLength={10}
                        onFocus={() => setShowPatientPhoneSuggestions(true)}
                        onBlur={() => setShowPatientPhoneSuggestions(false)}
                        helperText={
                          isAutoFillingPatient
                            ? "Đang kiểm tra SĐT và tự động điền thông tin bệnh nhân..."
                            : !selectedQuickDoctor?.hospitalId
                              ? "Chọn bác sĩ trước. Chỉ tự điền khi bệnh nhân thuộc đúng phòng khám của bác sĩ đã chọn."
                              : "SĐT Việt Nam 10 số, bắt đầu bằng số 0"
                        }
                      />
                      {showPatientPhoneSuggestions &&
                        !isAutoFillingPatient &&
                        !!selectedQuickDoctor?.hospitalId &&
                        patientPhoneSuggestions.length > 0 ? (
                        <View className="-mt-2 mb-3 rounded-xl border border-sky-100 bg-sky-50 overflow-hidden">
                          {patientPhoneSuggestions.map((s, idx) => (
                            <TouchableOpacity
                              key={`${s.phone}-${idx}`}
                              activeOpacity={0.75}
                              className={`px-3 py-2.5 ${idx < patientPhoneSuggestions.length - 1 ? "border-b border-sky-100" : ""}`}
                              onPress={() => {
                                // Move focus away from phone field after picking suggestion to avoid layout glitches
                                // where the left column can momentarily collapse until a full re-layout.
                                methods.setValue("patientPhone", s.phone, {
                                  shouldDirty: true,
                                  shouldTouch: true,
                                  shouldValidate: true,
                                });
                                setShowPatientPhoneSuggestions(false);
                                requestAnimationFrame(() => {
                                  try {
                                    methods.setFocus("patientName");
                                  } catch {
                                    // ignore
                                  }
                                });
                              }}
                            >
                              <Text className="text-[12px] font-extrabold text-slate-800">{s.phone}</Text>
                              {!!s.patientName && (
                                <Text className="text-[11px] text-slate-600 mt-0.5" numberOfLines={2}>
                                  {s.patientName}
                                </Text>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                      <FormInput
                        name="patientName"
                        label="Họ tên"
                        required
                        placeholder="Nhập vào họ và tên"
                        maxLength={MAX_NAME_LENGTH}
                        formatter={formatPatientNameInput}
                      />
                    </View>

                    <FormFieldGroup>
                      <FormDatePicker
                        name="patientDob"
                        label="Ngày sinh"
                        required
                        placeholder="Chọn ngày sinh"
                        maximumDate={new Date()}
                        helperText="Bấm để chọn ngày trên lịch"
                      />
                      <FormSelect
                        name="patientGender"
                        label="Giới tính"
                        required
                        options={PRESCRIPTION_SLIP_GENDER_OPTIONS}
                        getLabel={(o) => o.label}
                        getValue={(o) => o.value}
                        placeholder="Lựa chọn"
                        modalTitle="Chọn giới tính"
                      />
                    </FormFieldGroup>

                    <FormFieldGroup>
                      <FormInput
                        name="patientEmail"
                        label="Email"
                        placeholder="Nhập email (VD: example@gmail.com)"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        maxLength={120}
                      />
                      <FormInput
                        name="patientJob"
                        label="Nghề nghiệp"
                        placeholder="Nhập vào nghề nghiệp"
                        maxLength={MAX_JOB_LENGTH}
                      />
                    </FormFieldGroup>

                    <FormFieldGroup>
                      <FormInput
                        name="patientContactName"
                        label="Người liên hệ"
                        required
                        placeholder="Nhập vào họ và tên"
                        formatter={formatPatientNameInput}
                        maxLength={MAX_NAME_LENGTH}
                      />
                      <FormInput
                        name="patientContactPhone"
                        label="Số điện thoại liên hệ"
                        required
                        placeholder="Nhập số điện thoại"
                        keyboardType="phone-pad"
                        formatter={formatPhoneInput}
                        maxLength={10}
                        helperText="SĐT Việt Nam 10 số, bắt đầu bằng số 0"
                      />
                    </FormFieldGroup>

                    <FormTextarea
                      name="patientAddress"
                      label="Địa chỉ bệnh nhân"
                      required
                      placeholder="Nhập địa chỉ đầy đủ"
                      minHeight={90}
                      maxLength={MAX_ADDRESS_DETAIL_LENGTH}
                    />
                  </>
                )}

                {(!isStepFormMode || currentFormStep === 3) && (
                  <>
                    <Text className="text-slate-700 text-[13px] font-bold mb-2 mt-3">Thông tin xét nghiệm</Text>
                    <FormSelect
                      name="genomeTestId"
                      label="Mã xét nghiệm"
                      required
                      options={genomeTestOptions}
                      getLabel={(o) => o.label}
                      getValue={(o) => o.value}
                      placeholder="Nhập mã"
                      modalTitle="Chọn mã xét nghiệm"
                      disabled={isEditMode}
                    />
                    <FormInput
                      name="testName"
                      label="Tên xét nghiệm"
                      required
                      placeholder="Nhập để tìm kiếm"
                      maxLength={MAX_TEST_NAME_LENGTH}
                      editable={!genomeTestFieldsLocked}
                      helperText={
                        genomeTestFieldsLocked
                          ? "Theo mã xét nghiệm đã chọn — không chỉnh sửa."
                          : undefined
                      }
                    />
                    <FormTextarea
                      name="testDescription"
                      label="Mô tả xét nghiệm"
                      placeholder="Mô tả xét nghiệm"
                      minHeight={80}
                      maxLength={MAX_TEST_DESC_LENGTH}
                      disabled={genomeTestFieldsLocked}
                    />
                    <FormInput
                      name="testSample"
                      label="Mẫu xét nghiệm"
                      required
                      placeholder="Mẫu xét nghiệm"
                      maxLength={MAX_TEST_SAMPLE_LENGTH}
                      editable={!genomeTestFieldsLocked}
                    />
                    <FormSelect
                      name="embryoNumber"
                      label="Số lượng phôi"
                      required
                      options={[...EMBRYO_CREATE_OPTIONS]}
                      getLabel={(o) => o.label}
                      getValue={(o) => o.value}
                      placeholder="Chọn 1, 2 hoặc 3"
                      modalTitle="Chọn số lượng phôi"
                    />

                    <FormFieldGroup>
                      <FormInput
                        name="samplingSite"
                        label="Nơi thu mẫu"
                        required
                        placeholder="Nơi thu mẫu"
                        maxLength={MAX_SAMPLING_SITE_LENGTH}
                      />
                      <FormDatePicker
                        name="sampleCollectDate"
                        label="Ngày thu mẫu"
                        placeholder="Chọn ngày thu mẫu"
                        helperText="Bấm để chọn ngày trên lịch (tùy chọn)"
                      />
                    </FormFieldGroup>
                  </>
                )}

                {(!isStepFormMode || currentFormStep === 4) && (
                  <>
                    <Text className="text-slate-700 text-[13px] font-bold mb-2 mt-3">Thông tin lâm sàng</Text>
                    <FormFieldGroup>
                      <FormNumericInput
                        name="patientHeight"
                        label="Chiều cao (cm)"
                        type="decimal"
                        required
                        placeholder="Nhập chiều cao (cm)"
                        helperText="Giống web phiếu chỉ định: 0 – 200 cm"
                        numericMax={200}
                      />
                      <FormNumericInput
                        name="patientWeight"
                        label="Cân nặng (kg)"
                        type="decimal"
                        required
                        placeholder="Nhập cân nặng (kg)"
                        helperText="Giống web phiếu chỉ định: 0 – 100 kg"
                        numericMax={100}
                      />
                    </FormFieldGroup>
                    <FormTextarea
                      name="patientHistory"
                      label="Tiền sử bệnh nhân"
                      required
                      placeholder="Mô tả tiền sử bệnh nhân"
                      minHeight={80}
                      maxLength={MAX_TEXTAREA_LENGTH}
                    />
                    <FormTextarea
                      name="acuteDisease"
                      label="Bệnh lý cấp tính"
                      required
                      placeholder="Mô tả bệnh lý cấp tính"
                      minHeight={80}
                      maxLength={MAX_TEXTAREA_LENGTH}
                    />
                    <FormTextarea
                      name="medicalUsing"
                      label="Thuốc đang dùng"
                      required
                      placeholder="Liệt kê thuốc đang dùng (phân cách bằng dấu phẩy)"
                      minHeight={80}
                      maxLength={MAX_TEXTAREA_LENGTH}
                    />
                    <FormTextarea
                      name="medicalHistory"
                      label="Tiền sử bệnh"
                      required
                      placeholder="Mô tả tiền sử bệnh"
                      minHeight={80}
                      maxLength={MAX_TEXTAREA_LENGTH}
                    />
                    <FormTextarea
                      name="familyHistory"
                      label="Tiền sử gia đình"
                      required
                      placeholder="Mô tả tiền sử gia đình"
                      minHeight={80}
                      maxLength={MAX_TEXTAREA_LENGTH}
                    />
                    <FormTextarea
                      name="chronicDisease"
                      label="Bệnh lý mãn tính"
                      required
                      placeholder="Mô tả bệnh lý mãn tính"
                      minHeight={80}
                      maxLength={MAX_TEXTAREA_LENGTH}
                    />
                    <FormTextarea
                      name="toxicExposure"
                      label="Tiếp xúc độc hại"
                      required
                      placeholder="Mô tả tiếp xúc độc hại"
                      minHeight={80}
                      maxLength={MAX_TEXTAREA_LENGTH}
                    />
                    <FormTextarea
                      name="geneticTestResults"
                      label="Kết quả xét nghiệm di truyền của bản thân"
                      placeholder="Nhập kết quả xét nghiệm di truyền trước đó của bệnh nhân"
                      minHeight={80}
                      maxLength={MAX_TEXTAREA_LENGTH}
                    />
                    <FormTextarea
                      name="geneticTestResultsRelationship"
                      label="Kết quả xét nghiệm di truyền của người thân"
                      placeholder="Nhập kết quả xét nghiệm di truyền trước đó của người thân"
                      minHeight={80}
                      maxLength={MAX_TEXTAREA_LENGTH}
                    />
                  </>
                )}

                {(!isStepFormMode || currentFormStep === 5) && (
                  <>
                    <Text className="text-slate-700 text-[13px] font-bold mb-2 mt-3">Thông tin nhóm xét nghiệm</Text>
                    {selectedServiceType === "reproduction" ? (
                      <>
                        <FormFieldGroup>
                          <FormSelect
                            name="fetusesNumber"
                            label="Số thai"
                            required
                            options={[...EMBRYO_CREATE_OPTIONS]}
                            getLabel={(o) => o.label}
                            getValue={(o) => o.value}
                            placeholder="Chọn 1, 2 hoặc 3"
                            modalTitle="Chọn số thai"
                          />
                          <FormNumericInput
                            name="fetusesWeek"
                            label="Tuần thai (tối đa 40)"
                            type="integer"
                            placeholder="Tuần"
                            helperText="Số nguyên từ 0 đến 40"
                            numericMax={40}
                          />
                        </FormFieldGroup>
                        <FormFieldGroup>
                          <FormNumericInput
                            name="fetusesDay"
                            label="Ngày thai (tối đa 30)"
                            type="integer"
                            placeholder="Ngày"
                            helperText="Số nguyên từ 0 đến 30"
                            numericMax={30}
                          />
                          <FormDatePicker
                            name="ultrasoundDay"
                            label="Ngày siêu âm"
                            placeholder="Chọn ngày siêu âm"
                            helperText="Tùy chọn — không bắt buộc, không chặn ngày"
                          />
                        </FormFieldGroup>
                        <FormFieldGroup>
                          <FormNumericInput
                            name="headRumpLength"
                            label="Chiều dài đầu mông (CRL) (mm)"
                            type="decimal"
                            placeholder="Nhập chiều dài (mm)"
                            helperText="Khoảng hợp lệ: 0 - 100 mm"
                            numericMax={100}
                          />
                          <FormNumericInput
                            name="neckLength"
                            label="Độ mờ da gáy (NT) (mm)"
                            type="decimal"
                            placeholder="Nhập độ mờ (mm)"
                            helperText="Khoảng hợp lệ: 0 - 5 mm"
                            numericMax={5}
                          />
                        </FormFieldGroup>
                        <FormTextarea
                          name="combinedTestResult"
                          label="Kết quả combined test"
                          placeholder="Mô tả kết quả combined test"
                          minHeight={80}
                          maxLength={MAX_TEXTAREA_LENGTH}
                        />
                        <FormTextarea
                          name="ultrasoundResult"
                          label="Kết quả siêu âm"
                          placeholder="Mô tả kết quả siêu âm"
                          minHeight={80}
                          maxLength={MAX_TEXTAREA_LENGTH}
                        />
                      </>
                    ) : selectedServiceType === "embryo" ? (
                      <>
                        <FormSelect
                          name="embryoNumber"
                          label="Số lượng phôi"
                          required
                          options={[...EMBRYO_CREATE_OPTIONS]}
                          getLabel={(o) => o.label}
                          getValue={(o) => o.value}
                          placeholder="Chọn 1, 2 hoặc 3"
                          modalTitle="Chọn số lượng phôi"
                        />
                        <FormDatePicker
                          name="embryoBiospyDate"
                          label="Ngày sinh thiết"
                          placeholder="dd/mm/yyyy"
                          helperText="Tùy chọn — không chặn ngày"
                        />
                        <FormInput
                          name="embryoBiospy"
                          label="Sinh thiết"
                          placeholder="Loại sinh thiết"
                          maxLength={255}
                        />
                        <FormInput
                          name="embryoCellContainingSolution"
                          label="Dung dịch chứa tế bào"
                          placeholder="Loại dung dịch"
                          maxLength={255}
                        />
                        <FormInput
                          name="embryoStatus"
                          label="Tình trạng phôi"
                          placeholder="Mô tả tình trạng phôi"
                          maxLength={MAX_TEXTAREA_LENGTH}
                        />
                        <FormTextarea
                          name="embryoMorphologicalAssessment"
                          label="Đánh giá hình thái"
                          placeholder="Mô tả đánh giá hình thái"
                          minHeight={80}
                          maxLength={MAX_TEXTAREA_LENGTH}
                        />
                        <FormFieldGroup>
                          <FormSelect
                            name="embryoCellNucleus"
                            label="Có nhân tế bào"
                            options={[...YES_NO_OPTIONS]}
                            getLabel={(o) => o.label}
                            getValue={(o) => o.value}
                            placeholder="Chọn"
                            modalTitle="Có nhân tế bào"
                          />
                          <FormInput
                            name="embryoNegativeControl"
                            label="Đối chứng âm"
                            placeholder="Thông tin đối chứng âm"
                            maxLength={255}
                          />
                        </FormFieldGroup>
                      </>
                    ) : selectedServiceType === "disease" ? (
                      <>
                        <FormTextarea
                          name="diseaseSymptom"
                          label="Triệu chứng"
                          placeholder="Mô tả triệu chứng"
                          minHeight={80}
                          maxLength={MAX_TEXTAREA_LENGTH}
                        />
                        <FormTextarea
                          name="diseaseDiagnose"
                          label="Chẩn đoán"
                          placeholder="Mô tả chẩn đoán"
                          minHeight={80}
                          maxLength={MAX_TEXTAREA_LENGTH}
                        />
                        <View className="mt-1 mb-2">
                          <Text className="text-slate-800 text-sm font-extrabold mb-2">Hình ảnh chẩn đoán</Text>
                          <Text className="text-xs text-slate-500 mb-2">
                            Chọn ảnh từ thư viện hoặc chụp ảnh — ảnh được tải lên Cloudinary và lưu dưới dạng URL.
                          </Text>
                          {!!diseaseDiagnoseImageUrl?.trim() && (
                            <View className="mb-3 rounded-xl border border-sky-200 overflow-hidden bg-sky-50 self-start">
                              <Image
                                source={{ uri: diseaseDiagnoseImageUrl.trim() }}
                                className="w-40 h-40"
                                resizeMode="cover"
                              />
                            </View>
                          )}
                          <View className="flex-row flex-wrap gap-2 mb-2">
                            <TouchableOpacity
                              onPress={pickDiseaseDiagnoseImageFromLibrary}
                              disabled={uploadingDiseaseDiagnoseImage}
                              className={`px-4 py-2.5 rounded-xl border ${uploadingDiseaseDiagnoseImage ? "bg-slate-200 border-slate-200" : "bg-sky-600 border-sky-600"
                                }`}
                              activeOpacity={0.85}
                            >
                              {uploadingDiseaseDiagnoseImage ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <Text className="text-white text-xs font-extrabold">Chọn ảnh</Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={pickDiseaseDiagnoseImageFromCamera}
                              disabled={uploadingDiseaseDiagnoseImage}
                              className={`px-4 py-2.5 rounded-xl border ${uploadingDiseaseDiagnoseImage ? "bg-slate-100 border-slate-200" : "bg-white border-sky-300"
                                }`}
                              activeOpacity={0.85}
                            >
                              <Text
                                className={`text-xs font-extrabold ${uploadingDiseaseDiagnoseImage ? "text-slate-400" : "text-sky-700"
                                  }`}
                              >
                                Chụp ảnh
                              </Text>
                            </TouchableOpacity>
                            {!!diseaseDiagnoseImageUrl?.trim() && (
                              <TouchableOpacity
                                onPress={clearDiseaseDiagnoseImage}
                                disabled={uploadingDiseaseDiagnoseImage}
                                className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50"
                                activeOpacity={0.85}
                              >
                                <Text className="text-red-700 text-xs font-extrabold">Xóa ảnh</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <FormInput
                            name="diseaseDiagnoseImage"
                            label="Hoặc dán URL ảnh"
                            placeholder="https://..."
                            maxLength={2000}
                          />
                        </View>
                        <FormTextarea
                          name="diseaseTestRelated"
                          label="Xét nghiệm liên quan"
                          placeholder="Mô tả xét nghiệm liên quan"
                          minHeight={80}
                          maxLength={MAX_TEXTAREA_LENGTH}
                        />
                        <FormTextarea
                          name="diseaseTreatmentMethods"
                          label="Phương pháp điều trị"
                          placeholder="Mô tả phương pháp điều trị"
                          minHeight={80}
                          maxLength={MAX_TEXTAREA_LENGTH}
                        />
                        <FormNumericInput
                          name="diseaseTreatmentTimeDay"
                          label="Thời gian điều trị (ngày)"
                          type="integer"
                          placeholder="Số ngày điều trị"
                          helperText="Số nguyên ≥ 0"
                        />
                        <FormTextarea
                          name="diseaseDrugResistance"
                          label="Kháng thuốc"
                          placeholder="Mô tả tình trạng kháng thuốc"
                          minHeight={80}
                          maxLength={MAX_TEXTAREA_LENGTH}
                        />
                        <FormTextarea
                          name="diseaseRelapse"
                          label="Tái phát"
                          placeholder="Mô tả tình trạng tái phát"
                          minHeight={80}
                          maxLength={MAX_TEXTAREA_LENGTH}
                        />
                      </>
                    ) : (
                      <FormInfoBox>
                        Đã chọn {SERVICE_TYPE_MAPPER[selectedServiceType] || selectedServiceType}. Nhập thông tin nhóm phù hợp theo nghiệp vụ.
                      </FormInfoBox>
                    )}
                  </>
                )}

                {(!isStepFormMode || currentFormStep === 6) && (
                  <>
                    <Text className="text-slate-700 text-[13px] font-bold mb-2 mt-3">Ghi chú</Text>
                    <FormTextarea
                      name="specifyNote"
                      label="Ghi chú phiếu"
                      placeholder="Nhập ghi chú cho phiếu chỉ định (nếu có)"
                      minHeight={90}
                      maxLength={MAX_NOTE_LENGTH}
                      helperText={`Tối đa ${MAX_NOTE_LENGTH} ký tự`}
                    />
                  </>
                )}
              </View>
            )}
          </ScrollView>

          <View className="p-4 bg-white border-t border-sky-100">
            {isQuickMode ? (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => router.back()}
                  disabled={createMutation.isPending}
                  className="flex-1 p-4 rounded-2xl bg-slate-100 border border-slate-200 items-center justify-center"
                  activeOpacity={0.85}
                >
                  <Text className="text-slate-700 text-base font-extrabold">Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={createMutation.isPending}
                  className={`flex-1 p-4 rounded-2xl items-center justify-center ${createMutation.isPending ? "bg-slate-300" : "bg-sky-600"
                    }`}
                  activeOpacity={0.85}
                >
                  <Text className="text-white text-base font-extrabold">
                    {createMutation.isPending ? "Đang tạo..." : "Tạo phiếu"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {isStepFormMode ? (
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => {
                        if (currentFormStep === 1) {
                          router.back();
                          return;
                        }
                        setCurrentFormStep((prev) => Math.max(prev - 1, 1));
                      }}
                      disabled={createMutation.isPending}
                      className="flex-1 p-4 rounded-2xl bg-slate-100 border border-slate-200 items-center justify-center"
                      activeOpacity={0.85}
                    >
                      <Text className="text-slate-700 text-base font-extrabold">
                        {currentFormStep === 1 ? "Huỷ" : "Quay lại"}
                      </Text>
                    </TouchableOpacity>
                    {currentFormStep < SPECIFY_FORM_STEP_COUNT ? (
                      <TouchableOpacity
                        onPress={handleNextWizardStep}
                        disabled={createMutation.isPending}
                        className="flex-1 p-4 rounded-2xl items-center justify-center bg-sky-600"
                        activeOpacity={0.85}
                      >
                        <Text className="text-white text-base font-extrabold">Tiếp theo</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={createMutation.isPending}
                        className={`flex-1 p-4 rounded-2xl items-center justify-center ${createMutation.isPending ? "bg-slate-300" : "bg-sky-600"
                          }`}
                        activeOpacity={0.85}
                      >
                        <Text className="text-white text-base font-extrabold">
                          {createMutation.isPending
                            ? isEditMode
                              ? "Đang cập nhật..."
                              : "Đang tạo..."
                            : isEditMode
                              ? "Cập nhật phiếu"
                              : "Tạo mới"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={createMutation.isPending}
                    className={`p-4 rounded-2xl flex-row items-center justify-center ${createMutation.isPending ? "bg-slate-300" : "bg-sky-600"
                      }`}
                    activeOpacity={0.85}
                  >
                    <Text className="text-white text-base font-extrabold">
                      {createMutation.isPending
                        ? isEditMode
                          ? "Đang cập nhật..."
                          : "Đang tạo..."
                        : isEditMode
                          ? "Cập nhật phiếu"
                          : "Tạo mới"}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </FormProvider>
  );
}
