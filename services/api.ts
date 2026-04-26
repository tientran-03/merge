import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '@/config/api';
import { getTrustedDeviceToken, removeTrustedDeviceToken } from '@/lib/trustedDeviceToken';
import { buildMobileDeviceInfoHeader } from '@/utils/trustDevicePayload';

const REQUEST_TIMEOUT_MS = 25_000;

const TOKEN_KEY = '@htgen:token';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }
  private async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }
  private async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting token:', error);
    }
  }
  private async removeToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  }
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = await this.getToken();
    const trustedDevice = await getTrustedDeviceToken();

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: HeadersInit & {
      Authorization?: string;
      'x-device-token'?: string;
      'X-Device-Id'?: string;
    } = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (trustedDevice) {
      headers['x-device-token'] = trustedDevice;
    }
    headers['X-Device-Id'] = buildMobileDeviceInfoHeader();
    try {
      const fullUrl = `${this.baseURL}${endpoint}`;
      console.log(' API Request:', {
        method: options.method || 'GET',
        url: fullUrl,
        baseURL: this.baseURL,
        endpoint,
        headers: Object.keys(headers),
      });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(fullUrl, {
          ...options,
          headers,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      console.log(' API Response:', {
        status: response.status,
        statusText: response.statusText,
        url: fullUrl,
        headers: Object.fromEntries(response.headers.entries()),
      });
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        console.error(` Error ${response.status}: Bad Gateway / Service Unavailable`);
        console.error('  - Backend server may be down or unreachable');
        console.error('  - Cloudflare cannot connect to origin server');
        console.error('  - Server may be overloaded or under maintenance');
        const statusText =
          response.status === 502
            ? 'Bad Gateway - Server không phản hồi'
            : response.status === 503
              ? 'Service Unavailable - Dịch vụ tạm thời không khả dụng'
              : 'Gateway Timeout - Server phản hồi quá chậm';
        return {
          success: false,
          error: `${statusText}. Vui lòng thử lại sau hoặc liên hệ quản trị viên.`,
        };
      }

      if (response.status === 530) {
        console.error(' Error 530: Origin is unreachable. Possible issues:');
        console.error('  - Domain may not be configured correctly');
        console.error('  - Backend server may not be running on this domain');
        console.error('  - Cloudflare/reverse proxy configuration issue');
        console.error('  - SSL/TLS certificate problem');
        return {
          success: false,
          error:
            'Không thể kết nối đến server. Vui lòng kiểm tra:\n- Domain có đang hoạt động không?\n- Backend có đang chạy không?\n- Có thể thử dùng IP local khi phát triển',
        };
      }

      if (response.status === 401) {
        console.warn('Unauthorized - clearing token');
        await this.removeToken();
        return {
          success: false,
          error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        };
      }

      if (response.status === 204) {
        return {
          success: true,
        };
      }

      let data;
      const contentLength = response.headers.get('content-length');
      const hasBody = contentLength === null || parseInt(contentLength, 10) > 0;

      if (hasBody) {
        try {
          data = await response.json();
        } catch (e) {
          if (response.status === 201) {
            return {
              success: true,
            };
          }
          return {
            success: false,
            error: `Server error: ${response.status} ${response.statusText}`,
          };
        }
      }

      if (!response.ok) {
        const errCode = (data as any)?.errorCode;
        const errMsg = String((data as any)?.error || (data as any)?.message || '').toLowerCase();
        const isExpectedNotFound =
          response.status === 404 &&
          (errCode === 'PC_001' ||
            // Patient lookup flows (e.g. by email/phone) may legitimately return 404.
            // Avoid console.error because React Native will show a red error overlay.
            errMsg.includes('không tìm thấy bệnh nhân') ||
            errMsg.includes('khong tim thay benh nhan') ||
            errMsg.includes('patient not found'));
        if (!isExpectedNotFound) {
          console.error('API error response:', {
            status: response.status,
            statusText: response.statusText,
            data: JSON.stringify(data, null, 2),
          });
        }
        let errorMessage =
          data?.error || data?.message || `Server error: ${response.status} ${response.statusText}`;
        if (data?.data && Array.isArray(data.data)) {
          const validationErrors = data.data
            .map((err: any) => {
              if (typeof err === 'object') {
                return err.message || err.field
                  ? `${err.field}: ${err.message}`
                  : JSON.stringify(err);
              }
              return String(err);
            })
            .join('; ');
          if (validationErrors) {
            errorMessage = `${errorMessage}: ${validationErrors}`;
          }
          console.error('Validation errors:', data.data);
        }

        return {
          success: false,
          error: errorMessage,
        };
      }
      if (data) {
        if (response.status === 201) {
          if (data.success !== undefined) {
            return {
              success: data.success,
              message: data.message,
              data: data.data,
            };
          } else if (data.data) {
            return {
              success: true,
              message: data.message,
              data: data.data,
            };
          } else {
            return {
              success: true,
              data: data,
            };
          }
        }
        if (__DEV__) {
          console.log(' API Response Data:', {
            hasSuccess: data.success !== undefined,
            hasData: data.data !== undefined,
            hasLogs: data.logs !== undefined,
            keys: Object.keys(data),
            dataType: Array.isArray(data) ? 'array' : typeof data,
          });
        }
        if (data.success !== undefined) {
          return {
            success: data.success,
            message: data.message,
            data: data.data,
          } as ApiResponse<T>;
        } else if (data.logs !== undefined) {
          return {
            success: true,
            message: data?.message,
            data: data as T,
          };
        } else if (Array.isArray(data)) {
          return {
            success: true,
            data: data as T,
          };
        } else {
          return {
            success: true,
            message: data?.message,
            data: (data?.data || data) as T,
          };
        }
      }
      return {
        success: true,
      };
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        name: error.name,
        baseURL: this.baseURL,
        endpoint,
        fullUrl: `${this.baseURL}${endpoint}`,
        stack: error.stack,
        cause: error.cause,
      };
      console.error(' API request error:', errorDetails);
      let errorMessage = error.message || 'Network error occurred';
      if (error.name === 'AbortError') {
        errorMessage = `Hết thời gian chờ (${REQUEST_TIMEOUT_MS / 1000}s). Server không phản hồi — kiểm tra mạng hoặc backend.`;
      } else if (error.message?.includes('Network request failed')) {
        errorMessage = `Không thể kết nối đến server. Kiểm tra:\n- Backend có đang chạy không?\n- Domain/IP đúng chưa? (${this.baseURL})\n- Máy tính và điện thoại cùng WiFi?\n- Firewall có chặn không?\n- SSL certificate có hợp lệ không?`;
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = `Không thể kết nối đến server tại ${this.baseURL}.\n\nCó thể do:\n- Domain chưa được cấu hình đúng\n- Backend chưa chạy trên domain này\n- Vấn đề với SSL certificate\n- Cloudflare/reverse proxy chưa được setup\n\nVui lòng kiểm tra kết nối mạng và cấu hình domain.`;
      } else if (
        error.message?.includes('certificate') ||
        error.message?.includes('SSL') ||
        error.message?.includes('TLS')
      ) {
        errorMessage = `Lỗi SSL/TLS certificate khi kết nối đến ${this.baseURL}.\n\nCó thể do:\n- Certificate chưa được cấu hình đúng\n- Certificate đã hết hạn\n- Domain chưa được setup SSL`;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  async postFormData<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body: formData });
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async login(email: string, password: string): Promise<ApiResponse<any>> {
    const response = await this.post('/api/auth/login', { email, password });

    if (response.success && response.data) {
      const data = response.data as any;
      const token = data.sessionId || data.token || data.accessToken || data.jwt;

      if (token) {
        console.log('Token extracted successfully:', {
          tokenType: Object.keys(data).find(k => data[k] === token),
        });
        await this.setToken(token);
      } else {
        console.error('No token found in login response:', data);
      }
    }

    return response;
  }

  async logout(): Promise<void> {
    await this.post('/api/auth/logout');
    await this.removeToken();
    await removeTrustedDeviceToken();
  }

  async getCurrentUser(): Promise<ApiResponse<any>> {
    return this.get('/api/auth/me');
  }
}

export const apiClient = new ApiClient();
