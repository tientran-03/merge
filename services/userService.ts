import { API_ENDPOINTS } from '@/config/api';
import { apiClient } from './api';

export interface UserResponse {
  userId: string;
  username?: string;
  displayName?: string;
  name?: string;
  gender?: string;
  dob?: string;
  email: string;
  phone?: string;
  address?: string;
  hospitalName?: string;
  hospitalId?: string;
  role: string;
  avatarUrl?: string;
  isActive?: boolean;
  blockReason?: string;
  enabled?: boolean;
  otpVerified?: boolean;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  phone: string;
  dob?: string;
  gender: string;
  role: string;
  hospitalName?: string;
  password: string;
  avatarUrl?: string;
}

export interface BlockUserRequest {
  userId: string;
  reason: string;
}

export interface UnblockUserRequest {
  userId: string;
}

export interface UpdateProfileRequest {
  userId: string;
  displayName?: string;
  phone?: string;
  address?: string;
  dob?: string;
  gender?: 'male' | 'female';
  avatarUrl?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const userService = {
  getAll: async (params?: {
    page?: number;
    size?: number;
  }): Promise<{ success: boolean; data?: UserResponse[]; error?: string }> => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.USERS}?${queryParams.toString()}`
      : API_ENDPOINTS.USERS;
    return apiClient.get<UserResponse[]>(url);
  },
  create: async (
    payload: CreateUserRequest,
  ): Promise<{ success: boolean; data?: UserResponse; error?: string; message?: string }> => {
    return apiClient.post<UserResponse>(API_ENDPOINTS.USER_CREATE, payload);
  },
  block: async (userId: string, reason: string): Promise<boolean> => {
    const response = await apiClient.post<boolean>(API_ENDPOINTS.USER_BLOCK, {
      userId,
      reason,
    });
    if (response.success) {
      return true;
    }
    throw new Error(response.error || 'Failed to block user');
  },
  unblock: async (userId: string): Promise<boolean> => {
    console.log(' Unblocking user:', userId);
    const response = await apiClient.post<boolean>(API_ENDPOINTS.USER_UNBLOCK, {
      userId,
    });
    console.log(' Unblock response:', response);
    if (response.success) {
      return true;
    }
    throw new Error(response.error || 'Failed to unblock user');
  },
  countByRole: async (role: string): Promise<number> => {
    const response = await apiClient.get<number>(API_ENDPOINTS.USER_COUNT_BY_ROLE(role));
    if (response.success && response.data !== undefined) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to count users');
  },

  updateProfile: async (
    data: UpdateProfileRequest
  ): Promise<{ success: boolean; data?: UserResponse; error?: string; message?: string }> => {
    return apiClient.put<UserResponse>(API_ENDPOINTS.USER_PROFILE, data);
  },

  changePassword: async (
    data: ChangePasswordRequest
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    return apiClient.post<string>(API_ENDPOINTS.USER_PWD_CHANGE, data);
  },
};
