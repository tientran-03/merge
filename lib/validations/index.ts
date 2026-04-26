const VN_PHONE_PREFIXES = [
  '032',
  '033',
  '034',
  '035',
  '036',
  '037',
  '038',
  '039',
  '086',
  '096',
  '098',
  '070',
  '076',
  '077',
  '078',
  '079',
  '089',
  '090',
  '093',
  '081',
  '082',
  '083',
  '084',
  '085',
  '088',
  '091',
  '094',
  '052',
  '056',
  '058',
  '092',
  '059',
  '099',
  '055',
];

export interface PhoneValidationResult {
  isValid: boolean;
  error?: string;
}

export function formatPhoneInput(value: string): string {
  return value.replace(/\D/g, '');
}

export function validateVNPhone(phone: string): PhoneValidationResult {
  if (!phone || phone.trim() === '') {
    return { isValid: false, error: 'Vui lòng nhập số điện thoại' };
  }
  let cleaned = phone.replace(/[\s\-\.()]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  if (!cleaned.startsWith('0')) {
    return { isValid: false, error: 'Số điện thoại phải bắt đầu bằng 0 hoặc +84' };
  }
  if (cleaned.length !== 10) {
    return { isValid: false, error: 'Số điện thoại phải có 10 chữ số' };
  }
  if (!/^\d+$/.test(cleaned)) {
    return { isValid: false, error: 'Số điện thoại chỉ được chứa chữ số' };
  }
  const prefix = cleaned.substring(0, 3);
  if (!VN_PHONE_PREFIXES.includes(prefix)) {
    return { isValid: false, error: 'Đầu số không hợp lệ. Vui lòng kiểm tra lại' };
  }
  return { isValid: true };
}

export interface DateValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateDob(dob: string): DateValidationResult {
  if (!dob || dob.trim() === '') {
    return { isValid: false, error: 'Vui lòng nhập ngày sinh' };
  }
  const dobDate = new Date(dob);
  if (isNaN(dobDate.getTime())) {
    return { isValid: false, error: 'Ngày sinh không hợp lệ' };
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (dobDate > today) {
    return { isValid: false, error: 'Ngày sinh không được lớn hơn ngày hiện tại' };
  }
  return { isValid: true };
}

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateEmail(email: string): EmailValidationResult {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Vui lòng nhập email' };
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Email không đúng định dạng (VD: example@gmail.com)' };
  }
  return { isValid: true };
}

const MAX_GESTATIONAL_WEEKS = 40;
const MAX_GESTATIONAL_DAYS = 30;

export function validateGestationalWeeks(weeks: string): DateValidationResult {
  if (!weeks || weeks.trim() === '') return { isValid: true };
  const num = parseInt(weeks, 10);
  if (isNaN(num) || num < 0) {
    return { isValid: false, error: 'Tuần thai không hợp lệ' };
  }
  if (num > MAX_GESTATIONAL_WEEKS) {
    return { isValid: false, error: 'Tuần thai không được quá 40 tuần' };
  }
  return { isValid: true };
}

export function validateGestationalDays(days: string): DateValidationResult {
  if (!days || days.trim() === '') return { isValid: true };
  const num = parseInt(days, 10);
  if (isNaN(num) || num < 0) {
    return { isValid: false, error: 'Ngày thai không hợp lệ' };
  }
  if (num > MAX_GESTATIONAL_DAYS) {
    return { isValid: false, error: 'Ngày thai không được quá 30 ngày' };
  }
  return { isValid: true };
}

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}
