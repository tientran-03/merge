import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Dna,
  FlaskConical,
  Search,
  Tag,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { PaginationControls } from "@/components/PaginationControls";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { SERVICE_TYPE_MAPPER } from "@/lib/schemas/order-schemas";
import { MEDICAL } from "@/lib/theme/medical";
import { getApiResponseData } from "@/lib/types/api-types";
import { GenomeTestResponse, genomeTestService } from "@/services/genomeTestService";
import { ServiceResponse, serviceService } from "@/services/serviceService";

const formatVnd = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  try {
    return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
  } catch {
    return `${value} đ`;
  }
};

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      className={`mr-2 rounded-2xl border-2 px-4 py-2.5 ${
        active ? "border-sky-600 bg-sky-600" : "border-slate-200 bg-white"
      }`}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text
        className={`text-center text-[13px] font-extrabold ${active ? "text-white" : "text-slate-700"}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
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
      <SafeAreaView className="flex-1 bg-slate-100" edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color={MEDICAL.primary} />
          <Text className="mt-3 text-sm font-bold text-slate-500">Đang tải danh sách xét nghiệm...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-100" edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 active:bg-sky-100"
          >
            <ArrowLeft size={20} color={MEDICAL.primary} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-red-50">
            <Dna size={32} color="#dc2626" />
          </View>
          <Text className="text-center text-lg font-extrabold text-slate-900">Không tải được dữ liệu</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-slate-500">Kiểm tra mạng và thử lại.</Text>
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

  const listBottomPad = 28 + Math.max(insets.bottom, 8) + (totalPages > 1 ? 72 : 0);

  return (
    <SafeAreaView className="flex-1 bg-slate-100" edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View className="border-b border-slate-200 bg-white px-4 pb-4 pt-2 shadow-sm shadow-slate-200/50">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 active:bg-sky-100"
          accessibilityLabel="Quay lại"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={20} color={MEDICAL.primary} />
        </TouchableOpacity>

        <View className="mt-3 flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-extrabold text-slate-900">Dịch vụ xét nghiệm</Text>
            <Text className="mt-1 text-[13px] leading-5 text-slate-500">
              Xem giá, mã gói và loại mẫu — chạm thẻ để xem chi tiết
            </Text>
          </View>
          <View className="rounded-xl bg-sky-100 px-3 py-2">
            <Text className="text-center text-[11px] font-extrabold uppercase tracking-wide text-sky-800">
              {filtered.length}
            </Text>
            <Text className="text-center text-[10px] font-bold text-sky-600">gói</Text>
          </View>
        </View>

        <View
          className={`mt-4 flex-row items-center rounded-2xl border bg-slate-50 px-3 py-0.5 ${
            focusSearch ? "border-sky-400 bg-sky-50" : "border-slate-200"
          }`}
        >
          <Search size={20} color="#64748b" />
          <TextInput
            className="ml-2 flex-1 py-3 text-[15px] font-semibold text-slate-900"
            placeholder="Tìm mã, tên, code, nhóm, mẫu…"
            placeholderTextColor="#94a3b8"
            value={q}
            onChangeText={setQ}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
            returnKeyType="search"
          />
          {!!q.trim() && (
            <TouchableOpacity
              className="h-8 w-8 items-center justify-center rounded-xl active:bg-slate-200"
              onPress={() => setQ("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        <Text className="mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
          Lọc theo nhóm
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: "center", paddingRight: 4 }}
        >
          <FilterChip
            label="Tất cả"
            active={selectedServiceId === null}
            onPress={() => setSelectedServiceId(null)}
          />
          <FilterChip
            label={SERVICE_TYPE_MAPPER["reproduction"]}
            active={selectedServiceId === groupIds.reproduction}
            onPress={() => setSelectedServiceId(groupIds.reproduction)}
          />
          <FilterChip
            label={SERVICE_TYPE_MAPPER["disease"]}
            active={selectedServiceId === groupIds.disease}
            onPress={() => setSelectedServiceId(groupIds.disease)}
          />
          <FilterChip
            label={SERVICE_TYPE_MAPPER["embryo"]}
            active={selectedServiceId === groupIds.embryo}
            onPress={() => setSelectedServiceId(groupIds.embryo)}
          />
        </ScrollView>
      </View>

      <FlatList
        className="flex-1"
        data={filtered}
        keyExtractor={(item) => item.testId}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: listBottomPad,
        }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={MEDICAL.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white px-6 py-14">
            <FlaskConical size={48} color="#cbd5e1" />
            <Text className="mt-4 text-center text-base font-extrabold text-slate-700">
              {q.trim() ? "Không có kết quả" : "Chưa có dữ liệu"}
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
              {q.trim() ? "Thử từ khóa khác hoặc bỏ bộ lọc." : "Danh sách sẽ hiển thị khi có gói xét nghiệm."}
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
              activeOpacity={0.88}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-300/30"
              style={{ elevation: 2 }}
              onPress={() =>
                router.push({
                  pathname: "/customer/genome-test-detail",
                  params: { testId: item.testId },
                })
              }
            >
              <View className="flex-row">
                <View className="w-1.5 bg-sky-500" />
                <View className="min-w-0 flex-1 px-4 py-4 pr-2">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <View className="rounded-lg bg-slate-100 px-2 py-1">
                      <Text className="font-mono text-[11px] font-bold text-slate-700">{item.testId}</Text>
                    </View>
                    {!!serviceLabel && (
                      <View className="rounded-full bg-sky-50 px-2.5 py-1">
                        <Text className="text-[11px] font-extrabold text-sky-800">{serviceLabel}</Text>
                      </View>
                    )}
                  </View>

                  <Text className="mt-3 text-[16px] font-extrabold leading-5 text-slate-900" numberOfLines={2}>
                    {item.testName}
                  </Text>

                  {!!code && (
                    <View className="mt-2 flex-row items-center">
                      <Tag size={14} color={MEDICAL.primary} />
                      <Text className="ml-1.5 text-[12px] font-bold text-slate-600">{code}</Text>
                    </View>
                  )}

                  {!!item.testDescription && (
                    <Text className="mt-2 text-[12px] leading-4 text-slate-500" numberOfLines={2}>
                      {item.testDescription}
                    </Text>
                  )}

                  <View className="mt-4 flex-row items-end justify-between border-t border-slate-100 pt-3">
                    <View className="min-w-0 flex-1 pr-2">
                      {!!price && (
                        <Text className="text-[13px] font-semibold text-slate-500">Giá gốc</Text>
                      )}
                      {!!price && (
                        <Text className="text-[15px] font-extrabold text-slate-800">{formatVnd(price)}</Text>
                      )}
                      {(typeof taxRate === "number" || typeof finalPrice === "number") && (
                        <Text className="mt-1 text-[11px] font-semibold leading-4 text-emerald-700">
                          {typeof taxRate === "number" ? `VAT ${taxRate}%` : ""}
                          {typeof taxRate === "number" && typeof finalPrice === "number" ? " · " : ""}
                          {typeof finalPrice === "number" ? `Sau thuế ${formatVnd(finalPrice)}` : ""}
                        </Text>
                      )}
                    </View>
                    {item.testSample && item.testSample.length > 0 ? (
                      <View className="max-w-[48%] flex-row items-start">
                        <FlaskConical size={14} color={MEDICAL.mutedIcon} style={{ marginTop: 2 }} />
                        <Text className="ml-1.5 flex-1 text-[11px] font-semibold leading-4 text-slate-500" numberOfLines={2}>
                          {item.testSample.join(", ")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View className="justify-center pr-3 pl-1">
                  <ChevronRight size={22} color="#94a3b8" />
                </View>
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
