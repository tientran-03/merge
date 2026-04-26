import { orderService, type OrderResponse } from '@/services/orderService';
export async function fetchPendingApprovalOrders(): Promise<OrderResponse[]> {
  const [fa, sa] = await Promise.all([
    orderService.getByStatus('forward_analysis'),
    orderService.getByStatus('sample_addition'),
  ]);
  const listFa = fa.success && Array.isArray(fa.data) ? (fa.data as OrderResponse[]) : [];
  const listSa = sa.success && Array.isArray(sa.data) ? (sa.data as OrderResponse[]) : [];
  const byId = new Map<string, OrderResponse>();
  [...listFa, ...listSa].forEach(o => {
    if (o?.orderId) byId.set(String(o.orderId), o);
  });
  return Array.from(byId.values()).sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}
