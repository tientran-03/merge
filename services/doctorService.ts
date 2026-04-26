import { apiClient, ApiResponse } from "./api";
import { API_ENDPOINTS } from "@/config/api";

export interface DoctorResponse {
  doctorId: string;
  doctorName: string;
  doctorGender?: string;
  doctorDob?: string;
  doctorEmail?: string;
  doctorPhone?: string;
  doctorAddress?: string;
  hospitalId?: string;
  hospitalName?: string;
  doctorDegree?: string;
  doctorSpecialized?: string;
  userId?: string;
}

export interface DoctorRequest {
  doctorName: string;
  doctorGender?: string;
  doctorDob?: string;
  doctorEmail?: string;
  doctorPhone?: string;
  doctorAddress?: string;
  hospitalId: string;
  doctorDegree?: string;
  doctorSpecialized?: string;
  userId: string;
}

export const doctorService = {
  getAll: async () => {
    return apiClient.get<DoctorResponse[]>(API_ENDPOINTS.DOCTORS);
  },

  getById: async (id: string) => {
    return apiClient.get<DoctorResponse>(API_ENDPOINTS.DOCTOR_BY_ID(id));
  },

  getByUserId: async (userId: string) => {
    return apiClient.get<DoctorResponse>(`${API_ENDPOINTS.DOCTORS}/user/${userId}`);
  },

  search: async (name: string) => {
    return apiClient.get<DoctorResponse[]>(
      `${API_ENDPOINTS.DOCTORS}/search?name=${encodeURIComponent(name)}`
    );
  },

  // Get doctors by hospital ID and normalize to plain array
  getByHospitalId: async (hospitalId: string): Promise<DoctorResponse[]> => {
    const resp: ApiResponse<DoctorResponse[]> = await apiClient.get<DoctorResponse[]>(
      `${API_ENDPOINTS.DOCTORS}/hospital/${hospitalId}`
    );
    if (resp.success && Array.isArray(resp.data)) {
      return resp.data;
    }
    return [];
  },

  update: async (id: string, data: DoctorRequest) => {
    return apiClient.put<DoctorResponse>(API_ENDPOINTS.DOCTOR_BY_ID(id), data);
  },
};
