import { Stack, useRouter } from "expo-router";
import {
  Search,
  ChevronRight,
  Download,
  ArrowLeft,
  X,
  SlidersHorizontal,
  Calendar,
  Plus,
  FileText,
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { InvoiceModal } from "@/components/modals";
import { PaginationControls } from "@/components/PaginationControls";
import { useAuth } from "@/contexts/AuthContext";
import { canAddSupplementSampleToOrder } from "@/lib/can-add-supplement-sample";
import { MEDICAL } from "@/lib/theme/medical";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { orderService, OrderResponse } from "@/services/orderService";
import { OrderStatus } from "@/types";

type TimeFilter = "today" | "week" | "month" | "all";

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("vi-VN").format(amount);

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("vi-VN");
  } catch {
    return dateString;
  }
};

const mapStatus = (status: string): string => {
  const s = (status || "").toLowerCase();
  if (s === "completed") return "completed";
  if (s === "initiation" || s === "accepted" || s.includes("pending")) return "in_progress";
  if (s === "rejected" || s.includes("cancel")) return "rejected";
  if (
    s === "in_progress" ||
    s === "forward_analysis" ||
    s === "sample_error" ||
    s === "rerun_testing" ||
    s === "sample_addition"
  )
    return "in_progress";
  return "in_progress";
};

const mapOrderResponseToOrder = (order: OrderResponse): any => {
  const backendStatus = order.orderStatus?.toLowerCase() || "";
  const frontendStatus = mapStatus(backendStatus);

  const patientName =
    order.patientMetadata && order.patientMetadata.length > 0
      ? order.patientMetadata[0].patientId || ""
      : order.specifyId?.patientId || "";

  return {
    id: order.orderId,
    code: order.orderId,
    name: order.orderName,
    patientName,
    status: frontendStatus,
    date: formatDate(order.createdAt),
    createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
    amount: order.paymentAmount || 0,
    customer: order.customerName || "",
    clinic: order.specifyId?.hospitalId || "",
    hasDownload: backendStatus === "completed",
    fullOrder: order,
    paymentStatus: order.paymentStatus || "PENDING",
    genomeTestId: order.specifyId?.genomeTestId || "",
    invoiceLink: order.invoiceLink || null,
    resultDateFormatted: order.resultDate ? formatDate(order.resultDate) : "",
  };
};

const getStatusMeta = (status: OrderStatus) => {
  switch (status) {
    case "completed":
      return { label: "Đã có KQ", bg: "bg-emerald-50", fg: "text-emerald-700", bd: "border-emerald-200" };
    case "in_progress":
      return { label: "Chờ xử lý", bg: "bg-orange-50", fg: "text-orange-700", bd: "border-orange-200" };
    case "rejected":
      return { label: "Hủy", bg: "bg-red-50", fg: "text-red-700", bd: "border-red-200" };
    default:
      return { label: "Khởi tạo", bg: "bg-sky-50", fg: "text-sky-700", bd: "border-sky-200" };
  }
};

