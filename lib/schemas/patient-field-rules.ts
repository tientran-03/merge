import { z } from 'zod';

const MAX_STR = 255;
export const SPECIFY_VN_MOBILE_REGEX = /^0[35789]\d{8}$/;

export const PATIENT_NAME_SPECIFY_REGEX = /^[\p{L}\s.'’\-]+$/u;

export const SPECIFY_PHONE_ERROR_MESSAGE =
  'Số di động VN: đúng 10 số, bắt đầu 0 và đầu số 3, 5, 7, 8 hoặc 9 (VD: 0912345678; quốc tế +84 và 9 số tiếp theo)';
export function normalizeVnMobileDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('84') && d.length >= 11) {
    d = `0${d.slice(2)}`;
  } else if (!d.startsWith('0') && d.length === 9 && /^[35789]/.test(d)) {
    d = `0${d}`;
  }
  return d.slice(0, 10);
}
export function patientNameZodField(label: string) {
  return z
    .string()
    .min(1, `${label} là bắt buộc`)
    .max(MAX_STR, `${label} tối đa ${MAX_STR} ký tự`)
    .refine(s => !/\d/.test(s), 'Họ và tên không được chứa chữ số')
    .refine(
      s => PATIENT_NAME_SPECIFY_REGEX.test(s.trim()),
      "Họ tên chỉ gồm chữ cái, khoảng trắng và các dấu . - '"
    )
    .refine(s => !/\s{2,}/.test(s), 'Không nhập nhiều khoảng trắng liên tiếp')
    .refine(s => !/\.{2,}/.test(s), 'Không nhập nhiều dấu chấm liên tiếp');
}

export const patientNameSpecifySchema = patientNameZodField('Họ tên');
export const patientPhoneSpecifySchema = z.preprocess(
  v => normalizeVnMobileDigits(typeof v === 'string' ? v : ''),
  z
    .string()
    .min(1, 'Số điện thoại là bắt buộc')
    .regex(SPECIFY_VN_MOBILE_REGEX, SPECIFY_PHONE_ERROR_MESSAGE)
);
export const patientEmailOptionalSpecifySchema = z.string().refine(v => {
  if (v === undefined || v === null || String(v).trim() === '') return true;
  const t = String(v).trim();
  if (!/^[\x00-\x7F]+$/.test(t)) {
    return false;
  }
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(t);
}, 'Email không dùng ký tự có dấu; chỉ chữ không dấu, số và @ . _ % + - (VD: ten@gmail.com)');

const CONTACT_PHONE_EMPTY_MSG =
  'SĐT người liên hệ: đúng 10 số di động VN (VD: 0912345678) hoặc để trống';
export const patientContactPhoneOptionalSpecifySchema = z.preprocess(
  v => {
    if (v === undefined || v === null) return '';
    const s = String(v).trim();
    if (s === '') return '';
    return normalizeVnMobileDigits(s);
  },
  z.union([z.literal(''), z.string().regex(SPECIFY_VN_MOBILE_REGEX, CONTACT_PHONE_EMPTY_MSG)])
);
