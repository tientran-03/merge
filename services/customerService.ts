import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface CustomerResponse {
  customerId: string;
  customerName: string;
  customerGender?: string;
  customerDob?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  hospitalId?: string;
  hospitalName?: string;
  userId?: string;
}

export interface CustomerRequest {
  customerName: string;
  customerGender?: string;
  customerDob?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  hospitalId?: string;
  userId: string;
}

export const customerService = {
  getAll: async (params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.CUSTOMERS}?${queryParams.toString()}`
      : (API_ENDPOINTS.CUSTOMERS || "/api/v1/customers");
    return apiClient.get<CustomerResponse[]>(url);
  },

  getById: async (id: string) => {
    return apiClient.get<CustomerResponse>(`/api/v1/customers/${id}`);
  },

  getByUserId: async (userId: string) => {
    return apiClient.get<CustomerResponse>(`/api/v1/customers/user/${userId}`);
  },

  getByHospitalId: async (hospitalId: string) => {
    return apiClient.get<CustomerResponse[]>(`/api/v1/customers/hospital/${hospitalId}`);
  },

  search: async (name: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    queryParams.append("name", name);
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    return apiClient.get<CustomerResponse[]>(
      `/api/v1/customers/search?${queryParams.toString()}`
    );
  },

  create: async (data: CustomerRequest) => {
    return apiClient.post<CustomerResponse>(API_ENDPOINTS.CUSTOMERS || "/api/v1/customers", data);
  },

  update: async (id: string, data: CustomerRequest) => {
    return apiClient.put<CustomerResponse>(API_ENDPOINTS.CUSTOMER_BY_ID(id), data);
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.CUSTOMER_BY_ID(id));
  },
};
