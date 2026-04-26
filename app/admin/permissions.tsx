import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  Search,
  Shield,
  Users,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Lock,
} from "lucide-react-native";
import React, { useMemo, useState, useEffect, useCallback } from "react";
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
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getRoleLabelVi, isStaffLikeOperationalRole } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { roleService, RoleResponse } from "@/services/roleService";
import { permissionService, PermissionResponse } from "@/services/permissionService";
import { rolePermissionService, PermissionAccess } from "@/services/rolePermissionService";
import { userService } from "@/services/userService";

export default function AdminPermissionsScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleResponse | null>(null);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

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

  // Fetch roles
  const {
    data: roles = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["roles"],
    queryFn: () => roleService.getAll(),
    enabled: user?.role === "ROLE_ADMIN",
  });

  // Fetch user counts for each role
  useEffect(() => {
    if (roles.length > 0) {
      const fetchUserCounts = async () => {
        const counts: Record<string, number> = {};
        await Promise.all(
          roles.map(async (role) => {
            try {
              const count = await userService.countByRole(role.name);
              counts[role.id] = count;
            } catch (err) {
              counts[role.id] = 0;
            }
          })
        );
        setUserCounts(counts);
      };
      fetchUserCounts();
    }
  }, [roles]);

  // Filtered roles
  const filteredRoles = useMemo(() => {
    const visibleRoles = roles.filter((role) => role.name !== "ROLE_ADMIN");
    if (!searchQuery.trim()) return visibleRoles;
    const query = searchQuery.toLowerCase();
    return visibleRoles.filter(
      (role) =>
        role.name.toLowerCase().includes(query) ||
        getRoleLabelVi(role.name).toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query)
    );
  }, [roles, searchQuery]);

  const handleViewPermissions = (role: RoleResponse) => {
    setSelectedRole(role);
    setModalMode("view");
    setShowPermissionModal(true);
  };

  const handleEditPermissions = (role: RoleResponse) => {
    setSelectedRole(role);
    setModalMode("edit");
    setShowPermissionModal(true);
  };

  const handleDeletePermissions = (role: RoleResponse) => {
    setSelectedRole(role);
    setShowDeleteModal(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await rolePermissionService.deleteAllForRole(roleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setShowDeleteModal(false);
      setSelectedRole(null);
      Alert.alert("Thành công", "Đã xóa tất cả quyền của vai trò này");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể xóa quyền");
    },
  });

  const handleConfirmDelete = () => {
    if (selectedRole) {
      deleteMutation.mutate(selectedRole.id);
    }
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
            <Text className="text-slate-900 text-lg font-extrabold">Phân quyền & Vai trò</Text>
            <Text className="mt-0.5 text-xs text-slate-500">Quản lý quyền truy cập hệ thống</Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-sky-50 rounded-xl px-3 py-2 border border-sky-200">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 ml-2 text-sm text-slate-900"
            placeholder="Tìm kiếm vai trò..."
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

        {filteredRoles.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
            <Shield size={48} color="#94A3B8" />
            <Text className="mt-4 text-slate-500 text-sm font-bold text-center">
              {searchQuery ? "Không tìm thấy vai trò nào" : "Chưa có vai trò nào"}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {filteredRoles.map((role) => {
              const permissionCount = role.permissions?.length || 0;
              const userCount = userCounts[role.id] || 0;

              return (
                <View
                  key={role.id}
                  className="bg-white rounded-2xl p-4 border border-sky-100"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <View className="flex-row items-center mb-1">
                        <Shield size={20} color="#0284C7" />
                        <Text className="ml-2 text-slate-900 text-base font-extrabold">
                          {getRoleLabelVi(role.name)}
                        </Text>
                      </View>
                      {role.description && (
                        <Text className="text-slate-500 text-xs mt-1" numberOfLines={2}>
                          {role.description}
                        </Text>
                      )}
                      <Text className="text-slate-400 text-[10px] mt-1 font-bold">
                        {role.name}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-4 mb-3">
                    <View className="flex-row items-center">
                      <Lock size={14} color="#64748B" />
                      <Text className="ml-1 text-slate-600 text-xs font-bold">
                        {permissionCount} quyền
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Users size={14} color="#64748B" />
                      <Text className="ml-1 text-slate-600 text-xs font-bold">
                        {userCount} người dùng
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons - Tách riêng */}
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleViewPermissions(role)}
                      className="flex-1 bg-blue-50 border border-blue-200 rounded-xl py-2.5 items-center"
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center">
                        <Eye size={14} color="#2563EB" />
                        <Text className="text-blue-700 text-xs font-extrabold ml-1.5">
                          Xem
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleEditPermissions(role)}
                      className="flex-1 bg-sky-50 border border-sky-200 rounded-xl py-2.5 items-center"
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center">
                        <Edit size={14} color="#0284C7" />
                        <Text className="text-sky-700 text-xs font-extrabold ml-1.5">
                          Sửa
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeletePermissions(role)}
                      className="flex-1 bg-red-50 border border-red-200 rounded-xl py-2.5 items-center"
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center">
                        <Trash2 size={14} color="#DC2626" />
                        <Text className="text-red-700 text-xs font-extrabold ml-1.5">
                          Xóa
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Permission Modal */}
      {selectedRole && (
        <PermissionModal
          visible={showPermissionModal}
          mode={modalMode}
          role={selectedRole}
          onClose={() => {
            setShowPermissionModal(false);
            setSelectedRole(null);
            setModalMode("view");
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
          }}
        />
      )}

      {/* Delete Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-slate-900 text-lg font-extrabold mb-2">
              Xóa phân quyền
            </Text>
            <Text className="text-slate-600 text-sm mb-6">
              Bạn có chắc chắn muốn xóa tất cả quyền của vai trò{" "}
              <Text className="font-bold">{selectedRole ? getRoleLabelVi(selectedRole.name) : ""}</Text>?
              Hành động này không thể hoàn tác.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteModal(false);
                  setSelectedRole(null);
                }}
                className="flex-1 bg-slate-100 rounded-xl py-3 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-slate-700 text-sm font-extrabold">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 rounded-xl py-3 items-center"
                style={{ opacity: deleteMutation.isPending ? 0.5 : 1 }}
                activeOpacity={0.7}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-white text-sm font-extrabold">Xóa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Permission Modal Component
function PermissionModal({
  visible,
  mode,
  role,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  mode: "view" | "edit";
  role: RoleResponse;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [permissionAccess, setPermissionAccess] = useState<PermissionAccess[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReadOnly = mode === "view";

  // Fetch all permissions and current role permissions
  useEffect(() => {
    if (visible) {
      const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
          // Fetch all available permissions
          const permissions = await permissionService.getAll();
          setAllPermissions(permissions);

          // Fetch current role permissions
          const rolePermissions = await rolePermissionService.getPermissionsByRoleId(role.id);

          // Create a map of existing permissions
          const existingMap = new Map(
            rolePermissions.map((rp) => [rp.permissionId, rp])
          );

          // Merge with all permissions
          const mergedAccess: PermissionAccess[] = permissions.map((perm) => {
            const existing = existingMap.get(perm.id);
            return {
              permissionId: perm.id,
              permissionName: perm.permissionName,
              groupName: perm.groupName,
              levelName: perm.levelName,
              createAllowed: existing?.createAllowed || false,
              readAllowed: existing?.readAllowed || false,
              updateAllowed: existing?.updateAllowed || false,
              deleteAllowed: existing?.deleteAllowed || false,
            };
          });

          setPermissionAccess(mergedAccess);
        } catch (err: any) {
          setError(err.message || "Không thể tải dữ liệu");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [visible, role]);

  // Group permissions by groupName
  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionAccess[]>();
    permissionAccess.forEach((p) => {
      const group = groups.get(p.groupName) || [];
      group.push(p);
      groups.set(p.groupName, group);
    });
    return Array.from(groups.entries()).map(([groupName, permissions]) => ({
      groupName,
      permissions,
    }));
  }, [permissionAccess]);

  // Toggle permission access
  const toggleAccess = useCallback(
    (
      permissionId: string,
      field: "createAllowed" | "readAllowed" | "updateAllowed" | "deleteAllowed"
    ) => {
      if (isReadOnly) return;

      setPermissionAccess((prev) =>
        prev.map((p) =>
          p.permissionId === permissionId ? { ...p, [field]: !p[field] } : p
        )
      );
    },
    [isReadOnly]
  );

  // Save permissions
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Delete all existing permissions for this role
      await rolePermissionService.deleteAllForRole(role.id);

      // Assign new permissions
      const permissionsToAssign = permissionAccess.filter(
        (p) =>
          p.createAllowed || p.readAllowed || p.updateAllowed || p.deleteAllowed
      );

      for (const perm of permissionsToAssign) {
        await rolePermissionService.assignPermissionToRole({
          roleId: role.id,
          permissionId: perm.permissionId,
          createAllowed: perm.createAllowed,
          readAllowed: perm.readAllowed,
          updateAllowed: perm.updateAllowed,
          deleteAllowed: perm.deleteAllowed,
        });
      }

      Alert.alert("Thành công", "Đã cập nhật phân quyền");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Không thể lưu phân quyền");
      Alert.alert("Lỗi", err.message || "Không thể lưu phân quyền");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50">
        <View className="flex-1 bg-white mt-20 rounded-t-3xl">
          {/* Header */}
          <View className="px-6 py-4 border-b border-sky-100">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-1">
                <Text className="text-slate-900 text-lg font-extrabold">
                  {isReadOnly ? "Chi tiết phân quyền" : "Cập nhật phân quyền"}
                </Text>
                <Text className="text-slate-500 text-xs mt-1">
                  {getRoleLabelVi(role.name)}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <XCircle size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            {loading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="large" color="#0284C7" />
                <Text className="mt-3 text-slate-500 text-sm">Đang tải...</Text>
              </View>
            ) : error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4">
                <Text className="text-red-700 text-sm font-bold">{error}</Text>
              </View>
            ) : permissionGroups.length === 0 ? (
              <View className="py-8 items-center">
                <Shield size={48} color="#94A3B8" />
                <Text className="mt-4 text-slate-500 text-sm font-bold text-center">
                  Chưa có quyền hạn nào
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-slate-700 text-sm font-bold mb-4">
                  Thiết lập phân quyền (Vui lòng bật chức năng cho phép)
                </Text>

                {/* Table Header */}
                <View className="flex-row bg-slate-50 rounded-t-xl border-b border-slate-200 px-3 py-2 mb-1">
                  <View className="flex-1">
                    <Text className="text-slate-600 text-xs font-extrabold">Chức năng quản lý</Text>
                  </View>
                  <View className="w-16 items-center">
                    <Text className="text-slate-600 text-xs font-extrabold">Tạo</Text>
                  </View>
                  <View className="w-16 items-center">
                    <Text className="text-slate-600 text-xs font-extrabold">Xem</Text>
                  </View>
                  <View className="w-16 items-center">
                    <Text className="text-slate-600 text-xs font-extrabold">Sửa</Text>
                  </View>
                  <View className="w-16 items-center">
                    <Text className="text-slate-600 text-xs font-extrabold">Xóa</Text>
                  </View>
                </View>

                {/* Permissions by Group */}
                {permissionGroups.map((group, gIdx) => (
                  <View key={group.groupName} className="mb-4">
                    {/* Group Header */}
                    <View className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                      <Text className="text-slate-900 text-sm font-extrabold">
                        {gIdx + 1}. {group.groupName}
                      </Text>
                    </View>

                    {/* Permissions in Group */}
                    {group.permissions.map((perm, pIdx) => (
                      <View
                        key={perm.permissionId}
                        className="flex-row items-center bg-white border-b border-slate-100 px-3 py-3"
                      >
                        <View className="flex-1">
                          <Text className="text-slate-700 text-xs font-bold">
                            {gIdx + 1}.{pIdx + 1} {perm.permissionName}
                          </Text>
                        </View>
                        <View className="w-16 items-center">
                          <Switch
                            value={perm.createAllowed}
                            onValueChange={() => toggleAccess(perm.permissionId, "createAllowed")}
                            disabled={isReadOnly}
                            trackColor={{ false: "#E2E8F0", true: "#10B981" }}
                            thumbColor={perm.createAllowed ? "#FFFFFF" : "#94A3B8"}
                          />
                        </View>
                        <View className="w-16 items-center">
                          <Switch
                            value={perm.readAllowed}
                            onValueChange={() => toggleAccess(perm.permissionId, "readAllowed")}
                            disabled={isReadOnly}
                            trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
                            thumbColor={perm.readAllowed ? "#FFFFFF" : "#94A3B8"}
                          />
                        </View>
                        <View className="w-16 items-center">
                          <Switch
                            value={perm.updateAllowed}
                            onValueChange={() => toggleAccess(perm.permissionId, "updateAllowed")}
                            disabled={isReadOnly}
                            trackColor={{ false: "#E2E8F0", true: "#F59E0B" }}
                            thumbColor={perm.updateAllowed ? "#FFFFFF" : "#94A3B8"}
                          />
                        </View>
                        <View className="w-16 items-center">
                          <Switch
                            value={perm.deleteAllowed}
                            onValueChange={() => toggleAccess(perm.permissionId, "deleteAllowed")}
                            disabled={isReadOnly}
                            trackColor={{ false: "#E2E8F0", true: "#EF4444" }}
                            thumbColor={perm.deleteAllowed ? "#FFFFFF" : "#94A3B8"}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                ))}

                {!isReadOnly && (
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    className="bg-sky-600 rounded-xl py-3 items-center mt-4"
                    style={{ opacity: saving ? 0.5 : 1 }}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text className="text-white text-sm font-extrabold">Cập nhật</Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
