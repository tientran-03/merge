import { API_ENDPOINTS } from "@/config/api";
import { apiClient } from "./api";

export interface RolePermissionResponse {
  id: string;
  roleId: string;
  permissionId: string;
  createAllowed: boolean;
  readAllowed: boolean;
  updateAllowed: boolean;
  deleteAllowed: boolean;
}

export interface RolePermissionRequest {
  roleId: string;
  permissionId: string;
  createAllowed: boolean;
  readAllowed: boolean;
  updateAllowed: boolean;
  deleteAllowed: boolean;
}

export interface PermissionAccess {
  permissionId: string;
  permissionName: string;
  groupName: string;
  levelName: string;
  createAllowed: boolean;
  readAllowed: boolean;
  updateAllowed: boolean;
  deleteAllowed: boolean;
}

export interface PermissionsByRoleNameResponse {
  [groupName: string]: {
    [levelName: string]: {
      access: PermissionAccess;
    };
  };
}

export const rolePermissionService = {
  /**
   * Assign a permission to a role
   */
  assignPermissionToRole: async (request: RolePermissionRequest): Promise<RolePermissionResponse> => {
    const response = await apiClient.post<RolePermissionResponse>(API_ENDPOINTS.ROLE_PERMISSIONS, request);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to assign permission to role");
  },

  /**
   * Update role permission access rights
   */
  update: async (id: string, request: RolePermissionRequest): Promise<RolePermissionResponse> => {
    const response = await apiClient.put<RolePermissionResponse>(API_ENDPOINTS.ROLE_PERMISSION_BY_ID(id), request);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to update role permission");
  },

  /**
   * Get role permission by ID
   */
  getById: async (id: string): Promise<RolePermissionResponse> => {
    const response = await apiClient.get<RolePermissionResponse>(API_ENDPOINTS.ROLE_PERMISSION_BY_ID(id));
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch role permission");
  },

  /**
   * Get all permissions for a specific role ID
   */
  getPermissionsByRoleId: async (roleId: string): Promise<RolePermissionResponse[]> => {
    const response = await apiClient.get<RolePermissionResponse[]>(API_ENDPOINTS.ROLE_PERMISSIONS_BY_ROLE_ID(roleId));
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.error || "Failed to fetch permissions by role");
  },

  /**
   * Get all permissions for a specific role name
   */
  getAllPermissionsByRoleName: async (roleName: string): Promise<PermissionsByRoleNameResponse> => {
    const response = await apiClient.get<PermissionsByRoleNameResponse>(API_ENDPOINTS.ROLE_PERMISSIONS_BY_ROLE_NAME(roleName));
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch permissions by role name");
  },

  /**
   * Get all roles that have a specific permission
   */
  getRolesByPermissionId: async (permissionId: string): Promise<RolePermissionResponse[]> => {
    const response = await apiClient.get<RolePermissionResponse[]>(API_ENDPOINTS.ROLE_PERMISSIONS_BY_PERMISSION_ID(permissionId));
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.error || "Failed to fetch roles by permission");
  },

  /**
   * Get all role-permission mappings
   */
  getAll: async (): Promise<RolePermissionResponse[]> => {
    const response = await apiClient.get<RolePermissionResponse[]>(API_ENDPOINTS.ROLE_PERMISSIONS);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.error || "Failed to fetch role permissions");
  },

  /**
   * Delete a role permission mapping by ID
   */
  delete: async (id: string): Promise<void> => {
    const response = await apiClient.delete(API_ENDPOINTS.ROLE_PERMISSION_BY_ID(id));
    if (!response.success) {
      throw new Error(response.error || "Failed to delete role permission");
    }
  },

  /**
   * Delete a specific role-permission mapping
   */
  deleteByRoleAndPermission: async (roleId: string, permissionId: string): Promise<void> => {
    const response = await apiClient.delete(API_ENDPOINTS.ROLE_PERMISSION_DELETE_BY_ROLE_AND_PERMISSION(roleId, permissionId));
    if (!response.success) {
      throw new Error(response.error || "Failed to delete role permission");
    }
  },

  /**
   * Delete all permissions for a specific role
   */
  deleteAllForRole: async (roleId: string): Promise<void> => {
    const response = await apiClient.delete(API_ENDPOINTS.ROLE_PERMISSIONS_DELETE_ALL_FOR_ROLE(roleId));
    if (!response.success) {
      throw new Error(response.error || "Failed to delete all permissions for role");
    }
  },
};
