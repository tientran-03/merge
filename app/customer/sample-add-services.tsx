import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Beaker, Search, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { MEDICAL } from "@/lib/theme/medical";
import { getApiResponseData } from "@/lib/types/api-types";
import {
  SampleAddServiceCatalogResponse,
  sampleAddServiceCatalogService,
} from "@/services/sampleAddServiceCatalogService";

const formatCurrencyVnd = (amount?: number) => {
  if (amount == null || Number.isNaN(amount)) return "-";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

export default function CustomerSampleAddServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);

  const {
    data: servicesResponse,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["sample-add-services-catalog"],
    queryFn: () => sampleAddServiceCatalogService.getAll(),
    retry: false,
  });

  const services = useMemo(() => {
    return getApiResponseData<SampleAddServiceCatalogResponse>(servicesResponse) || [];
  }, [servicesResponse]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return services;
    return services.filter(
      (s) =>
        String(s.sampleName || "").toLowerCase().includes(q) ||
        String(s.id || "").toLowerCase().includes(q)
    );
  }, [services, searchQuery]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-100" edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center px-6">
          <ActivityIndicator size="large" color={MEDICAL.primary} />
          <Text className="mt-3 text-sm font-bold text-slate-500">Đang tải danh sách dịch vụ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-100" edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center px-6">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-red-50">
            <Beaker size={32} color="#dc2626" />
          </View>
          <Text className="text-center text-lg font-extrabold text-slate-900">Không tải được dữ liệu</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
            Kiểm tra kết nối mạng rồi thử lại.
          </Text>
          <TouchableOpacity
            className="mt-8 rounded-2xl bg-sky-600 px-8 py-3.5"
            onPress={() => refetch()}
            activeOpacity={0.88}
          >
            <Text className="text-base font-extrabold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-100" edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <View className="border-b border-slate-200 bg-white px-4 pb-4 pt-2 shadow-sm shadow-slate-200/50">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 active:bg-sky-100"
          accessibilityLabel="Quay lại"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={20} color={MEDICAL.primary} />
        </TouchableOpacity>

        <View
          className={`mt-3 flex-row items-center rounded-2xl border bg-slate-50 px-3 py-0.5 ${focusSearch ? "border-sky-400 bg-sky-50" : "border-slate-200"
            }`}
        >
          <Search size={20} color="#64748b" />
          <TextInput
            className="ml-2 flex-1 py-3 text-[15px] font-semibold text-slate-900"
            placeholder="Tìm theo tên dịch vụ..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
            returnKeyType="search"
          />
          {searchQuery.trim() ? (
            <TouchableOpacity
              className="h-8 w-8 items-center justify-center rounded-xl active:bg-slate-200"
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 28 + Math.max(insets.bottom, 12),
        }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={MEDICAL.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <View className="items-center rounded-2xl border border-slate-200 bg-white px-6 py-14 shadow-sm">
            <Beaker size={48} color="#cbd5e1" />
            <Text className="mt-4 text-center text-base font-extrabold text-slate-700">
              {searchQuery.trim() ? "Không tìm thấy dịch vụ" : "Chưa có dịch vụ"}
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
              {searchQuery.trim()
                ? "Thử từ khóa khác hoặc xóa ô tìm kiếm."
                : "Danh sách sẽ được cập nhật khi có dịch vụ mới."}
            </Text>
          </View>
        ) : (
          filtered.map((s) => (
            <View
              key={s.id}
              className="mb-4 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm shadow-slate-300/40"
              style={{ elevation: 2 }}
            >
              <View className="border-l-4 border-sky-500 px-4 py-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                      Dịch vụ
                    </Text>
                    <Text className="mt-1 text-[16px] font-extrabold leading-5 text-slate-900">
                      {s.sampleName || "N/A"}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      Tổng
                    </Text>
                    <Text className="mt-0.5 text-[17px] font-extrabold text-emerald-700">
                      {formatCurrencyVnd(s.finalPrice ?? s.price)}
                    </Text>
                  </View>
                </View>

                <View className="mt-4 rounded-xl bg-slate-50 px-3 py-3">
                  <View className="flex-row justify-between">
                    <Text className="text-[13px] text-slate-500">Giá gốc</Text>
                    <Text className="text-[13px] font-semibold text-slate-800">
                      {formatCurrencyVnd(s.price)}
                    </Text>
                  </View>
                  {s.taxRate != null && s.taxRate > 0 ? (
                    <View className="mt-2 flex-row justify-between">
                      <Text className="text-[13px] text-slate-500">Thuế ({s.taxRate}%)</Text>
                      <Text className="text-[13px] font-semibold text-slate-800">
                        {formatCurrencyVnd(((s.price ?? 0) * s.taxRate) / 100)}
                      </Text>
                    </View>
                  ) : (
                    <Text className="mt-2 text-[12px] text-slate-400">Không áp dụng thuế (0%)</Text>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
