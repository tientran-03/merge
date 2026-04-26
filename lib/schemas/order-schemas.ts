import { z } from "zod";

import { parseVndAmountInput } from "@/utils/money";

export const GENDER_OPTIONS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Khác" },
] as const;

export const SERVICE_TYPE_MAPPER:Record<string,string> = {
  "embryo": "Phôi",
  "disease": "Bệnh lý",
  "reproduction": "Sản",
 } as const;

export const SERVICE_TYPE_OPTIONS = [
  { value: "embryo", label: "Phôi" },
  { value: "disease", label: "Bệnh lý" },
  { value: "reproduction", label: "Sản" },
] as const;

export const PAYMENT_TYPE_OPTIONS = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "ONLINE_PAYMENT", label: "Thanh toán online" },
] as const;

export const PAYMENT_STATUS_OPTIONS = [
  { value: "UNPAID", label: "Chưa thanh toán" },
  { value: "COMPLETED", label: "Đã thanh toán" },
] as const;

/** Số lượng phôi — chọn 1 / 2 / 3 (nhóm phôi, đồng bộ web) */
export const EMBRYO_COUNT_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
];

const ORDER_NAME_MAX_LENGTH = 255;
const TEXT_MAX_LENGTH = 255;
const ADDRESS_MAX_LENGTH = 500;
const PAYMENT_AMOUNT_MAX = 1_000_000_000;
const VN_PHONE_REGEX = /^0\d{9}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DMY_DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

const parseNumericString = (value?: string): number | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

/** Số thập phân hoàn chỉnh: 50, 50.5 — từ chối "50.", ".", "1..2" */
const isCompleteDecimalNumberString = (raw: string): boolean => {
  const s = raw.trim();
  if (!s) return false;
  return /^\d+(\.\d+)?$/.test(s);
};

const isNonEmpty = (value?: string): boolean => String(value ?? "").trim().length > 0;

