import { API_ENDPOINTS } from '@/config/api';
import { apiClient } from './api';

export interface HospitalResponse {
  hospitalId: number;
  hospitalName: string;
}

export interface HospitalRequest {
  hospitalName: string;
}

export const hospitalService = {
  getAll: async (params?: {
    page?: number;
    size?: number;
  }): Promise<{ success: boolean; data?: HospitalResponse[]; error?: string }> => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.HOSPITALS}?${queryParams.toString()}`
      : API_ENDPOINTS.HOSPITALS;
    return apiClient.get<HospitalResponse[]>(url);
  },
  getById: async (id: string | number): Promise<HospitalResponse> => {
    const response = await apiClient.get<HospitalResponse>(API_ENDPOINTS.HOSPITAL_BY_ID(id));
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to fetch hospital');
  },

  search: async (
    name: string,
    params?: { page?: number; size?: number }
  ): Promise<{ success: boolean; data?: HospitalResponse[]; error?: string }> => {
    const queryParams = new URLSearchParams();
    queryParams.append('name', name);
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    return apiClient.get<HospitalResponse[]>(
      `${API_ENDPOINTS.HOSPITALS_SEARCH}?${queryParams.toString()}`
    );
  },
  create: async (data: HospitalRequest): Promise<HospitalResponse> => {
    const response = await apiClient.post<HospitalResponse>(API_ENDPOINTS.HOSPITALS, data);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to create hospital');
  },
  update: async (id: string | number, data: HospitalRequest): Promise<HospitalResponse> => {
    const response = await apiClient.put<HospitalResponse>(API_ENDPOINTS.HOSPITAL_BY_ID(id), data);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to update hospital');
  },

  delete: async (id: string | number): Promise<boolean> => {
    const response = await apiClient.delete(API_ENDPOINTS.HOSPITAL_BY_ID(id));
    if (response.success) {
      return true;
    }
    throw new Error(response.error || 'Failed to delete hospital');
  },
};
