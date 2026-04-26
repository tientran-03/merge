import { API_ENDPOINTS } from "@/config/api";

import { apiClient, type ApiResponse } from "./api";

/** Khớp backend / web admin (TrustDeviceRequest) */
export type TrustDeviceRequest = {
  ipAddress?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  deviceName?: string;
  screen?: string;
};

export type ActiveSessionResponse = {
  sessionId: string;
  ipAddress?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  deviceName?: string;
  screen?: string;
  createdAt: number;
  expiresAt: number;
  currentSession: boolean;
  trusted: boolean;
};

export type TrustedDeviceResponse = {
  id: number;
  userId: string;
  deviceToken: string;
  ipAddress?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  deviceName?: string;
  screen?: string;
  lastUsed?: string;
  createdAt?: string;
};

export const deviceService = {
  getActiveSessions(): Promise<ApiResponse<ActiveSessionResponse[]>> {
    return apiClient.get<ActiveSessionResponse[]>(API_ENDPOINTS.DEVICES_SESSIONS);
  },

  getTrustedDevices(): Promise<ApiResponse<TrustedDeviceResponse[]>> {
    return apiClient.get<TrustedDeviceResponse[]>(API_ENDPOINTS.DEVICES_TRUSTED);
  },

  trustDevice(
    body: TrustDeviceRequest
  ): Promise<ApiResponse<TrustedDeviceResponse>> {
    return apiClient.post<TrustedDeviceResponse>(API_ENDPOINTS.DEVICES_TRUST, body);
  },

  logoutSession(sessionId: string): Promise<ApiResponse<boolean>> {
    return apiClient.post<boolean>(API_ENDPOINTS.DEVICES_SESSION_LOGOUT(sessionId));
  },

  removeTrustedDevice(id: number): Promise<ApiResponse<boolean>> {
    return apiClient.delete<boolean>(API_ENDPOINTS.DEVICES_TRUSTED_BY_ID(id));
  },
};
