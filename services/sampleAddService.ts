import { apiClient } from "./api";
import { API_ENDPOINTS } from "@/config/api";

export interface SampleAddResponse {
  id?: string;
  sampleAddId?: string;
  sampleName: string;
  sampleCode?: string;
  specifyId?: string;
  orderId?: string;
  orderCode?: string;
  patientId?: string;
  patientName?: string;
  status: string;
  requestDate?: string;
  paymentStatus?: string;
  paymentType?: string;
  customerFastq?: boolean;
  note?: string;
  invoiceLink?: string;
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
      `${API_ENDPOINTS.SAMPLE_ADD_BY_ID(id)}/status?status=${status}`
    );
  },

  updatePaymentType: async (id: string, paymentType: string) => {
    const q = encodeURIComponent(paymentType);
    return apiClient.patch(`${API_ENDPOINTS.SAMPLE_ADD_BY_ID(id)}/payment-type?paymentType=${q}`);
  },

  updatePaymentStatus: async (id: string, paymentStatus: string) => {
    const q = encodeURIComponent(paymentStatus);
    return apiClient.patch(
      `${API_ENDPOINTS.SAMPLE_ADD_BY_ID(id)}/payment-status?paymentStatus=${q}`
    );
  },

  updateCustomerFastq: async (id: string, customerFastq: boolean) => {
    return apiClient.patch(
      `${API_ENDPOINTS.SAMPLE_ADD_BY_ID(id)}/customer-fastq?customerFastq=${customerFastq}`
    );
  },

  updateInvoiceLink: async (id: string, invoiceLink: string) => {
    const q = encodeURIComponent(invoiceLink);
    return apiClient.patch(`${API_ENDPOINTS.SAMPLE_ADD_BY_ID(id)}/invoice-link?invoiceLink=${q}`);
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.SAMPLE_ADD_BY_ID(id));
  },
};
