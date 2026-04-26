import { z } from 'zod';


export function zRhfNonNegativeNumber(min: number, message: string) {
  return z
    .union([z.string(), z.number()])
    .refine(
      v => {
        if (v === '' || v === null || v === undefined) return false;
        const n = typeof v === 'string' ? Number(v) : v;
        return Number.isFinite(n) && n >= min;
      },
      { message }
    )
    .transform(v => (typeof v === 'string' ? Number(v) : v));
}

export function zRhfOptionalNonNegativeNumber(message: string) {
  return z
    .union([z.string(), z.number(), z.undefined()])
    .transform(v => {
      if (v === '' || v === undefined || v === null) return undefined;
      const n = typeof v === 'string' ? Number(v) : v;
      return Number.isFinite(n) ? n : undefined;
    })
    .refine(n => n === undefined || n >= 0, { message });
}
