import { API_ENDPOINTS } from "@/config/api";
import { apiClient } from "./api";

export interface PermissionResponse {
  id: string;
  permissionName: string;
  groupName: string;
  levelName: string;
}

export interface PermissionRequest {
  permissionName: string;
  groupName: string;
  levelName: string;
}

export const permissionService = {
  /**
   * Get all permissions
   */
  getAll: async (): Promise<PermissionResponse[]> => {
    const response = await apiClient.get<PermissionResponse[]>(API_ENDPOINTS.PERMISSIONS);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.error || "Failed to fetch permissions");
  },

  /**
   * Get permission by ID
   */
  getById: async (id: string): Promise<PermissionResponse> => {
    const response = await apiClient.get<PermissionResponse>(API_ENDPOINTS.PERMISSION_BY_ID(id));
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch permission");
  },

  /**
   * Create a new permission
   */
  create: async (data: PermissionRequest) => {
    return apiClient.post<PermissionResponse>(API_ENDPOINTS.PERMISSIONS, data);
  },

  /**
   * Update an existing permission
   */
  update: async (id: string, data: PermissionRequest) => {
    return apiClient.put<PermissionResponse>(API_ENDPOINTS.PERMISSION_BY_ID(id), data);
  },

  /**
   * Delete a permission
   */
  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.PERMISSION_BY_ID(id));
  },
};
