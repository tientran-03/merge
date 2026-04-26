import { API_ENDPOINTS } from "@/config/api";
import { apiClient } from "./api";

// System Logs Types
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  logger?: string;
  traceId?: string;
  [key: string]: unknown;
}

export interface LogQueryResponse {
  streams: {
    entries: LogEntry[];
    labels: Record<string, string>;
  }[];
}

export interface LogStatisticsResponse {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
}

export interface LokiHealthResponse {
  status: string;
  message?: string;
}

// Audit Logs Types
export interface AuditLogEntry {
  timestamp: string;
  userId?: string;
  username?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: string;
  ipAddress?: string;
  details?: string;
}

export interface AuditLogResponse {
  logs: AuditLogEntry[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface AuditLogStatisticsResponse {
  totalLogs: number;
  actionCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  resourceCounts: Record<string, number>;
}

// Security Logs Types
export interface SecurityLogEntry {
  timestamp: string;
  userId?: string;
  username?: string;
  userRole?: string;
  action: string;
  endpoint?: string;
  ipAddress?: string;
  status: string;
  threatScore: number;
  details?: string;
}

export interface SecurityLogResponse {
  logs: SecurityLogEntry[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  summary?: {
    totalLogs: number;
    highThreatCount: number;
    failedLoginCount: number;
  };
}

export interface SecurityStatisticsResponse {
  totalLogs: number;
  highThreatCount: number;
  failedLoginCount: number;
  actionCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  threatScoreDistribution: {
    score: number;
    count: number;
  }[];
}

export interface SuspiciousIpResponse {
  ipAddress: string;
  threatScore: number;
  eventCount: number;
  lastSeen: string;
}

export const logService = {
  // System Logs
  checkLokiHealth: async () => {
    return apiClient.get<LokiHealthResponse>(API_ENDPOINTS.SYSTEM_LOGS_HEALTH);
  },

  querySystemLogs: async (params?: {
    level?: string;
    keyword?: string;
    limit?: number;
    start?: string;
    end?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.level) queryParams.append("level", params.level);
    if (params?.keyword) queryParams.append("keyword", params.keyword);
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.start) queryParams.append("start", params.start);
    if (params?.end) queryParams.append("end", params.end);

    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SYSTEM_LOGS_QUERY}?${queryParams.toString()}`
      : API_ENDPOINTS.SYSTEM_LOGS_QUERY;
    return apiClient.get<LogQueryResponse>(url);
  },

  getSystemLogStatistics: async () => {
    return apiClient.get<LogStatisticsResponse>(API_ENDPOINTS.SYSTEM_LOGS_STATISTICS);
  },

  // Audit Logs
  queryAuditLogs: async (params?: {
    userId?: string;
    username?: string;
    userRole?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    status?: string;
    ipAddress?: string;
    startTime?: string;
    endTime?: string;
    keyword?: string;
    page?: number;
    size?: number;
    sortDirection?: "ASC" | "DESC";
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append("userId", params.userId);
    if (params?.username) queryParams.append("username", params.username);
    if (params?.userRole) queryParams.append("userRole", params.userRole);
    if (params?.action) queryParams.append("action", params.action);
    if (params?.resource) queryParams.append("resource", params.resource);
    if (params?.resourceId) queryParams.append("resourceId", params.resourceId);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.ipAddress) queryParams.append("ipAddress", params.ipAddress);
    if (params?.startTime) queryParams.append("startTime", params.startTime);
    if (params?.endTime) queryParams.append("endTime", params.endTime);
    if (params?.keyword) queryParams.append("keyword", params.keyword);
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    if (params?.sortDirection) queryParams.append("sortDirection", params.sortDirection);

    const url = queryParams.toString()
      ? `${API_ENDPOINTS.AUDIT_LOGS}?${queryParams.toString()}`
      : API_ENDPOINTS.AUDIT_LOGS;
    return apiClient.get<AuditLogResponse>(url);
  },

  getAuditLogStatistics: async () => {
    return apiClient.get<AuditLogStatisticsResponse>(API_ENDPOINTS.AUDIT_LOGS_STATISTICS);
  },

  // Security Logs
  querySecurityLogs: async (params?: {
    userId?: string;
    username?: string;
    userRole?: string;
    action?: string;
    endpoint?: string;
    ipAddress?: string;
    status?: string;
    minThreatScore?: number;
    maxThreatScore?: number;
    startTime?: string;
    endTime?: string;
    keyword?: string;
    page?: number;
    size?: number;
    sortDirection?: "ASC" | "DESC";
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append("userId", params.userId);
    if (params?.username) queryParams.append("username", params.username);
    if (params?.userRole) queryParams.append("userRole", params.userRole);
    if (params?.action) queryParams.append("action", params.action);
    if (params?.endpoint) queryParams.append("endpoint", params.endpoint);
    if (params?.ipAddress) queryParams.append("ipAddress", params.ipAddress);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.minThreatScore !== undefined)
      queryParams.append("minThreatScore", params.minThreatScore.toString());
    if (params?.maxThreatScore !== undefined)
      queryParams.append("maxThreatScore", params.maxThreatScore.toString());
    if (params?.startTime) queryParams.append("startTime", params.startTime);
    if (params?.endTime) queryParams.append("endTime", params.endTime);
    if (params?.keyword) queryParams.append("keyword", params.keyword);
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    if (params?.sortDirection) queryParams.append("sortDirection", params.sortDirection);

    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SECURITY_LOGS}?${queryParams.toString()}`
      : API_ENDPOINTS.SECURITY_LOGS;
    return apiClient.get<SecurityLogResponse>(url);
  },

  getSecurityAlerts: async (params?: {
    minThreatScore?: number;
    startTime?: string;
    endTime?: string;
    page?: number;
    size?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.minThreatScore !== undefined)
      queryParams.append("minThreatScore", params.minThreatScore.toString());
    if (params?.startTime) queryParams.append("startTime", params.startTime);
    if (params?.endTime) queryParams.append("endTime", params.endTime);
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());

    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SECURITY_LOGS_ALERTS}?${queryParams.toString()}`
      : API_ENDPOINTS.SECURITY_LOGS_ALERTS;
    return apiClient.get<SecurityLogResponse>(url);
  },

  getSecurityStatistics: async (params?: {
    startTime?: string;
    endTime?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startTime) queryParams.append("startTime", params.startTime);
    if (params?.endTime) queryParams.append("endTime", params.endTime);

    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SECURITY_LOGS_STATISTICS}?${queryParams.toString()}`
      : API_ENDPOINTS.SECURITY_LOGS_STATISTICS;
    return apiClient.get<SecurityStatisticsResponse>(url);
  },

  getSuspiciousIps: async (params?: {
    limit?: number;
    startTime?: string;
    endTime?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.startTime) queryParams.append("startTime", params.startTime);
    if (params?.endTime) queryParams.append("endTime", params.endTime);

    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SECURITY_LOGS_SUSPICIOUS_IPS}?${queryParams.toString()}`
      : API_ENDPOINTS.SECURITY_LOGS_SUSPICIOUS_IPS;
    return apiClient.get<SuspiciousIpResponse[]>(url);
  },
};
