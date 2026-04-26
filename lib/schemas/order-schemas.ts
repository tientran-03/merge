import { ORDER_STATUS_VALUES } from '@/lib/constants/order-status';
import { z } from 'zod';

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
] as const;

export const EMBRYO_NUMBER_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
];

export const FETUS_NUMBER_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
];

export const SERVICE_TYPE_MAPPER: Record<string, string> = {
  embryo: 'Phôi',
  disease: 'Bệnh lý',
  reproduction: 'Sản',
} as const;

export const SERVICE_TYPE_OPTIONS = [
  { value: 'embryo', label: 'Phôi' },
  { value: 'disease', label: 'Bệnh lý' },
  { value: 'reproduction', label: 'Sản' },
] as const;

export const PAYMENT_TYPE_OPTIONS = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'ONLINE_PAYMENT', label: 'Thanh toán online' },
] as const;
export type FormPaymentStatus = 'COMPLETED' | 'UNPAID';

export function toFormPaymentStatus(
  raw: string | number | boolean | null | undefined
): FormPaymentStatus {
  const u = String(raw ?? 'UNPAID')
    .trim()
    .toUpperCase();
  return u === 'COMPLETED' ? 'COMPLETED' : 'UNPAID';
}
export const PAYMENT_STATUS_OPTIONS = [
  { value: 'COMPLETED', label: 'Đã thanh toán' },
  { value: 'UNPAID', label: 'Chưa thanh toán' },
] as const;

export const step1Schema = z.object({
  orderName: z.string().min(1, 'Vui lòng nhập tên đơn hàng'),
  doctorId: z.string().optional(),
  customerId: z.string().optional(),
  paymentAmount: z.string().optional(),
  staffId: z.string().optional(),
  staffAnalystId: z.string().optional(),
  sampleCollectorId: z.string().optional(),
  barcodeId: z.string().optional(),
  patientId: z.string().optional(),
  orderStatus: z.enum(ORDER_STATUS_VALUES).optional(),
  paymentStatus: z.enum(['COMPLETED', 'UNPAID']).optional(),
});

export type Step1FormData = z.infer<typeof step1Schema>;

export const step2Schema = z.object({
  patientName: z.string().optional(),
  patientPhone: z.string().optional(),
  patientDob: z.string().optional(),
  patientGender: z.enum(['male', 'female', 'other', '']).optional(),
  patientEmail: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  patientJob: z.string().optional(),
  patientContactName: z.string().optional(),
  patientContactPhone: z.string().optional(),
  patientAddress: z.string().optional(),
  specifyId: z.string().optional(),
  specifyImagePath: z.string().optional(),
  patientId: z.string().optional(),
});

export type Step2FormData = z.infer<typeof step2Schema>;

export const step5Schema = z.object({
  genomeTestId: z.string().optional(),
  testName: z.string().optional(),
  testSample: z.string().optional(),
  testContent: z.string().optional(),
  serviceType: z.enum(['embryo', 'disease', 'reproduction', '']).optional(),
});

export type Step5FormData = z.infer<typeof step5Schema>;

export const step4Schema = z.object({
  patientHeight: z.string().optional(),
  patientWeight: z.string().optional(),
  patientHistory: z.string().optional(),
  familyHistory: z.string().optional(),
  toxicExposure: z.string().optional(),
  medicalHistory: z.string().optional(),
  chronicDisease: z.string().optional(),
  acuteDisease: z.string().optional(),
  medicalUsing: z.string().optional(),
});

export type Step4FormData = z.infer<typeof step4Schema>;

const _reproductionServiceFields = z.object({
  fetusesNumber: z.string().optional(),
  fetusesWeek: z.string().optional(),
  fetusesDay: z.string().optional(),
  ultrasoundDay: z.string().optional(),
  headRumpLength: z.string().optional(),
  neckLength: z.string().optional(),
  combinedTestResult: z.string().optional(),
  ultrasoundResult: z.string().optional(),
});
const _embryoServiceFields = z.object({
  biospy: z.string().optional(),
  biospyDate: z.string().optional(),
  cellContainingSolution: z.string().optional(),
  embryoCreate: z.string().optional(),
  embryoStatus: z.string().optional(),
  morphologicalAssessment: z.string().optional(),
  cellNucleus: z.boolean().optional(),
  negativeControl: z.string().optional(),
});

