/**
 * Đồng bộ cách đọc mã barcode từ GET đơn: có thể là `barcodeId` (phẳng) hoặc object `barcode` (Jackson).
 */
export function getBarcodeStringFromOrder(order: unknown): string | undefined {
  if (order == null || typeof order !== "object") return undefined;
  const o = order as Record<string, unknown>;
  const flat = String(o.barcodeId ?? "").trim();
  if (flat) return flat;
  const b = o.barcode;
  if (b != null && typeof b === "object") {
    const code = String((b as Record<string, unknown>).barcode ?? "").trim();
    if (code) return code;
  }
  return undefined;
}

/** Mọi mã barcode đã gắn đơn (để ẩn khỏi dropdown tạo đơn mới). */
export function collectUsedBarcodeStringsFromOrders(orders: unknown[]): Set<string> {
  const used = new Set<string>();
  for (const order of orders) {
    const code = getBarcodeStringFromOrder(order);
    if (code) used.add(code);
  }
  return used;
}
