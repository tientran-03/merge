import { API_ENDPOINTS } from "@/config/api";
import { apiClient } from "./api";

export interface SystemConfigResponse {
  id: string;
  name: string;
  description?: string;
  metadata: Record<string, any>;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSystemConfigRequest {
  name: string;
  description?: string;
  metadata: Record<string, any>;
  isActive: boolean;
}

export interface UpdateSystemConfigRequest {
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}

export const SYSTEM_CONFIG_NAMES = {
  EMAIL_SMTP_CONFIG: "EMAIL_SMTP_CONFIG",
  EMAIL_SENDER_INFO: "EMAIL_SENDER_INFO",
  CLOUDINARY_CONFIG: "CLOUDINARY_CONFIG",
  FIREBASE_CONFIG: "FIREBASE_CONFIG",
} as const;

// Config name labels in Vietnamese
export const CONFIG_NAME_LABELS: Record<string, string> = {
  [SYSTEM_CONFIG_NAMES.EMAIL_SMTP_CONFIG]: "Cấu hình SMTP Email",
  [SYSTEM_CONFIG_NAMES.EMAIL_SENDER_INFO]: "Thông tin người gửi email",
  [SYSTEM_CONFIG_NAMES.CLOUDINARY_CONFIG]: "Cấu hình Cloudinary",
  [SYSTEM_CONFIG_NAMES.FIREBASE_CONFIG]: "Cấu hình Firebase Cloud Messaging",
};

export const getConfigLabel = (name: string): string => {
  return CONFIG_NAME_LABELS[name] || name;
};

export const systemConfigService = {
  /**
   * Get all system configs
   */
  getAll: async (): Promise<SystemConfigResponse[]> => {
    const response = await apiClient.get<SystemConfigResponse[]>(API_ENDPOINTS.SYSTEM_CONFIGS);
    if (response.success && response.data) {
      // Handle both array and object with data property
      if (Array.isArray(response.data)) {
        return response.data;
      }
      // If data is an object, try to extract array from it
      if (typeof response.data === 'object' && 'data' in response.data) {
        const nestedData = (response.data as any).data;
        return Array.isArray(nestedData) ? nestedData : [];
      }
      return [];
    }
    throw new Error(response.error || "Failed to fetch system configs");
  },

  /**
   * Get system config by ID
   */
  getById: async (id: string): Promise<SystemConfigResponse> => {
    const response = await apiClient.get<SystemConfigResponse>(API_ENDPOINTS.SYSTEM_CONFIG_BY_ID(id));
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch system config");
  },

  /**
   * Get config metadata by name
   */
  getMetadata: async <T = Record<string, unknown>>(configName: string): Promise<T> => {
    const response = await apiClient.get<T>(API_ENDPOINTS.SYSTEM_CONFIG_METADATA(configName));
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch config metadata");
  },

  /**
   * Create a new system config
   */
  create: async (request: CreateSystemConfigRequest): Promise<SystemConfigResponse> => {
    const response = await apiClient.post<SystemConfigResponse>(API_ENDPOINTS.SYSTEM_CONFIGS, request);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || response.message || "Failed to create system config");
  },

  /**
   * Update an existing system config
   */
  update: async (id: string, request: UpdateSystemConfigRequest): Promise<SystemConfigResponse> => {
    const response = await apiClient.put<SystemConfigResponse>(API_ENDPOINTS.SYSTEM_CONFIG_BY_ID(id), request);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || response.message || "Failed to update system config");
  },

  /**
   * Deactivate a system config
   */
  deactivate: async (id: string): Promise<void> => {
    const response = await apiClient.delete(API_ENDPOINTS.SYSTEM_CONFIG_BY_ID(id));
    if (!response.success) {
      throw new Error(response.error || response.message || "Failed to deactivate system config");
    }
  },

  /**
   * Get all available config names
   */
  getConfigNames: async (): Promise<string[]> => {
    const response = await apiClient.get<string[]>(API_ENDPOINTS.SYSTEM_CONFIG_NAMES);
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : [];
    }
    throw new Error(response.error || "Failed to fetch config names");
  },

  /**
   * Test connection for a specific config
   */
  testConnection: async (configName: string): Promise<TestConnectionResult> => {
    const response = await apiClient.post<any>(API_ENDPOINTS.SYSTEM_CONFIG_TEST(configName), {});
    
    if (__DEV__) {
      console.log("🔍 Test Connection Response:", {
        success: response.success,
        hasData: !!response.data,
        dataType: typeof response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        data: JSON.stringify(response.data, null, 2),
      });
    }
    
    if (response.success && response.data) {
      // Backend returns ApiResponse<Map<String, Object>> where data contains the test result
      // The data field itself contains {success, message, details, configName}
      const result = response.data;
      
      // If result is already in the correct format (has success and message properties)
      if (typeof result === 'object' && result !== null && 'success' in result) {
        return {
          success: Boolean(result.success),
          message: result.message || String(result.message || (result.success ? "Kết nối thành công" : "Kết nối thất bại")),
          details: result.details || (result.configName ? result : undefined),
        } as TestConnectionResult;
      }
      
      // If result has nested data structure
      if (result && typeof result === 'object' && 'data' in result && typeof result.data === 'object') {
        const testData = result.data;
        return {
          success: Boolean(testData.success),
          message: testData.message || String(testData.message || (testData.success ? "Kết nối thành công" : "Kết nối thất bại")),
          details: testData.details || testData,
        } as TestConnectionResult;
      }
      
      // Fallback: try to extract from result directly
      return {
        success: Boolean(result?.success || false),
        message: result?.message || String(result?.message || "Kết nối thất bại"),
        details: result,
      } as TestConnectionResult;
    }
    
    const errorMsg = response.error || response.message || "Failed to test connection";
    if (__DEV__) {
      console.error("❌ Test Connection Error:", errorMsg);
    }
    throw new Error(errorMsg);
  },

  /**
   * Clear all config caches
   */
  clearAllCache: async (): Promise<void> => {
    const response = await apiClient.post(API_ENDPOINTS.SYSTEM_CONFIG_CACHE_CLEAR, {});
    if (!response.success) {
      throw new Error(response.error || "Failed to clear cache");
    }
  },

  /**
   * Invalidate cache for a specific config
   */
  invalidateCache: async (configName: string): Promise<void> => {
    const response = await apiClient.delete(API_ENDPOINTS.SYSTEM_CONFIG_CACHE_INVALIDATE(configName));
    if (!response.success) {
      throw new Error(response.error || "Failed to invalidate cache");
    }
  },
};
