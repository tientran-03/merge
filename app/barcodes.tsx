import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { ArrowLeft, Plus, Search, X } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PaginationControls } from "@/components/PaginationControls";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { barcodeService, BarcodeResponse } from "@/services/barcodeService";

// Đồng bộ với web: BarcodeStatusValues (created, not_printed, printed)
const BARCODE_STATUS_LABELS: Record<string, { label: string; pillClass: string }> = {
  created: {
    label: "Đã tạo",
    pillClass: "bg-blue-100 border-blue-200 text-blue-700",
  },
  not_printed: {
    label: "Chưa in",
    pillClass: "bg-amber-100 border-amber-200 text-amber-700",
  },
  printed: {
    label: "Đã in",
    pillClass: "bg-emerald-100 border-emerald-200 text-emerald-700",
  },
};

const getStatusLabel = (status?: string) => {
  if (!status) return "Không rõ";
  const key = status.toLowerCase();
  return BARCODE_STATUS_LABELS[key]?.label || status;
};

const getStatusPillClass = (status?: string) => {
  const key = (status || "").toLowerCase();
  return (
    BARCODE_STATUS_LABELS[key]?.pillClass ||
    "bg-slate-500/10 border-slate-200 text-slate-600"
  );
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("vi-VN");
  } catch {
    return value;
  }
};