/** Dùng chung khi validate ngày (form đặt hàng, v.v.) */
export const parseFlexibleDate = (value?: string): Date | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (ISO_DATE_REGEX.test(raw)) {
    const date = new Date(`${raw}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (DMY_DATE_REGEX.test(raw)) {
    const [day, month, year] = raw.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    const isExact =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
    return isExact ? date : null;
  }

  // FormDatePicker / API: full ISO datetime
  if (raw.includes("T") || /^[+-]?\d{4}-\d{2}-\d{2}/.test(raw)) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const requiredTrimmedString = (message: string, maxLength = TEXT_MAX_LENGTH) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, { message })
    .refine((v) => v.length <= maxLength, {
      message: `Không được vượt quá ${maxLength} ký tự`,
    });

const optionalTrimmedString = (maxLength = TEXT_MAX_LENGTH) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length <= maxLength, {
      message: `Không được vượt quá ${maxLength} ký tự`,
    })
    .optional();

const optionalPhoneString = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => !v || VN_PHONE_REGEX.test(v), {
    message: "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0",
  })
  .optional();

const requiredPhoneString = (message: string) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, { message })
    .refine((v) => VN_PHONE_REGEX.test(v), {
      message: "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0",
    });

const optionalDateString = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => !v || !!parseFlexibleDate(v), {
    message: "Ngày phải đúng định dạng yyyy-MM-dd, dd/MM/yyyy hoặc chuỗi ngày ISO",
  })
  .optional();

const requiredDateString = (message: string) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, { message })
    .refine((v) => !!parseFlexibleDate(v), {
      message: "Ngày phải đúng định dạng yyyy-MM-dd, dd/MM/yyyy hoặc chuỗi ngày ISO",
    });

export const step1Schema = z.object({
  orderName: requiredTrimmedString("Vui lòng nhập tên đơn hàng", ORDER_NAME_MAX_LENGTH).refine(
    (v) => !/^\d/.test(v),
    { message: "Tên đơn hàng không được bắt đầu bằng số" }
  ),
  doctorId: requiredTrimmedString("Vui lòng chọn bác sĩ chỉ định", 100),
  hospitalId: requiredTrimmedString("Vui lòng chọn phòng khám/bệnh viện", 100),
  customerId: z.string().optional(),
  paymentAmount: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => {
      if (!v) return true;
      const amount = parseVndAmountInput(v);
      return Number.isFinite(amount) && amount > 0 && amount <= PAYMENT_AMOUNT_MAX;
    }, "Số tiền đã thu phải lớn hơn 0 và không vượt quá 1.000.000.000"),
  staffId: z.string().optional(),
  staffAnalystId: requiredTrimmedString("Vui lòng chọn nhân viên phụ trách", 100),
  sampleCollectorId: requiredTrimmedString("Vui lòng chọn nhân viên thu mẫu", 100),
  barcodeId: requiredTrimmedString("Vui lòng chọn mã Barcode PCĐ", 100),
  orderStatus: z.enum(["initiation", "forward_analysis", "accepted", "rejected", "in_progress", "sample_error", "rerun_testing", "completed", "sample_addition"]).optional(),
});

export type Step1FormData = z.infer<typeof step1Schema>;

export const step2Schema = z.object({
  patientName: requiredTrimmedString("Vui lòng nhập tên người làm xét nghiệm", TEXT_MAX_LENGTH).refine(
    (v) => !/^\d/.test(v),
    { message: "Họ tên không được bắt đầu bằng số" }
  ),
  patientPhone: requiredPhoneString("Vui lòng nhập số điện thoại"),
  patientDob: requiredDateString("Vui lòng nhập ngày sinh"),
  patientGender: z.enum(["male", "female", "other", ""]),
  patientEmail: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Email không hợp lệ",
    })
    .optional(),
  patientJob: optionalTrimmedString(TEXT_MAX_LENGTH),
  patientContactName: requiredTrimmedString("Vui lòng nhập người liên hệ", TEXT_MAX_LENGTH).refine(
    (v) => !/^\d/.test(v),
    { message: "Người liên hệ không được bắt đầu bằng số" }
  ),
  patientContactPhone: requiredPhoneString("Vui lòng nhập SĐT người liên hệ"),
  patientAddress: requiredTrimmedString("Vui lòng nhập địa chỉ bệnh nhân", ADDRESS_MAX_LENGTH),
  specifyId: z.string().optional(),
  specifyImagePath: z.string().optional(),
  patientId: z.string().optional(),
});

export type Step2FormData = z.infer<typeof step2Schema>;

export const step5Schema = z.object({
  genomeTestId: requiredTrimmedString("Vui lòng chọn xét nghiệm", 100),
  testName: requiredTrimmedString("Vui lòng nhập tên xét nghiệm", TEXT_MAX_LENGTH),
  testSample: requiredTrimmedString("Vui lòng nhập mẫu xét nghiệm", TEXT_MAX_LENGTH),
  testContent: optionalTrimmedString(1000),
  serviceType: z.enum(["embryo", "disease", "reproduction", ""]).optional(),
});

export type Step5FormData = z.infer<typeof step5Schema>;

export const step4Schema = z.object({
  patientHeight: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, {
      message: "Vui lòng nhập chiều cao",
    })
    .refine((v) => isCompleteDecimalNumberString(v), {
      message: "Chiều cao phải là số hợp lệ (vd: 165 hoặc 165.5), không kết thúc bằng dấu chấm",
    })
    .refine((v) => {
      const n = parseNumericString(v);
      /** Giống web đặt hàng: `clinical-info-section` — min 0, max 200 cm */
      return n !== null && n >= 0 && n <= 200;
    }, "Chiều cao phải từ 0 đến 200 cm")
    ,
  patientWeight: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, {
      message: "Vui lòng nhập cân nặng",
    })
    .refine((v) => isCompleteDecimalNumberString(v), {
      message: "Cân nặng phải là số hợp lệ (vd: 60 hoặc 60.5), không kết thúc bằng dấu chấm",
    })
    .refine((v) => {
      const n = parseNumericString(v);
      /** Giống web đặt hàng: `clinical-info-section` — min 0, max 100 kg */
      return n !== null && n >= 0 && n <= 100;
    }, "Cân nặng phải từ 0 đến 100 kg")
    ,
  patientHistory: requiredTrimmedString("Vui lòng nhập tiền sử bệnh nhân", 1000),
  familyHistory: optionalTrimmedString(1000),
  toxicExposure: optionalTrimmedString(1000),
  medicalHistory: optionalTrimmedString(1000),
  chronicDisease: optionalTrimmedString(1000),
  acuteDisease: requiredTrimmedString("Vui lòng nhập bệnh lý cấp tính", 1000),
  medicalUsing: requiredTrimmedString("Vui lòng nhập thuốc đang dùng", 1000),
});

export type Step4FormData = z.infer<typeof step4Schema>;

// Reproduction service fields
const reproductionServiceFields = z.object({
  fetusesNumber: z.string().optional(),
  fetusesWeek: z.string().optional(),
  fetusesDay: z.string().optional(),
  ultrasoundDay: z.string().optional(),
  headRumpLength: z.string().optional(),
  neckLength: z.string().optional(),
  combinedTestResult: z.string().optional(),
  ultrasoundResult: z.string().optional(),
});

// Embryo service fields
const embryoServiceFields = z.object({
  biospy: z.string().optional(),
  biospyDate: z.string().optional(),
  cellContainingSolution: z.string().optional(),
  embryoCreate: z.string().optional(),
  embryoStatus: z.string().optional(),
  morphologicalAssessment: z.string().optional(),
  cellNucleus: z.boolean().optional(),
  negativeControl: z.string().optional(),
});

// Disease service fields
const diseaseServiceFields = z.object({
  symptom: z.string().optional(),
  diagnose: z.string().optional(),
  diagnoseImage: z.string().optional(),
  testRelated: z.string().optional(),
  treatmentMethods: z.string().optional(),
  treatmentTimeDay: z.string().optional(),
  drugResistance: z.string().optional(),
  relapse: z.string().optional(),
});

export const step3Schema = z.object({
  serviceType: z.enum(["embryo", "disease", "reproduction", ""]),
  genomeTestId: z.string().optional(),
  testName: optionalTrimmedString(TEXT_MAX_LENGTH),
  testSample: optionalTrimmedString(TEXT_MAX_LENGTH),
  testContent: optionalTrimmedString(1000),
  // Reproduction service fields
  fetusesNumber: z.string().optional(),
  fetusesWeek: z.string().optional(),
  fetusesDay: z.string().optional(),
  ultrasoundDay: z.string().optional(),
  headRumpLength: z.string().optional(),
  neckLength: z.string().optional(),
  combinedTestResult: z.string().optional(),
  ultrasoundResult: z.string().optional(),
  // Embryo service fields
  biospy: optionalTrimmedString(TEXT_MAX_LENGTH),
  biospyDate: optionalDateString,
  cellContainingSolution: optionalTrimmedString(TEXT_MAX_LENGTH),
  embryoCreate: z.string().optional(),
  embryoStatus: optionalTrimmedString(TEXT_MAX_LENGTH),
  morphologicalAssessment: optionalTrimmedString(1000),
  cellNucleus: z.boolean().optional(),
  negativeControl: optionalTrimmedString(TEXT_MAX_LENGTH),
  // Disease service fields
  symptom: optionalTrimmedString(1000),
  diagnose: optionalTrimmedString(1000),
  diagnoseImage: optionalTrimmedString(1000),
  testRelated: optionalTrimmedString(1000),
  treatmentMethods: optionalTrimmedString(1000),
  treatmentTimeDay: z.string().optional(),
  drugResistance: optionalTrimmedString(1000),
  relapse: optionalTrimmedString(1000),
});

export type Step3FormData = z.infer<typeof step3Schema>;
export const step6Schema = z.object({
  fastq: z.enum(["YES", "NO"]).optional(),
  paymentStatus: z.enum(["UNPAID", "COMPLETED"]).optional(),
  paymentAmount: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => {
      if (!v) return true;
      const amount = parseVndAmountInput(v);
      return Number.isFinite(amount) && amount > 0 && amount <= PAYMENT_AMOUNT_MAX;
    }, "Số tiền đã thu phải lớn hơn 0 và không vượt quá 1.000.000.000"),
  paymentType: z.enum(["CASH", "ONLINE_PAYMENT"]).optional(),
  samplingSite: optionalTrimmedString(TEXT_MAX_LENGTH),
  sampleCollectDate: z.string().transform((v) => v.trim()),
  embryoNumber: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => {
      if (!v) return true;
      const n = parseNumericString(v);
      return n !== null && Number.isInteger(n) && n >= 1 && n <= 3;
    }, "Số lượng phôi chỉ được chọn 1, 2 hoặc 3")
    .optional(),
  specifyVoteImagePath: optionalTrimmedString(1000),
  invoiceLink: optionalTrimmedString(2048),
});

export type Step6FormData = z.infer<typeof step6Schema>;

export const step7Schema = z.object({
  geneticTestResults: z.string().optional(),
  geneticTestResultsRelationship: z.string().optional(),
});

export type Step7FormData = z.infer<typeof step7Schema>;

export const createOrderSchema = z.object({
  step1: step1Schema,
  step2: step2Schema,
  step3: step3Schema,
  step4: step4Schema,
  step5: step5Schema,
  step6: step6Schema,
  step7: step7Schema,
}).superRefine((data, ctx) => {
  if (!data.step3.serviceType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vui lòng chọn nhóm xét nghiệm",
      path: ["step3", "serviceType"],
    });
  }

  /** Nhóm sản — khớp admin web (service-type-section): bắt buộc tuần/ngày thai + số lượng thai; các trường khác tuỳ chọn */
  if (data.step3.serviceType === "reproduction") {
    const reproductionRequired: Array<{ field: keyof typeof data.step3; message: string }> = [
      { field: "fetusesNumber", message: "Vui lòng chọn số lượng thai" },
      { field: "fetusesWeek", message: "Vui lòng nhập tuần thai" },
      { field: "fetusesDay", message: "Vui lòng nhập ngày thai" },
    ];

    reproductionRequired.forEach(({ field, message }) => {
      if (!isNonEmpty(data.step3[field] as string)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message,
          path: ["step3", field],
        });
      }
    });

    const fetusesNumber = parseNumericString(data.step3.fetusesNumber);
    if (
      isNonEmpty(data.step3.fetusesNumber) &&
      (fetusesNumber === null || !Number.isInteger(fetusesNumber) || fetusesNumber < 1 || fetusesNumber > 3)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Số lượng thai: chọn 1, 2 hoặc 3 (giống web quản trị)",
        path: ["step3", "fetusesNumber"],
      });
    }

    const fetusesWeek = parseNumericString(data.step3.fetusesWeek);
    if (
      isNonEmpty(data.step3.fetusesWeek) &&
      (fetusesWeek === null || !Number.isInteger(fetusesWeek) || fetusesWeek < 0 || fetusesWeek > 40)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tuần thai phải là số nguyên từ 0 đến 40",
        path: ["step3", "fetusesWeek"],
      });
    }

    const fetusesDay = parseNumericString(data.step3.fetusesDay);
    if (
      isNonEmpty(data.step3.fetusesDay) &&
      (fetusesDay === null || !Number.isInteger(fetusesDay) || fetusesDay < 0 || fetusesDay > 30)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ngày thai phải là số nguyên từ 0 đến 30",
        path: ["step3", "fetusesDay"],
      });
    }

    const headRumpLength = parseNumericString(data.step3.headRumpLength);
    if (
      isNonEmpty(data.step3.headRumpLength) &&
      (headRumpLength === null || headRumpLength < 0 || headRumpLength > 100)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Chiều dài đầu mông phải trong khoảng 0 - 100 mm",
        path: ["step3", "headRumpLength"],
      });
    }

    const neckLength = parseNumericString(data.step3.neckLength);
    if (
      isNonEmpty(data.step3.neckLength) &&
      (neckLength === null || neckLength < 0 || neckLength > 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Độ mờ da gáy phải trong khoảng 0 - 5 mm",
        path: ["step3", "neckLength"],
      });
    }
  }

  /** Nhóm phôi — khớp web: không bắt buộc toàn bộ; số phôi tạo chỉ 1 / 2 / 3 */
  if (data.step3.serviceType === "embryo") {
    const embryoCreate = parseNumericString(data.step3.embryoCreate);
    if (
      isNonEmpty(data.step3.embryoCreate) &&
      (embryoCreate === null || !Number.isInteger(embryoCreate) || embryoCreate < 1 || embryoCreate > 3)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Số phôi tạo: chọn 1, 2 hoặc 3 (giống web quản trị)",
        path: ["step3", "embryoCreate"],
      });
    }

    const biospyDate = parseFlexibleDate(data.step3.biospyDate);
    if (isNonEmpty(data.step3.biospyDate) && !biospyDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ngày sinh thiết không hợp lệ (yyyy-MM-dd hoặc dd/MM/yyyy)",
        path: ["step3", "biospyDate"],
      });
    }
  }

  /** Nhóm bệnh lý — khớp web: các trường gửi API dạng optional */
  if (data.step3.serviceType === "disease") {
    const treatmentTimeDay = parseNumericString(data.step3.treatmentTimeDay);
    if (
      isNonEmpty(data.step3.treatmentTimeDay) &&
      (treatmentTimeDay === null || !Number.isInteger(treatmentTimeDay) || treatmentTimeDay < 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Số ngày điều trị phải là số nguyên ≥ 0",
        path: ["step3", "treatmentTimeDay"],
      });
    }
  }

  if (data.step6.fastq !== "YES" && !data.step6.paymentType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vui lòng chọn hình thức thanh toán",
      path: ["step6", "paymentType"],
    });
  }
});

export type CreateOrderFormData = z.infer<typeof createOrderSchema>;

export const createOrderDefaultValues: CreateOrderFormData = {
  step1: {
    orderName: "",
    doctorId: "",
    hospitalId: "",
    customerId: "",
    paymentAmount: "",
    staffId: "",
    staffAnalystId: "",
    sampleCollectorId: "",
    barcodeId: "",
    orderStatus: undefined,
  },
  step2: {
    patientName: "",
    patientPhone: "",
    patientDob: "",
    patientGender: "",
    patientEmail: "",
    patientJob: "",
    patientContactName: "",
    patientContactPhone: "",
    patientAddress: "",
    specifyId: "",
    specifyImagePath: "",
    patientId: "",
  },
  step5: {
    genomeTestId: "",
    testName: "",
    testSample: "",
    testContent: "",
    serviceType: "",
  },
  step4: {
    patientHeight: "",
    patientWeight: "",
    patientHistory: "",
    familyHistory: "",
    toxicExposure: "",
    medicalHistory: "",
    chronicDisease: "",
    acuteDisease: "",
    medicalUsing: "",
  },
  step3: {
    serviceType: "",
    genomeTestId: "",
    testName: "",
    testSample: "",
    testContent: "",
    // Reproduction service fields
    fetusesNumber: "",
    fetusesWeek: "",
    fetusesDay: "",
    ultrasoundDay: "",
    headRumpLength: "",
    neckLength: "",
    combinedTestResult: "",
    ultrasoundResult: "",
    // Embryo service fields
    biospy: "",
    biospyDate: "",
    cellContainingSolution: "",
    embryoCreate: "",
    embryoStatus: "",
    morphologicalAssessment: "",
    cellNucleus: undefined,
    negativeControl: "",
    // Disease service fields
    symptom: "",
    diagnose: "",
    diagnoseImage: "",
    testRelated: "",
    treatmentMethods: "",
    treatmentTimeDay: "",
    drugResistance: "",
    relapse: "",
  },
  step6: {
    fastq: "NO",
    paymentStatus: "UNPAID",
    paymentAmount: "",
    paymentType: undefined,
    samplingSite: "",
    sampleCollectDate: "",
    embryoNumber: "",
    specifyVoteImagePath: "",
    invoiceLink: "",
  },
  step7: {
    geneticTestResults: "",
    geneticTestResultsRelationship: "",
  },
};

/** Khớp `QuickOrderModal` trên web admin — không gửi doctor/hospital/service/specifyId */
export const quickOrderSchema = z
  .object({
    orderName: requiredTrimmedString("Vui lòng nhập tên đơn hàng", ORDER_NAME_MAX_LENGTH).refine(
      (v) => !/^\d/.test(v),
      { message: "Tên đơn hàng không được bắt đầu bằng số" }
    ),
    staffId: requiredTrimmedString("Vui lòng chọn nhân viên thu tiền", 100),
    staffAnalystId: requiredTrimmedString("Vui lòng chọn nhân viên phụ trách", 100),
    sampleCollectorId: requiredTrimmedString("Vui lòng chọn nhân viên thu mẫu", 100),
    barcodeId: requiredTrimmedString("Vui lòng chọn mã barcode", 200),
    paymentType: z.enum(["CASH", "ONLINE_PAYMENT"]),
    paymentStatus: z.enum(["UNPAID", "COMPLETED"]),
    /** Chỉ nhập khi đã thanh toán — validate trong superRefine */
    paymentAmount: z.string().transform((v) => v.trim()),
    specifyVoteImagePath: requiredTrimmedString("Vui lòng tải ảnh/PDF phiếu xét nghiệm", 2000),
    orderNote: optionalTrimmedString(2000),
    invoiceLink: optionalTrimmedString(2000),
  })
  .superRefine((data, ctx) => {
    if (data.paymentStatus !== "COMPLETED") return;
    if (!String(data.invoiceLink || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Đã thanh toán: vui lòng thêm link hoặc file hóa đơn",
        path: ["invoiceLink"],
      });
    }
    const raw = String(data.paymentAmount || "").trim();
    if (!raw) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng nhập số tiền đã thu",
        path: ["paymentAmount"],
      });
      return;
    }
    const amount = parseVndAmountInput(raw);
    if (!Number.isFinite(amount) || amount <= 0 || amount > PAYMENT_AMOUNT_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Số tiền đã thu không hợp lệ (lớn hơn 0, tối đa 1.000.000.000)",
        path: ["paymentAmount"],
      });
    }
  });

export type QuickOrderFormData = z.infer<typeof quickOrderSchema>;

export const quickOrderDefaultValues: QuickOrderFormData = {
  orderName: "",
  staffId: "",
  staffAnalystId: "",
  sampleCollectorId: "",
  barcodeId: "",
  paymentType: "CASH",
  paymentStatus: "UNPAID",
  paymentAmount: "",
  specifyVoteImagePath: "",
  orderNote: "",
  invoiceLink: "",
};
