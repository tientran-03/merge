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