export default function BarcodesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchQuantity, setBatchQuantity] = useState("10");

  const createOneMutation = useMutation({
    mutationFn: () => barcodeService.create(),
    onSuccess: (resp) => {
      if (!resp.success) {
        Alert.alert("Lỗi", resp.error || "Không thể tạo barcode mới");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      refetch();
      Alert.alert("Thành công", `Đã tạo barcode: ${resp.data?.barcode || ""}`.trim());
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể tạo barcode mới");
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: (quantity: number) => barcodeService.createBatch(quantity),
    onSuccess: (resp, quantity) => {
      if (!resp.success) {
        Alert.alert("Lỗi", resp.error || "Không thể tạo nhiều barcode");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      refetch();
      setShowBatchModal(false);
      Alert.alert("Thành công", `Đã tạo ${resp.data?.length ?? quantity} barcode`);
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể tạo nhiều barcode");
    },
  });

  const {
    data: barcodes,
    isLoading,
    error,
    refetch,
    isFetching,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<BarcodeResponse>({
    queryKey: ["barcodes", statusFilter],
    queryFn: async () => {
      if (statusFilter !== "all") {
        const resp = await barcodeService.getByStatus(statusFilter);
        if (!resp.success) {
          throw new Error(resp.error || "Không thể tải danh sách barcode");
        }
        return {
          success: true,
          data: Array.isArray(resp.data) ? resp.data : [],
        };
      }

      const resp = await barcodeService.getAll();
      if (!resp.success) {
        throw new Error(resp.error || "Không thể tải danh sách barcode");
      }
      return {
        success: true,
        data: Array.isArray(resp.data) ? resp.data : [],
      };
    },
    defaultPageSize: 20,
  });

  const filtered = useMemo(() => {
    let data = [...barcodes];

    // Search by barcode
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      data = data.filter((b) => (b.barcode || "").toLowerCase().includes(q));
    }

    // Show newest first
    return data.reverse();
  }, [barcodes, searchQuery]);

  const handleCreateOne = () => {
    Alert.alert("Tạo barcode", "Bạn muốn tạo 1 mã barcode mới?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Tạo",
        onPress: () => createOneMutation.mutate(),
      },
    ]);
  };

  const handleCreateBatch = () => {
    const quantity = Number(batchQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      Alert.alert("Lỗi", "Số lượng phải là số nguyên từ 1 đến 1000");
      return;
    }
    createBatchMutation.mutate(quantity);
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">
          Đang tải dữ liệu...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 px-4">
        <Text className="text-red-600 text-center font-bold">
          Có lỗi xảy ra khi tải dữ liệu
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 px-6 py-3 bg-sky-600 rounded-xl"
          activeOpacity={0.85}
        >
          <Text className="text-white font-bold">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#0284C7" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">
              Quản lý barcode
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {filtered.length} mã
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleCreateOne}
              disabled={createOneMutation.isPending || createBatchMutation.isPending}
              className="px-3 py-2 rounded-xl bg-sky-600 items-center justify-center"
              activeOpacity={0.8}
            >
              {createOneMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View className="flex-row items-center">
                  <Plus size={14} color="#fff" />
                  <Text className="text-white text-xs font-extrabold ml-1">Thêm mới</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowBatchModal(true)}
              disabled={createOneMutation.isPending || createBatchMutation.isPending}
              className="px-3 py-2 rounded-xl bg-emerald-600 items-center justify-center"
              activeOpacity={0.8}
            >
              <Text className="text-white text-xs font-extrabold">Thêm nhiều</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View className="mt-3 h-11 rounded-2xl flex-row items-center px-3 border border-slate-200 bg-slate-50">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 ml-3 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm kiếm theo mã barcode..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              activeOpacity={0.7}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter */}
        <View className="mt-3 flex-row flex-wrap gap-2">
          {[
            { value: "all", label: "Tất cả" },
            { value: "created", label: "Đã tạo" },
            { value: "not_printed", label: "Chưa in" },
            { value: "printed", label: "Đã in" },
          ].map((status) => (
            <TouchableOpacity
              key={status.value}
              onPress={() => setStatusFilter(status.value)}
              className={`px-3 py-1.5 rounded-xl border ${
                statusFilter === status.value
                  ? "bg-sky-600 border-sky-600"
                  : "bg-white border-slate-200"
              }`}
              activeOpacity={0.8}
            >
              <Text
                className={`text-xs font-extrabold ${
                  statusFilter === status.value ? "text-white" : "text-slate-700"
                }`}
              >
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Barcode list */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor="#0284C7"
          />
        }
      >
        {filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="mt-4 text-slate-500 text-base font-semibold">
              {searchQuery || statusFilter !== "all"
                ? "Không tìm thấy barcode phù hợp"
                : "Chưa có barcode nào"}
            </Text>
          </View>
        ) : (
          filtered.map((barcode) => {
            const pillClass = getStatusPillClass(barcode.status);
            return (
              <View
                key={barcode.barcode}
                className="bg-white rounded-2xl border border-sky-100 p-4 mb-3"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <Text className="text-slate-900 text-base font-extrabold">
                      {barcode.barcode}
                    </Text>
                    <Text className="mt-1 text-xs text-slate-500 font-semibold">
                      Ngày tạo: {formatDate(barcode.createAt)}
                    </Text>
                    {barcode.usedAt && (
                      <Text className="mt-1 text-xs text-slate-500 font-semibold">
                        Ngày sử dụng: {formatDate(barcode.usedAt)}
                      </Text>
                    )}
                  </View>
                  <View
                    className={`px-3 py-1 rounded-xl border ${pillClass}`}
                  >
                    <Text className="text-xs font-extrabold">
                      {getStatusLabel(barcode.status)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
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

      <Modal
        visible={showBatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBatchModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-3xl p-6 w-full max-w-[380px]">
            <Text className="text-lg font-extrabold text-slate-900 mb-2">
              Thêm nhiều barcode
            </Text>
            <Text className="text-xs text-slate-500 mb-4">
              Nhập số lượng cần tạo (1 - 1000)
            </Text>
            <TextInput
              className="h-11 rounded-xl px-3 bg-slate-50 border border-slate-200 text-sm text-slate-900 font-semibold"
              keyboardType="number-pad"
              value={batchQuantity}
              onChangeText={setBatchQuantity}
              placeholder="Ví dụ: 100"
              placeholderTextColor="#94A3B8"
            />
            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-slate-100 items-center"
                onPress={() => setShowBatchModal(false)}
                activeOpacity={0.85}
                disabled={createBatchMutation.isPending}
              >
                <Text className="text-slate-700 text-sm font-extrabold">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-emerald-600 items-center"
                onPress={handleCreateBatch}
                activeOpacity={0.85}
                disabled={createBatchMutation.isPending}
              >
                {createBatchMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white text-sm font-extrabold">Tạo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

