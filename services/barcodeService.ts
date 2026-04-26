import { API_ENDPOINTS } from '@/config/api';
import { apiClient } from './api';

export interface BarcodeResponse {
  barcode: string;
  createAt?: string;
  usedAt?: string;
  status?: string;
}

export interface BarcodeUpdateRequest {
  status?: string;
  createAt?: string;
  usedAt?: string;
}

export interface BatchBarcodeRequest {
  quantity: number;
}

export const barcodeService = {
  getAll: async () => {
    return apiClient.get<BarcodeResponse[]>(API_ENDPOINTS.BARCODES);
  },

  getById: async (id: string) => {
    return apiClient.get<BarcodeResponse>(API_ENDPOINTS.BARCODE_BY_ID(id));
  },

  getByStatus: async (status: string) => {
    return apiClient.get<BarcodeResponse[]>(API_ENDPOINTS.BARCODES_BY_STATUS(status));
  },
  create: async () => {
    return apiClient.post<BarcodeResponse>(API_ENDPOINTS.BARCODES, {});
  },

  createBatch: async (body: BatchBarcodeRequest) => {
    return apiClient.post<BarcodeResponse[]>(`${API_ENDPOINTS.BARCODES}/batch`, body);
  },

  markUsed: async (id: string) => {
    return apiClient.patch<BarcodeResponse>(`${API_ENDPOINTS.BARCODE_BY_ID(id)}/mark-used`);
  },

  delete: async (id: string) => {
    return apiClient.delete<void>(API_ENDPOINTS.BARCODE_BY_ID(id));
  },

  update: async (id: string, data: BarcodeUpdateRequest) => {
    return apiClient.put<BarcodeResponse>(API_ENDPOINTS.BARCODE_BY_ID(id), data);
  },
};
