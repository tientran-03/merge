import type { OrderResponse } from '@/services/orderService';
import type { SpecifyVoteTestResponse } from '@/services/specifyVoteTestService';

export function getOrderSpecifyVoteId(order: OrderResponse | null | undefined): string {
  const sid = order?.specifyId as unknown;
  if (sid == null) return '';
  if (typeof sid === 'string') return sid.trim();
  if (typeof sid !== 'object') return '';
  const raw = sid as { specifyVoteID?: string; specifyVoteId?: string };
  const id = raw?.specifyVoteID ?? raw?.specifyVoteId;
  return id != null && String(id).trim() !== '' ? String(id).trim() : '';
}

export function orderNeedsFullCreateWizard(order: OrderResponse | null | undefined): boolean {
  return !getOrderSpecifyVoteId(order);
}
export function orderHasSpecifyAndPatientForInvoice(
  order: OrderResponse | null | undefined,
  formPatient?: { name?: string | null; phone?: string | null } | null
): boolean {
  if (!getOrderSpecifyVoteId(order)) return false;
  const sid = order?.specifyId;
  let name = '';
  let phone = '';
  if (sid && typeof sid === 'object') {
    const p = (sid as SpecifyVoteTestResponse).patient;
    name = String(p?.patientName ?? '').trim();
    phone = String(p?.patientPhone ?? '').trim();
  }
  if (!name || !phone) {
    name = String(formPatient?.name ?? '').trim();
    phone = String(formPatient?.phone ?? '').trim();
  }
  return !!(name && phone);
}
