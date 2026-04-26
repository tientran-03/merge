import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  Search,
  ChevronRight,
  ArrowLeft,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Trash2,
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PaginationControls } from "@/components/PaginationControls";
import { useAuth } from "@/contexts/AuthContext";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { useSheetBottomInset } from "@/lib/useSheetBottomInset";
import { specifyVoteTestService, SpecifyVoteTestResponse } from "@/services/specifyVoteTestService";

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("vi-VN");
  } catch {
    return dateString;
  }
};

const getStatusLabel = (status: string): string => {
  const s = (status || "").toLowerCase();
  const statusMap: Record<string, string> = {
    pending: "Chờ xử lý",
    processing: "Đang xử lý",
    completed: "Hoàn thành",
    rejected: "Từ chối",
    cancelled: "Đã hủy",
  };
  return statusMap[s] || status;
};

const getStatusBadge = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "completed") {
    return { label: "Hoàn thành", bg: "bg-emerald-50", fg: "text-emerald-700", bd: "border-emerald-200" };
  }
  if (s === "rejected" || s === "cancelled") {
    return { label: "Từ chối/Hủy", bg: "bg-red-50", fg: "text-red-700", bd: "border-red-200" };
  }
  if (s === "processing") {
    return { label: "Đang xử lý", bg: "bg-blue-50", fg: "text-blue-700", bd: "border-blue-200" };
  }
  return { label: "Chờ xử lý", bg: "bg-orange-50", fg: "text-orange-700", bd: "border-orange-200" };
};

