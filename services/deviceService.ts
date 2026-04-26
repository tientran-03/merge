import { API_ENDPOINTS } from '@/config/api';
import { setTrustedDeviceToken } from '@/lib/trustedDeviceToken';

import { apiClient } from './api';

export interface TrustedDeviceResponse {
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
}

export interface ActiveSessionResponse {
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
}

export interface TrustDeviceRequest {
  ipAddress?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  deviceName?: string;
  screen?: string;
}

export const deviceService = {
  getTrustedDevices: () => apiClient.get<TrustedDeviceResponse[]>(API_ENDPOINTS.DEVICES_TRUSTED),

  getActiveSessions: () => apiClient.get<ActiveSessionResponse[]>(API_ENDPOINTS.DEVICES_SESSIONS),

  trustDevice: async (body: TrustDeviceRequest) => {
    const res = await apiClient.post<TrustedDeviceResponse>(API_ENDPOINTS.DEVICES_TRUST, body);
    const data = res.data as TrustedDeviceResponse | undefined;
    if (res.success && data?.deviceToken) {
      await setTrustedDeviceToken(data.deviceToken);
    }
    return res;
  },

  removeTrustedDevice: (id: number) =>
    apiClient.delete<boolean>(API_ENDPOINTS.DEVICES_TRUSTED_BY_ID(id)),

  logoutSession: (sessionId: string) =>
    apiClient.post<boolean>(API_ENDPOINTS.DEVICES_SESSION_LOGOUT(sessionId), {}),
};
