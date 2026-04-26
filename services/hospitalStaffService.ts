import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface HospitalStaffResponse {
  staffId: string;
  staffName: string;
  staffGender?: string;
  staffDob?: string;
  staffEmail?: string;
  staffPhone?: string;
  staffAddress?: string;
  hospitalId?: string;
  hospitalName?: string;
  staffPosition?: string;
  userId?: string;
}

export interface HospitalStaffRequest {
  staffName: string;
  staffGender?: string;
  staffDob?: string;
  staffEmail?: string;
  staffPhone?: string;
  staffAddress?: string;
  hospitalId: string;
  staffPosition: string;
  userId?: string;
}

export const hospitalStaffService = {
  getAll: async () => {
    return apiClient.get<HospitalStaffResponse[]>(API_ENDPOINTS.HOSPITAL_STAFFS);
  },

  getById: async (id: string) => {
    return apiClient.get<HospitalStaffResponse>(API_ENDPOINTS.HOSPITAL_STAFF_BY_ID(id));
  },

  getByUserId: async (userId: string) => {
    return apiClient.get<HospitalStaffResponse>(`${API_ENDPOINTS.HOSPITAL_STAFFS}/user/${userId}`);
  },

  search: async (name: string) => {
    return apiClient.get<HospitalStaffResponse[]>(
      `${API_ENDPOINTS.HOSPITAL_STAFFS}/search?name=${encodeURIComponent(name)}`
    );
  },

  getByHospitalId: async (hospitalId: string) => {
    return apiClient.get<HospitalStaffResponse[]>(
      API_ENDPOINTS.HOSPITAL_STAFF_BY_HOSPITAL_ID(hospitalId)
    );
  },

  update: async (id: string, data: HospitalStaffRequest) => {
    return apiClient.put<HospitalStaffResponse>(API_ENDPOINTS.HOSPITAL_STAFF_BY_ID(id), data);
  },
};
