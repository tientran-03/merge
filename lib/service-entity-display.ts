import type { ServiceEntityResponse } from '@/services/serviceEntityService';

export function getServiceEntityLabelVi(s: ServiceEntityResponse): string {
  const raw = (s.name || '').trim();
  if (!raw) return s.serviceId || '';

  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(raw)) {
    return raw;
  }

  let out = raw;
  out = out.replace(/\breproduction\b/gi, 'Sinh sản');
  out = out.replace(/\bembryo\b/gi, 'Phôi thai');
  out = out.replace(/\bdisease\b/gi, 'Bệnh lý di truyền');
  const lower = out.toLowerCase();
  if (out === raw && (lower === 'reproduction' || lower === 'embryo' || lower === 'disease')) {
    if (lower === 'reproduction') return 'Sinh sản';
    if (lower === 'embryo') return 'Phôi thai';
    return 'Bệnh lý di truyền';
  }
  return out.trim();
}
