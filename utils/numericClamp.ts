/**
 * Giữ chuỗi nhập số thập phân (dấu `.`) hợp lệ: bỏ dần ký tự cuối cho đến khi
 * parseFloat <= max. Tránh RN TextInput vẫn hiện số > max khi chỉ `return` không set state.
 */
export function clampDecimalStringToMax(raw: string, max: number): string {
  if (raw === "" || raw === ".") return raw;
  let s = raw;
  while (s.length > 0) {
    const n = parseFloat(s.replace(",", "."));
    if (Number.isFinite(n) && n <= max) return s;
    s = s.slice(0, -1);
  }
  return "";
}
