import type { HospitalStaffResponse } from '@/services/hospitalStaffService';
export const HTG_HOSPITAL_ID = '1';

function normalizePosition(pos?: string | null): string {
  return String(pos ?? '')
    .trim()
    .toLowerCase();
}

function isDoctorPosition(pos?: string | null): boolean {
  const p = normalizePosition(pos);
  return p === 'doctor';
}

function isLabCollectorPosition(pos?: string | null): boolean {
  const p = normalizePosition(pos);
  return p === 'lab_technician' || p === 'sample_collector';
}

function isStaffCashierPosition(pos?: string | null): boolean {
  const p = normalizePosition(pos);
  return p === 'staff';
}

export function staffAnalystOptionsForOrder(
  staffs: HospitalStaffResponse[]
): HospitalStaffResponse[] {
  return staffs.filter(
    s => isDoctorPosition(s.staffPosition) && String(s.hospitalId ?? '') === HTG_HOSPITAL_ID
  );
}

export function staffAnalystOptionsForOrderWithFallback(
  staffs: HospitalStaffResponse[],
  selectedStaffAnalystId?: string | null
): HospitalStaffResponse[] {
  const filtered = staffAnalystOptionsForOrder(staffs);
  const id = selectedStaffAnalystId?.trim();
  if (id && !filtered.some(s => s.staffId === id)) {
    const current = staffs.find(s => s.staffId === id);
    if (current) return [...filtered, current];
  }
  return filtered;
}

export function sampleCollectorOptionsForOrder(
  staffs: HospitalStaffResponse[],
  selectedSampleCollectorId?: string | null
): HospitalStaffResponse[] {
  const filtered = staffs.filter(s => isLabCollectorPosition(s.staffPosition));
  const id = selectedSampleCollectorId?.trim();
  if (id && !filtered.some(s => s.staffId === id)) {
    const current = staffs.find(s => s.staffId === id);
    if (current) filtered.push(current);
  }
  return filtered;
}

export function cashierStaffOptionsForOrder(
  staffs: HospitalStaffResponse[],
  currentStaffId?: string | null
): HospitalStaffResponse[] {
  let base = staffs.filter(s => isStaffCashierPosition(s.staffPosition));
  if (base.length === 0) base = staffs.slice();
  const wid = currentStaffId?.trim();
  if (wid && !base.some(s => s.staffId === wid)) {
    const cur = staffs.find(s => s.staffId === wid);
    if (cur) return [...base, cur];
  }
  return base;
}

export function isStaffAnalystAllowed(
  staffs: HospitalStaffResponse[],
  staffAnalystId: string | undefined | null
) {
  const id = staffAnalystId?.trim();
  if (!id) return false;
  return staffAnalystOptionsForOrder(staffs).some(s => s.staffId === id);
}

export function isSampleCollectorAllowed(
  staffs: HospitalStaffResponse[],
  sampleCollectorId: string | undefined | null
) {
  const id = sampleCollectorId?.trim();
  if (!id) return false;
  return sampleCollectorOptionsForOrder(staffs, id).some(s => s.staffId === id);
}

export function isCashierAllowed(
  staffs: HospitalStaffResponse[],
  staffId: string | undefined | null
) {
  const id = staffId?.trim();
  if (!id) return false;
  return cashierStaffOptionsForOrder(staffs, id).some(s => s.staffId === id);
}
