import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  Search,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Shield,
  Filter,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import {
  permissionService,
  PermissionResponse,
  PermissionRequest,
} from "@/services/permissionService";

export default function AdminPermissionsListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<PermissionResponse | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  // Form state
  const [formData, setFormData] = useState<PermissionRequest>({
    permissionName: "",
    groupName: "",
    levelName: "",
  });

  const { data: permissionsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-permissions-list"],
    queryFn: () => permissionService.getAll(),
    enabled: user?.role === "ROLE_ADMIN",
  });

  const createMutation = useMutation({
    mutationFn: (data: PermissionRequest) => permissionService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-permissions-list"] });
      setShowFormModal(false);
      resetForm();
      Alert.alert("Thành công", "Tạo quyền hạn thành công");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể tạo quyền hạn");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PermissionRequest }) =>
      permissionService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-permissions-list"] });
      setShowFormModal(false);
      resetForm();
      Alert.alert("Thành công", "Cập nhật quyền hạn thành công");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể cập nhật quyền hạn");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => permissionService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-permissions-list"] });
      setShowDeleteModal(false);
      setSelectedPermission(null);
      Alert.alert("Thành công", "Xóa quyền hạn thành công");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể xóa quyền hạn");
    },
  });

  const resetForm = () => {
    setFormData({
      permissionName: "",
      groupName: "",
      levelName: "",
    });
    setIsEdit(false);
    setSelectedPermission(null);
  };

  const handleAdd = () => {
    resetForm();
    setIsEdit(false);
    setShowFormModal(true);
  };

  const handleEdit = (permission: PermissionResponse) => {
    setSelectedPermission(permission);
    setFormData({
      permissionName: permission.permissionName,
      groupName: permission.groupName,
      levelName: permission.levelName,
    });
    setIsEdit(true);
    setShowFormModal(true);
  };

  const handleDelete = (permission: PermissionResponse) => {
    setSelectedPermission(permission);
    setShowDeleteModal(true);
  };

  const handleSubmit = () => {
    if (!formData.permissionName.trim() || !formData.groupName.trim() || !formData.levelName.trim()) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (isEdit && selectedPermission) {
      updateMutation.mutate({
        id: selectedPermission.id,
        data: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (user?.role !== "ROLE_ADMIN") {
    return null;
  }

  const permissions = useMemo(() => {
    if (!permissionsResponse || !Array.isArray(permissionsResponse)) return [];
    return permissionsResponse;
  }, [permissionsResponse]);

  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    permissions.forEach((p) => {
      if (p.groupName) groupSet.add(p.groupName);
    });
    return Array.from(groupSet).sort();
  }, [permissions]);

  const levels = useMemo(() => {
    const levelSet = new Set<string>();
    permissions.forEach((p) => {
      if (p.levelName) levelSet.add(p.levelName);
    });
    return Array.from(levelSet).sort();
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    return permissions.filter((permission) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        permission.permissionName?.toLowerCase().includes(q) ||
        permission.groupName?.toLowerCase().includes(q) ||
        permission.levelName?.toLowerCase().includes(q);

      const matchesGroup = groupFilter === "all" || permission.groupName === groupFilter;
      const matchesLevel = levelFilter === "all" || permission.levelName === levelFilter;

      return matchesSearch && matchesGroup && matchesLevel;
    });
  }, [permissions, searchQuery, groupFilter, levelFilter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (groupFilter !== "all") count++;
    if (levelFilter !== "all") count++;
    return count;
  }, [groupFilter, levelFilter]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-slate-900 text-center mb-2">
            Không tải được dữ liệu
          </Text>
          <Text className="text-xs text-slate-500 text-center mb-4">
            Vui lòng kiểm tra kết nối mạng và thử lại.
          </Text>
          <TouchableOpacity
            className="bg-sky-600 py-3 rounded-2xl items-center"
            onPress={() => refetch()}
            activeOpacity={0.85}
          >
            <Text className="text-white text-sm font-extrabold">Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen
        options={{
          title: "Quản lý quyền hạn",
          headerStyle: { backgroundColor: "#0891b2" },
          headerTintColor: "#fff",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="ml-2">
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleAdd} className="mr-2">
              <Plus size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Search and Filter Bar */}
      <View className="bg-white px-4 py-3 border-b border-sky-100">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center bg-sky-50 rounded-xl px-3 py-2 border border-sky-200">
            <Search size={18} color="#64748b" />
            <TextInput
              className="flex-1 ml-2 text-sm text-slate-900"
              placeholder="Tìm kiếm quyền hạn..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-xl border ${
              activeFilterCount > 0
                ? "bg-sky-600 border-sky-600"
                : "bg-white border-sky-200"
            }`}
            activeOpacity={0.85}
          >
            <View className="flex-row items-center gap-1">
              <Filter size={18} color={activeFilterCount > 0 ? "#fff" : "#64748b"} />
              {activeFilterCount > 0 && (
                <View className="bg-red-500 rounded-full min-w-[20px] h-[20px] items-center justify-center px-1">
                  <Text className="text-white text-[10px] font-bold">{activeFilterCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Filter Panel */}
        {showFilters && (
          <View className="mt-3 pt-3 border-t border-sky-100">
            <View className="mb-3">
              <Text className="text-xs font-bold text-slate-700 mb-2">Nhóm quyền</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setGroupFilter("all")}
                    className={`px-3 py-1.5 rounded-full border ${
                      groupFilter === "all"
                        ? "bg-sky-600 border-sky-600"
                        : "bg-white border-sky-200"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        groupFilter === "all" ? "text-white" : "text-slate-600"
                      }`}
                    >
                      Tất cả
                    </Text>
                  </TouchableOpacity>
                  {groups.map((group) => (
                    <TouchableOpacity
                      key={group}
                      onPress={() => setGroupFilter(group)}
                      className={`px-3 py-1.5 rounded-full border ${
                        groupFilter === group
                          ? "bg-sky-600 border-sky-600"
                          : "bg-white border-sky-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          groupFilter === group ? "text-white" : "text-slate-600"
                        }`}
                      >
                        {group}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-2">Cấp độ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setLevelFilter("all")}
                    className={`px-3 py-1.5 rounded-full border ${
                      levelFilter === "all"
                        ? "bg-sky-600 border-sky-600"
                        : "bg-white border-sky-200"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        levelFilter === "all" ? "text-white" : "text-slate-600"
                      }`}
                    >
                      Tất cả
                    </Text>
                  </TouchableOpacity>
                  {levels.map((level) => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => setLevelFilter(level)}
                      className={`px-3 py-1.5 rounded-full border ${
                        levelFilter === level
                          ? "bg-sky-600 border-sky-600"
                          : "bg-white border-sky-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          levelFilter === level ? "text-white" : "text-slate-600"
                        }`}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      {/* List */}
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        <View className="p-4 gap-3">
          {filteredPermissions.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
              <Shield size={48} color="#cbd5e1" />
              <Text className="text-sm font-bold text-slate-500 mt-3 text-center">
                Không tìm thấy quyền hạn nào
              </Text>
            </View>
          ) : (
            filteredPermissions.map((permission) => (
              <View
                key={permission.id}
                className="bg-white rounded-2xl p-4 border border-sky-100"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <Text className="text-sm font-extrabold text-slate-900 mb-1">
                      {permission.permissionName}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <View className="px-2 py-1 bg-sky-50 rounded-lg border border-sky-200">
                        <Text className="text-[10px] font-bold text-sky-700">
                          {permission.groupName}
                        </Text>
                      </View>
                      <View className="px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                        <Text className="text-[10px] font-bold text-emerald-700">
                          {permission.levelName}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => handleEdit(permission)}
                    className="flex-1 bg-sky-600 py-2 rounded-xl items-center"
                    activeOpacity={0.85}
                  >
                    <View className="flex-row items-center gap-1">
                      <Edit size={14} color="#fff" />
                      <Text className="text-white text-xs font-bold">Sửa</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(permission)}
                    className="px-4 py-2 bg-red-50 rounded-xl border border-red-200"
                    activeOpacity={0.85}
                  >
                    <Trash2 size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Form Modal */}
      <Modal
        visible={showFormModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFormModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <TouchableOpacity
            className="flex-1 bg-black/50 justify-end"
            activeOpacity={1}
            onPress={() => setShowFormModal(false)}
          >
            <TouchableOpacity
              className="bg-white rounded-t-3xl"
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={{ maxHeight: "90%" }}
            >
              <View className="px-6 pt-4 pb-2 border-b border-sky-100">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <TouchableOpacity 
                      onPress={() => setShowFormModal(false)}
                      className="mr-3 p-1"
                      activeOpacity={0.7}
                    >
                      <ArrowLeft size={24} color="#64748B" />
                    </TouchableOpacity>
                    <Text className="text-lg font-extrabold text-slate-900 flex-1">
                      {isEdit ? "Sửa quyền hạn" : "Thêm quyền hạn"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowFormModal(false)}>
                    <Text className="text-sky-600 text-sm font-bold">Đóng</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              >
                <View className="gap-4">
                  <View>
                    <Text className="text-xs font-bold text-slate-700 mb-2">Tên quyền hạn *</Text>
                    <TextInput
                      className="bg-sky-50 rounded-xl px-4 py-3 border border-sky-200 text-sm text-slate-900"
                      placeholder="Nhập tên quyền hạn"
                      placeholderTextColor="#94A3B8"
                      value={formData.permissionName}
                      onChangeText={(text) => setFormData({ ...formData, permissionName: text })}
                      returnKeyType="next"
                    />
                  </View>

                  <View>
                    <Text className="text-xs font-bold text-slate-700 mb-2">Nhóm quyền *</Text>
                    <TextInput
                      className="bg-sky-50 rounded-xl px-4 py-3 border border-sky-200 text-sm text-slate-900"
                      placeholder="Nhập nhóm quyền"
                      placeholderTextColor="#94A3B8"
                      value={formData.groupName}
                      onChangeText={(text) => setFormData({ ...formData, groupName: text })}
                      returnKeyType="next"
                    />
                  </View>

                  <View>
                    <Text className="text-xs font-bold text-slate-700 mb-2">Cấp độ *</Text>
                    <TextInput
                      className="bg-sky-50 rounded-xl px-4 py-3 border border-sky-200 text-sm text-slate-900"
                      placeholder="Nhập cấp độ"
                      placeholderTextColor="#94A3B8"
                      value={formData.levelName}
                      onChangeText={(text) => setFormData({ ...formData, levelName: text })}
                      returnKeyType="done"
                    />
                  </View>

                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity
                      onPress={() => setShowFormModal(false)}
                      className="flex-1 py-3 rounded-xl border border-slate-200 items-center"
                      activeOpacity={0.85}
                    >
                      <Text className="text-sm font-bold text-slate-700">Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSubmit}
                      className="flex-1 py-3 rounded-xl bg-sky-600 items-center"
                      activeOpacity={0.85}
                      disabled={createMutation.isPending || updateMutation.isPending}
                      style={{ opacity: createMutation.isPending || updateMutation.isPending ? 0.5 : 1 }}
                    >
                      {createMutation.isPending || updateMutation.isPending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-sm font-bold text-white">
                          {isEdit ? "Cập nhật" : "Tạo"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View className="bg-white rounded-2xl p-6 w-full max-w-[400px]">
            <Text className="text-lg font-extrabold text-slate-900 mb-2">
              Xác nhận xóa
            </Text>
            <Text className="text-sm text-slate-600 mb-4">
              Bạn có chắc chắn muốn xóa quyền hạn "{selectedPermission?.permissionName}"? Hành động này không thể hoàn tác.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 items-center"
                activeOpacity={0.85}
              >
                <Text className="text-sm font-bold text-slate-700">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (selectedPermission) {
                    deleteMutation.mutate(selectedPermission.id);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 items-center"
                activeOpacity={0.85}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-sm font-bold text-white">Xóa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
