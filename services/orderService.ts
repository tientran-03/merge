import { API_ENDPOINTS } from '@/config/api';

import type { SpecifyVoteTestResponse } from '@/services/specifyVoteTestService';
import { apiClient } from './api';

export type { SpecifyVoteTestResponse };

export interface PatientMetadataResponse {
  labcode: string;
  specifyId?: string;
  patientId?: string;
  sampleName?: string;
  status?: string;
}

export interface OrderResponse {
  orderId: string;
  orderName: string;
  customerId?: string;
  customerName?: string;
  staffId?: string;
  staffName?: string;
  sampleCollectorId?: string;
  sampleCollectorName?: string;
  staffAnalystId?: string;
  staffAnalystName?: string;
  barcodeId?: string;
  specifyId?: SpecifyVoteTestResponse;
  specifyVoteImagePath?: string;
  orderStatus: string;
  orderNote?: string;
  patientMetadata?: PatientMetadataResponse[];
  patientMetadataCount?: number;
  paymentStatus?: string;
  paymentType?: string;
  paymentAmount?: number;
  invoiceLink?: string;
  jobCount?: number;
  jobIds?: string[];
  createdAt?: string;
  resultDate?: string;
  customerFastq?: boolean;
}

export function pickOrderSampleCollector(order: OrderResponse | undefined | null): {
  id: string;
  name?: string;
} {
  const o = order as any;
  const id = String(o?.sampleCollectorId ?? '').trim();
  const name = String(o?.sampleCollectorName ?? '').trim();
  return { id, ...(name ? { name } : {}) };
}

export function pickLatestOrderResultDate(
  orders: OrderResponse[] | undefined | null
): string | undefined {
  if (!orders?.length) return undefined;
  let best: string | undefined;
  for (const o of orders) {
    const rd = o.resultDate;
    if (rd) {
      if (!best || new Date(rd) > new Date(best)) best = rd;
    }
  }
  return best;
}

export const orderService = {
  getAll: async (params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.ORDERS}?${queryParams.toString()}`
      : API_ENDPOINTS.ORDERS;
    return apiClient.get<OrderResponse[]>(url);
  },

  getById: async (id: string) => {
    return apiClient.get<OrderResponse>(API_ENDPOINTS.ORDER_BY_ID(id));
  },

  getByStatus: async (status: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.ORDER_BY_STATUS(status)}?${queryParams.toString()}`
      : API_ENDPOINTS.ORDER_BY_STATUS(status);
    return apiClient.get<OrderResponse[]>(url);
  },

  getByPatientId: async (patientId: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.ORDER_BY_PATIENT_ID(patientId)}?${queryParams.toString()}`
      : API_ENDPOINTS.ORDER_BY_PATIENT_ID(patientId);
    return apiClient.get<OrderResponse[]>(url);
  },

  getBySpecifyId: async (specifyId: string) => {
    return apiClient.get<OrderResponse[]>(`${API_ENDPOINTS.ORDERS}/specify/${specifyId}`);
  },

  getByCustomerId: async (customerId: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.ORDER_BY_CUSTOMER_ID(customerId)}?${queryParams.toString()}`
      : API_ENDPOINTS.ORDER_BY_CUSTOMER_ID(customerId);
    return apiClient.get<OrderResponse[]>(url);
  },

  search: async (query: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('orderName', query);
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    return apiClient.get<OrderResponse[]>(
      `${API_ENDPOINTS.ORDER_SEARCH}?${queryParams.toString()}`
    );
  },

  create: async (data: any) => {
    return apiClient.post<OrderResponse>(API_ENDPOINTS.ORDERS, data);
  },

  update: async (id: string, data: any) => {
    return apiClient.put<OrderResponse>(API_ENDPOINTS.ORDER_BY_ID(id), data);
  },

  updateStatus: async (id: string, status: string) => {
    const encodedStatus = encodeURIComponent(status);
    const endpoint = `${API_ENDPOINTS.ORDER_BY_ID(id)}/status?status=${encodedStatus}`;
    console.log(`[OrderService] updateStatus: id=${id}, status=${status}, endpoint=${endpoint}`);
    return apiClient.patch<OrderResponse>(endpoint);
  },

  updateCustomerFastq: async (id: string, customerFastq: boolean) => {
    const endpoint = `${API_ENDPOINTS.ORDER_BY_ID(id)}/customer-fastq?customerFastq=${encodeURIComponent(String(customerFastq))}`;
    return apiClient.patch<OrderResponse>(endpoint);
  },

  reject: async (id: string, rejectReason: string) => {
    return apiClient.patch<OrderResponse>(`${API_ENDPOINTS.ORDER_BY_ID(id)}/reject`, {
      rejectReason,
    });
  },

  updateResultDate: async (id: string, resultDate: string) => {
    const endpoint = `${API_ENDPOINTS.ORDER_BY_ID(id)}/result-date?resultDate=${encodeURIComponent(resultDate)}`;
    return apiClient.patch<OrderResponse>(endpoint);
  },

  updateInvoiceLink: async (id: string, invoiceLink: string) => {
    const endpoint = `${API_ENDPOINTS.ORDER_BY_ID(id)}/invoice-link?invoiceLink=${encodeURIComponent(invoiceLink)}`;
    return apiClient.patch<OrderResponse>(endpoint);
  },

  updateWithMergedPatch: async (
    id: string,
    patch: Partial<{
      patientMetadataIds: string[];
      orderStatus: string;
    }>
  ) => {
    const res = await apiClient.get<OrderResponse>(API_ENDPOINTS.ORDER_BY_ID(id));
    if (!res.success || !res.data) {
      return { success: false as const, error: res.error || 'Không tải được đơn hàng' };
    }
    const raw = res.data as unknown;
    const order =
      raw && typeof raw === 'object' && 'orderId' in (raw as object)
        ? (raw as OrderResponse)
        : raw && typeof raw === 'object' && (raw as { data?: unknown }).data
          ? ((raw as { data: OrderResponse }).data as OrderResponse)
          : null;
    if (!order?.orderId) {
      return { success: false as const, error: 'Không tải được đơn hàng' };
    }
    const specifyIdStr =
      order.specifyId && typeof order.specifyId === 'object'
        ? (order.specifyId as SpecifyVoteTestResponse).specifyVoteID
        : (order.specifyId as string | undefined);
    const existingLabs = order.patientMetadata?.map(pm => pm.labcode).filter(Boolean) as
      | string[]
      | undefined;
    const body: Record<string, unknown> = {
      orderName: order.orderName,
      orderStatus: patch.orderStatus ?? order.orderStatus,
      paymentStatus: order.paymentStatus || 'COMPLETED',
      paymentType: order.paymentType || 'ONLINE_PAYMENT',
      paymentAmount: order.paymentAmount,
      invoiceLink: order.invoiceLink,
      orderNote: order.orderNote,
      staffId: order.staffId,
      sampleCollectorId: order.sampleCollectorId,
      staffAnalystId: order.staffAnalystId,
      barcodeId: order.barcodeId,
      specifyId: specifyIdStr,
      specifyVoteImagePath: order.specifyVoteImagePath,
      patientMetadataIds:
        patch.patientMetadataIds !== undefined ? patch.patientMetadataIds : existingLabs,
    };
    return apiClient.put<OrderResponse>(API_ENDPOINTS.ORDER_BY_ID(id), body);
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.ORDER_BY_ID(id));
  },
};
