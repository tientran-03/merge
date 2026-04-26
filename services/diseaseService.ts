import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface DiseaseServiceRequest {
  serviceId: string;
  patientId: string;
  symptom?: string;
  diagnose?: string;
  diagnoseImage?: string;
  testRelated?: string;
  treatmentMethods?: string;
  treatmentTimeDay?: number;
  drugResistance?: string;
  relapse?: string;
}

export interface DiseaseServiceResponse {
  id: string;
  serviceId: string;
  serviceType: string;
  patientId: string;
  patientName?: string;
  symptom?: string;
  diagnose?: string;
  diagnoseImage?: string;
  testRelated?: string;
  treatmentMethods?: string;
  treatmentTimeDay?: number;
  drugResistance?: string;
  relapse?: string;
  createdAt?: string;
}

export const diseaseService = {
  create: async (data: DiseaseServiceRequest) => {
    return apiClient.post<DiseaseServiceResponse>(API_ENDPOINTS.DISEASE_SERVICES, data);
  },

  update: async (id: string, data: DiseaseServiceRequest) => {
    return apiClient.put<DiseaseServiceResponse>(`${API_ENDPOINTS.DISEASE_SERVICES}/${id}`, data);
  },

  getById: async (id: string) => {
    return apiClient.get<DiseaseServiceResponse>(`${API_ENDPOINTS.DISEASE_SERVICES}/${id}`);
  },

  getAll: async () => {
    return apiClient.get<DiseaseServiceResponse[]>(API_ENDPOINTS.DISEASE_SERVICES);
  },

  getByPatientId: async (patientId: string) => {
    return apiClient.get<DiseaseServiceResponse[]>(`${API_ENDPOINTS.DISEASE_SERVICES}/patient/${patientId}`);
  },

  getByServiceId: async (serviceId: string) => {
    return apiClient.get<DiseaseServiceResponse[]>(`${API_ENDPOINTS.DISEASE_SERVICES}/service/${serviceId}`);
  },
};
