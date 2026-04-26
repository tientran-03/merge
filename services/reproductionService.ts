import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface ReproductionServiceRequest {
  serviceId: string;
  patientId: string;
  fetusesNumber?: number;
  fetusesWeek?: number;
  fetusesDay?: number;
  ultrasoundDay?: string; // ISO date string
  headRumpLength?: number;
  neckLength?: number;
  combinedTestResult?: string;
  ultrasoundResult?: string;
}

export interface ReproductionServiceResponse {
  id: string;
  serviceId: string;
  serviceType: string;
  patientId: string;
  patientName?: string;
  fetusesNumber?: number;
  fetusesWeek?: number;
  fetusesDay?: number;
  ultrasoundDay?: string;
  headRumpLength?: number;
  neckLength?: number;
  combinedTestResult?: string;
  ultrasoundResult?: string;
  createdAt?: string;
}

export const reproductionService = {
  create: async (data: ReproductionServiceRequest) => {
    return apiClient.post<ReproductionServiceResponse>(API_ENDPOINTS.REPRODUCTION_SERVICES, data);
  },

  getById: async (id: string) => {
    return apiClient.get<ReproductionServiceResponse>(`${API_ENDPOINTS.REPRODUCTION_SERVICES}/${id}`);
  },

  getAll: async () => {
    return apiClient.get<ReproductionServiceResponse[]>(API_ENDPOINTS.REPRODUCTION_SERVICES);
  },

  update: async (id: string, data: ReproductionServiceRequest) => {
    return apiClient.put<ReproductionServiceResponse>(
      `${API_ENDPOINTS.REPRODUCTION_SERVICES}/${id}`,
      data
    );
  },
};
