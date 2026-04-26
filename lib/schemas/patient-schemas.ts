import type { FieldErrors } from 'react-hook-form';
import { z } from 'zod';

import {
  patientContactPhoneOptionalSpecifySchema,
  patientEmailOptionalSpecifySchema,
  patientNameZodField,
  patientPhoneSpecifySchema,
} from '@/lib/schemas/patient-field-rules';

const MAX_STR = 255;

export function getFirstPatientFormErrorMessage(errors: FieldErrors): string | undefined {
  for (const key of Object.keys(errors)) {
    const err = errors[key];
    if (
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message?: unknown }).message === 'string'
    ) {
      return (err as { message: string }).message;
    }
  }
  return undefined;
}

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
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
] as const;
export const GENDER_OPTIONS_BINARY = [
  { value: 'male' as const, label: 'Nam' },
  { value: 'female' as const, label: 'Nữ' },
] as const;

const optionalShortText = (label: string) =>
  z.string().max(MAX_STR, `${label} tối đa ${MAX_STR} ký tự`);

const clinicalTextOptional = (label: string) =>
  z.string().max(MAX_STR, `${label} tối đa ${MAX_STR} ký tự`);

const heightWeightRefine = (
  data: { patientHeight?: number; patientWeight?: number },
  ctx: z.RefinementCtx
) => {
  if (data.patientHeight !== undefined && data.patientHeight !== null) {
    const h = Number(data.patientHeight);
    if (Number.isNaN(h) || h < 0 || h > 300) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Chiều cao chỉ số từ 0 đến 300 cm',
        path: ['patientHeight'],
      });
    }
  }
  if (data.patientWeight !== undefined && data.patientWeight !== null) {
    const w = Number(data.patientWeight);
    if (Number.isNaN(w) || w < 0 || w > 300) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cân nặng chỉ số từ 0 đến 300 kg',
        path: ['patientWeight'],
      });
    }
  }
};

export const patientSchema = z.object({
  patientId: z
    .string()
    .min(1, 'Mã bệnh nhân là bắt buộc')
    .max(MAX_STR, `Mã bệnh nhân tối đa ${MAX_STR} ký tự`),
  patientName: patientNameZodField('Tên bệnh nhân'),
  patientPhone: patientPhoneSpecifySchema,
  patientEmail: patientEmailOptionalSpecifySchema,
  patientDob: patientDobNotFuture,
  gender: z.enum(['male', 'female']).optional(),
  patientJob: optionalShortText('Nghề nghiệp'),
  patientContactName: optionalShortText('Tên người liên hệ'),
  patientContactPhone: patientContactPhoneOptionalSpecifySchema,
  patientAddress: optionalShortText('Địa chỉ'),
  hospitalId: z.string().optional(),
});

export type PatientFormData = z.infer<typeof patientSchema>;

export const patientDefaultValues: PatientFormData = {
  patientId: '',
  patientName: '',
  patientPhone: '',
  patientEmail: '',
  patientDob: '',
  gender: undefined,
  patientJob: '',
  patientContactName: '',
  patientContactPhone: '',
  patientAddress: '',
  hospitalId: '',
};

const createPatientObjectSchema = z.object({
  patientName: patientNameZodField('Tên bệnh nhân'),
  patientPhone: patientPhoneSpecifySchema,
  patientEmail: patientEmailOptionalSpecifySchema,
  patientDob: patientDobNotFuture,
  gender: z.enum(['male', 'female'], {
    message: 'Vui lòng chọn giới tính (Nam hoặc Nữ)',
  }),
  patientJob: optionalShortText('Nghề nghiệp'),
  patientContactName: optionalShortText('Tên người liên hệ'),
  patientContactPhone: patientContactPhoneOptionalSpecifySchema,
  patientAddress: optionalShortText('Địa chỉ'),
  hospitalId: z.string().optional(),
  patientHeight: z
    .union([z.number(), z.string()])
    .optional()
    .transform(v => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v);
      return isNaN(n) ? undefined : n;
    }),
  patientWeight: z
    .union([z.number(), z.string()])
    .optional()
    .transform(v => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v);
      return isNaN(n) ? undefined : n;
    }),
  patientHistory: clinicalTextOptional('Tiền sử bản thân'),
  familyHistory: clinicalTextOptional('Tiền sử gia đình'),
  medicalHistory: clinicalTextOptional('Tiền sử y tế'),
  acuteDisease: clinicalTextOptional('Bệnh lý cấp tính'),
  chronicDisease: clinicalTextOptional('Bệnh mãn tính'),
  medicalUsingInput: clinicalTextOptional('Thuốc đang sử dụng'),
  toxicExposure: clinicalTextOptional('Phơi nhiễm độc hại'),
});

export const createPatientSchema = createPatientObjectSchema.superRefine(heightWeightRefine);

export type CreatePatientFormData = z.infer<typeof createPatientSchema>;

export const createPatientDefaultValues: CreatePatientFormData = {
  patientName: '',
  patientPhone: '',
  patientEmail: '',
  patientDob: '',
  gender: undefined as unknown as CreatePatientFormData['gender'],
  patientJob: '',
  patientContactName: '',
  patientContactPhone: '',
  patientAddress: '',
  hospitalId: '',
  patientHeight: undefined,
  patientWeight: undefined,
  patientHistory: '',
  familyHistory: '',
  medicalHistory: '',
  acuteDisease: '',
  chronicDisease: '',
  medicalUsingInput: '',
  toxicExposure: '',
};

export const editPatientClinicalFieldsSchema = createPatientObjectSchema.pick({
  patientHeight: true,
  patientWeight: true,
  patientHistory: true,
  familyHistory: true,
  medicalHistory: true,
  acuteDisease: true,
  chronicDisease: true,
  medicalUsingInput: true,
  toxicExposure: true,
});

export const editPatientFullSchema = patientSchema
  .merge(editPatientClinicalFieldsSchema)
  .superRefine(heightWeightRefine);

export type EditPatientFullFormData = z.infer<typeof editPatientFullSchema>;

export const editPatientFullDefaultValues: EditPatientFullFormData = {
  ...patientDefaultValues,
  patientHeight: undefined,
  patientWeight: undefined,
  patientHistory: '',
  familyHistory: '',
  medicalHistory: '',
  acuteDisease: '',
  chronicDisease: '',
  medicalUsingInput: '',
  toxicExposure: '',
};
