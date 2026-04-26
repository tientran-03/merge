import { apiClient } from "./api";
import { API_ENDPOINTS } from "@/config/api";

export interface PatientAppendixResponse {
  id?: string;
  patientId?: string;
  patientName?: string;
  specifyId?: string;
  labCode?: string;
  appendixPath?: string;
  appendixType?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  description?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const patientAppendixService = {
  getAll: async (params?: { page?: number; size?: number }): Promise<ApiResponse<PatientAppendixResponse[]>> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page !== undefined) queryParams.append("page", params.page.toString());
      if (params?.size) queryParams.append("size", params.size.toString());
      const url = queryParams.toString()
        ? `${API_ENDPOINTS.PATIENT_APPENDICES}?${queryParams.toString()}`
        : API_ENDPOINTS.PATIENT_APPENDICES;
      const response = await apiClient.get<PatientAppendixResponse[]>(url);
      return response;
    } catch (error: any) {
      console.error("[PatientAppendixService] Error fetching patient appendices:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy thông tin phụ lục bệnh nhân",
      };
    }
  },

  getByPatientId: async (patientId: string): Promise<ApiResponse<PatientAppendixResponse[]>> => {
    try {
      const url = `${API_ENDPOINTS.PATIENT_APPENDICES}/patient/${patientId}`;
      const response = await apiClient.get<PatientAppendixResponse[]>(url);
      return response;
    } catch (error: any) {
      console.error("[PatientAppendixService] Error fetching patient appendices by patientId:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy thông tin phụ lục bệnh nhân",
      };
    }
  },

  getById: async (id: string): Promise<ApiResponse<PatientAppendixResponse>> => {
    try {
      const url = `${API_ENDPOINTS.PATIENT_APPENDICES}/${id}`;
      const response = await apiClient.get<PatientAppendixResponse>(url);
      return response;
    } catch (error: any) {
      console.error("[PatientAppendixService] Error fetching patient appendix by id:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy thông tin phụ lục bệnh nhân",
      };
    }
  },
};