const _diseaseServiceFields = z.object({
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
  serviceType: z.enum(['embryo', 'disease', 'reproduction', '']).optional(),
  genomeTestId: z.string().optional(),
  testName: z.string().optional(),
  testSample: z.string().optional(),
  testContent: z.string().optional(),
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
});

export type Step3FormData = z.infer<typeof step3Schema>;
export const step6Schema = z.object({
  paymentAmount: z.string().optional(),
  paymentType: z.enum(['CASH', 'ONLINE_PAYMENT']),
  samplingSite: z.string().optional(),
  sampleCollectDate: z.string().optional(),
  embryoNumber: z.string().optional(),
  specifyVoteImagePath: z.string().optional(),
});

export type Step6FormData = z.infer<typeof step6Schema>;

export const step7Schema = z.object({
  geneticTestResults: z.string().optional(),
  geneticTestResultsRelationship: z.string().optional(),
  orderNote: z.string().optional(),
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
});

export type CreateOrderFormData = z.infer<typeof createOrderSchema>;

export const createOrderDefaultValues: CreateOrderFormData = {
  step1: {
    orderName: '',
    doctorId: '',
    customerId: '',
    paymentAmount: '',
    staffId: '',
    staffAnalystId: '',
    sampleCollectorId: '',
    barcodeId: '',
    patientId: '',
    orderStatus: undefined,
    paymentStatus: 'UNPAID',
  },
  step2: {
    patientName: '',
    patientPhone: '',
    patientDob: '',
    patientGender: '',
    patientEmail: '',
    patientJob: '',
    patientContactName: '',
    patientContactPhone: '',
    patientAddress: '',
    specifyId: '',
    specifyImagePath: '',
    patientId: '',
  },
  step5: {
    genomeTestId: '',
    testName: '',
    testSample: '',
    testContent: '',
    serviceType: '',
  },
  step4: {
    patientHeight: '',
    patientWeight: '',
    patientHistory: '',
    familyHistory: '',
    toxicExposure: '',
    medicalHistory: '',
    chronicDisease: '',
    acuteDisease: '',
    medicalUsing: '',
  },
  step3: {
    serviceType: '',
    genomeTestId: '',
    testName: '',
    testSample: '',
    testContent: '',
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
    cellNucleus: undefined,
    negativeControl: '',
    symptom: '',
    diagnose: '',
    diagnoseImage: '',
    testRelated: '',
    treatmentMethods: '',
    treatmentTimeDay: '',
    drugResistance: '',
    relapse: '',
  },
  step6: {
    paymentAmount: '',
    paymentType: 'CASH',
    samplingSite: '',
    sampleCollectDate: '',
    embryoNumber: '',
    specifyVoteImagePath: '',
  },
  step7: {
    geneticTestResults: '',
    geneticTestResultsRelationship: '',
    orderNote: '',
  },
};

export const quickOrderSchema = z
  .object({
    orderName: z.string().min(1, 'Vui lòng nhập tên đơn hàng'),
    staffId: z.string().min(1, 'Vui lòng chọn nhân viên thu tiền'),
    staffAnalystId: z.string().min(1, 'Vui lòng chọn nhân viên phụ trách'),
    sampleCollectorId: z.string().min(1, 'Vui lòng chọn nhân viên thu mẫu'),
    barcodeId: z.string().min(1, 'Vui lòng chọn barcode'),
    paymentType: z.enum(['CASH', 'ONLINE_PAYMENT']),
    /** Đã thanh toán — bắt buộc kèm ảnh hóa đơn. */
    paymentCompleted: z.boolean(),
    paymentAmount: z.string().optional(),
    invoiceLink: z.string().optional(),
    specifyVoteImagePath: z.string().min(1, 'Vui lòng tải ảnh phiếu xét nghiệm'),
    orderNote: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentCompleted && !data.invoiceLink?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Vui lòng tải ảnh hóa đơn khi đã thanh toán',
        path: ['invoiceLink'],
      });
    }
  });

export type QuickOrderFormData = z.infer<typeof quickOrderSchema>;

export const quickOrderDefaultValues: QuickOrderFormData = {
  orderName: '',
  staffId: '',
  staffAnalystId: '',
  sampleCollectorId: '',
  barcodeId: '',
  paymentType: 'CASH',
  paymentCompleted: false,
  paymentAmount: '',
  invoiceLink: '',
  specifyVoteImagePath: '',
  orderNote: '',
};
