import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Eye, FileText, Filter, Search, Shield } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useSheetBottomInset } from '@/lib/useSheetBottomInset';
import { logService } from '@/services/logService';

type LogTab = 'system' | 'audit' | 'security';

const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN');
  } catch {
    return dateString;
  }
};

export default function AdminLogsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<LogTab>('system');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const sheetBottomInset = useSheetBottomInset();

  // System Logs
  const {
    data: systemLogsResponse,
    isLoading: systemLoading,
    refetch: refetchSystem,
  } = useQuery({
    queryKey: ['admin-logs-system', searchQuery, levelFilter],
    queryFn: () =>
      logService.querySystemLogs({
        keyword: searchQuery || undefined,
        level: levelFilter !== 'all' ? levelFilter : undefined,
        limit: 100,
      }),
    enabled: user?.role === 'ROLE_ADMIN' && activeTab === 'system',
  });

  // Audit Logs
  const {
    data: auditLogsResponse,
    isLoading: auditLoading,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['admin-logs-audit', searchQuery],
    queryFn: () => {
      // Use Unix milliseconds timestamp (same format as web frontend uses for Loki)
      // Query last 7 days like web frontend
      const endTime = Date.now(); // Unix milliseconds
      const startTime = endTime - 7 * 24 * 60 * 60 * 1000; // 7 days ago

      return logService.queryAuditLogs({
        keyword: searchQuery || undefined,
        startTime: startTime.toString(), // Unix milliseconds as string
        endTime: endTime.toString(), // Unix milliseconds as string
        page: 0,
        size: 50,
      });
    },
    enabled: user?.role === 'ROLE_ADMIN' && activeTab === 'audit',
  });

  // Security Logs
  const {
    data: securityLogsResponse,
    isLoading: securityLoading,
    refetch: refetchSecurity,
  } = useQuery({
    queryKey: ['admin-logs-security', searchQuery],
    queryFn: () => {
      // Use Unix milliseconds timestamp (same format as web frontend uses for Loki)
      // Query last 7 days like web frontend
      const endTime = Date.now(); // Unix milliseconds
      const startTime = endTime - 7 * 24 * 60 * 60 * 1000; // 7 days ago

      return logService.querySecurityLogs({
        keyword: searchQuery || undefined,
        startTime: startTime.toString(), // Unix milliseconds as string
        endTime: endTime.toString(), // Unix milliseconds as string
        page: 0,
        size: 50,
      });
    },
    enabled: user?.role === 'ROLE_ADMIN' && activeTab === 'security',
  });

  if (user?.role !== 'ROLE_ADMIN') {
    return null;
  }

  const isLoading = systemLoading || auditLoading || securityLoading;

  const handleRefetch = () => {
    if (activeTab === 'system') refetchSystem();
    else if (activeTab === 'audit') refetchAudit();
    else if (activeTab === 'security') refetchSecurity();
  };

  // Get logs based on active tab
  const logs = useMemo(() => {
    if (activeTab === 'system') {
      if (!systemLogsResponse?.success || !systemLogsResponse.data) return [];
      const response = systemLogsResponse.data;
      const allEntries: any[] = [];
      response.streams?.forEach((stream: any) => {
        stream.entries?.forEach((entry: any) => {
          allEntries.push(entry);
        });
      });
      return allEntries.slice(0, 100); // Limit to 100 entries
    } else if (activeTab === 'audit') {
      // Handle different response formats for audit logs
      if (!auditLogsResponse) return [];

      // Support both ApiResponse<AuditLogResponse> and direct AuditLogResponse
      let responseData: any = null;
      const raw = auditLogsResponse as any;

      if (raw.logs && Array.isArray(raw.logs)) {
        // Backend returned logs object directly
        responseData = raw;
      } else if (raw.data) {
        // ApiResponse wrapper
        if (raw.success === false) return [];
        responseData = raw.data;
      } else {
        console.warn('⚠️ Audit logs: No data field in response', raw);
        return [];
      }

      if (!responseData) {
        console.warn('⚠️ Audit logs: No data in response');
        return [];
      }

      // Log data structure for debugging
      if (__DEV__) {
        console.log('📋 Audit logs data structure:', {
          hasLogs: responseData.logs !== undefined,
          isArray: Array.isArray(responseData),
          hasContent: responseData.content !== undefined,
          keys: Object.keys(responseData),
          logsType: typeof responseData.logs,
          logsIsArray: Array.isArray(responseData.logs),
          logsLength: responseData.logs?.length,
          logsValue: responseData.logs
            ? Array.isArray(responseData.logs)
              ? `Array(${responseData.logs.length})`
              : typeof responseData.logs
            : 'undefined',
        });
      }

      // Handle different data formats
      if (responseData.logs !== undefined) {
        if (Array.isArray(responseData.logs)) {
          const logs = responseData.logs;
          if (__DEV__) {
            console.log('✅ Audit logs: Returning logs array, length:', logs.length);
            if (logs.length > 0) {
              console.log('📝 First log sample:', {
                action: logs[0].action,
                resource: logs[0].resource,
                timestamp: logs[0].timestamp,
              });
            }
          }
          return logs;
        } else {
          console.warn('⚠️ Audit logs: logs is not an array', {
            type: typeof responseData.logs,
            value: responseData.logs,
          });
        }
      }

      if (Array.isArray(responseData)) {
        if (__DEV__) {
          console.log('✅ Audit logs: Returning direct array, length:', responseData.length);
        }
        return responseData;
      }

      if (responseData.content && Array.isArray(responseData.content)) {
        // Paginated response
        if (__DEV__) {
          console.log(
            '✅ Audit logs: Returning content array, length:',
            responseData.content.length
          );
        }
        return responseData.content;
      }

      console.warn('⚠️ Audit logs: Unknown data format', {
        responseData,
        hasLogs: responseData.logs !== undefined,
        logsType: typeof responseData.logs,
        logsIsArray: Array.isArray(responseData.logs),
        allKeys: Object.keys(responseData),
      });
      return [];
    } else if (activeTab === 'security') {
      // Handle different response formats for security logs
      if (!securityLogsResponse) return [];

      // Support both ApiResponse<SecurityLogResponse> and direct SecurityLogResponse
      let responseData: any = null;
      const raw = securityLogsResponse as any;

      if (raw.logs && Array.isArray(raw.logs)) {
        responseData = raw;
      } else if (raw.data) {
        if (raw.success === false) return [];
        responseData = raw.data;
      } else {
        console.warn('⚠️ Security logs: No data field in response', raw);
        return [];
      }

      if (!responseData) {
        console.warn('⚠️ Security logs: No data in response');
        return [];
      }

      // Log data structure for debugging
      if (__DEV__) {
        console.log('📋 Security logs data structure:', {
          hasLogs: responseData.logs !== undefined,
          isArray: Array.isArray(responseData),
          hasContent: responseData.content !== undefined,
          keys: Object.keys(responseData),
        });
      }

      // Handle different data formats
      if (responseData.logs && Array.isArray(responseData.logs)) {
        return responseData.logs;
      } else if (Array.isArray(responseData)) {
        return responseData;
      } else if (responseData.content && Array.isArray(responseData.content)) {
        // Paginated response
        return responseData.content;
      }

      console.warn('⚠️ Security logs: Unknown data format', responseData);
      return [];
    }
    return [];
  }, [activeTab, systemLogsResponse, auditLogsResponse, securityLogsResponse]);

  const filteredLogs = useMemo(() => {
    if (__DEV__) {
      console.log('🔍 Filtering logs:', {
        activeTab,
        logsLength: logs.length,
        searchQuery: searchQuery.trim(),
      });
    }

    if (!searchQuery.trim()) {
      if (__DEV__) {
        console.log('✅ Returning all logs, count:', logs.length);
      }
      return logs;
    }

    const q = searchQuery.toLowerCase();
    const filtered = logs.filter((log: any) => {
      if (activeTab === 'system') {
        return (
          log.message?.toLowerCase().includes(q) ||
          log.logger?.toLowerCase().includes(q) ||
          log.traceId?.toLowerCase().includes(q)
        );
      } else if (activeTab === 'audit') {
        return (
          log.action?.toLowerCase().includes(q) ||
          log.resource?.toLowerCase().includes(q) ||
          log.username?.toLowerCase().includes(q) ||
          log.details?.toLowerCase().includes(q)
        );
      } else if (activeTab === 'security') {
        return (
          log.action?.toLowerCase().includes(q) ||
          log.endpoint?.toLowerCase().includes(q) ||
          log.username?.toLowerCase().includes(q) ||
          log.ipAddress?.toLowerCase().includes(q) ||
          log.details?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (__DEV__) {
      console.log('✅ Filtered logs count:', filtered.length);
    }

    return filtered;
  }, [logs, searchQuery, activeTab]);

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen
        options={{
          title: 'Quản lý log hệ thống',
          headerStyle: { backgroundColor: '#0891b2' },
          headerTintColor: '#fff',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="ml-2">
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Tabs */}
      <View className="bg-white px-4 py-3 border-b border-sky-100">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setActiveTab('system')}
              className={`px-4 py-2 rounded-xl border ${
                activeTab === 'system' ? 'bg-sky-600 border-sky-600' : 'bg-white border-sky-200'
              }`}
              activeOpacity={0.85}
            >
              <View className="flex-row items-center gap-2">
                <FileText size={16} color={activeTab === 'system' ? '#fff' : '#64748b'} />
                <Text
                  className={`text-xs font-bold ${
                    activeTab === 'system' ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  System Logs
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-xl border ${
                activeTab === 'audit' ? 'bg-sky-600 border-sky-600' : 'bg-white border-sky-200'
              }`}
              activeOpacity={0.85}
            >
              <View className="flex-row items-center gap-2">
                <Eye size={16} color={activeTab === 'audit' ? '#fff' : '#64748b'} />
                <Text
                  className={`text-xs font-bold ${
                    activeTab === 'audit' ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  Audit Logs
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('security')}
              className={`px-4 py-2 rounded-xl border ${
                activeTab === 'security' ? 'bg-sky-600 border-sky-600' : 'bg-white border-sky-200'
              }`}
              activeOpacity={0.85}
            >
              <View className="flex-row items-center gap-2">
                <Shield size={16} color={activeTab === 'security' ? '#fff' : '#64748b'} />
                <Text
                  className={`text-xs font-bold ${
                    activeTab === 'security' ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  Security Logs
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Search and Filter Bar */}
      <View className="bg-white px-4 py-3 border-b border-sky-100">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center bg-sky-50 rounded-xl px-3 py-2 border border-sky-200">
            <Search size={18} color="#64748b" />
            <TextInput
              className="flex-1 ml-2 text-sm text-slate-900"
              placeholder="Tìm kiếm logs..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          {activeTab === 'system' && (
            <TouchableOpacity
              onPress={() => setShowFilters(!showFilters)}
              className="px-4 py-2 rounded-xl border border-sky-200 bg-white"
              activeOpacity={0.85}
            >
              <Filter size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Panel for System Logs */}
        {showFilters && activeTab === 'system' && (
          <View className="mt-3 pt-3 border-t border-sky-100">
            <Text className="text-xs font-bold text-slate-700 mb-2">Mức độ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {['all', 'error', 'warn', 'info', 'debug'].map(level => (
                  <TouchableOpacity
                    key={level}
                    onPress={() => setLevelFilter(level)}
                    className={`px-3 py-1.5 rounded-full border ${
                      levelFilter === level
                        ? 'bg-sky-600 border-sky-600'
                        : 'bg-white border-sky-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        levelFilter === level ? 'text-white' : 'text-slate-600'
                      }`}
                    >
                      {level === 'all' ? 'Tất cả' : level.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Logs List */}
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefetch} />}
      >
        <View className="p-4 gap-3">
          {isLoading ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
              <ActivityIndicator size="large" color="#0284C7" />
              <Text className="text-sm font-bold text-slate-500 mt-3">Đang tải logs...</Text>
            </View>
          ) : filteredLogs.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
              <FileText size={48} color="#cbd5e1" />
              <Text className="text-sm font-bold text-slate-500 mt-3 text-center">
                Không tìm thấy logs nào
              </Text>
            </View>
          ) : (
            filteredLogs.map((log: any, index: number) => {
              const getLevelColor = (level?: string) => {
                const l = (level || '').toLowerCase();
                if (l === 'error') return 'bg-red-50 border-red-200';
                if (l === 'warn') return 'bg-yellow-50 border-yellow-200';
                if (l === 'info') return 'bg-blue-50 border-blue-200';
                return 'bg-slate-50 border-slate-200';
              };

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    setSelectedLog(log);
                    setShowDetailModal(true);
                  }}
                  className="bg-white rounded-2xl p-4 border border-sky-100"
                  activeOpacity={0.85}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      {activeTab === 'system' && (
                        <View
                          className={`px-2 py-1 rounded-lg border ${getLevelColor(log.level)} self-start mb-2`}
                        >
                          <Text className="text-[10px] font-bold text-slate-700">
                            {log.level?.toUpperCase() || 'LOG'}
                          </Text>
                        </View>
                      )}
                      <Text
                        className="text-sm font-extrabold text-slate-900 mb-1"
                        numberOfLines={2}
                      >
                        {activeTab === 'system'
                          ? log.message || 'No message'
                          : activeTab === 'audit'
                            ? `${log.action} - ${log.resource}`
                            : `${log.action} - ${log.endpoint || 'N/A'}`}
                      </Text>
                      <Text className="text-xs text-slate-500">
                        {formatDateTime(log.timestamp)}
                      </Text>
                    </View>
                    {activeTab === 'security' && log.threatScore && (
                      <View
                        className={`px-2 py-1 rounded-lg border ${
                          log.threatScore >= 7
                            ? 'bg-red-50 border-red-200'
                            : log.threatScore >= 4
                              ? 'bg-yellow-50 border-yellow-200'
                              : 'bg-green-50 border-green-200'
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-bold ${
                            log.threatScore >= 7
                              ? 'text-red-700'
                              : log.threatScore >= 4
                                ? 'text-yellow-700'
                                : 'text-green-700'
                          }`}
                        >
                          Threat: {log.threatScore}
                        </Text>
                      </View>
                    )}
                  </View>

                  {activeTab !== 'system' && (
                    <View className="mt-2 pt-2 border-t border-sky-50">
                      {activeTab === 'audit' && (
                        <>
                          <View className="flex-row items-center gap-2 mb-1">
                            <Text className="text-xs text-slate-500">User:</Text>
                            <Text className="text-xs font-bold text-slate-700">
                              {log.username || 'N/A'}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2">
                            <Text className="text-xs text-slate-500">Status:</Text>
                            <View
                              className={`px-2 py-0.5 rounded ${
                                log.status === 'SUCCESS' ? 'bg-emerald-50' : 'bg-red-50'
                              }`}
                            >
                              <Text
                                className={`text-[10px] font-bold ${
                                  log.status === 'SUCCESS' ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {log.status}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                      {activeTab === 'security' && (
                        <>
                          <View className="flex-row items-center gap-2 mb-1">
                            <Text className="text-xs text-slate-500">IP:</Text>
                            <Text className="text-xs font-bold text-slate-700">
                              {log.ipAddress || 'N/A'}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2">
                            <Text className="text-xs text-slate-500">Status:</Text>
                            <View
                              className={`px-2 py-0.5 rounded ${
                                log.status === 'SUCCESS' ? 'bg-emerald-50' : 'bg-red-50'
                              }`}
                            >
                              <Text
                                className={`text-[10px] font-bold ${
                                  log.status === 'SUCCESS' ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {log.status}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[80%]" style={{ paddingBottom: sheetBottomInset }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-extrabold text-slate-900">Chi tiết log</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Text className="text-sky-600 text-sm font-bold">Đóng</Text>
              </TouchableOpacity>
            </View>

            {selectedLog && (
              <ScrollView>
                <View className="gap-3">
                  {Object.entries(selectedLog).map(([key, value]) => (
                    <View key={key}>
                      <Text className="text-xs font-bold text-slate-500 mb-1">
                        {key.toUpperCase()}
                      </Text>
                      <Text className="text-sm text-slate-900">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
