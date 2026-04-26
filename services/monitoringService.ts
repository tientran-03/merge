import { API_ENDPOINTS } from "@/config/api";
import { apiClient } from "./api";

export interface DatabaseHealth {
  status: string;
  responseTime?: number;
  activeConnections?: number;
  maxConnections?: number;
  databaseName?: string;
  driverName?: string;
}

export interface RedisHealth {
  status: string;
  responseTime?: number;
  version?: string;
}

export interface JvmHealth {
  status: string;
  uptime?: number;
  memoryUsed?: number;
  memoryMax?: number;
  threads?: number;
}

export interface DiskHealth {
  status: string;
  total?: number;
  free?: number;
  usable?: number;
  threshold?: number;
}

export interface SystemHealthResponse {
  database?: DatabaseHealth;
  redis?: RedisHealth;
  jvm?: JvmHealth;
  disk?: DiskHealth;
}

export interface HttpMetrics {
  requests?: {
    total?: number;
    rate?: number;
    errors?: number;
  };
  responseTime?: {
    avg?: number;
    p50?: number;
    p95?: number;
    p99?: number;
  };
}

export interface JvmMetrics {
  memory?: {
    heapUsed?: number;
    heapMax?: number;
    nonHeapUsed?: number;
    heapCommitted?: number;
  };
  threads?: {
    live?: number;
    daemon?: number;
    peak?: number;
  };
  gc?: {
    pauseTime?: number;
    pauseCount?: number;
  };
  classes?: {
    loaded?: number;
    unloaded?: number;
  };
}

export interface DatabaseMetrics {
  connections?: {
    active?: number;
    idle?: number;
    pending?: number;
    max?: number;
  };
  pool?: {
    size?: number;
    available?: number;
  };
}

export interface ApplicationMetrics {
  totalUsers?: number;
  activeUsers?: number;
  totalOrders?: number;
  pendingOrders?: number;
}

export interface SystemMetricsResponse {
  http?: HttpMetrics;
  jvm?: JvmMetrics;
  database?: DatabaseMetrics;
  application?: ApplicationMetrics;
}

/** Backend GenomeService trả DTO phẳng; UI mobile dùng cấu trúc lồng — map tại đây. */
function normalizeSystemMetrics(raw: any): SystemMetricsResponse {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const out: SystemMetricsResponse = {};

  if (raw.http && typeof raw.http === "object") {
    const h = raw.http;
    const total = h.totalRequests ?? h.requests?.total ?? 0;
    const errors = h.failedRequests ?? h.requests?.errors ?? 0;
    const rate = h.requestsPerSecond ?? h.requests?.rate ?? 0;
    const avgMs =
      h.avgResponseTime != null
        ? Number(h.avgResponseTime)
        : h.responseTime?.avg != null
          ? Number(h.responseTime.avg) * 1000
          : 0;
    out.http = {
      requests: {
        total: typeof total === "number" ? total : Number(total) || 0,
        rate: typeof rate === "number" ? rate : Number(rate) || 0,
        errors: typeof errors === "number" ? errors : Number(errors) || 0,
      },
      responseTime: {
        avg: avgMs > 0 ? avgMs / 1000 : 0,
        p50: h.responseTime?.p50,
        p95: h.responseTime?.p95,
        p99: h.responseTime?.p99,
      },
    };
  }

  if (raw.database && typeof raw.database === "object") {
    const d = raw.database;
    const master = d.masterPool;
    const slave = d.slavePool;

    let active: number | undefined = d.connections?.active ?? d.activeConnections;
    if (active == null && (master || slave)) {
      active = (master?.activeConnections ?? 0) + (slave?.activeConnections ?? 0);
    }

    let idle: number | undefined = d.connections?.idle ?? d.idleConnections;
    if (idle == null && (master || slave)) {
      idle = (master?.idleConnections ?? 0) + (slave?.idleConnections ?? 0);
    }

    const pending = d.connections?.pending ?? d.pendingConnections ?? 0;
    const maxRaw =
      d.connections?.max ??
      d.maxConnections ??
      [master?.maxConnections, slave?.maxConnections].find((m: unknown) => typeof m === "number" && (m as number) > 0);
    const max = typeof maxRaw === "number" ? maxRaw : Number(maxRaw) || 0;

    out.database = {
      connections: {
        active: Number(active) || 0,
        idle: Number(idle) || 0,
        pending: Number(pending) || 0,
        max,
      },
      pool: d.pool,
    };
  }

  if (raw.jvm && typeof raw.jvm === "object") {
    const j = raw.jvm;
    const mem = j.memory || {};
    const th = j.threads || {};
    const gc = j.gc || {};
    out.jvm = {
      memory: {
        heapUsed: mem.heapUsed,
        heapMax: mem.heapMax,
        nonHeapUsed: mem.nonHeapUsed,
        heapCommitted: mem.heapCommitted,
      },
      threads: {
        live: th.liveThreads ?? th.live,
        daemon: th.daemonThreads ?? th.daemon,
        peak: th.peakThreads ?? th.peak,
      },
      gc: {
        pauseCount: gc.gcCount ?? gc.pauseCount,
        pauseTime:
          gc.gcTime != null
            ? Number(gc.gcTime) / 1000
            : gc.pauseTime != null
              ? Number(gc.pauseTime)
              : undefined,
      },
      classes: j.classes,
    };
  }

  if (raw.application && typeof raw.application === "object") {
    const a = raw.application;
    out.application = {
      totalUsers: a.totalUsers,
      activeUsers: a.activeUsers,
      totalOrders: a.totalOrders,
      pendingOrders: a.pendingOrders,
    };
  }

  return out;
}

