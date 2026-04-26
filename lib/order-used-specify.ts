import type { OrderResponse } from "@/services/orderService";

/** Mã phiếu chỉ định (`specifyVoteID`) đã gắn với ít nhất một đơn hàng. */
export function collectUsedSpecifyVoteIdsFromOrders(
  orders: OrderResponse[] | undefined | null
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(orders)) return ids;

  for (const order of orders) {
    const sid = order.specifyId;
    if (!sid) continue;
    if (typeof sid === "string") {
      const t = sid.trim();
      if (t) ids.add(t);
    } else if (typeof sid === "object" && (sid as { specifyVoteID?: string }).specifyVoteID) {
      const t = String((sid as { specifyVoteID?: string }).specifyVoteID).trim();
      if (t) ids.add(t);
    }
  }
  return ids;
}
