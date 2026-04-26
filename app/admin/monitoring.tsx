import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  RefreshCw,
  Server,
  Database,
  Cpu,
  HardDrive,
  Globe,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Users,
  FileText,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isStaffLikeOperationalRole } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import {
  monitoringService,
  SystemHealthResponse,
  SystemMetricsResponse,
} from "@/services/monitoringService";

// Format bytes to human readable
const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Format duration
const formatDuration = (ms?: number): string => {
  if (!ms) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

// Format uptime
const formatUptime = (ms?: number): string => {
  if (!ms) return "0m";
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(" ") || "0m";
};

// Get status badge
const getStatusBadge = (status?: string) => {
  const s = (status || "UNKNOWN").toUpperCase();
  if (s === "UP") {
    return {
      label: "Hoạt động",
      bg: "bg-green-50",
      fg: "text-green-700",
      bd: "border-green-200",
      icon: CheckCircle,
    };
  }
  if (s === "DOWN") {
    return {
      label: "Lỗi",
      bg: "bg-red-50",
      fg: "text-red-700",
      bd: "border-red-200",
      icon: XCircle,
    };
  }
  if (s === "DEGRADED") {
    return {
      label: "Suy giảm",
      bg: "bg-amber-50",
      fg: "text-amber-700",
      bd: "border-amber-200",
      icon: AlertTriangle,
    };
  }
  return {
    label: "Không xác định",
    bg: "bg-slate-50",
    fg: "text-slate-700",
    bd: "border-slate-200",
    icon: AlertTriangle,
  };
};

export default function AdminMonitoringScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Guard: Chỉ ADMIN mới được vào màn hình này
  useEffect(() => {
    if (!authLoading && user && user.role !== "ROLE_ADMIN") {
      if (isStaffLikeOperationalRole(user.role)) {
        router.replace("/home");
      } else {
        router.replace("/");
      }
    }
  }, [user, authLoading, router]);

  // Fetch system health
  const {
    data: healthData,
    isLoading: healthLoading,
    refetch: refetchHealth,
    isFetching: healthFetching,
  } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => monitoringService.getSystemHealth(),
    enabled: user?.role === "ROLE_ADMIN",
    refetchInterval: autoRefresh ? 30000 : false,
    onSuccess: () => {
      setLastUpdated(new Date());
    },
  });

  // Fetch metrics overview
  const {
    data: metricsData,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
    isFetching: metricsFetching,
  } = useQuery({
    queryKey: ["system-metrics"],
    queryFn: () => monitoringService.getMetricsOverview(),
    enabled: user?.role === "ROLE_ADMIN",
    refetchInterval: autoRefresh ? 30000 : false,
    onSuccess: () => {
      setLastUpdated(new Date());
    },
  });

  const isLoading = healthLoading || metricsLoading;
  const isFetching = healthFetching || metricsFetching;

  const handleRefresh = () => {
    refetchHealth();
    refetchMetrics();
  };

  if (authLoading || isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải...</Text>
      </View>
    );
  }

  if (!user || user.role !== "ROLE_ADMIN") {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-slate-900 text-lg font-extrabold">Giám sát hệ thống</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                {lastUpdated
                  ? `Cập nhật: ${lastUpdated.toLocaleTimeString("vi-VN")}`
                  : "Đang tải dữ liệu..."}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg border ${
              autoRefresh
                ? "bg-green-50 border-green-200"
                : "bg-slate-50 border-slate-200"
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`text-xs font-bold ${
                autoRefresh ? "text-green-700" : "text-slate-600"
              }`}
            >
              {autoRefresh ? "Tự động" : "Thủ công"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={handleRefresh}
            tintColor="#0284C7"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Health Check Section */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-slate-900 text-base font-extrabold">Kiểm tra sức khỏe hệ thống</Text>
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={isFetching}
              className="p-2"
              activeOpacity={0.7}
            >
              <RefreshCw
                size={18}
                color="#0284C7"
                style={{ transform: [{ rotate: isFetching ? "180deg" : "0deg" }] }}
              />
            </TouchableOpacity>
          </View>

          <View className="gap-3">
            {/* Database Health */}
            {healthData?.database && (
              <HealthCard
                title="Database"
                icon={Database}
                status={healthData.database.status}
                data={healthData.database}
                fields={[
                  {
                    label: "Thời gian phản hồi",
                    value: healthData.database.responseTime !== undefined
                      ? `${formatDuration(healthData.database.responseTime)}`
                      : "N/A",
                  },
                  {
                    label: "Kết nối",
                    value: healthData.database.activeConnections !== undefined
                      ? `${healthData.database.activeConnections}/${healthData.database.maxConnections || "N/A"}`
                      : "N/A",
                  },
                  {
                    label: "Database",
                    value: healthData.database.databaseName || "N/A",
                  },
                ]}
              />
            )}

            {/* Redis Health */}
            {healthData?.redis && (
              <HealthCard
                title="Redis"
                icon={Activity}
                status={healthData.redis.status}
                data={healthData.redis}
                fields={[
                  {
                    label: "Thời gian phản hồi",
                    value: healthData.redis.responseTime !== undefined
                      ? `${formatDuration(healthData.redis.responseTime)}`
                      : "N/A",
                  },
                  {
                    label: "Phiên bản",
                    value: healthData.redis.version || "N/A",
                  },
                ]}
              />
            )}

            {/* JVM Health */}
            {healthData?.jvm && (
              <HealthCard
                title="JVM"
                icon={Cpu}
                status={healthData.jvm.status}
                data={healthData.jvm}
                fields={[
                  {
                    label: "Thời gian hoạt động",
                    value: formatUptime(healthData.jvm.uptime),
                  },
                  {
                    label: "Bộ nhớ",
                    value: healthData.jvm.memoryUsed !== undefined
                      ? `${formatBytes(healthData.jvm.memoryUsed)} / ${formatBytes(healthData.jvm.memoryMax)}`
                      : "N/A",
                  },
                  {
                    label: "Threads",
                    value: healthData.jvm.threads?.toString() || "N/A",
                  },
                ]}
              />
            )}

            {/* Disk Health */}
            {healthData?.disk && (
              <HealthCard
                title="Ổ đĩa"
                icon={HardDrive}
                status={healthData.disk.status}
                data={healthData.disk}
                fields={[
                  {
                    label: "Dung lượng",
                    value: healthData.disk.total !== undefined
                      ? `${formatBytes(healthData.disk.free || 0)} / ${formatBytes(healthData.disk.total)}`
                      : "N/A",
                  },
                  {
                    label: "Sử dụng",
                    value: healthData.disk.total !== undefined && healthData.disk.free !== undefined
                      ? `${((1 - (healthData.disk.free / healthData.disk.total)) * 100).toFixed(1)}%`
                      : "N/A",
                  },
                ]}
              />
            )}
          </View>
        </View>

        {/* Metrics Section */}
        <View className="mb-6">
          <Text className="text-slate-900 text-base font-extrabold mb-3">Metrics hệ thống</Text>

          {/* HTTP Metrics */}
          {metricsData?.http && (
            <View className="bg-white rounded-2xl p-4 border border-sky-100 mb-3">
              <View className="flex-row items-center mb-3">
                <Globe size={20} color="#0284C7" />
                <Text className="ml-2 text-slate-900 text-sm font-extrabold">HTTP</Text>
              </View>
              {metricsData.http.requests && (
                <View className="gap-2">
                  {metricsData.http.requests.total !== undefined && (
                    <MetricRow
                      label="Tổng requests"
                      value={metricsData.http.requests.total.toLocaleString()}
                    />
                  )}
                  {metricsData.http.requests.rate !== undefined && (
                    <MetricRow
                      label="Tốc độ"
                      value={`${metricsData.http.requests.rate.toFixed(2)} req/s`}
                    />
                  )}
                  {metricsData.http.requests.errors !== undefined && (
                    <MetricRow
                      label="Lỗi"
                      value={metricsData.http.requests.errors.toLocaleString()}
                    />
                  )}
                  {metricsData.http.responseTime?.avg !== undefined && (
                    <MetricRow
                      label="Thời gian phản hồi TB"
                      value={formatDuration(metricsData.http.responseTime.avg * 1000)}
                    />
                  )}
                </View>
              )}
            </View>
          )}

          {/* JVM Metrics */}
          {metricsData?.jvm && (
            <View className="bg-white rounded-2xl p-4 border border-sky-100 mb-3">
              <View className="flex-row items-center mb-3">
                <Cpu size={20} color="#9333EA" />
                <Text className="ml-2 text-slate-900 text-sm font-extrabold">JVM</Text>
              </View>
              <View className="gap-2">
                {metricsData.jvm.memory && (
                  <>
                    {metricsData.jvm.memory.heapUsed !== undefined && (
                      <MetricRow
                        label="Heap Memory"
                        value={`${formatBytes(metricsData.jvm.memory.heapUsed)} / ${formatBytes(metricsData.jvm.memory.heapMax)}`}
                      />
                    )}
                    {metricsData.jvm.memory.heapMax && metricsData.jvm.memory.heapUsed && (
                      <View className="mt-1">
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-xs text-slate-500">Sử dụng</Text>
                          <Text className="text-xs text-slate-700 font-bold">
                            {((metricsData.jvm.memory.heapUsed / metricsData.jvm.memory.heapMax) * 100).toFixed(1)}%
                          </Text>
                        </View>
                        <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <View
                            className="h-full bg-purple-500"
                            style={{
                              width: `${(metricsData.jvm.memory.heapUsed / metricsData.jvm.memory.heapMax) * 100}%`,
                            }}
                          />
                        </View>
                      </View>
                    )}
                  </>
                )}
                {metricsData.jvm.threads && (
                  <>
                    {metricsData.jvm.threads.live !== undefined && (
                      <MetricRow
                        label="Threads đang chạy"
                        value={metricsData.jvm.threads.live.toString()}
                      />
                    )}
                    {metricsData.jvm.threads.peak !== undefined && (
                      <MetricRow
                        label="Threads cao nhất"
                        value={metricsData.jvm.threads.peak.toString()}
                      />
                    )}
                  </>
                )}
                {metricsData.jvm.gc && (
                  <>
                    {metricsData.jvm.gc.pauseCount !== undefined && (
                      <MetricRow
                        label="GC Pause Count"
                        value={metricsData.jvm.gc.pauseCount.toString()}
                      />
                    )}
                    {metricsData.jvm.gc.pauseTime !== undefined && (
                      <MetricRow
                        label="GC Pause Time"
                        value={formatDuration(metricsData.jvm.gc.pauseTime * 1000)}
                      />
                    )}
                  </>
                )}
              </View>
            </View>
          )}

          {/* Database Metrics */}
          {metricsData?.database && (
            <View className="bg-white rounded-2xl p-4 border border-sky-100 mb-3">
              <View className="flex-row items-center mb-3">
                <Database size={20} color="#16A34A" />
                <Text className="ml-2 text-slate-900 text-sm font-extrabold">Database</Text>
              </View>
              {metricsData.database.connections && (
                <View className="gap-2">
                  {metricsData.database.connections.active !== undefined && (
                    <MetricRow
                      label="Kết nối đang hoạt động"
                      value={metricsData.database.connections.active.toString()}
                    />
                  )}
                  {metricsData.database.connections.idle !== undefined && (
                    <MetricRow
                      label="Kết nối rảnh"
                      value={metricsData.database.connections.idle.toString()}
                    />
                  )}
                  {metricsData.database.connections.max !== undefined && (
                    <MetricRow
                      label="Kết nối tối đa"
                      value={metricsData.database.connections.max.toString()}
                    />
                  )}
                </View>
              )}
            </View>
          )}

          {/* Application Metrics */}
          {metricsData?.application && (
            <View className="bg-white rounded-2xl p-4 border border-sky-100">
              <View className="flex-row items-center mb-3">
                <Server size={20} color="#F97316" />
                <Text className="ml-2 text-slate-900 text-sm font-extrabold">Ứng dụng</Text>
              </View>
              <View className="flex-row flex-wrap gap-3">
                {metricsData.application.totalUsers !== undefined && (
                  <View className="flex-1 min-w-[48%] bg-sky-50 rounded-xl p-3 border border-sky-200">
                    <View className="flex-row items-center mb-1">
                      <Users size={14} color="#0284C7" />
                      <Text className="ml-1 text-xs text-slate-500 font-bold">Tổng Users</Text>
                    </View>
                    <Text className="text-lg font-extrabold text-slate-900">
                      {metricsData.application.totalUsers.toLocaleString()}
                    </Text>
                  </View>
                )}
                {metricsData.application.activeUsers !== undefined && (
                  <View className="flex-1 min-w-[48%] bg-green-50 rounded-xl p-3 border border-green-200">
                    <View className="flex-row items-center mb-1">
                      <Activity size={14} color="#16A34A" />
                      <Text className="ml-1 text-xs text-slate-500 font-bold">Users Active</Text>
                    </View>
                    <Text className="text-lg font-extrabold text-slate-900">
                      {metricsData.application.activeUsers.toLocaleString()}
                    </Text>
                  </View>
                )}
                {metricsData.application.totalOrders !== undefined && (
                  <View className="flex-1 min-w-[48%] bg-purple-50 rounded-xl p-3 border border-purple-200">
                    <View className="flex-row items-center mb-1">
                      <FileText size={14} color="#9333EA" />
                      <Text className="ml-1 text-xs text-slate-500 font-bold">Tổng Orders</Text>
                    </View>
                    <Text className="text-lg font-extrabold text-slate-900">
                      {metricsData.application.totalOrders.toLocaleString()}
                    </Text>
                  </View>
                )}
                {metricsData.application.pendingOrders !== undefined && (
                  <View className="flex-1 min-w-[48%] bg-orange-50 rounded-xl p-3 border border-orange-200">
                    <View className="flex-row items-center mb-1">
                      <Clock size={14} color="#F97316" />
                      <Text className="ml-1 text-xs text-slate-500 font-bold">Orders Pending</Text>
                    </View>
                    <Text className="text-lg font-extrabold text-slate-900">
                      {metricsData.application.pendingOrders.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Health Card Component
function HealthCard({
  title,
  icon: Icon,
  status,
  data,
  fields,
}: {
  title: string;
  icon: React.ElementType;
  status: string;
  data: any;
  fields: Array<{ label: string; value: string }>;
}) {
  const statusBadge = getStatusBadge(status);

  return (
    <View className="bg-white rounded-2xl p-4 border border-sky-100">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Icon size={20} color="#0284C7" />
          <Text className="ml-2 text-slate-900 text-sm font-extrabold">{title}</Text>
        </View>
        <View className={`px-2 py-1 rounded-full border ${statusBadge.bg} ${statusBadge.bd}`}>
          <View className="flex-row items-center">
            {status === "UP" && <CheckCircle size={12} color="#16A34A" />}
            {status === "DOWN" && <XCircle size={12} color="#EF4444" />}
            {(status === "DEGRADED" || status === "UNKNOWN") && (
              <AlertTriangle size={12} color="#F59E0B" />
            )}
            <Text className={`text-[10px] font-bold ml-1 ${statusBadge.fg}`}>
              {statusBadge.label}
            </Text>
          </View>
        </View>
      </View>
      <View className="gap-2">
        {fields.map((field, index) => (
          <View key={index} className="flex-row justify-between">
            <Text className="text-xs text-slate-500">{field.label}</Text>
            <Text className="text-xs text-slate-900 font-bold">{field.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Metric Row Component
function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-xs text-slate-500">{label}</Text>
      <Text className="text-xs text-slate-900 font-bold">{value}</Text>
    </View>
  );
}
