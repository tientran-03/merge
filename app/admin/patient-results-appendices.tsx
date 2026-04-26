import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Download, ExternalLink, FileText, Search, X } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "@/contexts/AuthContext";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { patientMetadataService, PatientMetadataResponse } from "@/services/patientMetadataService";
import {
  downloadAndShareTestResultPdf,
  loadMinioContextForPatientMetadata,
  viewTestResultPdfInBrowser,
} from "@/utils/test-result-pdf";

const PATIENT_METADATA_STATUS_LABELS: Record<string, string> = {
  sample_run: "Mẫu khởi chạy",
  sample_waiting_analyze: "Mẫu chờ phân tích",
  sample_in_analyze: "Mẫu đang phân tích",
  sample_completed: "Mẫu hoàn thành",
  sample_error: "Mẫu lỗi",
  sample_added: "Mẫu bổ sung",
  sample_rerun: "Mẫu chạy lại",
};

const getStatusLabel = (status?: string): string => {
  if (!status?.trim()) return "—";
  const key = status.toLowerCase();
  return PATIENT_METADATA_STATUS_LABELS[key] || status;
};

const getStatusPillClass = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "sample_completed")
    return {
      bg: "bg-emerald-500/12",
      text: "text-emerald-700",
      border: "border-emerald-200",
    };
  if (s === "sample_waiting_analyze" || s === "sample_run")
    return {
      bg: "bg-amber-500/12",
      text: "text-amber-700",
      border: "border-amber-200",
    };
  if (s === "sample_in_analyze")
    return {
      bg: "bg-blue-500/12",
      text: "text-blue-700",
      border: "border-blue-200",
    };
  if (s === "sample_error")
    return {
      bg: "bg-red-500/12",
      text: "text-red-700",
      border: "border-red-200",
    };
  if (s === "sample_added" || s === "sample_rerun")
    return {
      bg: "bg-amber-500/12",
      text: "text-amber-700",
      border: "border-amber-200",
    };
  return { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-200" };
};

export default function AdminPatientResultsAppendicesScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && user?.role && user.role !== "ROLE_ADMIN") {
      router.replace("/admin-home");
    }
  }, [authLoading, user, router]);

  const {
    data: metadataList,
    isLoading,
    error,
    refetch,
    isFetching,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<PatientMetadataResponse>({
    queryKey: ["admin-patient-results-appendices"],
    queryFn: async (params) => await patientMetadataService.getAll(params),
    defaultPageSize: 20,
    enabled: user?.role === "ROLE_ADMIN",
  });

  const filtered = useMemo(() => {
    let data = [...metadataList];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      data = data.filter((m) => {
        return (
          (m.labcode || "").toLowerCase().includes(q) ||
          (m.patientId || "").toLowerCase().includes(q) ||
          (m.patientName || "").toLowerCase().includes(q) ||
          (m.specifyId || "").toLowerCase().includes(q) ||
          (m.sampleName || "").toLowerCase().includes(q)
        );
      });
    }
    if (statusFilter !== "all") {
      data = data.filter(
        (m) => (m.status || "").toLowerCase() === statusFilter.toLowerCase()
      );
    }
    return data.sort((a, b) => (b.labcode || "").localeCompare(a.labcode || ""));
  }, [metadataList, searchQuery, statusFilter]);

  const handleView = async (metadata: PatientMetadataResponse) => {
    if (!metadata.testResultPath) {
      Alert.alert("Thông báo", "Mẫu này chưa có file PDF (kết quả / phụ lục).");
      return;
    }
    const ctx = await loadMinioContextForPatientMetadata(metadata);
    await viewTestResultPdfInBrowser(metadata.testResultPath, metadata, ctx);
  };

  const handleDownload = async (metadata: PatientMetadataResponse) => {
    if (!metadata.testResultPath) {
      Alert.alert("Thông báo", "Mẫu này chưa có file PDF (kết quả / phụ lục).");
      return;
    }
    const ctx = await loadMinioContextForPatientMetadata(metadata);
    await downloadAndShareTestResultPdf(metadata.testResultPath, metadata, ctx);
  };

  if (authLoading || !user) {
    return (
      <View className="flex-1 bg-sky-50 items-center justify-center">
        <Text className="text-slate-500 text-sm font-medium">Đang tải...</Text>
      </View>
    );
  }

  if (user.role !== "ROLE_ADMIN") {
    return null;
  }

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 px-4">
        <Text className="text-red-600 text-center font-bold mb-4">
          {error instanceof Error ? error.message : String(error || "Có lỗi xảy ra khi tải dữ liệu")}
        </Text>
        <TouchableOpacity onPress={() => refetch()} className="px-6 py-3 bg-sky-600 rounded-xl">
          <Text className="text-white font-bold">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

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
            <Text className="text-slate-900 text-lg font-extrabold">Kết quả & phụ lục</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Một danh sách mẫu — xem / tải PDF (kết quả xét nghiệm và phụ lục dùng chung file khi đã có)
            </Text>
          </View>
        </View>

        <View
          className={`flex-row items-center px-3 py-2 rounded-xl border mb-3 ${
            focusSearch ? "bg-white border-sky-400" : "bg-sky-50 border-sky-200"
          }`}
        >
          <Search size={18} color="#64748b" />
          <TextInput
            className="flex-1 ml-2 text-slate-900 text-sm"
            placeholder="Tìm theo labcode, BN, phiếu chỉ định..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} className="ml-2" activeOpacity={0.7}>
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => setStatusFilter("all")}
            className={`px-4 py-2 rounded-xl border ${
              statusFilter === "all" ? "bg-sky-600 border-sky-600" : "bg-white border-sky-200"
            }`}
            activeOpacity={0.85}
          >
            <Text className={`text-xs font-bold ${statusFilter === "all" ? "text-white" : "text-slate-600"}`}>
              Tất cả
            </Text>
          </TouchableOpacity>
          {["sample_completed", "sample_in_analyze", "sample_waiting_analyze", "sample_error"].map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl border ${
                statusFilter === status ? "bg-sky-600 border-sky-600" : "bg-white border-sky-200"
              }`}
              activeOpacity={0.85}
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
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#0284C7" />}
      >
        {filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-24 h-24 rounded-full bg-sky-100 items-center justify-center mb-6">
              <FileText size={48} color="#0284C7" />
            </View>
            <Text className="text-slate-900 text-xl font-extrabold mb-2 text-center">
              {searchQuery || statusFilter !== "all" ? "Không tìm thấy" : "Chưa có mẫu"}
            </Text>
            <Text className="text-slate-500 text-sm text-center px-4">
              {searchQuery || statusFilter !== "all"
                ? "Không có mẫu nào khớp bộ lọc."
                : "Chưa có dữ liệu metadata mẫu."}
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-slate-600 text-sm font-bold mb-3">
              Hiển thị {filtered.length} mẫu{totalElements ? ` (trang ${currentPage + 1}/${Math.max(1, totalPages)})` : ""}
            </Text>

            {filtered.map((metadata) => {
              const statusPill = getStatusPillClass(metadata.status);
              const hasFile = Boolean(metadata.testResultPath?.trim());
              return (
                <View key={metadata.labcode} className="bg-white rounded-xl p-4 mb-3 border border-sky-100">
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-slate-900 font-extrabold text-base mb-1">
                        {metadata.labcode || "—"}
                      </Text>
                      {!!metadata.patientName && (
                        <Text className="text-slate-600 text-sm mb-1">BN: {metadata.patientName}</Text>
                      )}
                      {!!metadata.patientId && (
                        <Text className="text-slate-500 text-xs mb-1">Mã BN: {metadata.patientId}</Text>
                      )}
                      {!!metadata.specifyId && (
                        <Text className="text-slate-500 text-xs mb-1">Phiếu: {metadata.specifyId}</Text>
                      )}
                      {!!metadata.sampleName && (
                        <Text className="text-slate-500 text-xs">Mẫu: {metadata.sampleName}</Text>
                      )}
                    </View>
                    {!!metadata.status && (
                      <View className={`ml-2 px-2 py-1 rounded-lg border ${statusPill.bg} ${statusPill.border}`}>
                        <Text className={`text-xs font-bold ${statusPill.text}`}>
                          {getStatusLabel(metadata.status)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-sky-100">
                    {hasFile ? (
                      <>
                        <Text className="text-emerald-600 text-xs font-bold shrink pr-2">
                          Có PDF (KQ / phụ lục)
                        </Text>
                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            onPress={() => void handleView(metadata)}
                            className="flex-row items-center px-3 py-2 rounded-lg bg-sky-50 border border-sky-200"
                            activeOpacity={0.85}
                          >
                            <ExternalLink size={14} color="#0369a1" />
                            <Text className="text-sky-800 text-xs font-bold ml-1">Xem</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => void handleDownload(metadata)}
                            className="flex-row items-center px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200"
                            activeOpacity={0.85}
                          >
                            <Download size={14} color="#047857" />
                            <Text className="text-emerald-800 text-xs font-bold ml-1">Tải PDF</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <Text className="text-slate-400 text-xs">Chưa có PDF (kết quả / phụ lục)</Text>
                    )}
                  </View>
                </View>
              );
            })}

            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalElements={totalElements}
                pageSize={pageSize}
                onPageChange={goToPage}
                isLoading={isFetching}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
