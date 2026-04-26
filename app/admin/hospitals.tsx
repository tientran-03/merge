import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  Building2,
  Edit,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PaginationControls } from "@/components/PaginationControls";
import { ROLE_DOCTOR, ROLE_LAB_TECHNICIAN, ROLE_SAMPLE_COLLECTOR } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { ROOT_HREF } from "@/lib/router-href";
import {
  HospitalRequest,
  HospitalResponse,
  hospitalService,
} from "@/services/hospitalService";

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-2 rounded-full border ${active
          ? "bg-sky-600 border-sky-600"
          : "bg-white border-slate-200"
        }`}
      activeOpacity={0.7}
    >
      <Text
        className={`text-xs font-bold ${active ? "text-white" : "text-slate-700"
          }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminHospitalsScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterHospitalId, setFilterHospitalId] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHospital, setEditingHospital] = useState<HospitalResponse | null>(null);
  const [formHospitalName, setFormHospitalName] = useState("");

  useEffect(() => {
    if (!authLoading && user && user.role !== "ROLE_ADMIN") {
      const r = user.role?.toUpperCase();
      if (r === ROLE_DOCTOR) router.replace("/doctor");
      else if (r === ROLE_LAB_TECHNICIAN) router.replace("/lab-technician");
      else if (r === ROLE_SAMPLE_COLLECTOR) router.replace("/sample-collector");
      else if (r === "ROLE_STAFF") router.replace("/staff");
      else router.replace(ROOT_HREF);
    }
  }, [user, authLoading]);
  const {
    data: hospitalsData,
    isLoading,
    error,
    refetch,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<HospitalResponse>({
    queryKey: ["hospitals", searchQuery],
    queryFn: async (params) => {
      if (searchQuery.trim()) {
        return await hospitalService.search(searchQuery.trim(), params);
      }
      return await hospitalService.getAll(params);
    },
    defaultPageSize: 20,
    enabled: user?.role === "ROLE_ADMIN",
  });

  // Extract hospitals array from response
  const hospitals = useMemo(() => {
    return hospitalsData || [];
  }, [hospitalsData]);

  // Filter hospitals
  const filteredHospitals = useMemo(() => {
    let result = [...hospitals];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (h) =>
          String(h.hospitalId).toLowerCase().includes(query) ||
          h.hospitalName?.toLowerCase().includes(query)
      );
    }

    // Hospital ID filter
    if (filterHospitalId.trim()) {
      const query = filterHospitalId.toLowerCase().trim();
      result = result.filter((h) =>
        String(h.hospitalId).toLowerCase().includes(query)
      );
    }

    return result;
  }, [hospitals, searchQuery, filterHospitalId]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterHospitalId.trim()) count++;
    return count;
  }, [filterHospitalId]);

  const handleClearFilters = () => {
    setFilterHospitalId("");
    setSearchQuery("");
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: HospitalRequest) => hospitalService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
      setShowCreateModal(false);
      resetForm();
      Alert.alert("Thành công", "Đã tạo tổ chức mới");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error.message || "Không thể tạo tổ chức");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: HospitalRequest }) =>
      hospitalService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
      setShowEditModal(false);
      setEditingHospital(null);
      resetForm();
      Alert.alert("Thành công", "Đã cập nhật tổ chức");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error.message || "Không thể cập nhật tổ chức");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => hospitalService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
      Alert.alert("Thành công", "Đã xóa tổ chức");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error.message || "Không thể xóa tổ chức");
    },
  });

  const resetForm = () => {
    setFormHospitalName("");
  };

  const handleCreate = () => {
    if (!formHospitalName.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên tổ chức");
      return;
    }
    createMutation.mutate({
      hospitalName: formHospitalName.trim(),
    });
  };

  const handleEdit = (hospital: HospitalResponse) => {
    setEditingHospital(hospital);
    setFormHospitalName(hospital.hospitalName);
    setShowEditModal(true);
  };

  const handleUpdate = () => {
    if (!editingHospital || !formHospitalName.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên tổ chức");
      return;
    }
    updateMutation.mutate({
      id: editingHospital.hospitalId,
      data: {
        hospitalName: formHospitalName.trim(),
      },
    });
  };

  const handleDelete = (hospital: HospitalResponse) => {
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc chắn muốn xóa tổ chức "${hospital.hospitalName}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => deleteMutation.mutate(hospital.hospitalId),
        },
      ]
    );
  };

  if (authLoading || isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">
          Đang tải dữ liệu...
        </Text>
      </View>
    );
  }

  if (!user || user.role !== "ROLE_ADMIN") {
    return null;
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
    <SafeAreaView
      className="flex-1 bg-sky-50"
      edges={["top", "left", "right"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen
        options={{
          title: "Quản lý tổ chức",
          headerStyle: { backgroundColor: "#0891b2" },
          headerTintColor: "#fff",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.push("/admin")}
              className="ml-2"
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Header với search và filter */}
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center mb-3">
          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">
              Quản lý tổ chức
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {filteredHospitals.length} tổ chức
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setEditingHospital(null);
              setShowCreateModal(true);
            }}
            className="w-10 h-10 rounded-xl bg-emerald-600 items-center justify-center mr-2"
            activeOpacity={0.85}
          >
            <Plus size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowFilters((v) => !v)}
            className={`w-10 h-10 rounded-xl border items-center justify-center relative ${showFilters
                ? "bg-sky-600 border-sky-600"
                : "bg-sky-50 border-sky-200"
              }`}
            activeOpacity={0.85}
          >
            <SlidersHorizontal
              size={18}
              color={showFilters ? "#FFFFFF" : "#0284C7"}
            />
            {activeFilterCount > 0 && (
              <View className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white items-center justify-center">
                <Text className="text-[10px] font-bold text-white">
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View className="flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm theo mã hoặc tên tổ chức..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {!!searchQuery.trim() && (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center"
              onPress={() => setSearchQuery("")}
              activeOpacity={0.75}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter panel */}
        {showFilters && (
          <View className="mt-3 pt-3 border-t border-sky-100">
            <Text className="text-xs font-bold text-slate-600 mb-2">
              Mã tổ chức
            </Text>
            <TextInput
              className="h-10 rounded-xl px-3 bg-white border border-sky-200 text-sm text-slate-900 font-semibold"
              placeholder="Nhập mã tổ chức"
              placeholderTextColor="#94A3B8"
              value={filterHospitalId}
              onChangeText={setFilterHospitalId}
            />

            {activeFilterCount > 0 && (
              <TouchableOpacity
                className="mt-3 py-2 rounded-xl bg-slate-100 items-center"
                onPress={handleClearFilters}
                activeOpacity={0.75}
              >
                <Text className="text-xs font-bold text-slate-700">
                  Xóa bộ lọc
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Hospital list */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor="#0284C7"
          />
        }
      >
        {filteredHospitals.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20 px-5">
            <Building2 size={48} color="#94A3B8" />
            <Text className="mt-4 text-base font-bold text-slate-700 text-center">
              {searchQuery.trim() || filterHospitalId.trim()
                ? "Không tìm thấy tổ chức phù hợp"
                : "Chưa có tổ chức nào"}
            </Text>
            <Text className="mt-2 text-xs text-slate-500 text-center">
              {searchQuery.trim() || filterHospitalId.trim()
                ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
                : "Danh sách tổ chức sẽ hiển thị tại đây"}
            </Text>
          </View>
        ) : (
          <View className="p-4">
            {filteredHospitals.map((hospital, index) => (
              <View
                key={hospital.hospitalId}
                className={`bg-white rounded-2xl p-4 mb-3 border border-sky-100 ${index === 0 ? "" : ""
                  }`}
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <Building2 size={18} color="#0284C7" />
                      <Text className="ml-2 text-xs font-bold text-sky-600">
                        Mã BV: {hospital.hospitalId}
                      </Text>
                    </View>
                    <Text className="mt-1 text-base font-extrabold text-slate-900">
                      {hospital.hospitalName || "Chưa có tên"}
                    </Text>
                  </View>
                </View>

                {/* Action buttons */}
                <View className="flex-row gap-2 mt-3 pt-3 border-t border-sky-100">
                  <TouchableOpacity
                    className={`flex-1 py-2.5 px-3 rounded-xl border items-center ${createMutation.isPending ||
                        updateMutation.isPending ||
                        deleteMutation.isPending
                        ? "bg-slate-100 border-slate-200 opacity-50"
                        : "bg-blue-50 border-blue-200"
                      }`}
                    onPress={() => handleEdit(hospital)}
                    activeOpacity={0.7}
                    disabled={
                      createMutation.isPending ||
                      updateMutation.isPending ||
                      deleteMutation.isPending
                    }
                  >
                    <Edit
                      size={16}
                      color={
                        createMutation.isPending ||
                          updateMutation.isPending ||
                          deleteMutation.isPending
                          ? "#94A3B8"
                          : "#2563EB"
                      }
                    />
                    <Text
                      className={`mt-1 text-xs font-bold ${createMutation.isPending ||
                          updateMutation.isPending ||
                          deleteMutation.isPending
                          ? "text-slate-500"
                          : "text-blue-700"
                        }`}
                    >
                      Sửa
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className={`flex-1 py-2.5 px-3 rounded-xl border items-center ${createMutation.isPending ||
                        updateMutation.isPending ||
                        deleteMutation.isPending
                        ? "bg-slate-100 border-slate-200 opacity-50"
                        : "bg-red-50 border-red-200"
                      }`}
                    onPress={() => handleDelete(hospital)}
                    activeOpacity={0.7}
                    disabled={
                      createMutation.isPending ||
                      updateMutation.isPending ||
                      deleteMutation.isPending
                    }
                  >
                    <Trash2
                      size={16}
                      color={
                        createMutation.isPending ||
                          updateMutation.isPending ||
                          deleteMutation.isPending
                          ? "#94A3B8"
                          : "#DC2626"
                      }
                    />
                    <Text
                      className={`mt-1 text-xs font-bold ${createMutation.isPending ||
                          updateMutation.isPending ||
                          deleteMutation.isPending
                          ? "text-slate-500"
                          : "text-red-700"
                        }`}
                    >
                      Xóa
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          pageSize={pageSize}
          totalElements={totalElements}
          isLoading={isLoading}
        />
      )}

      {/* Create Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-3xl p-6 w-full max-w-[400px]">
            <Text className="text-lg font-extrabold text-slate-900 mb-2">
              Thêm tổ chức mới
            </Text>

            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-700 mb-2">
                Tên tổ chức *
              </Text>
              <TextInput
                className="h-11 rounded-xl px-3 bg-slate-50 border border-slate-200 text-sm text-slate-900 font-semibold"
                placeholder="Nhập tên tổ chức"
                placeholderTextColor="#94A3B8"
                value={formHospitalName}
                onChangeText={setFormHospitalName}
              />
            </View>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-slate-100 items-center"
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                activeOpacity={0.85}
                disabled={createMutation.isPending}
              >
                <Text className="text-slate-700 text-sm font-extrabold">
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-emerald-600 items-center"
                onPress={handleCreate}
                activeOpacity={0.85}
                disabled={createMutation.isPending || !formHospitalName.trim()}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-sm font-extrabold">
                    Tạo
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowEditModal(false);
          setEditingHospital(null);
          resetForm();
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-3xl p-6 w-full max-w-[400px]">
            <Text className="text-lg font-extrabold text-slate-900 mb-2">
              Chỉnh sửa tổ chức
            </Text>
            <Text className="text-sm text-slate-600 mb-4">
              Mã: {editingHospital?.hospitalId}
            </Text>

            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-700 mb-2">
                Tên tổ chức *
              </Text>
              <TextInput
                className="h-11 rounded-xl px-3 bg-slate-50 border border-slate-200 text-sm text-slate-900 font-semibold"
                placeholder="Nhập tên tổ chức"
                placeholderTextColor="#94A3B8"
                value={formHospitalName}
                onChangeText={setFormHospitalName}
              />
            </View>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-slate-100 items-center"
                onPress={() => {
                  setShowEditModal(false);
                  setEditingHospital(null);
                  resetForm();
                }}
                activeOpacity={0.85}
                disabled={updateMutation.isPending}
              >
                <Text className="text-slate-700 text-sm font-extrabold">
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-blue-600 items-center"
                onPress={handleUpdate}
                activeOpacity={0.85}
                disabled={updateMutation.isPending || !formHospitalName.trim()}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-sm font-extrabold">
                    Cập nhật
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