export const monitoringService = {
  /**
   * Get overall system health
   */
  getSystemHealth: async (): Promise<SystemHealthResponse> => {
    const response = await apiClient.get<SystemHealthResponse>(API_ENDPOINTS.METRICS_HEALTH);
    if (response.success && response.data) {
      const raw: any = response.data;

      const normalized: SystemHealthResponse = {
        database: raw.database
          ? {
              status: raw.database.status || "UNKNOWN",
              responseTime:
                raw.database.responseTime !== undefined
                  ? raw.database.responseTime
                  : raw.database.responseTimeMs,
              activeConnections: raw.database.activeConnections,
              maxConnections: raw.database.maxConnections,
              databaseName: raw.database.databaseName || raw.database.driverName,
              driverName: raw.database.driverName,
            }
          : undefined,
        redis: raw.redis
          ? {
              status: raw.redis.status || "UNKNOWN",
              responseTime:
                raw.redis.responseTime !== undefined
                  ? raw.redis.responseTime
                  : raw.redis.responseTimeMs,
              version: raw.redis.version,
            }
          : undefined,
        jvm: raw.jvm
          ? {
              // Backend does not expose jvm.status, derive from heap usage for UI badge.
              status:
                raw.jvm.status ||
                (raw.jvm.heapUsagePercent !== undefined && raw.jvm.heapUsagePercent > 90
                  ? "DEGRADED"
                  : "UP"),
              uptime: raw.uptime ?? raw.jvm.uptime,
              memoryUsed:
                raw.jvm.memoryUsed !== undefined ? raw.jvm.memoryUsed : raw.jvm.heapUsed,
              memoryMax:
                raw.jvm.memoryMax !== undefined ? raw.jvm.memoryMax : raw.jvm.heapMax,
              threads:
                raw.jvm.threads !== undefined ? raw.jvm.threads : raw.jvm.threadCount,
            }
          : undefined,
        disk: raw.disk
          ? {
              // Backend does not expose disk.status, derive from usage for UI badge.
              status:
                raw.disk.status ||
                (raw.disk.usagePercent !== undefined && raw.disk.usagePercent > 90
                  ? "DEGRADED"
                  : "UP"),
              total: raw.disk.total !== undefined ? raw.disk.total : raw.disk.totalSpace,
              free: raw.disk.free !== undefined ? raw.disk.free : raw.disk.freeSpace,
              usable:
                raw.disk.usable !== undefined ? raw.disk.usable : raw.disk.usableSpace,
              threshold: raw.disk.threshold,
            }
          : undefined,
      };

      return normalized;
    }
    throw new Error(response.error || "Failed to fetch system health");
  },

  /**
   * Get database health
   */
  getDatabaseHealth: async (): Promise<DatabaseHealth> => {
    const response = await apiClient.get<DatabaseHealth>(API_ENDPOINTS.METRICS_HEALTH_DATABASE);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch database health");
  },

  /**
   * Get Redis health
   */
  getRedisHealth: async (): Promise<RedisHealth> => {
    const response = await apiClient.get<RedisHealth>(API_ENDPOINTS.METRICS_HEALTH_REDIS);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch Redis health");
  },

  /**
   * Get JVM health
   */
  getJvmHealth: async (): Promise<JvmHealth> => {
    const response = await apiClient.get<JvmHealth>(API_ENDPOINTS.METRICS_HEALTH_JVM);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch JVM health");
  },

  /**
   * Get Disk health
   */
  getDiskHealth: async (): Promise<DiskHealth> => {
    const response = await apiClient.get<DiskHealth>(API_ENDPOINTS.METRICS_HEALTH_DISK);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch disk health");
  },

  /**
   * Get metrics overview
   */
  getMetricsOverview: async (): Promise<SystemMetricsResponse> => {
    const response = await apiClient.get<SystemMetricsResponse>(API_ENDPOINTS.METRICS_OVERVIEW);
    if (response.success && response.data) {
      return normalizeSystemMetrics(response.data as any);
    }
    throw new Error(response.error || "Failed to fetch metrics overview");
  },

  /**
   * Get HTTP metrics
   */
  getHttpMetrics: async (): Promise<HttpMetrics> => {
    const response = await apiClient.get<HttpMetrics>(API_ENDPOINTS.METRICS_HTTP);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch HTTP metrics");
  },

  /**
   * Get JVM metrics
   */
  getJvmMetrics: async (): Promise<JvmMetrics> => {
    const response = await apiClient.get<JvmMetrics>(API_ENDPOINTS.METRICS_JVM);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch JVM metrics");
  },

  /**
   * Get Database metrics
   */
  getDatabaseMetrics: async (): Promise<DatabaseMetrics> => {
    const response = await apiClient.get<DatabaseMetrics>(API_ENDPOINTS.METRICS_DATABASE);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || "Failed to fetch database metrics");
  },
};
