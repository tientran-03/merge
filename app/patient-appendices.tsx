import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Download, ExternalLink, FileText, Search, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PaginationControls } from "@/components/PaginationControls";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { patientMetadataService, PatientMetadataResponse } from "@/services/patientMetadataService";
import {
  downloadAndShareTestResultPdf,
  loadMinioContextForPatientMetadata,
  viewTestResultPdfInBrowser,
} from "@/utils/test-result-pdf";

const formatDate = (dateString?: string): string => {
  if (!dateString) return "-";
  try {
    return new Date(dateString).toLocaleDateString("vi-VN");
  } catch {
    return dateString;
  }
};

export default function PatientAppendicesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);

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
    queryKey: ["patient-appendices-metadata"],
    queryFn: async (params) => await patientMetadataService.getAll(params),
    defaultPageSize: 20,
  });

  const filtered = useMemo(() => {
    let data = [...metadataList];
    
    // Search filter
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

    return data.sort((a, b) => {
      // Sort by labcode
      return (b.labcode || "").localeCompare(a.labcode || "");
    });
  }, [metadataList, searchQuery]);

  const handleViewResult = async (metadata: PatientMetadataResponse) => {
    if (!metadata.testResultPath) {
      Alert.alert("Thông báo", "Mẫu này chưa có kết quả xét nghiệm.");
      return;
    }
    const ctx = await loadMinioContextForPatientMetadata(metadata);
    await viewTestResultPdfInBrowser(metadata.testResultPath, metadata, ctx);
  };

  const handleDownloadResult = async (metadata: PatientMetadataResponse) => {
    if (!metadata.testResultPath) {
      Alert.alert("Thông báo", "Mẫu này chưa có kết quả xét nghiệm.");
      return;
    }
    const ctx = await loadMinioContextForPatientMetadata(metadata);
    await downloadAndShareTestResultPdf(metadata.testResultPath, metadata, ctx);
  };

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
        <TouchableOpacity
          onPress={() => refetch()}
          className="px-6 py-3 bg-sky-600 rounded-xl"
        >
          <Text className="text-white font-bold">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
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
            <Text className="text-slate-900 text-lg font-extrabold">Phụ lục bệnh nhân</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Quản lý phụ lục kết quả xét nghiệm
            </Text>
          </View>
        </View>

        {/* Search */}
        <View
          className={`flex-row items-center px-3 py-2 rounded-xl border ${
            focusSearch
              ? "bg-white border-sky-400"
              : "bg-sky-50 border-sky-200"
          }`}
        >
          <Search size={18} color="#64748b" />
          <TextInput
            className="flex-1 ml-2 text-slate-900 text-sm"
            placeholder="Tìm kiếm theo mã lab, bệnh nhân, phiếu chỉ định..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              className="ml-2"
              activeOpacity={0.7}
            >
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} />
        }
      >
        {filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-24 h-24 rounded-full bg-sky-100 items-center justify-center mb-6">
              <FileText size={48} color="#0284C7" />
            </View>
            <Text className="text-slate-900 text-xl font-extrabold mb-2 text-center">
              {searchQuery ? "Không tìm thấy" : "Chưa có phụ lục"}
            </Text>
            <Text className="text-slate-500 text-sm text-center px-4">
              {searchQuery
                ? "Không có phụ lục nào khớp với từ khóa tìm kiếm."
                : "Chưa có phụ lục bệnh nhân nào được tải lên."}
            </Text>
          </View>
        ) : (
          <>
            <View className="mb-4">
              <Text className="text-slate-600 text-sm font-bold">
                Tổng cộng: {filtered.length} phụ lục
              </Text>
            </View>

            {filtered.map((metadata) => (
              <View
                key={metadata.labcode}
                className="bg-white rounded-xl p-4 mb-3 border border-sky-100"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <Text className="text-slate-900 font-extrabold text-base mb-1">
                      {metadata.labcode || "Không có mã"}
                    </Text>
                    {metadata.patientName && (
                      <Text className="text-slate-600 text-sm mb-1">
                        Bệnh nhân: {metadata.patientName}
                      </Text>
                    )}
                    {metadata.patientId && (
                      <Text className="text-slate-500 text-xs mb-1">
                        Mã BN: {metadata.patientId}
                      </Text>
                    )}
                    {metadata.specifyId && (
                      <Text className="text-slate-500 text-xs mb-1">
                        Phiếu chỉ định: {metadata.specifyId}
                      </Text>
                    )}
                    {metadata.sampleName && (
                      <Text className="text-slate-500 text-xs mb-1">
                        Tên mẫu: {metadata.sampleName}
                      </Text>
                    )}
                  </View>
                  {metadata.status && (
                    <View className="ml-2 px-2 py-1 bg-sky-100 rounded-lg">
                      <Text className="text-sky-700 text-xs font-bold">
                        {metadata.status}
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-sky-100">
                  {metadata.testResultPath ? (
                    <>
                      <Text className="text-emerald-600 text-xs font-bold">✓ Có kết quả</Text>
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => void handleViewResult(metadata)}
                          className="flex-row items-center px-3 py-2 rounded-lg bg-sky-50 border border-sky-200"
                          activeOpacity={0.85}
                        >
                          <ExternalLink size={14} color="#0369a1" />
                          <Text className="text-sky-800 text-xs font-bold ml-1">Xem</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => void handleDownloadResult(metadata)}
                          className="flex-row items-center px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200"
                          activeOpacity={0.85}
                        >
                          <Download size={14} color="#047857" />
                          <Text className="text-emerald-800 text-xs font-bold ml-1">Tải PDF</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <Text className="text-slate-400 text-xs">Chưa có kết quả</Text>
                  )}
                </View>
              </View>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalElements={totalElements}
                pageSize={pageSize}
                onPageChange={goToPage}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
