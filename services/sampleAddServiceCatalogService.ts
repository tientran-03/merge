import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface SampleAddServiceCatalogResponse {
  id: string;
  sampleName: string;
  price: number;
  taxRate: number;
  finalPrice: number;
  createdAt?: string;
}

export interface SampleAddServiceCatalogRequest {
  sampleName: string;
  price: number;
  taxRate?: number;
}

export const sampleAddServiceCatalogService = {
  getAll: async () => {
    return apiClient.get<SampleAddServiceCatalogResponse[]>(API_ENDPOINTS.SAMPLE_ADD_SERVICES);
  },

  getById: async (id: string) => {
    return apiClient.get<SampleAddServiceCatalogResponse>(API_ENDPOINTS.SAMPLE_ADD_SERVICE_BY_ID(id));
  },

  getBySampleName: async (sampleName: string) => {
    const encoded = encodeURIComponent(sampleName);
    return apiClient.get<SampleAddServiceCatalogResponse>(
      `${API_ENDPOINTS.SAMPLE_ADD_SERVICES}/name/${encoded}`
    );
  },

  create: async (body: SampleAddServiceCatalogRequest) => {
    return apiClient.post<SampleAddServiceCatalogResponse>(API_ENDPOINTS.SAMPLE_ADD_SERVICES, body);
  },

  update: async (id: string, body: SampleAddServiceCatalogRequest) => {
    return apiClient.put<SampleAddServiceCatalogResponse>(API_ENDPOINTS.SAMPLE_ADD_SERVICE_BY_ID(id), body);
  },

  delete: async (id: string) => {
    return apiClient.delete<unknown>(API_ENDPOINTS.SAMPLE_ADD_SERVICE_BY_ID(id));
  },
};
