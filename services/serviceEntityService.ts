import { API_ENDPOINTS } from '@/config/api';
import { apiClient } from './api';

export interface ServiceEntityResponse {
  serviceId: string;
  name: string;
}

export interface ServiceEntityRequest {
  serviceId: string;
  name: string;
}

export const serviceEntityService = {
  getAll: async (params?: {
    page?: number;
    size?: number;
  }): Promise<{ success: boolean; data?: ServiceEntityResponse[]; error?: string }> => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SERVICES}?${queryParams.toString()}`
      : API_ENDPOINTS.SERVICES;
    return apiClient.get<ServiceEntityResponse[]>(url);
  },

  getById: async (id: string): Promise<ServiceEntityResponse> => {
    const response = await apiClient.get<ServiceEntityResponse>(API_ENDPOINTS.SERVICE_BY_ID(id));
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to fetch service');
  },

  create: async (data: ServiceEntityRequest): Promise<ServiceEntityResponse> => {
    console.log(' Creating service:', data);
    console.log('Endpoint:', API_ENDPOINTS.SERVICES);

    try {
      const response = await apiClient.post<ServiceEntityResponse>(API_ENDPOINTS.SERVICES, data);
      console.log(' Create response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        console.log(' Service created successfully:', response.data);
        return response.data;
      }

      const errorMsg = response.error || response.message || 'Failed to create service';
      console.error(' Create failed:', errorMsg);
      throw new Error(errorMsg);
    } catch (error: any) {
      console.error(' Create exception:', error);
      console.error(' Create exception details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
      });
      throw error;
    }
  },
  update: async (id: string, data: ServiceEntityRequest): Promise<ServiceEntityResponse> => {
    console.log('Updating service:', { id, data });
    const response = await apiClient.put<ServiceEntityResponse>(
      API_ENDPOINTS.SERVICE_BY_ID(id),
      data
    );
    console.log('Update response:', response);
    if (response.success && response.data) {
      return response.data;
    }
    const errorMsg = response.error || response.message || 'Failed to update service';
    console.error('Update error:', errorMsg);
    throw new Error(errorMsg);
  },

  delete: async (id: string): Promise<boolean> => {
    console.log(' Deleting service:', id);
    console.log(' Delete endpoint:', API_ENDPOINTS.SERVICE_BY_ID(id));

    try {
      const response = await apiClient.delete<void>(API_ENDPOINTS.SERVICE_BY_ID(id));
      console.log(' Delete response:', JSON.stringify(response, null, 2));

      if (response.success) {
        console.log(' Delete successful');
        return true;
      }

      const errorMsg = response.error || response.message || 'Failed to delete service';
      console.error('Delete failed:', errorMsg);
      throw new Error(errorMsg);
    } catch (error: any) {
      console.error(' Delete exception:', error);
      console.error(' Delete exception details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
      });
      throw error;
    }
  },
};
