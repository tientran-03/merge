import { OrderStatus } from "@/types";

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "initiation", label: "Khởi tạo" },
  { value: "forward_analysis", label: "Chuyển phân tích" },
  { value: "accepted", label: "Đã chấp nhận" },
  { value: "rejected", label: "Từ chối" },
  { value: "in_progress", label: "Đang xử lý" },
  { value: "sample_error", label: "Lỗi mẫu" },
  { value: "rerun_testing", label: "Chạy lại" },
  { value: "completed", label: "Hoàn thành" },
  { value: "sample_addition", label: "Bổ sung mẫu" },
];

/** Khớp nhãn `ORDER_STATUS_CONFIG` trên web (htgen_fe / capstone utils). */
export const getOrderStatusLabel = (status: string): string => {
  const s = String(status || "").toLowerCase();
  const statusMap: Record<string, string> = {
    initiation: "Khởi tạo",
    forward_analysis: "Chuyển phân tích",
    accepted: "Đã chấp nhận",
    rejected: "Từ chối",
    in_progress: "Đang xử lý",
    sample_error: "Lỗi mẫu",
    rerun_testing: "Chạy lại",
    completed: "Hoàn thành",
    sample_addition: "Bổ sung mẫu",
    awaiting_results_approval: "Chờ duyệt kết quả",
    results_approved: "Đã duyệt kết quả",
    result_approved: "Đã duyệt kết quả",
    canceled: "Đã hủy",
  };
  return statusMap[s] || String(status || "").trim() || "—";
};

/**
 * Badge NativeWind — màu/nhóm khớp `ORDER_STATUS_CONFIG` trên web
 * (blue / cyan / green / purple / orange / amber / lime / gray / …).
 */
export function getOrderStatusBadge(status: string): {
  label: string;
  bg: string;
  fg: string;
  bd: string;
} {
  const label = getOrderStatusLabel(status);
  const s = (status || "").toLowerCase();

  if (s === "initiation") {
    return { label, bg: "bg-blue-100", fg: "text-blue-700", bd: "border-blue-200" };
  }
  if (s === "forward_analysis") {
    return { label, bg: "bg-cyan-100", fg: "text-cyan-700", bd: "border-cyan-200" };
  }
  if (s === "accepted") {
    return { label, bg: "bg-green-100", fg: "text-green-700", bd: "border-green-200" };
  }
  if (s === "rejected") {
    return { label, bg: "bg-red-100", fg: "text-red-700", bd: "border-red-200" };
  }
  if (s === "in_progress") {
    return { label, bg: "bg-purple-100", fg: "text-purple-700", bd: "border-purple-200" };
  }
  if (s === "sample_error") {
    return { label, bg: "bg-red-100", fg: "text-red-700", bd: "border-red-200" };
  }
  if (s === "rerun_testing") {
    return { label, bg: "bg-yellow-100", fg: "text-yellow-700", bd: "border-yellow-200" };
  }
  if (s === "completed") {
    return { label, bg: "bg-emerald-100", fg: "text-emerald-700", bd: "border-emerald-200" };
  }
  if (s === "sample_addition") {
    return { label, bg: "bg-orange-100", fg: "text-orange-700", bd: "border-orange-200" };
  }
  if (s === "awaiting_results_approval") {
    return { label, bg: "bg-amber-100", fg: "text-amber-700", bd: "border-amber-200" };
  }
  if (s === "results_approved" || s === "result_approved") {
    return { label, bg: "bg-lime-100", fg: "text-lime-700", bd: "border-lime-200" };
  }
  if (s === "canceled") {
    return { label, bg: "bg-gray-100", fg: "text-gray-700", bd: "border-gray-200" };
  }

  return { label, bg: "bg-gray-100", fg: "text-gray-700", bd: "border-gray-200" };
}

/** Fallback khi thiếu dữ liệu / hiển thị mặc định — không dùng làm trạng thái lúc tạo đơn */
export const ORDER_STATUS_DEFAULT = "initiation" as OrderStatus;

/** Trạng thái gán khi tạo đơn mới (mobile) — đã chấp nhận */
export const ORDER_STATUS_ON_CREATE = "accepted" as OrderStatus;

/**
 * Trạng thái đơn khi gửi PUT cập nhật (sau thanh toán, hóa đơn, sửa wizard…):
 * giữ nguyên nếu đã có; không fallback «khởi tạo» — tránh ghi đè «đã chấp nhận».
 */
export function orderStatusForUpdatePayload(
  currentOrderStatus: string | undefined | null
): OrderStatus {
  const cur = String(currentOrderStatus ?? "").trim();
  if (cur) return cur as OrderStatus;
  return ORDER_STATUS_ON_CREATE;
}
