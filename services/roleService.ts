import { API_ENDPOINTS } from "@/config/api";
import { apiClient } from "./api";

export interface RoleResponse {
  id: string;
  name: string;
  description?: string;
  permissions?: RolePermissionInfo[];
}

export interface RolePermissionInfo {
  id: string;
  permissionId: string;
  permissionName: string;
  groupName: string;
  levelName: string;
  createAllowed: boolean;
  readAllowed: boolean;
  updateAllowed: boolean;
  deleteAllowed: boolean;
}

export interface RoleRequest {
  name: string;
  description?: string;
}

export const roleService = {
  /**
   * Get all roles
   */
  getAll: async (): Promise<RoleResponse[]> => {
    const response = await apiClient.get<RoleResponse[]>(API_ENDPOINTS.ROLES);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.error || "Failed to fetch roles");
  },

  /**
   * Get role by ID
   */
  getById: async (id: string): Promise<RoleResponse> => {
    const response = await apiClient.get<RoleResponse>(API_ENDPOINTS.ROLE_BY_ID(id));
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch role");
  },

  /**
   * Get role by name
   */
  getByName: async (name: string): Promise<RoleResponse> => {
    const response = await apiClient.get<RoleResponse>(API_ENDPOINTS.ROLE_BY_NAME(name));
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch role");
  },

  /**
   * Create a new role
   */
  create: async (request: RoleRequest): Promise<RoleResponse> => {
    const response = await apiClient.post<RoleResponse>(API_ENDPOINTS.ROLES, request);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to create role");
  },

  /**
   * Update an existing role
   */
  update: async (id: string, request: RoleRequest): Promise<RoleResponse> => {
    const response = await apiClient.put<RoleResponse>(API_ENDPOINTS.ROLE_BY_ID(id), request);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to update role");
  },

  /**
   * Delete a role
   */
  delete: async (id: string): Promise<void> => {
    const response = await apiClient.delete(API_ENDPOINTS.ROLE_BY_ID(id));
    if (!response.success) {
      throw new Error(response.error || "Failed to delete role");
    }
  },
};
