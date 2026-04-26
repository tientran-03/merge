import { apiClient } from "./api";
import { API_BASE_URL } from "@/config/api";

export interface AnnotationJob {
  id: string;
  run_name?: string;
  orig_input_fname?: string[];
  submission_time?: string;
  status: string;
  viewable?: boolean;
  num_input_var?: number;
  annotators?: string[];
  assembly?: string;
  note?: string;
  reports?: string[];
  num_error_input?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// OpenCRAVAT API proxy base URL - sử dụng API_BASE_URL từ config
const OC_PROXY_BASE = `${API_BASE_URL}/oc`;

export const annotationService = {
  /**
   * Fetch all job IDs
   */
  fetchJobIds: async (): Promise<ApiResponse<string[]>> => {
    try {
      // Sử dụng apiClient để có authentication
      const response = await apiClient.get<string[]>(`/oc/submit/jobs`);
      
      // Kiểm tra nếu response có error và là lỗi 500 hoặc SYSTEM_003
      if (!response.success) {
        const errorMsg = response.error || "";
        if (
          errorMsg.includes("SYSTEM_003") ||
          errorMsg.includes("Lỗi hệ thống") ||
          errorMsg.includes("500")
        ) {
          return {
            success: false,
            error: "Tính năng OpenCRAVAT Annotation chưa được kích hoạt trên hệ thống. Vui lòng liên hệ quản trị viên để kích hoạt tính năng này.",
          };
        }
        return {
          success: false,
          error: response.error || "Không thể lấy danh sách job IDs",
        };
      }

      if (response.success && response.data) {
        return {
          success: true,
          data: Array.isArray(response.data) ? response.data : [],
        };
      }

      return {
        success: false,
        error: "Không thể lấy danh sách job IDs",
      };
    } catch (error: any) {
      console.error("[AnnotationService] Error fetching job IDs:", error);
      const errorMsg = error?.message || "";
      // Nếu lỗi 500, có thể endpoint chưa được implement
      if (errorMsg.includes("500") || errorMsg.includes("SYSTEM_003")) {
        return {
          success: false,
          error: "Tính năng OpenCRAVAT Annotation chưa được kích hoạt trên hệ thống. Vui lòng liên hệ quản trị viên để kích hoạt tính năng này.",
        };
      }
      return {
        success: false,
        error: errorMsg || "Không thể lấy danh sách job IDs",
      };
    }
  },

  /**
   * Fetch detailed job info for given job IDs
   */
  fetchJobDetails: async (jobIds: string[]): Promise<ApiResponse<AnnotationJob[]>> => {
    try {
      if (!jobIds || jobIds.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      const url = `/oc/submit/getjobs?ids=${encodeURIComponent(
        JSON.stringify(jobIds)
      )}`;
      const response = await apiClient.get<AnnotationJob[]>(url);
      if (response.success && response.data) {
        return {
          success: true,
          data: Array.isArray(response.data) ? response.data : [],
        };
      }
      return {
        success: false,
        error: response.error || "Không thể lấy chi tiết jobs",
      };
    } catch (error: any) {
      console.error("[AnnotationService] Error fetching job details:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy chi tiết jobs",
      };
    }
  },

  /**
   * Fetch all jobs with full details
   */
  fetchAllJobs: async (): Promise<ApiResponse<AnnotationJob[]>> => {
    try {
      // First get all job IDs
      const idsResponse = await annotationService.fetchJobIds();
      if (!idsResponse.success || !idsResponse.data || idsResponse.data.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Then get details for all jobs
      return await annotationService.fetchJobDetails(idsResponse.data);
    } catch (error: any) {
      console.error("[AnnotationService] Error fetching all jobs:", error);
      return {
        success: false,
        error: error?.message || "Không thể lấy danh sách jobs",
      };
    }
  },
};
