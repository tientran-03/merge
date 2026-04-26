import { API_ENDPOINTS } from '@/config/api';
import { apiClient } from './api';

export interface PatientMetadataResponse {
  labcode: string;
  specifyId?: string;
  patientId?: string;
  patientName?: string;
  sampleName?: string;
  status?: string;
  testResultPath?: string;
  createdAt?: string;
  hasFastq?: boolean;
  has_fastq?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PatientMetadataRequest {
  specifyId: string;
  patientId?: string;
  patientName?: string;
  sampleName?: string;
}

export interface PatientMetadataPage {
  content: PatientMetadataResponse[];
  totalElements?: number;
  totalPages?: number;
  size?: number;
  number?: number;
}

export const patientMetadataService = {
  getById: async (labcode: string): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      const lc = String(labcode || '').trim();
      if (!lc) return { success: false, error: 'Thiếu labcode' };
      return await apiClient.get<PatientMetadataResponse>(API_ENDPOINTS.PATIENT_METADATA_BY_ID(lc));
    } catch (error: any) {
      console.error('[PatientMetadataService] Error fetching metadata by labcode:', error);
      return { success: false, error: error?.message || 'Không thể lấy patient metadata' };
    }
  },

  getAll: async (params?: {
    page?: number;
    size?: number;
  }): Promise<ApiResponse<PatientMetadataResponse[]>> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page !== undefined) queryParams.append('page', params.page.toString());
      if (params?.size) queryParams.append('size', params.size.toString());
      const url = queryParams.toString()
        ? `${API_ENDPOINTS.PATIENT_METADATA}?${queryParams.toString()}`
        : API_ENDPOINTS.PATIENT_METADATA;
      const response = await apiClient.get<PatientMetadataResponse[]>(url);
      return response;
    } catch (error: any) {
      console.error('[PatientMetadataService] Error fetching patient metadata:', error);
      return {
        success: false,
        error: error?.message || 'Không thể lấy thông tin patient metadata',
      };
    }
  },


  getByHospitalIdPaged: async (
    hospitalId: string,
    params?: { page?: number; size?: number; sort?: string }
  ): Promise<ApiResponse<PatientMetadataPage>> => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(params?.page ?? 0));
      queryParams.set('size', String(params?.size ?? 10));
      queryParams.set('sort', params?.sort ?? 'labcode,desc');
      const path = `/api/v1/patient-metadata/hospital/${encodeURIComponent(hospitalId)}/paged?${queryParams}`;
      return await apiClient.get<PatientMetadataPage>(path);
    } catch (error: any) {
      console.error('[PatientMetadataService] Error fetching hospital paged metadata:', error);
      return {
        success: false,
        error: error?.message || 'Không thể lấy danh sách metadata theo bệnh viện',
      };
    }
  },

  getAllForHospital: async (hospitalId: string): Promise<ApiResponse<PatientMetadataResponse[]>> => {
    const pageSize = 100;
    let page = 0;
    const all: PatientMetadataResponse[] = [];
    for (let guard = 0; guard < 200; guard++) {
      const res = await patientMetadataService.getByHospitalIdPaged(hospitalId, {
        page,
        size: pageSize,
        sort: 'labcode,desc',
      });
      if (!res.success) {
        return { success: false, error: res.error };
      }
      const body = res.data;
      if (!body || !Array.isArray(body.content)) {
        return { success: false, error: 'Định dạng phản hồi không hợp lệ' };
      }
      all.push(...body.content);
      const totalPages = Math.max(1, body.totalPages ?? 1);
      if (page >= totalPages - 1 || body.content.length < pageSize) {
        break;
      }
      page += 1;
    }
    return { success: true, data: all };
  },

  getByPatientId: async (
    patientId: string,
    params?: { page?: number; size?: number }
  ): Promise<ApiResponse<PatientMetadataResponse[]>> => {
    try {
      console.log('[PatientMetadataService] Fetching metadata for patientId:', patientId);
      const queryParams = new URLSearchParams();
      if (params?.page !== undefined) queryParams.append('page', params.page.toString());
      if (params?.size) queryParams.append('size', params.size.toString());
      const url = queryParams.toString()
        ? `/api/v1/patient-metadata/patient/${patientId}?${queryParams.toString()}`
        : `/api/v1/patient-metadata/patient/${patientId}`;
      const response = await apiClient.get<PatientMetadataResponse[]>(url);
      console.log('[PatientMetadataService] Response:', response);
      return response;
    } catch (error: any) {
      console.error('[PatientMetadataService] Error fetching patient metadata:', error);
      return {
        success: false,
        error: error?.message || 'Không thể lấy thông tin patient metadata',
      };
    }
  },

  getBySpecifyId: async (specifyId: string): Promise<ApiResponse<PatientMetadataResponse[]>> => {
    try {
      const sid = (specifyId || '').trim();
      if (!sid) {
        return { success: false, error: 'Thiếu specifyId' };
      }
      return await apiClient.get<PatientMetadataResponse[]>(
        API_ENDPOINTS.PATIENT_METADATA_BY_SPECIFY_ID(sid)
      );
    } catch (error: any) {
      console.error('[PatientMetadataService] Error fetching metadata by specifyId:', error);
      return {
        success: false,
        error: error?.message || 'Không thể lấy danh sách metadata theo phiếu chỉ định',
      };
    }
  },

  updateStatus: async (
    labcode: string,
    status: string
  ): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      const encodedStatus = encodeURIComponent(status);
      const response = await apiClient.patch<PatientMetadataResponse>(
        `${API_ENDPOINTS.PATIENT_METADATA}/status/${labcode}?status=${encodedStatus}`
      );
      return response;
    } catch (error: any) {
      console.error('[PatientMetadataService] Error updating status:', error);
      return {
        success: false,
        error: error?.message || 'Không thể cập nhật trạng thái',
      };
    }
  },

  updateHasFastq: async (
    labcode: string,
    hasFastq: boolean
  ): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      const response = await apiClient.patch<PatientMetadataResponse>(
        `${API_ENDPOINTS.PATIENT_METADATA}/has-fastq/${encodeURIComponent(labcode)}?hasFastq=${hasFastq}`
      );
      return response;
    } catch (error: any) {
      console.error('[PatientMetadataService] Error updating hasFastq:', error);
      return {
        success: false,
        error: error?.message || 'Không thể cập nhật hasFastq',
      };
    }
  },

  updateTestResultPath: async (
    labcode: string,
    testResultPath: string
  ): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      // Match frontend behavior: PATCH /test-result/{labcode} with JSON body
      const primary = await apiClient.patch<PatientMetadataResponse>(
        `${API_ENDPOINTS.PATIENT_METADATA}/test-result/${encodeURIComponent(labcode)}`,
        { testResultPath }
      );
      if (primary.success) return primary;

      // Backward-compatible fallback for older backend variants
      const fallback = await apiClient.patch<PatientMetadataResponse>(
        `${API_ENDPOINTS.PATIENT_METADATA}/test-result-path/${encodeURIComponent(labcode)}?testResultPath=${encodeURIComponent(testResultPath)}`
      );
      return fallback;
    } catch (error: any) {
      console.error('[PatientMetadataService] Error updating testResultPath:', error);
      return {
        success: false,
        error: error?.message || 'Không thể cập nhật đường dẫn kết quả',
      };
    }
  },

  create: async (data: PatientMetadataRequest): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      console.log('[PatientMetadataService] Creating metadata:', data);
      const response = await apiClient.post<PatientMetadataResponse>(
        API_ENDPOINTS.PATIENT_METADATA,
        data
      );
      console.log('[PatientMetadataService] Create response:', response);
      return response;
    } catch (error: any) {
      console.error('[PatientMetadataService] Error creating patient metadata:', error);
      return {
        success: false,
        error: error?.message || 'Không thể tạo patient metadata',
      };
    }
  },

  createWithSampleAdd: async (
    data: PatientMetadataRequest
  ): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      const response = await apiClient.post<PatientMetadataResponse>(
        `${API_ENDPOINTS.PATIENT_METADATA}/sampleAdd`,
        data
      );
      return response;
    } catch (error: any) {
      console.error('[PatientMetadataService] Error creating sample-add metadata:', error);
      return {
        success: false,
        error: error?.message || 'Không thể tạo patient metadata',
      };
    }
  },

  createWithAnalyze: async (
    data: PatientMetadataRequest
  ): Promise<ApiResponse<PatientMetadataResponse>> => {
    try {
      return await apiClient.post<PatientMetadataResponse>(
        `${API_ENDPOINTS.PATIENT_METADATA}/analyze`,
        data
      );
    } catch (error: any) {
      console.error('[PatientMetadataService] Error creating analyze metadata:', error);
      return {
        success: false,
        error: error?.message || 'Không thể tạo patient metadata',
      };
    }
  },
};
