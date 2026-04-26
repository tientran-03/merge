/**
 * Cờ tạm để màn danh sách biết cần reset phân trang / ưu tiên bản ghi mới
 * sau khi `router.back()` từ màn tạo — tránh `replace` sang cùng route gây trùng màn trên stack.
 */
export type ListFreshTarget = "prescription-slips" | "admin-specifies" | "orders" | "admin-orders";

const flags: Record<ListFreshTarget, boolean> = {
  "prescription-slips": false,
  "admin-specifies": false,
  orders: false,
  "admin-orders": false,
};

export function setListFreshOnNextFocus(target: ListFreshTarget) {
  flags[target] = true;
}

export function consumeListFresh(target: ListFreshTarget): boolean {
  const v = flags[target];
  flags[target] = false;
  return v;
}
