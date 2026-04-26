import { apiClient } from "./api";
import { API_ENDPOINTS } from "@/config/api";

export interface PatientTestResultResponse {
  id?: string;
  patientId?: string;
  patientName?: string;
  specifyId?: string;
  labCode?: string;
  testResultPath?: string;
  testResultType?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  status?: string;
  conclusion?: string;
  testDate?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const patientTestResultService = {
  getAll: async (params?: { page?: number; size?: number }): Promise<ApiResponse<PatientTestResultResponse[]>> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page !== undefined) queryParams.append("page", params.page.toString());
      if (params?.size) queryParams.append("size", params.size.toString());
      const url = queryParams.toString()
        ? `${API_ENDPOINTS.PATIENT_TEST_RESULTS}?${queryParams.toString()}`
        : API_ENDPOINTS.PATIENT_TEST_RESULTS;
      const response = await apiClient.get<PatientTestResultResponse[]>(url);
      return response;
    } catch (error: any) {
      console.error("[PatientTestResultService] Error fetching patient test results:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy thông tin kết quả xét nghiệm",
      };
    }
  },

  getByPatientId: async (patientId: string): Promise<ApiResponse<PatientTestResultResponse[]>> => {
    try {
      const url = `${API_ENDPOINTS.PATIENT_TEST_RESULTS}/patient/${patientId}`;
      const response = await apiClient.get<PatientTestResultResponse[]>(url);
      return response;
    } catch (error: any) {
      console.error("[PatientTestResultService] Error fetching patient test results by patientId:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy thông tin kết quả xét nghiệm",
      };
    }
  },

  getById: async (id: string): Promise<ApiResponse<PatientTestResultResponse>> => {
    try {
      const url = `${API_ENDPOINTS.PATIENT_TEST_RESULTS}/${id}`;
      const response = await apiClient.get<PatientTestResultResponse>(url);
      return response;
    } catch (error: any) {
      console.error("[PatientTestResultService] Error fetching patient test result by id:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy thông tin kết quả xét nghiệm",
      };
    }
  },

  getByLabCode: async (labCode: string): Promise<ApiResponse<PatientTestResultResponse[]>> => {
    try {
      const url = `${API_ENDPOINTS.PATIENT_TEST_RESULTS}/labcode/${labCode}`;
      const response = await apiClient.get<PatientTestResultResponse[]>(url);
      return response;
    } catch (error: any) {
      console.error("[PatientTestResultService] Error fetching patient test results by labCode:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy thông tin kết quả xét nghiệm",
      };
    }
  },
};
