import { API_ENDPOINTS } from "@/config/api";
import { apiClient } from "./api";

export interface SampleAddServiceConfigRequest {
  sampleName: string;
  price: number;
  taxRate?: number;
}

export interface SampleAddServiceConfigResponse {
  id: string;
  sampleName: string;
  price: number;
  taxRate: number;
  finalPrice: number;
  createdAt?: string;
}

export const sampleAddServiceConfigService = {
  getAll: async () => {
    return apiClient.get<SampleAddServiceConfigResponse[]>(
      API_ENDPOINTS.SAMPLE_ADD_SERVICES
    );
  },

  create: async (body: SampleAddServiceConfigRequest) => {
    return apiClient.post<SampleAddServiceConfigResponse>(
      API_ENDPOINTS.SAMPLE_ADD_SERVICES,
      body
    );
  },

  update: async (id: string, body: SampleAddServiceConfigRequest) => {
    return apiClient.put<SampleAddServiceConfigResponse>(
      API_ENDPOINTS.SAMPLE_ADD_SERVICE_BY_ID(id),
      body
    );
  },

  delete: async (id: string) => {
    return apiClient.delete<void>(API_ENDPOINTS.SAMPLE_ADD_SERVICE_BY_ID(id));
  },
};
