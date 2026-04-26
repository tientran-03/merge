import { z } from "zod";

// Payment type enum matching web
export enum PaymentType {
  CASH = "CASH",
  ONLINE_PAYMENT = "ONLINE_PAYMENT",
}

// Payment status enum matching web
export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  UNPAID = "UNPAID",
}

// Order status enum matching web
export enum OrderStatus {
  INITIATION = "initiation",
  FORWARD_ANALYSIS = "forward_analysis",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  IN_PROGRESS = "in_progress",
  SAMPLE_ERROR = "sample_error",
  RERUN_TESTING = "rerun_testing",
  COMPLETED = "completed",
  SAMPLE_ADDITION = "sample_addition",
}

// Barcode status enum matching web
export enum BarcodeStatus {
  CREATED = "created",
  NOT_PRINTED = "not_printed",
  PRINTED = "printed",
}

export enum StaffPosition {
  SAMPLE_COLLECTOR = "sample_collector",
  LAB_TECHNICIAN = "lab_technician",
  DOCTOR="doctor",
  STAFF = "staff",
  ADMIN = "admin",
}

export enum SpecifyStatus {
  INITIATION = "initation", // Note: typo in backend
  PAYMENT_FAILED = "payment_failed",
  WAITING_RECEIVE_SAMPLE ="waiting_receive_sample",
  FORWARD_ANALYSIS = "forward_analysis",
  /** Đơn hàng đã tạo — giống web `SpecifyStatus.ACCEPTED` sau create order */
  ACCEPTED = "accepted",
  SAMPLE_COLLECTING = "sample_collecting",
  SAMPLE_RETRIEVED = "sample_retrieved",
  ANALYZE_IN_PROGRESS = "analyze_in_progress",
  RERUN_TESTING = "rerun_testing",
  AWAITING_RESULTS_APPROVAL = "awaiting_results_approval",
  RESULTS_APPROVED = "results_approved",
  CANCELED = "canceled",
  REJECTED = "rejected",
  SAMPLE_ADDITION = "sample_addition",
  SAMPLE_ERROR = "sample_error",
  COMPLETED = "completed",
}

// Service type matching web
export enum ServiceType {
  EMBRYO = "embryo",
  DISEASE = "disease",
  REPRODUCTION = "reproduction",
}

// Order form schema matching web validation
export const orderFormSchema = z.object({
  // Step 1: Basic Order Info
  orderName: z.string().min(1, "Vui lòng nhập tên đơn hàng"),
  doctorId: z.string().optional(),
  staffId: z.string().optional(), // người thu tiền
  paymentAmount: z.string().optional(),
  staffAnalystId: z.string().optional(), // nhân viên phụ trách
  sampleCollectorId: z.string().optional(), // nhân viên thu mẫu
  barcodeId: z.string().optional(),
  paymentType: z.nativeEnum(PaymentType).or(z.literal("")),
  customerId: z.string().optional(), // customer ID từ patient

  // Step 2: Specify Image
  specifyVoteTestImagePath: z.string().optional(),

  // Step 3: Specify Info
  specifyId: z.string().optional(),
  // Patient info (from specify)
  patientPhone: z.string().optional(),
  patientName: z.string().optional(),
  patientDob: z.string().optional(),
  patientGender: z.string().optional(),
  patientEmail: z.string().optional(),
  patientJob: z.string().optional(),
  patientContactName: z.string().optional(),
  patientContactPhone: z.string().optional(),
  patientAddress: z.string().optional(),
  // Genome test info
  genomeTestId: z.string().optional(),
  testName: z.string().optional(),
  testSample: z.string().optional(),
  testContent: z.string().optional(),
  samplingSite: z.string().optional(),
  sampleCollectDate: z.string().optional(),
  embryoNumber: z.string().optional(),

  // Step 4: Clinical Info
  patientHeight: z.string().optional(),
  patientWeight: z.string().optional(),
  patientHistory: z.string().optional(),
  familyHistory: z.string().optional(),
  toxicExposure: z.string().optional(),
  medicalHistory: z.string().optional(),
  chronicDisease: z.string().optional(),
  acuteDisease: z.string().optional(),
  medicalUsing: z.string().optional(),

  // Step 5: Genetic Test Results
  geneticTestResults: z.string().optional(),
  geneticTestResultsRelationship: z.string().optional(),

  // Step 6: Service Type Group
  serviceType: z.enum(["reproduction", "embryo", "disease", ""]).optional(),
  // Reproduction fields
  fetusesWeek: z.string().optional(),
  fetusesDay: z.string().optional(),
  headRumpLength: z.string().optional(),
  ultrasoundDay: z.string().optional(),
  fetusesNumber: z.string().optional(),
  neckLength: z.string().optional(),
  combinedTestResult: z.string().optional(),
  ultrasoundResult: z.string().optional(),
  // Embryo fields
  biospy: z.string().optional(),
  biospyDate: z.string().optional(),
  cellContainingSolution: z.string().optional(),
  embryoCreate: z.string().optional(),
  embryoStatus: z.string().optional(),
  morphologicalAssessment: z.string().optional(),
  cellNucleus: z.boolean().optional(),
  negativeControl: z.string().optional(),
  // Disease fields
  symptom: z.string().optional(),
  diagnose: z.string().optional(),
  testRelated: z.string().optional(),
  treatmentMethods: z.string().optional(),
  treatmentTimeDay: z.string().optional(),
  drugResistance: z.string().optional(),
  relapse: z.string().optional(),

  // Step 7: Order Note
  orderNote: z.string().optional(),
});

