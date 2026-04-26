/**
 * Formats raw input as a Vietnamese-style grouped integer (e.g. 1.000.000).
 * Strips non-digits, then applies vi-VN grouping.
 */
export function formatVndAmountInput(raw: string): string {
  const cleaned = raw.replace(/\D/g, "");
  if (!cleaned) return "";
  const n = parseInt(cleaned, 10);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("vi-VN");
}

/** Parses amount from display string (digits only; ignores grouping dots). */
export function parseVndAmountInput(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return NaN;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return NaN;
  const n = Number(digits);
  return Number.isFinite(n) ? n : NaN;
}

/** Formats a numeric amount for a money TextInput (empty if not a positive integer). */
export function formatVndAmountFromNumber(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return Math.trunc(n).toLocaleString("vi-VN");
}
