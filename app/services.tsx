import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, FlaskConical, Plus, Search, Tag, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PaginationControls } from "@/components/PaginationControls";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { GenomeTestResponse, genomeTestService } from "@/services/genomeTestService";
import { SERVICE_TYPE_MAPPER } from "@/lib/schemas/order-schemas";
import { getApiResponseData } from "@/lib/types/api-types";
import { ServiceResponse, serviceService } from "@/services/serviceService";

const formatVnd = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  try {
    return `${new Intl.NumberFormat("vi-VN").format(value)} VNĐ`;
  } catch {
    return `${value} VNĐ`;
  }
};

export default function ServicesScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const { data: servicesResp } = useQuery({
    queryKey: ["services"],
    queryFn: () => serviceService.getAll(),
  });

  const services: ServiceResponse[] = useMemo(() => {
    return getApiResponseData<ServiceResponse>(servicesResp) || [];
  }, [servicesResp]);

  const groupIds = useMemo(() => {
    const byName = new Map<string, string>();
    services.forEach((s) => {
      if (s?.name && s?.serviceId) byName.set(String(s.name).toLowerCase(), String(s.serviceId));
    });
    return {
      embryo: byName.get("embryo") || "EMBRYO",
      disease: byName.get("disease") || "DISEASE",
      reproduction: byName.get("reproduction") || "REPRODUCTION",
    };
  }, [services]);

  const {
    data: tests,
    isLoading,
    error,
    refetch,
    isFetching,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<GenomeTestResponse>({
    queryKey: ["genome-tests", selectedServiceId ?? "all"],
    queryFn: async (params) =>
      selectedServiceId
        ? await genomeTestService.getByServiceId(selectedServiceId, params)
        : await genomeTestService.getAll(params),
    defaultPageSize: 20,
  });

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return tests;
    return tests.filter((t) => {
      const testId = (t.testId || "").toLowerCase();
      const testName = (t.testName || "").toLowerCase();
      const code = ((t as any).code || "").toString().toLowerCase();
      const serviceName = (t.service?.name || "").toLowerCase();
      const samples = (t.testSample || []).join(" ").toLowerCase();
      return (
        testId.includes(key) ||
        testName.includes(key) ||
        code.includes(key) ||
        serviceName.includes(key) ||
        samples.includes(key)
      );
    });
  }, [tests, q]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="pt-14 pb-3 px-4 bg-white border-b border-sky-100">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>
            <Text className="text-slate-900 text-lg font-extrabold">Dịch vụ</Text>
          </View>
        </View>

        <View className="flex-1 justify-center items-center px-5">
          <Text className="text-slate-900 text-base font-extrabold mb-2">
            Không tải được dữ liệu
          </Text>
          <TouchableOpacity
            className="bg-sky-600 px-6 py-3 rounded-2xl"
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
      <Stack.Screen options={{ headerShown: false }} />

      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-slate-900 text-lg font-extrabold">Dịch vụ</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                {filtered.length} xét nghiệm
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/create-genome-test")}
            className="flex-row items-center px-3 py-2 rounded-xl bg-sky-600"
            activeOpacity={0.85}
          >
            <Plus size={18} color="#fff" />
            <Text className="ml-1.5 text-white text-sm font-extrabold">Thêm dịch vụ</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-3 flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm theo mã, tên, code, nhóm, mẫu…"
            placeholderTextColor="#94A3B8"
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
          />
          {!!q.trim() && (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center"
              onPress={() => setQ("")}
              activeOpacity={0.75}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter: chọn 1 trong 3 nhóm dịch vụ */}
        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            onPress={() => setSelectedServiceId(groupIds.reproduction)}
            className={`px-3 py-2 rounded-xl border ${
              selectedServiceId === groupIds.reproduction
                ? "bg-sky-600 border-sky-600"
                : "bg-sky-50 border-sky-200"
            }`}
            activeOpacity={0.85}
          >
            <Text
              className={`text-xs font-extrabold ${
                selectedServiceId === groupIds.reproduction ? "text-white" : "text-sky-700"
              }`}
            >
              {SERVICE_TYPE_MAPPER["reproduction"]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedServiceId(groupIds.disease)}
            className={`px-3 py-2 rounded-xl border ${
              selectedServiceId === groupIds.disease
                ? "bg-sky-600 border-sky-600"
                : "bg-sky-50 border-sky-200"
            }`}
            activeOpacity={0.85}
          >
            <Text
              className={`text-xs font-extrabold ${
                selectedServiceId === groupIds.disease ? "text-white" : "text-sky-700"
              }`}
            >
              {SERVICE_TYPE_MAPPER["disease"]}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedServiceId(groupIds.embryo)}
            className={`px-3 py-2 rounded-xl border ${
              selectedServiceId === groupIds.embryo
                ? "bg-sky-600 border-sky-600"
                : "bg-sky-50 border-sky-200"
            }`}
            activeOpacity={0.85}
          >
            <Text
              className={`text-xs font-extrabold ${
                selectedServiceId === groupIds.embryo ? "text-white" : "text-sky-700"
              }`}
            >
              {SERVICE_TYPE_MAPPER["embryo"]}
            </Text>
          </TouchableOpacity>

          {selectedServiceId ? (
            <TouchableOpacity
              onPress={() => setSelectedServiceId(null)}
              className="ml-auto px-3 py-2 rounded-xl bg-slate-100 border border-slate-200"
              activeOpacity={0.85}
            >
              <Text className="text-xs font-extrabold text-slate-700">Tất cả</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.testId}
        contentContainerStyle={{ padding: 16, paddingBottom: totalPages > 1 ? 80 : 20 }}
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor="#0284C7"
          />
        }
        ListEmptyComponent={
          <View className="pt-10 items-center px-6">
            <Text className="text-base font-extrabold text-slate-900">
              {q.trim() ? "Không có kết quả" : "Chưa có dữ liệu"}
            </Text>
            <Text className="mt-2 text-xs font-bold text-slate-500 text-center">
              {q.trim() ? "Thử từ khóa khác." : "Danh sách xét nghiệm sẽ hiển thị ở đây."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const code = ((item as any).code || "").toString();
          const price = item.price;
          const taxRate = (item as any).taxRate as number | undefined;
          const finalPrice = (item as any).finalPrice as number | undefined;
          const serviceLabel = item.service?.name
            ? SERVICE_TYPE_MAPPER[item.service.name] || item.service.name
            : "";

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              className="bg-white rounded-2xl border border-sky-100 px-4 py-4"
              onPress={() =>
                router.push({
                  pathname: "/genome-test-detail",
                  params: { testId: item.testId },
                })
              }
            >
              <View className="flex-row items-center justify-between">
                <View className="px-2.5 py-1.5 rounded-full bg-sky-50 border border-sky-200">
                  <Text className="text-xs font-extrabold text-sky-700">{item.testId}</Text>
                </View>
                {!!serviceLabel && (
                  <View className="px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200">
                    <Text className="text-xs font-extrabold text-slate-600">{serviceLabel}</Text>
                  </View>
                )}
              </View>

              <Text className="mt-3 text-[15px] font-extrabold text-slate-900" numberOfLines={2}>
                {item.testName}
              </Text>

              {!!code && (
                <View className="mt-2 flex-row items-center">
                  <Tag size={14} color="#64748B" />
                  <Text className="ml-2 text-xs font-bold text-slate-600">{code}</Text>
                </View>
              )}

              {!!item.testDescription && (
                <Text className="mt-2 text-xs text-slate-600" numberOfLines={2}>
                  {item.testDescription}
                </Text>
              )}

              <View className="mt-3 flex-row items-end justify-between">
                <View className="flex-1">
                  {!!price && (
                    <Text className="text-sm font-extrabold text-sky-700">{formatVnd(price)}</Text>
                  )}
                  {(typeof taxRate === "number" || typeof finalPrice === "number") && (
                    <Text className="mt-0.5 text-[11px] font-bold text-slate-500">
                      {typeof taxRate === "number" ? `Thuế ${taxRate}%` : ""}
                      {typeof taxRate === "number" && typeof finalPrice === "number" ? " • " : ""}
                      {typeof finalPrice === "number" ? `Sau thuế ${formatVnd(finalPrice)}` : ""}
                    </Text>
                  )}
                </View>

                {item.testSample && item.testSample.length > 0 ? (
                  <View className="ml-3 flex-row items-center">
                    <FlaskConical size={14} color="#64748B" />
                    <Text className="ml-2 text-[11px] font-bold text-slate-500" numberOfLines={1}>
                      {item.testSample.join(", ")}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />

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
    </SafeAreaView>
  );
}
