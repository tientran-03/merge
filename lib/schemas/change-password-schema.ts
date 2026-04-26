import { z } from 'zod';

const newPasswordRules = z
  .string()
  .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
  .regex(/[A-Z]/, 'Cần ít nhất 1 chữ hoa')
  .regex(/[a-z]/, 'Cần ít nhất 1 chữ thường')
  .regex(/\d/, 'Cần ít nhất 1 chữ số');

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    newPassword: newPasswordRules,
    confirmPassword: z.string().min(1, 'Nhập lại mật khẩu mới'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
