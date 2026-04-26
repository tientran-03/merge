import { API_ENDPOINTS } from '@/config/api';
import { apiClient } from './api';

export interface SystemLogsQueryParams {
  keyword?: string;
  level?: string;
  limit?: number;
}

export interface LokiStreamEntry {
  message?: string;
  logger?: string;
  traceId?: string;
  level?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface LokiStream {
  stream?: Record<string, string>;
  values?: [string, string][];
  entries?: LokiStreamEntry[];
}

export interface SystemLogsResponse {
  streams?: LokiStream[];
}

export interface AuditLogQueryParams {
  keyword?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  size?: number;
}

export interface AuditLogEntry {
  action?: string;
  resource?: string;
  username?: string;
  timestamp?: string;
  status?: string;
  details?: string;
  [key: string]: any;
}

export interface AuditLogResponse {
  logs?: AuditLogEntry[];
  content?: AuditLogEntry[];
}

export interface SecurityLogQueryParams {
  keyword?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  size?: number;
}

export interface SecurityLogEntry {
  action?: string;
  endpoint?: string;
  username?: string;
  ipAddress?: string;
  timestamp?: string;
  status?: string;
  threatScore?: number;
  details?: string;
  [key: string]: any;
}

export interface SecurityLogResponse {
  logs?: SecurityLogEntry[];
  content?: SecurityLogEntry[];
}

export const logService = {
  querySystemLogs: async (params: SystemLogsQueryParams) => {
    const queryParams = new URLSearchParams();
    if (params.keyword) queryParams.append('keyword', params.keyword);
    if (params.level) queryParams.append('level', params.level);
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());

    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SYSTEM_LOGS_QUERY}?${queryParams.toString()}`
      : API_ENDPOINTS.SYSTEM_LOGS_QUERY;

    return apiClient.post<SystemLogsResponse>(url);
  },

  queryAuditLogs: async (params: AuditLogQueryParams) => {
    const queryParams = new URLSearchParams();
    if (params.keyword) queryParams.append('keyword', params.keyword);
    if (params.startTime) queryParams.append('startTime', params.startTime);
    if (params.endTime) queryParams.append('endTime', params.endTime);
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());

    const url = `${API_ENDPOINTS.AUDIT_LOGS}?${queryParams.toString()}`;
    return apiClient.get<AuditLogResponse>(url);
  },

  querySecurityLogs: async (params: SecurityLogQueryParams) => {
    const queryParams = new URLSearchParams();
    if (params.keyword) queryParams.append('keyword', params.keyword);
    if (params.startTime) queryParams.append('startTime', params.startTime);
    if (params.endTime) queryParams.append('endTime', params.endTime);
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());

    const url = `${API_ENDPOINTS.SECURITY_LOGS}?${queryParams.toString()}`;
    return apiClient.get<SecurityLogResponse>(url);
  },
};
