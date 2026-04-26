import { z } from "zod";

export const GENDER_OPTIONS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Khác" },
] as const;

export const patientSchema = z.object({
  patientId: z.string().min(1, "Mã bệnh nhân là bắt buộc"),
  patientName: z.string().min(1, "Tên bệnh nhân là bắt buộc"),
  patientPhone: z
    .string()
    .min(1, "Số điện thoại là bắt buộc")
    .regex(/^[0-9]{10,11}$/, "Số điện thoại phải có 10-11 chữ số"),
  patientEmail: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  patientDob: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  patientJob: z.string().optional(),
  patientContactName: z.string().optional(),
  patientContactPhone: z.string().optional(),
  patientAddress: z.string().optional(),
  hospitalId: z.string().optional(),
});

export type PatientFormData = z.infer<typeof patientSchema>;

export const patientDefaultValues: PatientFormData = {
  patientId: "",
  patientName: "",
  patientPhone: "",
  patientEmail: "",
  patientDob: "",
  gender: undefined,
  patientJob: "",
  patientContactName: "",
  patientContactPhone: "",
  patientAddress: "",
  hospitalId: "",
};
