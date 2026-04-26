import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface EmbryoServiceRequest {
  serviceId: string;
  patientId: string;
  biospy?: string;
  biospyDate?: string; 
  cellContainingSolution?: string;
  embryoCreate?: number;
  embryoStatus?: string;
  morphologicalAssessment?: string;
  cellNucleus?: boolean;
  negativeControl?: string;
}

export interface EmbryoServiceResponse {
  id: string;
  serviceId: string;
  serviceType: string;
  patientId: string;
  patientName?: string;
  biospy?: string;
  biospyDate?: string;
  cellContainingSolution?: string;
  embryoCreate?: number;
  embryoStatus?: string;
  morphologicalAssessment?: string;
  cellNucleus?: boolean;
  negativeControl?: string;
  createdAt?: string;
}

export const embryoService = {
  create: async (data: EmbryoServiceRequest) => {
    return apiClient.post<EmbryoServiceResponse>(API_ENDPOINTS.EMBRYO_SERVICES, data);
  },

  update: async (id: string, data: EmbryoServiceRequest) => {
    return apiClient.put<EmbryoServiceResponse>(`${API_ENDPOINTS.EMBRYO_SERVICES}/${id}`, data);
  },

  getById: async (id: string) => {
    return apiClient.get<EmbryoServiceResponse>(`${API_ENDPOINTS.EMBRYO_SERVICES}/${id}`);
  },

  getAll: async () => {
    return apiClient.get<EmbryoServiceResponse[]>(API_ENDPOINTS.EMBRYO_SERVICES);
  },

  getByPatientId: async (patientId: string) => {
    return apiClient.get<EmbryoServiceResponse[]>(`${API_ENDPOINTS.EMBRYO_SERVICES}/patient/${patientId}`);
  },

  getByServiceId: async (serviceId: string) => {
    return apiClient.get<EmbryoServiceResponse[]>(`${API_ENDPOINTS.EMBRYO_SERVICES}/service/${serviceId}`);
  },
};
