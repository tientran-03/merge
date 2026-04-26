import { apiClient } from "./api";
import { API_ENDPOINTS } from "@/config/api";

export interface SampleAddResponse {
  /** Backend trả `id`; mobile có thể map thêm `sampleAddId` */
  id?: string;
  sampleAddId?: string;
  sampleName: string;
  sampleCode?: string;
  specifyId?: string;
  orderId?: string;
  orderCode?: string;
  patientId?: string;
  patientName?: string;
  status?: string;
  paymentStatus?: string;
  paymentType?: string;
  note?: string;
  invoiceLink?: string;
  requestDate?: string;
}

export const sampleAddService = {
  getAll: async () => {
    return apiClient.get<SampleAddResponse[]>(API_ENDPOINTS.SAMPLE_ADDS);
  },

  getById: async (id: string) => {
    return apiClient.get<SampleAddResponse>(API_ENDPOINTS.SAMPLE_ADD_BY_ID(id));
  },

  getByOrderId: async (orderId: string) => {
    return apiClient.get<SampleAddResponse[]>(
      API_ENDPOINTS.SAMPLE_ADD_BY_ORDER(orderId)
    );
  },

  create: async (data: any) => {
    return apiClient.post<SampleAddResponse>(API_ENDPOINTS.SAMPLE_ADDS, data);
  },

  update: async (id: string, data: any) => {
    return apiClient.put<SampleAddResponse>(
      API_ENDPOINTS.SAMPLE_ADD_BY_ID(id),
      data
    );
  },

  updateStatus: async (id: string, status: string) => {
    return apiClient.patch(
      `${API_ENDPOINTS.SAMPLE_ADD_BY_ID(id)}/status?status=${encodeURIComponent(status)}`
    );
  },

  updatePaymentType: async (id: string, paymentType: string) => {
    return apiClient.patch(
      `${API_ENDPOINTS.SAMPLE_ADD_BY_ID(id)}/payment-type?paymentType=${encodeURIComponent(paymentType)}`
    );
  },

  updatePaymentStatus: async (id: string, paymentStatus: string) => {
    return apiClient.patch(
      `${API_ENDPOINTS.SAMPLE_ADD_BY_ID(id)}/payment-status?paymentStatus=${encodeURIComponent(paymentStatus)}`
    );
  },

  updateInvoiceLink: async (id: string, invoiceLink: string) => {
    return apiClient.patch(
      `${API_ENDPOINTS.SAMPLE_ADD_BY_ID(id)}/invoice-link?invoiceLink=${encodeURIComponent(invoiceLink)}`
    );
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.SAMPLE_ADD_BY_ID(id));
  },
};