export default function AdminSpecifiesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSpecify, setSelectedSpecify] = useState<SpecifyVoteTestResponse | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const sheetBottomInset = useSheetBottomInset();

  const {
    data: specifiesData,
    isLoading,
    error,
    refetch,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<SpecifyVoteTestResponse>({
    queryKey: ["admin-specifies", statusFilter, hospitalFilter],
    queryFn: async (params) => await specifyVoteTestService.getAll(params),
    defaultPageSize: 20,
    enabled: user?.role === "ROLE_ADMIN",
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => specifyVoteTestService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-specifies"] });
      setShowDeleteModal(false);
      setSelectedSpecify(null);
      Alert.alert("Thành công", "Xóa phiếu xét nghiệm thành công");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể xóa phiếu xét nghiệm");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      specifyVoteTestService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-specifies"] });
      Alert.alert("Thành công", "Cập nhật trạng thái thành công");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể cập nhật trạng thái");
    },
  });

  if (user?.role !== "ROLE_ADMIN") {
    return null;
  }

  const specifies = useMemo(() => {
    return specifiesData || [];
  }, [specifiesData]);

  const hospitals = useMemo(() => {
    const hospitalSet = new Set<string>();
    specifies.forEach((specify) => {
      const hospitalName = specify.hospital?.hospitalName;
      if (hospitalName) hospitalSet.add(hospitalName);
    });
    return Array.from(hospitalSet).sort();
  }, [specifies]);

  const filteredSpecifies = useMemo(() => {
    return specifies.filter((specify) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(specify.specifyVoteID || "").toLowerCase().includes(q) ||
        String(specify.patient?.patientName || "").toLowerCase().includes(q) ||
        String(specify.patient?.patientPhone || "").toLowerCase().includes(q) ||
        String(specify.hospital?.hospitalName || "").toLowerCase().includes(q) ||
        String(specify.genomeTest?.testName || "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || specify.specifyStatus?.toLowerCase() === statusFilter.toLowerCase();
      const matchesHospital =
        hospitalFilter === "all" || specify.hospital?.hospitalName === hospitalFilter;

      return matchesSearch && matchesStatus && matchesHospital;
    });
  }, [specifies, searchQuery, statusFilter, hospitalFilter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (hospitalFilter !== "all") count++;
    return count;
  }, [statusFilter, hospitalFilter]);

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
          title: "Quản lý phiếu xét nghiệm",
          headerStyle: { backgroundColor: "#0891b2" },
          headerTintColor: "#fff",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="ml-2">
              <ArrowLeft size={24} color="#fff" />
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
              placeholder="Tìm kiếm phiếu xét nghiệm..."
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
              <Text className="text-xs font-bold text-slate-700 mb-2">Trạng thái</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setStatusFilter("all")}
                    className={`px-3 py-1.5 rounded-full border ${
                      statusFilter === "all"
                        ? "bg-sky-600 border-sky-600"
                        : "bg-white border-sky-200"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        statusFilter === "all" ? "text-white" : "text-slate-600"
                      }`}
                    >
                      Tất cả
                    </Text>
                  </TouchableOpacity>
                  {["pending", "processing", "completed", "rejected"].map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-full border ${
                        statusFilter === status
                          ? "bg-sky-600 border-sky-600"
                          : "bg-white border-sky-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          statusFilter === status ? "text-white" : "text-slate-600"
                        }`}
                      >
                        {getStatusLabel(status)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-2">Bệnh viện</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setHospitalFilter("all")}
                    className={`px-3 py-1.5 rounded-full border ${
                      hospitalFilter === "all"
                        ? "bg-sky-600 border-sky-600"
                        : "bg-white border-sky-200"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        hospitalFilter === "all" ? "text-white" : "text-slate-600"
                      }`}
                    >
                      Tất cả
                    </Text>
                  </TouchableOpacity>
                  {hospitals.map((hospital) => (
                    <TouchableOpacity
                      key={hospital}
                      onPress={() => setHospitalFilter(hospital)}
                      className={`px-3 py-1.5 rounded-full border ${
                        hospitalFilter === hospital
                          ? "bg-sky-600 border-sky-600"
                          : "bg-white border-sky-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          hospitalFilter === hospital ? "text-white" : "text-slate-600"
                        }`}
                      >
                        {hospital}
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
          {filteredSpecifies.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
              <FileText size={48} color="#cbd5e1" />
              <Text className="text-sm font-bold text-slate-500 mt-3 text-center">
                Không tìm thấy phiếu xét nghiệm nào
              </Text>
            </View>
          ) : (
            filteredSpecifies.map((specify) => {
              const statusBadge = getStatusBadge(specify.specifyStatus || "");
              return (
                <TouchableOpacity
                  key={specify.specifyVoteID}
                  onPress={() => {
                    setSelectedSpecify(specify);
                    setShowDetailModal(true);
                  }}
                  className="bg-white rounded-2xl p-4 border border-sky-100"
                  activeOpacity={0.85}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-sm font-extrabold text-slate-900 mb-1">
                        {specify.patient?.patientName || "N/A"}
                      </Text>
                      <Text className="text-xs text-slate-500">
                        ID: {specify.specifyVoteID}
                      </Text>
                    </View>
                    <View
                      className={`px-2 py-1 rounded-lg border ${statusBadge.bg} ${statusBadge.bd}`}
                    >
                      <Text className={`text-[10px] font-bold ${statusBadge.fg}`}>
                        {statusBadge.label}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-2 pt-2 border-t border-sky-50">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-xs text-slate-500">Xét nghiệm:</Text>
                      <Text className="text-xs font-bold text-slate-700 flex-1">
                        {specify.genomeTest?.testName || "N/A"}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-xs text-slate-500">Bệnh viện:</Text>
                      <Text className="text-xs font-bold text-slate-700 flex-1">
                        {specify.hospital?.hospitalName || "N/A"}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-slate-500">Ngày tạo:</Text>
                      <Text className="text-xs font-bold text-slate-700">
                        {formatDate(specify.createdAt)}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-2 mt-3">
                    {specify.specifyStatus !== "completed" && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          if (specify.specifyStatus === "pending") {
                            updateStatusMutation.mutate({
                              id: specify.specifyVoteID,
                              status: "processing",
                            });
                          } else if (specify.specifyStatus === "processing") {
                            updateStatusMutation.mutate({
                              id: specify.specifyVoteID,
                              status: "completed",
                            });
                          }
                        }}
                        className="flex-1 bg-sky-600 py-2 rounded-xl items-center"
                        activeOpacity={0.85}
                      >
                        <Text className="text-white text-xs font-bold">
                          {specify.specifyStatus === "pending" ? "Bắt đầu xử lý" : "Hoàn thành"}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedSpecify(specify);
                        setShowDeleteModal(true);
                      }}
                      className="px-4 py-2 bg-red-50 rounded-xl border border-red-200"
                      activeOpacity={0.85}
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
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
              <Text className="text-lg font-extrabold text-slate-900">Chi tiết phiếu xét nghiệm</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <XCircle size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedSpecify && (
              <ScrollView>
                <View className="gap-4">
                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">ID Phiếu</Text>
                    <Text className="text-sm font-bold text-slate-900">{selectedSpecify.specifyVoteID}</Text>
                  </View>
                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Bệnh nhân</Text>
                    <Text className="text-sm font-bold text-slate-900">
                      {selectedSpecify.patient?.patientName || "N/A"}
                    </Text>
                    <Text className="text-xs text-slate-500">
                      {selectedSpecify.patient?.patientPhone || ""}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Xét nghiệm</Text>
                    <Text className="text-sm font-bold text-slate-900">
                      {selectedSpecify.genomeTest?.testName || "N/A"}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Bệnh viện</Text>
                    <Text className="text-sm font-bold text-slate-900">
                      {selectedSpecify.hospital?.hospitalName || "N/A"}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Bác sĩ</Text>
                    <Text className="text-sm font-bold text-slate-900">
                      {selectedSpecify.doctor?.doctorName || "N/A"}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Trạng thái</Text>
                    <View className={`px-3 py-1.5 rounded-lg border ${getStatusBadge(selectedSpecify.specifyStatus || "").bg} ${getStatusBadge(selectedSpecify.specifyStatus || "").bd} self-start`}>
                      <Text className={`text-xs font-bold ${getStatusBadge(selectedSpecify.specifyStatus || "").fg}`}>
                        {getStatusBadge(selectedSpecify.specifyStatus || "").label}
                      </Text>
                    </View>
                  </View>
                  {selectedSpecify.specifyNote && (
                    <View>
                      <Text className="text-xs font-bold text-slate-500 mb-1">Ghi chú</Text>
                      <Text className="text-sm text-slate-700">{selectedSpecify.specifyNote}</Text>
                    </View>
                  )}
                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Ngày tạo</Text>
                    <Text className="text-sm text-slate-700">
                      {formatDate(selectedSpecify.createdAt)}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
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
              Bạn có chắc chắn muốn xóa phiếu xét nghiệm này? Hành động này không thể hoàn tác.
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
                  if (selectedSpecify) {
                    deleteMutation.mutate(selectedSpecify.specifyVoteID);
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
