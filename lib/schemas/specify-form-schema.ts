import { z } from 'zod';

import { MAX_GESTATIONAL_DAYS, MAX_GESTATIONAL_WEEKS } from '@/lib/constants/gestational';
import {
  patientContactPhoneOptionalSpecifySchema,
  patientEmailOptionalSpecifySchema,
  patientNameSpecifySchema,
  patientPhoneSpecifySchema,
} from '@/lib/schemas/patient-field-rules';

export { SPECIFY_VN_MOBILE_REGEX } from '@/lib/schemas/patient-field-rules';

const patientDobNotFuture = z
  .string()
  .optional()
  .refine(
    val => {
      if (val === undefined || val === null || !String(val).trim()) return true;
      const d = new Date(String(val));
      if (Number.isNaN(d.getTime())) return false;
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return d <= end;
    },
    { message: 'Ngày sinh không được trong tương lai' }
  );

const heightWeightRefine = (
  data: { patientHeight?: number | string; patientWeight?: number | string },
  ctx: z.RefinementCtx
) => {
  const check = (
    raw: number | string | undefined | null,
    path: 'patientHeight' | 'patientWeight'
  ) => {
    if (raw === undefined || raw === null || raw === '') return;
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0 || n > 300) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          path === 'patientHeight'
            ? 'Chiều cao chỉ nhập từ 0 đến 300 cm'
            : 'Cân nặng chỉ nhập từ 0 đến 300 kg',
        path: [path],
      });
    }
  };
  check(data.patientHeight, 'patientHeight');
  check(data.patientWeight, 'patientWeight');
};