export type OrderFormData = z.infer<typeof orderFormSchema>;

export const defaultOrderFormValues: OrderFormData = {
  // Step 1
  orderName: "",
  doctorId: "",
  staffId: "",
  paymentAmount: "",
  staffAnalystId: "",
  sampleCollectorId: "",
  barcodeId: "",
  paymentType: "",
  customerId: "",

  // Step 2
  specifyVoteTestImagePath: "",

  // Step 3
  specifyId: "",
  patientPhone: "",
  patientName: "",
  patientDob: "",
  patientGender: "",
  patientEmail: "",
  patientJob: "",
  patientContactName: "",
  patientContactPhone: "",
  patientAddress: "",
  genomeTestId: "",
  testName: "",
  testSample: "",
  testContent: "",
  samplingSite: "",
  sampleCollectDate: "",
  embryoNumber: "",

  // Step 4
  patientHeight: "",
  patientWeight: "",
  patientHistory: "",
  familyHistory: "",
  toxicExposure: "",
  medicalHistory: "",
  chronicDisease: "",
  acuteDisease: "",
  medicalUsing: "",

  // Step 5
  geneticTestResults: "",
  geneticTestResultsRelationship: "",

  // Step 6
  serviceType: "",
  fetusesWeek: "",
  fetusesDay: "",
  headRumpLength: "",
  ultrasoundDay: "",
  fetusesNumber: "",
  neckLength: "",
  combinedTestResult: "",
  ultrasoundResult: "",
  biospy: "",
  biospyDate: "",
  cellContainingSolution: "",
  embryoCreate: "",
  embryoStatus: "",
  morphologicalAssessment: "",
  cellNucleus: false,
  negativeControl: "",
  symptom: "",
  diagnose: "",
  testRelated: "",
  treatmentMethods: "",
  treatmentTimeDay: "",
  drugResistance: "",
  relapse: "",

  // Step 7
  orderNote: "",
};

// Helper functions matching web
export const getPaymentTypeDisplayName = (type: PaymentType | string | undefined): string => {
  switch (type) {
    case PaymentType.ONLINE_PAYMENT:
    case "ONLINE_PAYMENT":
      return "Thanh toán online";
    case PaymentType.CASH:
    case "CASH":
      return "Tiền mặt";
    default:
      return String(type || "");
  }
};

export const getStaffPositionDisplayName = (position: StaffPosition | string | undefined): string => {
  switch (position) {
    case StaffPosition.STAFF:
    case "STAFF":
    case "staff":
      return "Nhân viên";
    case StaffPosition.LAB_TECHNICIAN:
    case "LAB_TECHNICIAN":
    case "lab_technician":
      return "KTV xét nghiệm";
    case StaffPosition.SAMPLE_COLLECTOR:
    case "SAMPLE_COLLECTOR":
    case "sample_collector":
      return "NV thu mẫu";
    case "doctor":
      return "Bác sĩ";
    default:
      return String(position || "");
  }
};

// Step field validation for each step (matching web behavior)
export const STEP_FIELDS: Record<number, (keyof OrderFormData)[]> = {
  1: ["orderName", "paymentType"], // paymentType required for create mode
  2: [], // Image is optional
  3: [], // Specify info is optional
  4: [], // Clinical info is read-only
  5: [], // Genetic results is read-only
  6: [], // Service type fields are read-only
  7: [], // Order note is optional
};
