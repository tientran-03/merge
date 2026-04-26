import { apiClient } from "./api";
import { API_ENDPOINTS } from "@/config/api";

export interface PatientMetadataResponse {
  labcode: string;
  specifyId?: string;
  patientId?: string;
  patientName?: string;
  sampleName?: string;
  status?: string;
  testResultPath?: string;
  sampleAdd?: boolean;
  /** Đồng bộ backend — đã upload cặp FASTQ lên MinIO */
  hasFastq?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PatientMetadataRequest {
  specifyId: string;
  patientId: string;
  patientName?: string;
  sampleName?: string;
}

/** Trang Spring — khớp `GET /api/v1/patient-metadata/paged` */
export type PatientMetadataPage = {
  content: PatientMetadataResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
};

export const patientMetadataService = {
  /**
   * Danh sách metadata: có `page` + `size` thì gọi `/paged` (đúng phân trang backend),
   * không thì trả về toàn bộ (`GET /patient-metadata`).
   */
  getAll: async (
    params?: { page?: number; size?: number },
  ): Promise<ApiResponse<PatientMetadataResponse[] | PatientMetadataPage>> => {
    try {
      if (params?.page !== undefined && params?.size !== undefined) {
        const queryParams = new URLSearchParams();
        queryParams.append("page", String(params.page));
        queryParams.append("size", String(params.size));
        queryParams.append("sort", "labcode,desc");
        const url = `${API_ENDPOINTS.PATIENT_METADATA}/paged?${queryParams.toString()}`;
        const response = await apiClient.get<PatientMetadataPage>(url);
        return response;
      }
      const response = await apiClient.get<PatientMetadataResponse[]>(API_ENDPOINTS.PATIENT_METADATA);
      return response;
    } catch (error: any) {
      console.error("[PatientMetadataService] Error fetching patient metadata:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy thông tin patient metadata",
      };
    }
  },

  getBySpecifyId: async (specifyId: string): Promise<ApiResponse<PatientMetadataResponse[]>> => {
    try {
      const url = API_ENDPOINTS.PATIENT_METADATA_BY_SPECIFY_ID(specifyId);
      const response = await apiClient.get<PatientMetadataResponse[]>(url);
      return response;
    } catch (error: any) {
      console.error("[PatientMetadataService] Error fetching by specifyId:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy danh sách mẫu theo phiếu chỉ định",
      };
    }
  },

  getByPatientId: async (patientId: string, params?: { page?: number; size?: number }): Promise<ApiResponse<PatientMetadataResponse[]>> => {
    try {
      console.log("[PatientMetadataService] Fetching metadata for patientId:", patientId);
      const queryParams = new URLSearchParams();
      if (params?.page !== undefined) queryParams.append("page", params.page.toString());
      if (params?.size) queryParams.append("size", params.size.toString());
      const url = queryParams.toString()
        ? `/api/v1/patient-metadata/patient/${patientId}?${queryParams.toString()}`
        : `/api/v1/patient-metadata/patient/${patientId}`;
      const response = await apiClient.get<PatientMetadataResponse[]>(url);
      console.log("[PatientMetadataService] Response:", response);
      return response;
    } catch (error: any) {
      console.error("[PatientMetadataService] Error fetching patient metadata:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy thông tin patient metadata",
      };
    }
  },
  
  create: async (data: PatientMetadataRequest): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      console.log("[PatientMetadataService] Creating metadata:", data);
      const response = await apiClient.post<PatientMetadataResponse>(
        API_ENDPOINTS.PATIENT_METADATA,
        data
      );
      console.log("[PatientMetadataService] Create response:", response);
      return response;
    } catch (error: any) {
      console.error("[PatientMetadataService] Error creating patient metadata:", error);
      return {
        success: false,
        error: error?.message || "Không thể tạo patient metadata",
      };
    }
  },

  /**
   * `POST /api/v1/patient-metadata/analyze` — tạo mẫu với `sample_waiting_analyze` (giống web sau thanh toán / chờ phân tích).
   */
  createWithAnalyze: async (data: PatientMetadataRequest): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      const response = await apiClient.post<PatientMetadataResponse>(
        `${API_ENDPOINTS.PATIENT_METADATA}/analyze`,
        data
      );
      return response;
    } catch (error: any) {
      console.error("[PatientMetadataService] createWithAnalyze error:", error);
      return {
        success: false,
        error: error?.message || "Không thể tạo patient metadata (chờ phân tích)",
      };
    }
  },

  /**
   * `POST /api/v1/patient-metadata/sampleAdd` — tạo metadata cho luồng bổ sung mẫu.
   */
  createWithSampleAdd: async (
    data: PatientMetadataRequest,
  ): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      const response = await apiClient.post<PatientMetadataResponse>(
        `${API_ENDPOINTS.PATIENT_METADATA}/sampleAdd`,
        data,
      );
      return response;
    } catch (error: any) {
      console.error("[PatientMetadataService] createWithSampleAdd error:", error);
      return {
        success: false,
        error: error?.message || "Không thể tạo patient metadata (mẫu bổ sung)",
      };
    }
  },

  /**
   * Update status for a patient metadata by labcode
   * Backend: PATCH /api/v1/patient-metadata/status/{labcode}?status=...
   */
  /**
   * Đánh dấu đã có kết quả (giống web `patientMetadataApi.updateTestResultPath`).
   * PATCH `/api/v1/patient-metadata/test-result/{labcode}` body `{ testResultPath }`
   */
  updateTestResultPath: async (
    labcode: string,
    testResultPath: string,
  ): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      const url = `/api/v1/patient-metadata/test-result/${encodeURIComponent(labcode)}`;
      const response = await apiClient.patch<PatientMetadataResponse>(url, { testResultPath });
      return response;
    } catch (error: any) {
      console.error("[PatientMetadataService] updateTestResultPath error:", error);
      return {
        success: false,
        error: error?.message || "Không thể cập nhật đường dẫn kết quả",
      };
    }
  },

  updateStatus: async (
    labcode: string,
    status: string,
  ): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      const url = `/api/v1/patient-metadata/status/${encodeURIComponent(
        labcode,
      )}?status=${encodeURIComponent(status)}`;
      const response = await apiClient.patch<PatientMetadataResponse>(url);
      return response;
    } catch (error: any) {
      console.error("[PatientMetadataService] Error updating status:", error);
      return {
        success: false,
        error: error?.message || "Không thể cập nhật trạng thái mẫu",
      };
    }
  },

  /** PATCH `/api/v1/patient-metadata/has-fastq/{labcode}?hasFastq=` — giống web sau upload FASTQ */
  updateHasFastq: async (
    labcode: string,
    hasFastq: boolean,
  ): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      const url = `/api/v1/patient-metadata/has-fastq/${encodeURIComponent(
        labcode,
      )}?hasFastq=${encodeURIComponent(String(hasFastq))}`;
      const response = await apiClient.patch<PatientMetadataResponse>(url);
      return response;
    } catch (error: any) {
      console.error("[PatientMetadataService] updateHasFastq error:", error);
      return {
        success: false,
        error: error?.message || "Không thể cập nhật hasFastq",
      };
    }
  },
};