const getPaymentStatusMeta = (paymentStatus?: string) => {
  const status = (paymentStatus || "PENDING").toUpperCase();
  if (status === "COMPLETED") {
    return { label: "Đã thanh toán", bg: "bg-emerald-50", fg: "text-emerald-700", bd: "border-emerald-200" };
  }
  return { label: "Chưa thanh toán", bg: "bg-orange-50", fg: "text-orange-700", bd: "border-orange-200" };
};

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className={`px-3 py-2 rounded-full border ${
        active ? "bg-sky-600 border-sky-600" : "bg-white border-sky-100"
      }`}
    >
      <Text className={`text-xs font-extrabold ${active ? "text-white" : "text-sky-800"}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<{ id: string; invoiceLink: string | null } | null>(null);

  const {
    data: ordersData,
    isLoading,
    error,
    refetch,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    goToPage,
  } = usePaginatedQuery<OrderResponse>({
    queryKey: ["orders", "customer", statusFilter, user?.id],
    queryFn: async (params) => {
      if (user?.id) {
        return await orderService.getByCustomerId(user.id, params);
      }
      return await orderService.getAll(params);
    },
    defaultPageSize: 20,
  });

  const orders = useMemo(() => {
    return ordersData.map(mapOrderResponseToOrder);
  }, [ordersData]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order: any) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(order.code || "").toLowerCase().includes(q) ||
        String(order.name || "").toLowerCase().includes(q) ||
        String(order.customer || "").toLowerCase().includes(q) ||
        String(order.clinic || "").toLowerCase().includes(q) ||
        String(order.patientName || "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;

      let matchesTime = true;
      const now = new Date();
      const orderDate: Date = order.createdAt;

      if (timeFilter === "today") matchesTime = orderDate.toDateString() === now.toDateString();
      else if (timeFilter === "week")
        matchesTime = orderDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (timeFilter === "month")
        matchesTime = orderDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      return matchesSearch && matchesStatus && matchesTime;
    });
  }, [orders, searchQuery, statusFilter, timeFilter]);

  const groupedOrders = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredOrders.forEach((o: any) => {
      if (!groups[o.date]) groups[o.date] = [];
      groups[o.date].push(o);
    });
    return groups;
  }, [filteredOrders]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={MEDICAL.primary} />
        <Text className="mt-3 text-sky-700 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-sky-950 text-center mb-2">
            Không tải được dữ liệu
          </Text>
          <Text className="text-xs text-sky-800/80 text-center mb-4">
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

  const dayKeys = Object.keys(groupedOrders);

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={MEDICAL.screenBg} />
      <Stack.Screen options={{ headerShown: false }} />

      <View className="pb-3 px-4 bg-white border-b border-sky-100 shadow-sm shadow-sky-900/5">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color={MEDICAL.primary} />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-sky-950 text-lg font-extrabold">Đơn hàng</Text>
            <Text className="mt-0.5 text-xs text-sky-700/80">
              {filteredOrders.length} đơn • {statusFilter === "all" ? "Tất cả" : getStatusMeta(statusFilter).label}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowFilters((v) => !v)}
            className={`w-10 h-10 rounded-xl border items-center justify-center ${
              showFilters ? "bg-sky-600 border-sky-600" : "bg-sky-50 border-sky-200"
            }`}
            activeOpacity={0.85}
          >
            <SlidersHorizontal size={18} color={showFilters ? "#FFFFFF" : MEDICAL.primary} />
          </TouchableOpacity>
        </View>

        <View className="mt-3 flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm theo mã / tên đơn / bệnh nhân…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {!!searchQuery.trim() && (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center bg-white border border-sky-200"
              onPress={() => setSearchQuery("")}
              activeOpacity={0.75}
            >
              <X size={16} color={MEDICAL.primaryDark} />
            </TouchableOpacity>
          )}
        </View>

        {showFilters && (
          <View className="mt-3">
            <View className="flex-row items-center mb-2">
              <Calendar size={16} color={MEDICAL.primary} />
              <Text className="ml-2 text-xs font-extrabold text-sky-800">Thời gian</Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <Pill label="Hôm nay" active={timeFilter === "today"} onPress={() => setTimeFilter("today")} />
              <Pill label="Tuần này" active={timeFilter === "week"} onPress={() => setTimeFilter("week")} />
              <Pill label="Tháng này" active={timeFilter === "month"} onPress={() => setTimeFilter("month")} />
              <Pill label="Tất cả" active={timeFilter === "all"} onPress={() => setTimeFilter("all")} />
            </View>

            <View className="mt-3 flex-row items-center mb-2">
              <Text className="text-xs font-extrabold text-sky-800">Trạng thái</Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <Pill label="Tất cả" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
              <Pill
                label="Khởi tạo"
                active={statusFilter === "initiation"}
                onPress={() => setStatusFilter("initiation")}
              />
              <Pill
                label="Chờ xử lý"
                active={statusFilter === "in_progress"}
                onPress={() => setStatusFilter("in_progress")}
              />
              <Pill
                label="Đã có KQ"
                active={statusFilter === "completed"}
                onPress={() => setStatusFilter("completed")}
              />
              <Pill
                label="Hủy"
                active={statusFilter === "rejected"}
                onPress={() => setStatusFilter("rejected")}
              />
            </View>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1 bg-sky-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
      >
        {dayKeys.length === 0 ? (
          <View className="pt-12 items-center px-6">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 items-center justify-center border border-sky-200">
              <Search size={24} color={MEDICAL.primary} />
            </View>
            <Text className="mt-4 text-base font-extrabold text-sky-950">Không có đơn hàng</Text>
            <Text className="mt-2 text-xs font-bold text-sky-700/80 text-center">
              Thử đổi bộ lọc hoặc từ khóa tìm kiếm.
            </Text>
          </View>
        ) : (
          dayKeys.map((date) => (
            <View key={date} className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-[15px] font-extrabold text-sky-950">{date}</Text>
                <View className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200">
                  <Text className="text-xs font-extrabold text-sky-700">
                    {groupedOrders[date].length}
                  </Text>
                </View>
              </View>

              {groupedOrders[date].map((order: any) => {
                const paymentMeta = getPaymentStatusMeta(order.paymentStatus);

                return (
                  <TouchableOpacity
                    key={order.id}
                    className="bg-white rounded-2xl p-4 mb-3 border border-sky-100 shadow-sm shadow-sky-900/5"
                    onPress={() =>
                      router.push({
                        pathname: "/customer/order-detail",
                        params: { orderId: order.id },
                      })
                    }
                    activeOpacity={0.85}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-extrabold text-sky-700" numberOfLines={1}>
                          {order.code}
                        </Text>
                        <Text className="text-[10px] font-bold text-sky-700/70 mt-0.5" numberOfLines={1}>
                          Tạo: {order.date}
                        </Text>
                        <Text
                          className="text-[10px] font-bold text-emerald-700 mt-0.5"
                          numberOfLines={1}
                        >
                          Ngày trả kết quả: {order.resultDateFormatted || 'N/A'}
                        </Text>
                      </View>

                      <View className={`px-2.5 py-1 rounded-full border ${paymentMeta.bg} ${paymentMeta.bd}`}>
                        <Text className={`text-xs font-extrabold ${paymentMeta.fg}`}>{paymentMeta.label}</Text>
                      </View>
                    </View>

                    <Text className="mt-2 text-[14px] font-extrabold text-sky-950" numberOfLines={2}>
                      {order.name}
                    </Text>

                    <View className="mt-2 flex-row items-center flex-wrap">
                      <Text className="text-sm font-extrabold text-sky-950">
                        {formatCurrency(order.amount || 0)} VND
                      </Text>

                      {!!order.genomeTestId && (
                        <>
                          <Text className="mx-2 text-sky-200">•</Text>
                          <Text className="text-xs font-bold text-sky-800" numberOfLines={1}>
                            {order.genomeTestId}
                          </Text>
                        </>
                      )}

                      {!!order.patientName && (
                        <>
                          <Text className="mx-2 text-sky-200">•</Text>
                          <Text className="text-xs font-bold text-sky-800" numberOfLines={1}>
                            {order.patientName}
                          </Text>
                        </>
                      )}

                      {!!order.customer && (
                        <>
                          <Text className="mx-2 text-sky-200">•</Text>
                          <Text className="text-xs font-bold text-sky-800" numberOfLines={1}>
                            {order.customer}
                          </Text>
                        </>
                      )}
                    </View>

                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-xs font-bold text-slate-500" numberOfLines={1}>
                        {order.clinic ? `Cơ sở: ${order.clinic}` : " "}
                      </Text>

                      <View className="flex-row items-center gap-2">
                        {!!order.invoiceLink && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setInvoiceOrder({ id: order.id, invoiceLink: order.invoiceLink });
                            }}
                            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center"
                            activeOpacity={0.8}
                          >
                            <FileText size={18} color={MEDICAL.primary} />
                          </TouchableOpacity>
                        )}
                        {canAddSupplementSampleToOrder(order.fullOrder?.orderStatus) && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              router.push({
                                pathname: "/customer/new-sample-add",
                                params: { orderId: order.id },
                              });
                            }}
                            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center"
                            activeOpacity={0.8}
                          >
                            <Plus size={18} color={MEDICAL.primary} />
                          </TouchableOpacity>
                        )}
                        {order.hasDownload ? (
                          <View className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center">
                            <Download size={18} color={MEDICAL.primary} />
                          </View>
                        ) : (
                          <View className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center">
                            <ChevronRight size={18} color={MEDICAL.primary} />
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <InvoiceModal
        visible={!!invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
        invoiceLink={invoiceOrder?.invoiceLink ?? null}
        orderId={invoiceOrder?.id ?? ""}
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
