import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface ServiceEntityResponse {
  serviceId: string;
  name: string;
}

export interface GenomeTestResponse {
  testId: string;
  testName: string;
  testDescription?: string | null;
  code?: string | null;
  testSample?: string[];
  price?: number | null;
  taxRate?: number | null;
  finalPrice?: number | null;
  service?: ServiceEntityResponse;
}

export interface CreateGenomeTestRequest {
  testId: string;
  testName: string;
  testDescription?: string;
  code?: string;
  serviceId?: string;
  price: number;
  taxRate?: number;
  testSample?: string[];
}

export const genomeTestService = {
  getAll: async (params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.GENOME_TESTS}?${queryParams.toString()}`
      : API_ENDPOINTS.GENOME_TESTS;
    return apiClient.get<GenomeTestResponse[]>(url);
  },

  getByServiceId: async (serviceId: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.GENOME_TESTS_BY_SERVICE(serviceId)}?${queryParams.toString()}`
      : API_ENDPOINTS.GENOME_TESTS_BY_SERVICE(serviceId);
    return apiClient.get<GenomeTestResponse[]>(url);
  },

  getById: async (id: string) => {
    return apiClient.get<GenomeTestResponse>(API_ENDPOINTS.GENOME_TEST_BY_ID(id));
  },

  create: async (data: CreateGenomeTestRequest) => {
    return apiClient.post<GenomeTestResponse>(API_ENDPOINTS.GENOME_TESTS, data);
  },

  update: async (id: string, data: CreateGenomeTestRequest) => {
    return apiClient.put<GenomeTestResponse>(API_ENDPOINTS.GENOME_TEST_BY_ID(id), data);
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.GENOME_TEST_BY_ID(id));
  },
};
