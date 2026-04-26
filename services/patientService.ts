import { apiClient } from "./api";
import { API_ENDPOINTS } from "@/config/api";

export interface PatientResponse {
  patientId: string;
  patientCode?: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  patientDob?: string;
  gender?: "male" | "female" | "other";
  patientJob?: string;
  patientContactName?: string;
  patientContactPhone?: string;
  patientAddress?: string;
  hospitalId?: string;
  // Legacy fields for backward compatibility
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
}

export const patientService = {
  getAll: async (params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.PATIENTS}?${queryParams.toString()}`
      : API_ENDPOINTS.PATIENTS;
    return apiClient.get<PatientResponse[]>(url);
  },

  getById: async (id: string) => {
    return apiClient.get<PatientResponse>(API_ENDPOINTS.PATIENT_BY_ID(id));
  },

  getByPhone: async (phone: string) => {
    return apiClient.get<PatientResponse>(API_ENDPOINTS.PATIENT_BY_PHONE(encodeURIComponent(phone)));
  },

  getByHospitalId: async (hospitalId: string) => {
    return apiClient.get<PatientResponse[]>(`${API_ENDPOINTS.PATIENTS}/hospital/${hospitalId}`);
  },

  search: async (name: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    queryParams.append("name", name);
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    return apiClient.get<PatientResponse[]>(
      `${API_ENDPOINTS.PATIENT_SEARCH}?${queryParams.toString()}`
    );
  },

  create: async (data: any) => {
    return apiClient.post<PatientResponse>(API_ENDPOINTS.PATIENTS, data);
  },

  update: async (id: string, data: any) => {
    return apiClient.put<PatientResponse>(API_ENDPOINTS.PATIENT_BY_ID(id), data);
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.PATIENT_BY_ID(id));
  },
};
