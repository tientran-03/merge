import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface HospitalStaffResponse {
  staffId: string;
  staffName: string;
  staffEmail?: string;
  staffPhone?: string;
  hospitalId?: string;
  hospitalName?: string;
  staffPosition?: string;
  userId?: string;
}

export const hospitalStaffService = {
  getAll: async () => {
    return apiClient.get<HospitalStaffResponse[]>(API_ENDPOINTS.HOSPITAL_STAFFS);
  },

  getById: async (id: string) => {
    return apiClient.get<HospitalStaffResponse>(API_ENDPOINTS.HOSPITAL_STAFF_BY_ID(id));
  },

  getByHospitalId: async (hospitalId: string) => {
    return apiClient.get<HospitalStaffResponse[]>(
      `${API_ENDPOINTS.HOSPITAL_STAFFS}/hospital/${hospitalId}`,
    );
  },

  search: async (name: string) => {
    return apiClient.get<HospitalStaffResponse[]>(
      `${API_ENDPOINTS.HOSPITAL_STAFFS}/search?name=${encodeURIComponent(name)}`
    );
  },
};
