import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface BarcodeResponse {
  barcode: string;
  createAt?: string;
  usedAt?: string;
  status?: string;
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

  createBatch: async (quantity: number) => {
    const payload: BatchBarcodeRequest = { quantity };
    return apiClient.post<BarcodeResponse[]>(`${API_ENDPOINTS.BARCODES}/batch`, payload);
  },

  /** PUT body — `status` dùng enum backend: `created` | `not_printed` | `printed` */
  update: async (id: string, body: { status?: string; createAt?: string }) => {
    return apiClient.put<BarcodeResponse>(API_ENDPOINTS.BARCODE_BY_ID(id), body);
  },
};
