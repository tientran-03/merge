import { Stack, useRouter } from "expo-router";
import {
  Search,
  ArrowLeft,
  FileText,
  Filter,
  Calendar,
  User,
  Building2,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Clock,
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
  RefreshControl,
  Modal,
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
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleString("vi-VN");
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

export default function AdminTestResultsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SpecifyVoteTestResponse | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
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
    queryKey: ["admin-test-results"],
    queryFn: async (params) => {
      const response = await specifyVoteTestService.getAll(params);
      return response;
    },
    defaultPageSize: 20,
    enabled: user?.role === "ROLE_ADMIN",
  });

  if (user?.role !== "ROLE_ADMIN") {
    return null;
  }

  const specifies = useMemo(() => {
    return specifiesData || [];
  }, [specifiesData]);

  // Danh sách kết quả (hiện tất cả trạng thái để đảm bảo không bị lọc mất dữ liệu)
  const results = useMemo(() => {
    return specifies;
  }, [specifies]);

  const hospitals = useMemo(() => {
    const hospitalSet = new Set<string>();
    results.forEach((result) => {
      const hospitalName = result.hospital?.hospitalName;
      if (hospitalName) hospitalSet.add(hospitalName);
    });
    return Array.from(hospitalSet).sort();
  }, [results]);

  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(result.specifyVoteID || "").toLowerCase().includes(q) ||
        String(result.patient?.patientName || "").toLowerCase().includes(q) ||
        String(result.patient?.patientPhone || "").toLowerCase().includes(q) ||
        String(result.hospital?.hospitalName || "").toLowerCase().includes(q) ||
        String(result.genomeTest?.testName || "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || result.specifyStatus?.toLowerCase() === statusFilter.toLowerCase();
      const matchesHospital =
        hospitalFilter === "all" || result.hospital?.hospitalName === hospitalFilter;

      return matchesSearch && matchesStatus && matchesHospital;
    });
  }, [results, searchQuery, statusFilter, hospitalFilter]);

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
          title: "Kết quả xét nghiệm",
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
              placeholder="Tìm kiếm kết quả xét nghiệm..."
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
                  {["processing", "completed"].map((status) => (
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

      {/* Summary Stats */}
      <View className="bg-white px-4 py-3 border-b border-sky-100">
        <View className="flex-row gap-3">
          <View className="flex-1 bg-sky-50 rounded-xl p-3 border border-sky-200">
            <Text className="text-xs font-bold text-slate-500 mb-1">Tổng kết quả</Text>
            <Text className="text-lg font-extrabold text-slate-900">{filteredResults.length}</Text>
          </View>
          <View className="flex-1 bg-emerald-50 rounded-xl p-3 border border-emerald-200">
            <Text className="text-xs font-bold text-slate-500 mb-1">Đã hoàn thành</Text>
            <Text className="text-lg font-extrabold text-slate-900">
              {filteredResults.filter((r) => r.specifyStatus?.toLowerCase() === "completed").length}
            </Text>
          </View>
          <View className="flex-1 bg-blue-50 rounded-xl p-3 border border-blue-200">
            <Text className="text-xs font-bold text-slate-500 mb-1">Đang xử lý</Text>
            <Text className="text-lg font-extrabold text-slate-900">
              {filteredResults.filter((r) => r.specifyStatus?.toLowerCase() === "processing").length}
            </Text>
          </View>
        </View>
      </View>

      {/* List */}
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        <View className="p-4 gap-3">
          {filteredResults.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
              <FileText size={48} color="#cbd5e1" />
              <Text className="text-sm font-bold text-slate-500 mt-3 text-center">
                Không tìm thấy kết quả xét nghiệm nào
              </Text>
            </View>
          ) : (
            filteredResults.map((result) => {
              const statusBadge = getStatusBadge(result.specifyStatus || "");
              return (
                <TouchableOpacity
                  key={result.specifyVoteID}
                  onPress={() => {
                    setSelectedResult(result);
                    setShowDetailModal(true);
                  }}
                  className="bg-white rounded-2xl p-4 border border-sky-100"
                  activeOpacity={0.85}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <User size={16} color="#64748b" />
                        <Text className="text-sm font-extrabold text-slate-900">
                          {result.patient?.patientName || "N/A"}
                        </Text>
                      </View>
                      <Text className="text-xs text-slate-500">
                        ID: {result.specifyVoteID}
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
                    <View className="flex-row items-center gap-2 mb-2">
                      <FlaskConical size={14} color="#64748b" />
                      <Text className="text-xs text-slate-500">Xét nghiệm:</Text>
                      <Text className="text-xs font-bold text-slate-700 flex-1">
                        {result.genomeTest?.testName || "N/A"}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2 mb-2">
                      <Building2 size={14} color="#64748b" />
                      <Text className="text-xs text-slate-500">Bệnh viện:</Text>
                      <Text className="text-xs font-bold text-slate-700 flex-1">
                        {result.hospital?.hospitalName || "N/A"}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Calendar size={14} color="#64748b" />
                      <Text className="text-xs text-slate-500">Ngày tạo:</Text>
                      <Text className="text-xs font-bold text-slate-700">
                        {formatDate(result.createdAt)}
                      </Text>
                    </View>
                    {result.sampleCollectDate && (
                      <View className="flex-row items-center gap-2 mt-1">
                        <Calendar size={14} color="#64748b" />
                        <Text className="text-xs text-slate-500">Ngày lấy mẫu:</Text>
                        <Text className="text-xs font-bold text-slate-700">
                          {formatDate(result.sampleCollectDate)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {result.geneticTestResults && (
                    <View className="mt-2 pt-2 border-t border-sky-50">
                      <Text className="text-xs font-bold text-slate-700 mb-1">Kết quả:</Text>
                      <Text className="text-xs text-slate-600" numberOfLines={2}>
                        {result.geneticTestResults}
                      </Text>
                    </View>
                  )}
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
              <Text className="text-lg font-extrabold text-slate-900">Chi tiết kết quả xét nghiệm</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <XCircle size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedResult && (
              <ScrollView>
                <View className="gap-4">
                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">ID Phiếu</Text>
                    <Text className="text-sm font-bold text-slate-900">{selectedResult.specifyVoteID}</Text>
                  </View>

                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Bệnh nhân</Text>
                    <Text className="text-sm font-bold text-slate-900">
                      {selectedResult.patient?.patientName || "N/A"}
                    </Text>
                    <Text className="text-xs text-slate-500">
                      {selectedResult.patient?.patientPhone || ""}
                    </Text>
                    {selectedResult.patient?.patientDob && (
                      <Text className="text-xs text-slate-500">
                        Ngày sinh: {formatDate(selectedResult.patient.patientDob)}
                      </Text>
                    )}
                    {selectedResult.patient?.gender && (
                      <Text className="text-xs text-slate-500">
                        Giới tính: {selectedResult.patient.gender}
                      </Text>
                    )}
                  </View>

                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Xét nghiệm</Text>
                    <Text className="text-sm font-bold text-slate-900">
                      {selectedResult.genomeTest?.testName || "N/A"}
                    </Text>
                    {selectedResult.genomeTest?.testDescription && (
                      <Text className="text-xs text-slate-600 mt-1">
                        {selectedResult.genomeTest.testDescription}
                      </Text>
                    )}
                  </View>

                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Bệnh viện</Text>
                    <Text className="text-sm font-bold text-slate-900">
                      {selectedResult.hospital?.hospitalName || "N/A"}
                    </Text>
                  </View>

                  {selectedResult.doctor?.doctorName && (
                    <View>
                      <Text className="text-xs font-bold text-slate-500 mb-1">Bác sĩ</Text>
                      <Text className="text-sm font-bold text-slate-900">
                        {selectedResult.doctor.doctorName}
                      </Text>
                    </View>
                  )}

                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Trạng thái</Text>
                    <View
                      className={`px-3 py-1.5 rounded-lg border ${getStatusBadge(selectedResult.specifyStatus || "").bg} ${getStatusBadge(selectedResult.specifyStatus || "").bd} self-start`}
                    >
                      <Text
                        className={`text-xs font-bold ${getStatusBadge(selectedResult.specifyStatus || "").fg}`}
                      >
                        {getStatusBadge(selectedResult.specifyStatus || "").label}
                      </Text>
                    </View>
                  </View>

                  {selectedResult.sampleCollectDate && (
                    <View>
                      <Text className="text-xs font-bold text-slate-500 mb-1">Ngày lấy mẫu</Text>
                      <Text className="text-sm text-slate-700">
                        {formatDate(selectedResult.sampleCollectDate)}
                      </Text>
                    </View>
                  )}

                  {selectedResult.samplingSite && (
                    <View>
                      <Text className="text-xs font-bold text-slate-500 mb-1">Địa điểm lấy mẫu</Text>
                      <Text className="text-sm text-slate-700">{selectedResult.samplingSite}</Text>
                    </View>
                  )}

                  {selectedResult.geneticTestResults && (
                    <View>
                      <Text className="text-xs font-bold text-slate-500 mb-1">Kết quả xét nghiệm</Text>
                      <View className="bg-sky-50 rounded-xl p-3 border border-sky-200">
                        <Text className="text-sm text-slate-700">{selectedResult.geneticTestResults}</Text>
                      </View>
                    </View>
                  )}

                  {selectedResult.geneticTestResultsRelationship && (
                    <View>
                      <Text className="text-xs font-bold text-slate-500 mb-1">Mối quan hệ</Text>
                      <Text className="text-sm text-slate-700">
                        {selectedResult.geneticTestResultsRelationship}
                      </Text>
                    </View>
                  )}

                  {selectedResult.specifyNote && (
                    <View>
                      <Text className="text-xs font-bold text-slate-500 mb-1">Ghi chú</Text>
                      <Text className="text-sm text-slate-700">{selectedResult.specifyNote}</Text>
                    </View>
                  )}

                  <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1">Ngày tạo</Text>
                    <Text className="text-sm text-slate-700">
                      {formatDateTime(selectedResult.createdAt)}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
