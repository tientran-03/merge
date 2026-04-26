import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Search, X, Clock3, FileText, User } from "lucide-react-native";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PaginationControls } from "@/components/PaginationControls";
import { getOrderStatusLabel } from "@/lib/constants/order-status";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { orderService, OrderResponse } from "@/services/orderService";

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("vi-VN");
  } catch {
    return dateString;
  }
};

const isPendingStatus = (status: string): boolean => {
  const s = (status || "").toLowerCase();
  return s === "initiation" || s === "accepted" || s === "in_progress" || s === "forward_analysis";
};

const getStatusPillClass = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "initiation") return { bg: "bg-orange-500/12", text: "text-orange-600", border: "border-orange-200" };
  if (s === "in_progress" || s === "forward_analysis") return { bg: "bg-sky-500/12", text: "text-sky-700", border: "border-sky-200" };
  if (s === "accepted") return { bg: "bg-emerald-500/12", text: "text-emerald-700", border: "border-emerald-200" };
  return { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-200" };
};

export default function PendingOrdersScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);

  const {
    data: ordersData,
    isLoading,
    error,
    refetch,
    isFetching,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<OrderResponse>({
    queryKey: ["orders", "pending"],
    queryFn: async (params) => await orderService.getAll(params),
    defaultPageSize: 20,
  });

  const pendingOrders = useMemo(() => {
    return ordersData
      .filter((order) => isPendingStatus(order.orderStatus))
      .map((order) => {
        const patientName =
          order.patientMetadata && order.patientMetadata.length > 0
            ? order.patientMetadata[0].patientId || ""
            : (order as any)?.specifyId?.patientId || "";

        return {
          id: order.orderId,
          code: order.orderId,
          name: order.orderName,
          status: order.orderStatus,
          customerName: order.customerName || "",
          patientName,
          date: formatDate(order.createdAt),
          createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [ordersData]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pendingOrders;

    return pendingOrders.filter((o) => {
      return (
        (o.code || "").toLowerCase().includes(q) ||
        (o.name || "").toLowerCase().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.patientName || "").toLowerCase().includes(q)
      );
    });
  }, [pendingOrders, searchQuery]);

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
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-slate-900 text-center mb-2">
            Không tải được dữ liệu
          </Text>
          <Text className="text-xs text-slate-500 text-center mb-4">
            Vui lòng kiểm tra kết nối mạng
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
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

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
            <Text className="text-slate-900 text-lg font-extrabold">Đơn hàng chờ cập nhật</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Danh sách đơn đang ở trạng thái xử lý / khởi tạo
            </Text>
          </View>

          <View className="px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-200">
            <Text className="text-sm font-extrabold text-sky-700">{filtered.length}</Text>
          </View>
        </View>

        <View
          className={`mt-3 flex-row items-center rounded-2xl px-3 bg-sky-50 border ${
            focusSearch ? "border-sky-400" : "border-sky-100"
          }`}
        >
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm theo mã / tên đơn / khách hàng / bệnh nhân…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
            returnKeyType="search"
          />
          {searchQuery.trim() ? (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center"
              onPress={() => setSearchQuery("")}
              activeOpacity={0.75}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor="#0284C7" />
        }
      >
        {filtered.length === 0 ? (
          <View className="pt-10 items-center px-6">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 items-center justify-center border border-sky-200">
              <Clock3 size={26} color="#0284C7" />
            </View>
            <Text className="mt-4 text-base font-extrabold text-slate-900">
              {searchQuery.trim() ? "Không tìm thấy đơn phù hợp" : "Không có đơn hàng chờ cập nhật"}
            </Text>
            <Text className="mt-2 text-xs font-bold text-slate-500 text-center">
              {searchQuery.trim()
                ? "Thử từ khóa khác hoặc xóa tìm kiếm."
                : "Danh sách đơn đang xử lý sẽ hiển thị tại đây."}
            </Text>
          </View>
        ) : (
          filtered.map((order) => {
            const pill = getStatusPillClass(order.status);
            const statusLabel = getOrderStatusLabel(order.status);

            return (
              <TouchableOpacity
                key={order.id}
                className="bg-white rounded-2xl p-4 mb-3 border border-sky-100"
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: "/update-order-wizard",
                    params: { orderId: order.id },
                  })
                }
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 pr-3">
                    <View className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3">
                      <FileText size={18} color="#0284C7" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-extrabold text-slate-900" numberOfLines={1}>
                        {order.code}
                      </Text>
                      <Text className="text-[12px] font-bold text-slate-500 mt-0.5" numberOfLines={1}>
                        {order.date}
                      </Text>
                    </View>
                  </View>

                  <View className={`px-2.5 py-1.5 rounded-full border ${pill.bg} ${pill.border}`}>
                    <Text className={`text-xs font-extrabold ${pill.text}`}>{statusLabel}</Text>
                  </View>
                </View>

                <Text className="mt-3 text-[15px] font-extrabold text-slate-900" numberOfLines={2}>
                  {order.name}
                </Text>

                {(!!order.customerName || !!order.patientName) && (
                  <View className="mt-3 gap-2">
                    {!!order.customerName && (
                      <View className="flex-row items-center">
                        <User size={14} color="#64748B" />
                        <Text className="ml-2 text-xs font-bold text-slate-600" numberOfLines={1}>
                          Khách hàng: {order.customerName}
                        </Text>
                      </View>
                    )}

                    {!!order.patientName && (
                      <View className="flex-row items-center">
                        <User size={14} color="#64748B" />
                        <Text className="ml-2 text-xs font-bold text-slate-600" numberOfLines={1}>
                          Bệnh nhân: {order.patientName}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  className="mt-4 bg-sky-600 py-3 rounded-2xl items-center"
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: "/update-order-wizard",
                      params: { orderId: order.id },
                    })
                  }
                >
                  <Text className="text-white text-sm font-extrabold">Cập nhật</Text>
                </TouchableOpacity>
              </TouchableOpacity>
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
    </SafeAreaView>
  );
}
