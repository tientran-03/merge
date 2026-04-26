import { z } from "zod";

export const profileSchema = z.object({
  displayName: z.string().min(1, "Vui lòng nhập tên hiển thị"),
  phone: z.string().optional(),
  address: z.string().optional(),
  dob: z.string().optional().refine(
    (val) => {
      if (!val || val === "") return true; 
      const regex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!regex.test(val)) return false;
      const [day, month, year] = val.split("/").map(Number);
      const date = new Date(year, month - 1, day);
      return (
        date.getDate() === day &&
        date.getMonth() === month - 1 &&
        date.getFullYear() === year
      );
    },
    { message: "Ngày sinh phải có định dạng dd/MM/yyyy (VD: 01/01/1990)" }
  ),
  gender: z.enum(["male", "female"]).optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

export const GENDER_OPTIONS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
];
