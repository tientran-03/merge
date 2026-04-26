import type { PatientResponse } from '@/services/patientService';

export function patientGenderLabel(g?: string | null): string {
  const s = (g ?? '').toString().trim().toLowerCase();
  if (s === 'male' || s === 'm') return 'Nam';
  if (s === 'female' || s === 'f') return 'Nữ';
  if (s === 'other') return 'Khác';
  const u = (g ?? '').toString().trim().toUpperCase();
  if (u === 'MALE') return 'Nam';
  if (u === 'FEMALE') return 'Nữ';
  if (u === 'OTHER') return 'Khác';
  return g ? String(g) : '';
}

export function patientMatchesSearch(p: PatientResponse, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    p.patientId,
    p.patientCode,
    p.patientName,
    p.patientPhone,
    p.patientEmail,
    p.patientAddress,
    p.name,
    p.phone,
    p.email,
    p.address,
  ]
    .map(x => String(x ?? '').toLowerCase())
    .join(' ');
  return hay.includes(needle);
}