export const specifyFormSchema = z
  .object({
    isNewPatient: z.boolean().optional(),
    selectedPatientId: z.string().optional(),
    patientName: patientNameSpecifySchema,
    patientPhone: patientPhoneSpecifySchema,
    patientDob: patientDobNotFuture,
    patientGender: z
      .union([z.enum(['male', 'female']), z.undefined()])
      .refine(v => v === 'male' || v === 'female', {
        message: 'Vui lòng chọn Nam hoặc Nữ',
      }),
    patientEmail: z.preprocess(
      v => (v === undefined || v === null ? '' : String(v)),
      patientEmailOptionalSpecifySchema
    ),
    patientJob: z.string().optional(),
    patientContactName: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập người liên hệ')
      .max(255, 'Người liên hệ tối đa 255 ký tự'),
    patientContactPhone: patientContactPhoneOptionalSpecifySchema,
    patientAddress: z.string().optional(),
    patientHeight: z.union([z.number(), z.string()]).optional(),
    patientWeight: z.union([z.number(), z.string()]).optional(),
    patientHistory: z.string().optional(),
    familyHistory: z.string().optional(),
    medicalHistory: z.string().optional(),
    acuteDisease: z.string().optional(),
    chronicDisease: z.string().optional(),
    toxicExposure: z.string().optional(),
    medicalUsing: z.string().optional(),
    serviceId: z.string().optional(),
    serviceType: z.enum(['reproduction', 'embryo', 'disease']).optional(),
    genomeTestId: z.string().optional(),
    hospitalId: z.string().optional(),
    doctorId: z.string().optional(),
    samplingSite: z.string().optional(),
    sampleCollectDate: z.string().optional(),
    embryoNumber: z.union([z.number(), z.string()]).optional(),
    geneticTestResults: z.string().optional(),
    geneticTestResultsRelationship: z.string().optional(),
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
    patientClinicalId: z.string().optional(),
    reproductionServiceId: z.string().optional(),
    embryoServiceId: z.string().optional(),
    diseaseServiceId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasPatient = String(data.selectedPatientId ?? '').trim().length > 0;
    if (data.isNewPatient && !hasPatient && !(data.patientAddress ?? '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Vui lòng nhập / chọn địa chỉ',
        path: ['patientAddress'],
      });
    }
  })
  .superRefine(heightWeightRefine)
  .superRefine((data, ctx) => {
    const st = data.serviceType;
    if (!st) return;

    const optDecimalMm = (
      raw: string | undefined,
      min: number,
      max: number,
      label: string,
      path: string
    ) => {
      const s = (raw ?? '').trim();
      if (!s) return;
      const n = parseFloat(s.replace(',', '.'));
      if (Number.isNaN(n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} phải là số`,
          path: [path],
        });
        return;
      }
      if (n < min || n > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} phải từ ${min} đến ${max} mm`,
          path: [path],
        });
      }
    };

    if (st === 'reproduction') {
      const wk = (data.fetusesWeek ?? '').trim();
      if (wk) {
        if (!/^\d+$/.test(wk)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Tuần thai không hợp lệ',
            path: ['fetusesWeek'],
          });
        } else {
          const num = parseInt(wk, 10);
          if (num < 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Tuần thai không hợp lệ',
              path: ['fetusesWeek'],
            });
          } else if (num > MAX_GESTATIONAL_WEEKS) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Tuần thai không được quá 40 tuần',
              path: ['fetusesWeek'],
            });
          }
        }
      }
      const fd = (data.fetusesDay ?? '').trim();
      if (fd) {
        if (!/^\d+$/.test(fd)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Ngày thai không hợp lệ',
            path: ['fetusesDay'],
          });
        } else {
          const num = parseInt(fd, 10);
          if (num < 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Ngày thai không hợp lệ',
              path: ['fetusesDay'],
            });
          } else if (num > MAX_GESTATIONAL_DAYS) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Ngày thai không được quá 30 ngày',
              path: ['fetusesDay'],
            });
          }
        }
      }
      optDecimalMm(data.headRumpLength, 0, 100, 'Chiều dài đầu mông (CRL)', 'headRumpLength');
      optDecimalMm(data.neckLength, 0, 5, 'Độ mờ da gáy (NT)', 'neckLength');
    }

    if (st === 'embryo') {
      const s = (data.embryoCreate ?? '').trim();
      if (s) {
        if (!/^\d+$/.test(s)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Số phôi tạo chỉ được nhập số nguyên ≥ 0',
            path: ['embryoCreate'],
          });
        } else {
          const n = parseInt(s, 10);
          if (n < 0 || n > 999) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Số phôi tạo phải từ 0 đến 999',
              path: ['embryoCreate'],
            });
          }
        }
      }
    }

    if (st === 'disease') {
      const s = (data.treatmentTimeDay ?? '').trim();
      if (s) {
        if (!/^\d+$/.test(s)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Thời gian điều trị (ngày) chỉ được nhập số nguyên',
            path: ['treatmentTimeDay'],
          });
        } else {
          const n = parseInt(s, 10);
          if (n < 0 || n > 36500) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Thời gian điều trị phải từ 0 đến 36500 ngày',
              path: ['treatmentTimeDay'],
            });
          }
        }
      }
    }
  });

export type SpecifyFormData = z.input<typeof specifyFormSchema>;

export const specifyFormDefaultValues: SpecifyFormData = {
  isNewPatient: true,
  selectedPatientId: '',
  patientName: '',
  patientPhone: '',
  patientDob: '',
  patientGender: undefined,
  patientEmail: '',
  patientJob: '',
  patientContactName: '',
  patientContactPhone: '',
  patientAddress: '',
  patientHeight: undefined,
  patientWeight: undefined,
  patientHistory: '',
  familyHistory: '',
  medicalHistory: '',
  acuteDisease: '',
  chronicDisease: '',
  toxicExposure: '',
  medicalUsing: '',
  serviceId: '',
  serviceType: undefined,
  genomeTestId: '',
  hospitalId: '',
  doctorId: '',
  samplingSite: '',
  sampleCollectDate: '',
  embryoNumber: undefined,
  geneticTestResults: '',
  geneticTestResultsRelationship: '',
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
  patientClinicalId: '',
  reproductionServiceId: '',
  embryoServiceId: '',
  diseaseServiceId: '',
};
