import { apiClient } from "./api";
import { API_ENDPOINTS } from "@/config/api";

export interface DoctorResponse {
  doctorId: string;
  doctorName: string;
  doctorEmail?: string;
  doctorPhone?: string;
  hospitalId?: string;
  hospitalName?: string;
}

export const doctorService = {
  getAll: async () => {
    return apiClient.get<DoctorResponse[]>(API_ENDPOINTS.DOCTORS);
  },

  getById: async (id: string) => {
    return apiClient.get<DoctorResponse>(API_ENDPOINTS.DOCTOR_BY_ID(id));
  },

  getByUserId: async (userId: string) => {
    return apiClient.get<DoctorResponse>(API_ENDPOINTS.DOCTOR_BY_USER_ID(userId));
  },

  getByHospitalId: async (hospitalId: string) => {
    return apiClient.get<DoctorResponse[]>(
      `${API_ENDPOINTS.DOCTORS}/hospital/${hospitalId}`
    );
  },

  search: async (name: string) => {
    return apiClient.get<DoctorResponse[]>(
      `${API_ENDPOINTS.DOCTORS}/search?name=${encodeURIComponent(name)}`
    );
  },
};
