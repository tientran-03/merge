import { z } from 'zod';
export enum PaymentType {
  CASH = 'CASH',
  ONLINE_PAYMENT = 'ONLINE_PAYMENT',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  UNPAID = 'UNPAID',
}

export enum OrderStatus {
  INITIATION = 'initiation',
  FORWARD_ANALYSIS = 'forward_analysis',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  IN_PROGRESS = 'in_progress',
  SAMPLE_ERROR = 'sample_error',
  RERUN_TESTING = 'rerun_testing',
  COMPLETED = 'completed',
  SAMPLE_ADDITION = 'sample_addition',
}
export enum BarcodeStatus {
  CREATED = 'created',
  NOT_PRINTED = 'not_printed',
  PRINTED = 'printed',
}

export enum StaffPosition {
  SAMPLE_COLLECTOR = 'sample_collector',
  LAB_TECHNICIAN = 'lab_technician',
  DOCTOR = 'doctor',
  STAFF = 'staff',
  ADMIN = 'admin',
}

export enum SpecifyStatus {
  INITIATION = 'initation',
  PAYMENT_FAILED = 'payment_failed',
  WAITING_RECEIVE_SAMPLE = 'waiting_receive_sample',
  FORWARD_ANALYSIS = 'forward_analysis',
  SAMPLE_COLLECTING = 'sample_collecting',
  SAMPLE_RETRIEVED = 'sample_retrieved',
  ANALYZE_IN_PROGRESS = 'analyze_in_progress',
  RERUN_TESTING = 'rerun_testing',
  AWAITING_RESULTS_APPROVAL = 'awaiting_results_approval',
  RESULTS_APPROVED = 'results_approved',
  CANCELED = 'canceled',
  REJECTED = 'rejected',
  SAMPLE_ADDITION = 'sample_addition',
  SAMPLE_ERROR = 'sample_error',
  COMPLETED = 'completed',
}
export enum ServiceType {
  EMBRYO = 'embryo',
  DISEASE = 'disease',
  REPRODUCTION = 'reproduction',
}
export const orderFormSchema = z
  .object({
    orderName: z.string().min(1, 'Vui lòng nhập tên đơn hàng'),
    doctorId: z.string().optional(),
    staffId: z.string().optional(),
    paymentAmount: z.string().optional(),
    staffAnalystId: z.string().optional(),
    sampleCollectorId: z.string().optional(),
    barcodeId: z.string().optional(),
    paymentType: z.nativeEnum(PaymentType).or(z.literal('')),
    paymentStatus: z.enum(['UNPAID', 'COMPLETED']).or(z.literal('')).optional(),
    invoiceLink: z.string().optional(),
    customerId: z.string().optional(),
    customerFastq: z.boolean().optional(),
    specifyVoteTestImagePath: z.string().optional(),
    specifyId: z.string().optional(),
    patientPhone: z.string().optional(),
    patientName: z.string().optional(),
    patientDob: z.string().optional(),
    patientGender: z.string().optional(),
    patientEmail: z
      .string()
      .optional()
      .refine(
        v =>
          !v ||
          v.trim() === '' ||
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim()),
        'Email không đúng định dạng (VD: example@gmail.com)'
      ),
    patientJob: z.string().optional(),
    patientContactName: z.string().optional(),
    patientContactPhone: z.string().optional(),
    patientAddress: z.string().optional(),
    genomeTestId: z.string().optional(),
    testName: z.string().optional(),
    testSample: z.string().optional(),
    testContent: z.string().optional(),
    samplingSite: z.string().optional(),
    sampleCollectDate: z.string().optional(),
    embryoNumber: z.string().optional(),
    patientHeight: z.string().optional(),
    patientWeight: z.string().optional(),
    patientHistory: z.string().optional(),
    familyHistory: z.string().optional(),
    toxicExposure: z.string().optional(),
    medicalHistory: z.string().optional(),
    chronicDisease: z.string().optional(),
    acuteDisease: z.string().optional(),
    medicalUsing: z.string().optional(),
    geneticTestResults: z.string().optional(),
    geneticTestResultsRelationship: z.string().optional(),
    serviceType: z.enum(['reproduction', 'embryo', 'disease', '']).optional(),
    fetusesWeek: z.string().optional(),
    fetusesDay: z.string().optional(),
    headRumpLength: z.string().optional(),
    ultrasoundDay: z.string().optional(),
    fetusesNumber: z.string().optional(),
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
    testRelated: z.string().optional(),
    treatmentMethods: z.string().optional(),
    treatmentTimeDay: z.string().optional(),
    drugResistance: z.string().optional(),
    relapse: z.string().optional(),

    orderNote: z.string().optional(),
    sendEmailToPatient: z.boolean().optional(),
    sendZaloToPatient: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const optionalClinicalText = (
      raw: string | undefined,
      path: keyof Pick<
        OrderFormData,
        | 'patientHistory'
        | 'familyHistory'
        | 'toxicExposure'
        | 'medicalHistory'
        | 'chronicDisease'
        | 'acuteDisease'
        | 'medicalUsing'
      >,
      label: string
    ) => {
      const value = String(raw ?? '');
      if (!value.trim()) return;
      if (value.trim().length > 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} tối đa 1000 ký tự.`,
          path: [path],
        });
      }
    };
    const optionalRangeNumber = (
      raw: string | undefined,
      path: 'patientHeight' | 'patientWeight',
      min: number,
      max: number,
      label: string
    ) => {
      const value = String(raw ?? '').trim();
      if (!value) return;
      const normalized = value.replace(',', '.');
      const n = Number(normalized);
      if (Number.isNaN(n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} phải là số hợp lệ.`,
          path: [path],
        });
        return;
      }
      if (n < min || n > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} phải trong khoảng ${min} đến ${max}.`,
          path: [path],
        });
      }
    };
    optionalRangeNumber(data.patientHeight, 'patientHeight', 0, 300, 'Chiều cao');
    optionalRangeNumber(data.patientWeight, 'patientWeight', 0, 300, 'Cân nặng');
    optionalClinicalText(data.patientHistory, 'patientHistory', 'Tiền sử bệnh nhân');
    optionalClinicalText(data.familyHistory, 'familyHistory', 'Tiền sử gia đình');
    optionalClinicalText(data.toxicExposure, 'toxicExposure', 'Tiếp xúc độc hại');
    optionalClinicalText(data.medicalHistory, 'medicalHistory', 'Tiền sử bệnh');
    optionalClinicalText(data.chronicDisease, 'chronicDisease', 'Bệnh lý mãn tính');
    optionalClinicalText(data.acuteDisease, 'acuteDisease', 'Bệnh lý cấp tính');
    optionalClinicalText(data.medicalUsing, 'medicalUsing', 'Thuốc đang dùng');

    const st = String(data.serviceType || '').toLowerCase();
    if (st === 'reproduction') {
      const weekRaw = String(data.fetusesWeek || '').trim();
      const dayRaw = String(data.fetusesDay || '').trim();

      if (weekRaw) {
        if (!/^\d+$/.test(weekRaw)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Tuần thai chỉ được nhập số.',
            path: ['fetusesWeek'],
          });
        } else {
          const week = Number(weekRaw);
          if (week < 0 || week > 42) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Tuần thai phải trong khoảng 0 đến 42.',
              path: ['fetusesWeek'],
            });
          }
        }
      }

      if (dayRaw) {
        if (!/^\d+$/.test(dayRaw)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Ngày thai chỉ được nhập số.',
            path: ['fetusesDay'],
          });
        } else {
          const day = Number(dayRaw);
          if (day < 0 || day > 6) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Ngày thai phải trong khoảng 0 đến 6.',
              path: ['fetusesDay'],
            });
          }
        }
      }
    }

    const ps = String(data.paymentStatus || '').toUpperCase();
    if (ps !== 'COMPLETED') return;
    const slip = String(data.specifyId || '').trim();
    const pname = String(data.patientName || '').trim();
    const pphone = String(data.patientPhone || '').trim();
    if (!slip || !pname || !pphone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Đã thanh toán / hóa đơn: cần có mã phiếu xét nghiệm và họ tên, số điện thoại bệnh nhân (bước 3).',
        path: ['paymentStatus'],
      });
    }
    const link = String(data.invoiceLink || '').trim();
    if (!/^https?:\/\//i.test(link)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Khi chọn đã thanh toán, vui lòng tải ảnh hóa đơn lên Cloudinary (link https).',
        path: ['invoiceLink'],
      });
    }
  });

export type OrderFormData = z.infer<typeof orderFormSchema>;

export const defaultOrderFormValues: OrderFormData = {
  orderName: '',
  doctorId: '',
  staffId: '',
  paymentAmount: '',
  staffAnalystId: '',
  sampleCollectorId: '',
  barcodeId: '',
  paymentType: '',
  paymentStatus: 'UNPAID',
  invoiceLink: '',
  customerId: '',
  customerFastq: false,
  specifyVoteTestImagePath: '',
  specifyId: '',
  patientPhone: '',
  patientName: '',
  patientDob: '',
  patientGender: '',
  patientEmail: '',
  patientJob: '',
  patientContactName: '',
  patientContactPhone: '',
  patientAddress: '',
  genomeTestId: '',
  testName: '',
  testSample: '',
  testContent: '',
  samplingSite: '',
  sampleCollectDate: '',
  embryoNumber: '',
  patientHeight: '',
  patientWeight: '',
  patientHistory: '',
  familyHistory: '',
  toxicExposure: '',
  medicalHistory: '',
  chronicDisease: '',
  acuteDisease: '',
  medicalUsing: '',
  geneticTestResults: '',
  geneticTestResultsRelationship: '',
  serviceType: '',
  fetusesWeek: '',
  fetusesDay: '',
  headRumpLength: '',
  ultrasoundDay: '',
  fetusesNumber: '',
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
  testRelated: '',
  treatmentMethods: '',
  treatmentTimeDay: '',
  drugResistance: '',
  relapse: '',

  orderNote: '',
  sendEmailToPatient: false,
  sendZaloToPatient: false,
};
export const getPaymentTypeDisplayName = (type: PaymentType | string | undefined): string => {
  switch (type) {
    case PaymentType.ONLINE_PAYMENT:
    case 'ONLINE_PAYMENT':
      return 'Thanh toán online';
    case PaymentType.CASH:
    case 'CASH':
      return 'Tiền mặt';
    default:
      return String(type || '');
  }
};

export const getStaffPositionDisplayName = (
  position: StaffPosition | string | undefined
): string => {
  switch (position) {
    case StaffPosition.STAFF:
    case 'STAFF':
    case 'staff':
      return 'Nhân viên';
    case StaffPosition.LAB_TECHNICIAN:
    case 'LAB_TECHNICIAN':
    case 'lab_technician':
      return 'KTV xét nghiệm';
    case StaffPosition.SAMPLE_COLLECTOR:
    case 'SAMPLE_COLLECTOR':
    case 'sample_collector':
      return 'NV thu mẫu';
    case 'doctor':
      return 'Bác sĩ';
    default:
      return String(position || '');
  }
};
export const STEP_FIELDS: Record<number, (keyof OrderFormData)[]> = {
  1: ['orderName', 'paymentType'],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
};
