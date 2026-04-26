import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  Search,
  Plus,
  Edit,
  Eye,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
} from "lucide-react-native";
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isStaffLikeOperationalRole } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import {
  systemConfigService,
  SystemConfigResponse,
  CreateSystemConfigRequest,
  UpdateSystemConfigRequest,
  getConfigLabel,
  SYSTEM_CONFIG_NAMES,
} from "@/services/systemConfigService";

const SYSTEM_CONFIG_OPTIONS = Object.values(SYSTEM_CONFIG_NAMES);

export default function AdminConfigScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTestResultModal, setShowTestResultModal] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SystemConfigResponse | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    configName: string;
    success: boolean;
    message: string;
    details?: Record<string, any>;
  } | null>(null);

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

  // Fetch configs
  const {
    data: configs = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["system-configs"],
    queryFn: () => systemConfigService.getAll(),
    enabled: user?.role === "ROLE_ADMIN",
    retry: false,
    onError: (error: any) => {
      // Handle 401 - logout and redirect to login
      const errorMessage = error?.message || error?.error || String(error || "");
      if (errorMessage.includes("hết hạn") || errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
        console.warn("401 detected in config screen, logging out...");
        logout();
      }
    },
  });

  // Filtered configs
  const filteredConfigs = useMemo(() => {
    if (!searchQuery.trim()) return configs;
    const query = searchQuery.toLowerCase();
    return configs.filter(
      (config) =>
        config.name.toLowerCase().includes(query) ||
        getConfigLabel(config.name).toLowerCase().includes(query) ||
        config.description?.toLowerCase().includes(query)
    );
  }, [configs, searchQuery]);
  const existingConfigNames = useMemo(
    () => new Set(configs.map((config) => config.name.trim().toLowerCase())),
    [configs]
  );

  // Delete/Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => systemConfigService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-configs"] });
      Alert.alert("Thành công", "Đã vô hiệu hóa cấu hình");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error.message || "Không thể vô hiệu hóa cấu hình");
    },
  });

  // Test connection
  const handleTestConnection = async (configName: string) => {
    setTestingConnection(configName);
    try {
      const result = await systemConfigService.testConnection(configName);
      setTestResult({
        configName,
        success: result.success,
        message: result.message || (result.success ? "Kết nối thành công" : "Kết nối thất bại"),
        details: result.details,
      });
      setShowTestResultModal(true);
    } catch (error: any) {
      setTestResult({
        configName,
        success: false,
        message: error.message || "Không thể kiểm tra kết nối",
      });
      setShowTestResultModal(true);
    } finally {
      setTestingConnection(null);
    }
  };

  // Handle delete
  const handleDeactivate = (config: SystemConfigResponse) => {
    Alert.alert(
      "Xác nhận",
      `Bạn có chắc chắn muốn vô hiệu hóa cấu hình "${getConfigLabel(config.name)}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận",
          style: "destructive",
          onPress: () => deactivateMutation.mutate(config.id),
        },
      ]
    );
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
        <View className="flex-row items-center mb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#0284C7" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">Cấu hình cơ bản</Text>
            <Text className="mt-0.5 text-xs text-slate-500">Quản lý cấu hình hệ thống</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setSelectedConfig(null);
              setShowCreateModal(true);
            }}
            className="w-10 h-10 rounded-xl bg-sky-600 items-center justify-center"
            activeOpacity={0.8}
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-sky-50 rounded-xl px-3 py-2 border border-sky-200">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 ml-2 text-sm text-slate-900"
            placeholder="Tìm kiếm cấu hình..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} className="ml-2">
              <XCircle size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor="#0284C7"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-red-700 text-sm font-bold">
              Lỗi: {error instanceof Error ? error.message : "Không thể tải dữ liệu"}
            </Text>
          </View>
        )}

        {filteredConfigs.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
            <Settings size={48} color="#94A3B8" />
            <Text className="mt-4 text-slate-500 text-sm font-bold text-center">
              {searchQuery ? "Không tìm thấy cấu hình nào" : "Chưa có cấu hình nào"}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {filteredConfigs.map((config) => (
              <View
                key={config.id}
                className="bg-white rounded-2xl p-4 border border-sky-100"
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <Text className="text-slate-900 text-base font-extrabold">
                        {getConfigLabel(config.name)}
                      </Text>
                      {config.isActive ? (
                        <View className="ml-2 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                          <Text className="text-emerald-700 text-[10px] font-bold">Hoạt động</Text>
                        </View>
                      ) : (
                        <View className="ml-2 px-2 py-0.5 rounded-full bg-red-50 border border-red-200">
                          <Text className="text-red-700 text-[10px] font-bold">Vô hiệu</Text>
                        </View>
                      )}
                    </View>
                    {config.description && (
                      <Text className="text-slate-500 text-xs mt-1" numberOfLines={2}>
                        {config.description}
                      </Text>
                    )}
                    <Text className="text-slate-400 text-[10px] mt-1 font-bold">
                      {config.name}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedConfig(config);
                      setShowDetailModal(true);
                    }}
                    className="flex-1 py-2 rounded-xl bg-sky-50 border border-sky-200 items-center"
                    activeOpacity={0.7}
                  >
                    <Eye size={16} color="#0284C7" />
                    <Text className="text-sky-700 text-xs font-bold mt-1">Xem</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedConfig(config);
                      setShowEditModal(true);
                    }}
                    className="flex-1 py-2 rounded-xl bg-orange-50 border border-orange-200 items-center"
                    activeOpacity={0.7}
                  >
                    <Edit size={16} color="#F97316" />
                    <Text className="text-orange-700 text-xs font-bold mt-1">Sửa</Text>
                  </TouchableOpacity>

                  {(config.name === SYSTEM_CONFIG_NAMES.EMAIL_SMTP_CONFIG ||
                    config.name === SYSTEM_CONFIG_NAMES.CLOUDINARY_CONFIG ||
                    config.name === SYSTEM_CONFIG_NAMES.FIREBASE_CONFIG) && (
                    <TouchableOpacity
                      onPress={() => handleTestConnection(config.name)}
                      className="flex-1 py-2 rounded-xl bg-purple-50 border border-purple-200 items-center"
                      activeOpacity={0.7}
                      disabled={testingConnection === config.name}
                    >
                      {testingConnection === config.name ? (
                        <ActivityIndicator size="small" color="#9333EA" />
                      ) : (
                        <Zap size={16} color="#9333EA" />
                      )}
                      <Text className="text-purple-700 text-xs font-bold mt-1">Test</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => handleDeactivate(config)}
                    className="flex-1 py-2 rounded-xl bg-red-50 border border-red-200 items-center"
                    activeOpacity={0.7}
                    disabled={deactivateMutation.isPending}
                  >
                    <Trash2 size={16} color="#EF4444" />
                    <Text className="text-red-700 text-xs font-bold mt-1">Xóa</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <ConfigDetailModal
        visible={showDetailModal}
        config={selectedConfig}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedConfig(null);
        }}
      />

      {/* Edit Modal */}
      <ConfigEditModal
        visible={showEditModal}
        config={selectedConfig}
        onClose={() => {
          setShowEditModal(false);
          setSelectedConfig(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["system-configs"] });
          setShowEditModal(false);
          setSelectedConfig(null);
        }}
      />

      {/* Create Modal */}
      <ConfigCreateModal
        visible={showCreateModal}
        existingConfigNames={existingConfigNames}
        onClose={() => {
          setShowCreateModal(false);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["system-configs"] });
          setShowCreateModal(false);
        }}
      />

      {/* Test Result Modal */}
      <TestResultModal
        visible={showTestResultModal}
        result={testResult}
        onClose={() => {
          setShowTestResultModal(false);
          setTestResult(null);
        }}
      />
    </SafeAreaView>
  );
}

// Detail Modal Component
function ConfigDetailModal({
  visible,
  config,
  onClose,
}: {
  visible: boolean;
  config: SystemConfigResponse | null;
  onClose: () => void;
}) {
  if (!visible) return null;

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="slide" 
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <TouchableOpacity
          className="absolute inset-0"
          activeOpacity={1}
          onPress={onClose}
        />
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: "85%" }}>
          <View className="px-6 py-4 border-b border-sky-100">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <TouchableOpacity 
                  onPress={onClose}
                  className="mr-3 p-1"
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={24} color="#64748B" />
                </TouchableOpacity>
                <Text className="text-slate-900 text-lg font-extrabold flex-1">Chi tiết cấu hình</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <XCircle size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={true}
          >
            {config ? (
              <>
                <View className="mb-4">
                  <Text className="text-slate-500 text-xs font-bold mb-1">Tên cấu hình</Text>
                  <Text className="text-slate-900 text-base font-extrabold">
                    {getConfigLabel(config.name)}
                  </Text>
                </View>

                <View className="mb-4">
                  <Text className="text-slate-500 text-xs font-bold mb-1">Mã cấu hình</Text>
                  <Text className="text-slate-700 text-sm font-bold">{config.name}</Text>
                </View>

                {config.description && (
                  <View className="mb-4">
                    <Text className="text-slate-500 text-xs font-bold mb-1">Mô tả</Text>
                    <Text className="text-slate-700 text-sm">{config.description}</Text>
                  </View>
                )}

                <View className="mb-4">
                  <Text className="text-slate-500 text-xs font-bold mb-1">Trạng thái</Text>
                  <View className="mt-1">
                    {config.isActive ? (
                      <View className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 self-start">
                        <Text className="text-emerald-700 text-xs font-bold">Hoạt động</Text>
                      </View>
                    ) : (
                      <View className="px-3 py-1.5 rounded-full bg-red-50 border border-red-200 self-start">
                        <Text className="text-red-700 text-xs font-bold">Vô hiệu</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-slate-500 text-xs font-bold mb-2">Metadata (JSON)</Text>
                  <ScrollView 
                    horizontal
                    className="bg-slate-50 rounded-xl p-3 border border-slate-200"
                    showsHorizontalScrollIndicator={true}
                  >
                    <Text className="text-slate-700 text-xs font-mono" style={{ minWidth: 300 }}>
                      {JSON.stringify(config.metadata, null, 2)}
                    </Text>
                  </ScrollView>
                </View>

                {config.createdAt && (
                  <View className="mb-4">
                    <Text className="text-slate-500 text-xs font-bold mb-1">Ngày tạo</Text>
                    <Text className="text-slate-700 text-sm">
                      {new Date(config.createdAt).toLocaleString("vi-VN")}
                    </Text>
                  </View>
                )}

                {config.updatedAt && (
                  <View className="mb-4">
                    <Text className="text-slate-500 text-xs font-bold mb-1">Ngày cập nhật</Text>
                    <Text className="text-slate-700 text-sm">
                      {new Date(config.updatedAt).toLocaleString("vi-VN")}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View className="py-8 items-center">
                <Text className="text-slate-500 text-sm">Không có dữ liệu</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Edit Modal Component
function ConfigEditModal({
  visible,
  config,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  config: SystemConfigResponse | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [description, setDescription] = useState("");
  const [metadataJson, setMetadataJson] = useState("{}");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (config && visible) {
      setDescription(config.description || "");
      setMetadataJson(JSON.stringify(config.metadata, null, 2));
      setIsActive(config.isActive);
      setJsonError(null);
    }
  }, [config, visible]);

  const validateJson = (json: string): boolean => {
    try {
      JSON.parse(json);
      setJsonError(null);
      return true;
    } catch {
      setJsonError("JSON không hợp lệ");
      return false;
    }
  };

  const handleSave = async () => {
    if (!config || !validateJson(metadataJson)) {
      if (!config) {
        Alert.alert("Lỗi", "Không tìm thấy cấu hình");
      }
      return;
    }

    setSaving(true);
    try {
      const metadata = JSON.parse(metadataJson);
      const request: UpdateSystemConfigRequest = {
        description: description.trim() || undefined,
        metadata,
        isActive,
      };
      await systemConfigService.update(config.id, request);
      Alert.alert("Thành công", "Đã cập nhật cấu hình");
      onSuccess();
    } catch (error: any) {
      console.error("Error updating config:", error);
      Alert.alert("Lỗi", error.message || error.error || "Không thể cập nhật cấu hình");
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <TouchableOpacity
          className="absolute inset-0"
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "position"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 12}
        >
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: "88%", minHeight: "72%" }}>
            <View className="px-6 py-4 border-b border-sky-100">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <TouchableOpacity 
                    onPress={onClose}
                    className="mr-3 p-1"
                    activeOpacity={0.7}
                  >
                    <ArrowLeft size={24} color="#64748B" />
                  </TouchableOpacity>
                  <View className="flex-1">
                    <Text className="text-slate-900 text-lg font-extrabold">Chỉnh sửa cấu hình</Text>
                    {config && (
                      <Text className="text-slate-500 text-xs mt-1">
                        {getConfigLabel(config.name)}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={onClose}>
                  <XCircle size={24} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="always"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              nestedScrollEnabled
              contentContainerStyle={{ padding: 16, paddingBottom: 20, flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
            >
              {config ? (
                <>
                  <View className="mb-4">
                    <Text className="text-slate-500 text-xs font-bold mb-1">Mô tả</Text>
                    <TextInput
                      className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-slate-900 text-sm"
                      placeholder="Mô tả cấu hình..."
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      textAlignVertical="top"
                      style={{ minHeight: 92 }}
                    />
                  </View>

                  <View className="mb-4">
                    <Text className="text-slate-500 text-xs font-bold mb-1">
                      Metadata (JSON) <Text className="text-red-500">*</Text>
                    </Text>
                    <TextInput
                      className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-slate-900 text-xs font-mono"
                      placeholder="{}"
                      value={metadataJson}
                      onChangeText={(text) => {
                        setMetadataJson(text);
                        if (jsonError) setJsonError(null);
                      }}
                      onBlur={() => validateJson(metadataJson)}
                      multiline
                      textAlignVertical="top"
                      style={{ height: 220 }}
                    />
                    {jsonError && (
                      <Text className="text-red-600 text-xs mt-1">{jsonError}</Text>
                    )}
                    {!jsonError && (
                      <Text className="text-slate-400 text-[11px] mt-1">
                        JSON hợp lệ sẽ được kiểm tra khi rời ô nhập hoặc bấm Lưu.
                      </Text>
                    )}
                  </View>

                  <View className="mb-6">
                    <TouchableOpacity
                      onPress={() => setIsActive(!isActive)}
                      className="flex-row items-center"
                    >
                      <View
                        className={`w-5 h-5 rounded border-2 items-center justify-center mr-2 ${
                          isActive
                            ? "bg-sky-600 border-sky-600"
                            : "bg-white border-slate-300"
                        }`}
                      >
                        {isActive && <CheckCircle size={14} color="#FFFFFF" />}
                      </View>
                      <Text className="text-slate-700 text-sm font-bold">Kích hoạt</Text>
                    </TouchableOpacity>
                  </View>

                </>
              ) : (
                <View className="py-8 items-center">
                  <Text className="text-slate-500 text-sm">Không có dữ liệu</Text>
                </View>
              )}
            </ScrollView>
            <View className="px-4 py-3 border-t border-slate-100 bg-white">
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving || !!jsonError || !config}
                className="bg-sky-600 rounded-xl py-3 items-center"
                style={{ opacity: saving || jsonError || !config ? 0.5 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-sm font-extrabold">Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// Test Result Modal Component
function TestResultModal({
  visible,
  result,
  onClose,
}: {
  visible: boolean;
  result: {
    configName: string;
    success: boolean;
    message: string;
    details?: Record<string, any>;
  } | null;
  onClose: () => void;
}) {
  if (!visible || !result) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-white rounded-3xl p-6 w-full max-w-[400px]">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-extrabold text-slate-900">Kết quả kiểm tra</Text>
            <TouchableOpacity onPress={onClose}>
              <XCircle size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View className="mb-4">
            <Text className="text-xs font-bold text-slate-500 mb-1">Cấu hình</Text>
            <Text className="text-sm font-bold text-slate-900">
              {getConfigLabel(result.configName)}
            </Text>
          </View>

          <View className="mb-4">
            <View className="flex-row items-center mb-2">
              {result.success ? (
                <>
                  <CheckCircle size={20} color="#16A34A" />
                  <Text className="ml-2 text-base font-extrabold text-emerald-700">
                    Thành công
                  </Text>
                </>
              ) : (
                <>
                  <XCircle size={20} color="#DC2626" />
                  <Text className="ml-2 text-base font-extrabold text-red-700">Thất bại</Text>
                </>
              )}
            </View>
            <View
              className={`rounded-xl p-3 border ${
                result.success
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  result.success ? "text-emerald-900" : "text-red-900"
                }`}
              >
                {result.message}
              </Text>
            </View>
          </View>

          {result.details && Object.keys(result.details).length > 0 && (
            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-500 mb-2">Chi tiết</Text>
              <View className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                {Object.entries(result.details).map(([key, value], index) => (
                  <View
                    key={key}
                    className={`flex-row items-start ${
                      index < Object.keys(result.details || {}).length - 1 ? "mb-3 pb-3 border-b border-slate-200" : ""
                    }`}
                  >
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-slate-600 mb-1">
                        {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1").trim()}:
                      </Text>
                      <Text className="text-sm text-slate-900 font-semibold">
                        {typeof value === "object" && value !== null
                          ? JSON.stringify(value, null, 2)
                          : value === null || value === undefined
                          ? "N/A"
                          : String(value)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            className="mt-4 py-3 rounded-2xl bg-sky-600 items-center"
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text className="text-white text-sm font-extrabold">Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Create Modal Component
function ConfigCreateModal({
  visible,
  existingConfigNames,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  existingConfigNames: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metadataJson, setMetadataJson] = useState("{}");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName("");
      setDescription("");
      setMetadataJson("{}");
      setIsActive(true);
      setJsonError(null);
    }
  }, [visible]);

  const validateJson = (json: string): boolean => {
    try {
      JSON.parse(json);
      setJsonError(null);
      return true;
    } catch {
      setJsonError("JSON không hợp lệ");
      return false;
    }
  };
  const normalizedName = name.trim().toLowerCase();
  const isDuplicateName = normalizedName.length > 0 && existingConfigNames.has(normalizedName);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên cấu hình");
      return;
    }
    if (isDuplicateName) {
      Alert.alert("Tên cấu hình đã tồn tại", "Tên này đã có trong hệ thống. Vui lòng chọn tên khác hoặc sửa cấu hình hiện có.");
      return;
    }
    if (!validateJson(metadataJson)) {
      Alert.alert("Lỗi", "Metadata JSON không hợp lệ");
      return;
    }

    setSaving(true);
    try {
      const metadata = JSON.parse(metadataJson);
      const request: CreateSystemConfigRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        metadata,
        isActive,
      };
      await systemConfigService.create(request);
      Alert.alert("Thành công", "Đã tạo cấu hình mới");
      onSuccess();
    } catch (error: any) {
      console.error("Error creating config:", error);
      const rawError = String(error?.message || error?.error || "");
      const duplicateError =
        rawError.includes("duplicate key value violates unique constraint") ||
        rawError.includes("idx_system_configs_name") ||
        rawError.includes("already exists");
      Alert.alert(
        duplicateError ? "Tên cấu hình đã tồn tại" : "Lỗi",
        duplicateError
          ? "Tên cấu hình này đã có trong hệ thống. Vui lòng dùng tên khác hoặc chỉnh sửa bản hiện có."
          : rawError || "Không thể tạo cấu hình"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <TouchableOpacity
          className="absolute inset-0"
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "position"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 12}
        >
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: "88%", minHeight: "72%" }}>
            <View className="px-6 py-4 border-b border-sky-100">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <TouchableOpacity 
                    onPress={onClose}
                    className="mr-3 p-1"
                    activeOpacity={0.7}
                  >
                    <ArrowLeft size={24} color="#64748B" />
                  </TouchableOpacity>
                  <Text className="text-slate-900 text-lg font-extrabold flex-1">Thêm cấu hình mới</Text>
                </View>
                <TouchableOpacity onPress={onClose}>
                  <XCircle size={24} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="always"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              nestedScrollEnabled
              contentContainerStyle={{ padding: 16, paddingBottom: 20, flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
            >
              <View className="mb-4">
                <Text className="text-slate-500 text-xs font-bold mb-1">
                  Tên cấu hình <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-slate-900 text-sm"
                  placeholder="VD: EMAIL_SMTP_CONFIG"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="characters"
                />
                {isDuplicateName && (
                  <Text className="text-red-600 text-xs mt-1">
                    Tên này đã tồn tại, vui lòng chọn tên khác hoặc sửa cấu hình hiện có.
                  </Text>
                )}
                <Text className="text-slate-400 text-[11px] mt-1 mb-2">
                  Chọn nhanh từ mẫu có sẵn:
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {SYSTEM_CONFIG_OPTIONS.map((configName) => {
                    const configExists = existingConfigNames.has(configName.toLowerCase());
                    const selected = name === configName;
                    return (
                      <TouchableOpacity
                        key={configName}
                        onPress={() => setName(configName)}
                        disabled={configExists}
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          selected
                            ? "bg-sky-600 border-sky-600"
                            : configExists
                            ? "bg-slate-100 border-slate-300"
                            : "bg-sky-50 border-sky-200"
                        }`}
                        activeOpacity={configExists ? 1 : 0.8}
                      >
                        <Text
                          className={`text-[10px] font-bold ${
                            selected ? "text-white" : configExists ? "text-slate-500" : "text-sky-700"
                          }`}
                        >
                          {configExists ? `${configName} (đã có)` : configName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-slate-500 text-xs font-bold mb-1">Mô tả</Text>
                <TextInput
                  className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-slate-900 text-sm"
                  placeholder="Mô tả cấu hình..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                  style={{ minHeight: 92 }}
                />
              </View>

              <View className="mb-4">
                <Text className="text-slate-500 text-xs font-bold mb-1">
                  Metadata (JSON) <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-slate-900 text-xs font-mono"
                  placeholder="{}"
                  value={metadataJson}
                  onChangeText={(text) => {
                    setMetadataJson(text);
                    if (jsonError) setJsonError(null);
                  }}
                  onBlur={() => validateJson(metadataJson)}
                  multiline
                  textAlignVertical="top"
                  style={{ height: 220 }}
                />
                {jsonError && (
                  <Text className="text-red-600 text-xs mt-1">{jsonError}</Text>
                )}
                {!jsonError && (
                  <Text className="text-slate-400 text-[11px] mt-1">
                    JSON hợp lệ sẽ được kiểm tra khi rời ô nhập hoặc bấm Tạo.
                  </Text>
                )}
              </View>

              <View className="mb-6">
                <TouchableOpacity
                  onPress={() => setIsActive(!isActive)}
                  className="flex-row items-center"
                >
                  <View
                    className={`w-5 h-5 rounded border-2 items-center justify-center mr-2 ${
                      isActive
                        ? "bg-sky-600 border-sky-600"
                        : "bg-white border-slate-300"
                    }`}
                  >
                    {isActive && <CheckCircle size={14} color="#FFFFFF" />}
                  </View>
                  <Text className="text-slate-700 text-sm font-bold">Kích hoạt</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
            <View className="px-4 py-3 border-t border-slate-100 bg-white">
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving || !!jsonError || !name.trim() || isDuplicateName}
                className="bg-sky-600 rounded-xl py-3 items-center"
                style={{ opacity: saving || jsonError || !name.trim() || isDuplicateName ? 0.5 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-sm font-extrabold">Tạo cấu hình</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
