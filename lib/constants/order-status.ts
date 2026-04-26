import { OrderStatus } from '@/types';

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'initiation', label: 'Khởi tạo' },
  { value: 'forward_analysis', label: 'Chuyển tiếp phân tích' },
  { value: 'accepted', label: 'Chấp nhận đơn' },
  { value: 'rejected', label: 'Từ chối đơn' },
  { value: 'in_progress', label: 'Đang xử lý phân tích' },
  { value: 'sample_error', label: 'Mẫu lỗi' },
  { value: 'rerun_testing', label: 'Chạy lại' },
  { value: 'awaiting_results_approval', label: 'Chờ duyệt kết quả' },
  { value: 'results_approved', label: 'Đã duyệt kết quả' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'sample_addition', label: 'Thêm mẫu' },
];

export const ORDER_STATUS_VALUES = ORDER_STATUS_OPTIONS.map(o => o.value) as [
  OrderStatus,
  ...OrderStatus[],
];

export const getOrderStatusLabel = (status: string): string => {
  const s = status.toLowerCase();
  const statusMap: Record<string, string> = {
    initiation: 'Khởi tạo',
    forward_analysis: 'Chuyển tiếp phân tích',
    accepted: 'Chấp nhận đơn',
    rejected: 'Từ chối đơn',
    in_progress: 'Đang xử lý phân tích',
    sample_error: 'Mẫu lỗi',
    rerun_testing: 'Chạy lại',
    completed: 'Hoàn thành',
    sample_addition: 'Thêm mẫu',
    awaiting_results_approval: 'Chờ duyệt kết quả',
    results_approved: 'Đã duyệt kết quả',
    result_approved: 'Đã duyệt kết quả',
    canceled: 'Đã hủy',
  };
  return statusMap[s] || status;
};
export const ORDER_STATUS_DEFAULT = 'accepted' as OrderStatus;

/**
 * Backend requires `orderStatus` on create.
 * Keep default consistent across create flows.
 */
export const ORDER_STATUS_ON_CREATE = ORDER_STATUS_DEFAULT;

export type OrderStatusBadge = {
  label: string;
  bg: string;
  fg: string;
  bd: string;
};

/**
 * UI badge styles for order status across screens.
 * Keep lightweight and backward-compatible with older backend status variants.
 */
export const getOrderStatusBadge = (status?: string | null): OrderStatusBadge => {
  const s = String(status || '').trim().toLowerCase();
  const label = getOrderStatusLabel(s || ORDER_STATUS_DEFAULT);

  if (s === 'completed') {
    return { label, bg: 'bg-emerald-50', fg: 'text-emerald-800', bd: 'border-emerald-200' };
  }
  if (s === 'results_approved' || s === 'result_approved') {
    return { label, bg: 'bg-lime-50', fg: 'text-lime-800', bd: 'border-lime-200' };
  }
  if (s === 'awaiting_results_approval') {
    return { label, bg: 'bg-amber-50', fg: 'text-amber-800', bd: 'border-amber-200' };
  }
  if (s === 'rejected' || s === 'canceled') {
    return { label, bg: 'bg-red-50', fg: 'text-red-800', bd: 'border-red-200' };
  }
  if (s === 'rerun_testing') {
    return { label, bg: 'bg-fuchsia-50', fg: 'text-fuchsia-800', bd: 'border-fuchsia-200' };
  }
  if (s === 'sample_error') {
    return { label, bg: 'bg-orange-50', fg: 'text-orange-800', bd: 'border-orange-200' };
  }
  if (s === 'in_progress' || s === 'forward_analysis' || s === 'sample_addition') {
    return { label, bg: 'bg-sky-50', fg: 'text-sky-800', bd: 'border-sky-200' };
  }

  // default (accepted/initiation/unknown)
  return { label, bg: 'bg-slate-50', fg: 'text-slate-700', bd: 'border-slate-200' };
};

/**
 * Normalize any raw orderStatus into a backend-safe value for update payload.
 * Falls back to default instead of sending empty/undefined.
 */
export const orderStatusForUpdatePayload = (raw?: unknown): OrderStatus => {
  const s = String(raw ?? '').trim().toLowerCase();
  const allowed = new Set(ORDER_STATUS_VALUES as unknown as string[]);
  if (allowed.has(s)) return s as OrderStatus;
  // backward-compatible aliases
  if (s === 'result_approved') return 'results_approved' as OrderStatus;
  return ORDER_STATUS_DEFAULT;
};
