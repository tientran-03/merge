/** Nhãn & màu badge thanh toán — khớp `PAYMENT_STATUS_CONFIG` trên web (@capstone/utils). */

export function getPaymentStatusLabel(status: string): string {
  const s = String(status || "").toUpperCase();
  const map: Record<string, string> = {
    PENDING: "Chờ thanh toán",
    COMPLETED: "Đã thanh toán",
    FAILED: "Thanh toán thất bại",
    UNPAID: "Chưa thanh toán",
  };
  return map[s] || status || "—";
}

export function getPaymentStatusBadge(status: string): {
  label: string;
  bg: string;
  fg: string;
  bd: string;
} {
  const label = getPaymentStatusLabel(status);
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED") {
    return { label, bg: "bg-green-100", fg: "text-green-700", bd: "border-green-200" };
  }
  if (s === "FAILED") {
    return { label, bg: "bg-red-100", fg: "text-red-700", bd: "border-red-200" };
  }
  if (s === "UNPAID") {
    return { label, bg: "bg-slate-100", fg: "text-slate-700", bd: "border-slate-200" };
  }
  if (s === "PENDING") {
    return { label, bg: "bg-yellow-100", fg: "text-yellow-700", bd: "border-yellow-200" };
  }
  return { label, bg: "bg-gray-100", fg: "text-gray-700", bd: "border-gray-200" };
}
