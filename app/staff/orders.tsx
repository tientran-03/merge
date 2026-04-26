import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Download,
  Eye,
  FileText,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react-native";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { ConfirmModal, InvoiceModal } from "@/components/modals";
import { PaginationControls } from "@/components/PaginationControls";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { presentFeedbackError, presentFeedbackSuccess } from "@/lib/feedbackModal";
import { downloadOrderPdf } from "@/lib/orderPdf";
import { useStaffDoctorBasePath } from "@/lib/staff-doctor-route";
import { OrderResponse, orderService } from "@/services/orderService";
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
const ORDER_STATUS_LABEL_VI: Record<string, { label: string; bg: string; fg: string; bd: string }> = {
  initiation: { label: "Khởi tạo", bg: "bg-blue-50", fg: "text-blue-800", bd: "border-blue-200" },
  forward_analysis: { label: "Chuyển phân tích", bg: "bg-cyan-50", fg: "text-cyan-800", bd: "border-cyan-200" },
  accepted: { label: "Đã chấp nhận", bg: "bg-green-50", fg: "text-green-800", bd: "border-green-200" },
  rejected: { label: "Từ chối", bg: "bg-red-50", fg: "text-red-800", bd: "border-red-200" },
  in_progress: { label: "Đang xử lý", bg: "bg-purple-50", fg: "text-purple-800", bd: "border-purple-200" },
  sample_error: { label: "Lỗi mẫu", bg: "bg-red-50", fg: "text-red-800", bd: "border-red-200" },
  rerun_testing: { label: "Chạy lại", bg: "bg-yellow-50", fg: "text-yellow-800", bd: "border-yellow-200" },
  completed: { label: "Hoàn thành", bg: "bg-emerald-50", fg: "text-emerald-800", bd: "border-emerald-200" },
  sample_addition: { label: "Bổ sung mẫu", bg: "bg-orange-50", fg: "text-orange-800", bd: "border-orange-200" },
  awaiting_results_approval: { label: "Chờ xác nhận KQ", bg: "bg-amber-50", fg: "text-amber-800", bd: "border-amber-200" },
  results_approved: { label: "KQ đã xác nhận", bg: "bg-lime-50", fg: "text-lime-800", bd: "border-lime-200" },
  result_approved: { label: "KQ đã xác nhận", bg: "bg-lime-50", fg: "text-lime-800", bd: "border-lime-200" },
  canceled: { label: "Đã hủy", bg: "bg-slate-100", fg: "text-slate-700", bd: "border-slate-200" },
};

const getOrderStatusBadge = (raw?: string) => {
  const key = (raw || "").toLowerCase();
  return (
    ORDER_STATUS_LABEL_VI[key] || {
      label: raw || "—",
      bg: "bg-slate-100",
      fg: "text-slate-700",
      bd: "border-slate-200",
    }
  );
};

const mapOrderResponseToOrder = (order: OrderResponse): any => {
  const backendStatus = order.orderStatus?.toLowerCase() || "";
  const frontendStatus = mapStatus(backendStatus);

  const patientName =
    order.patientMetadata && order.patientMetadata.length > 0
      ? order.patientMetadata[0].patientId || ""
      : order.specifyId?.patientId || "";

  const hospitalName = order.specifyId?.hospital?.hospitalName || "";
  const serviceName = order.specifyId?.genomeTest?.testName || "";

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
    clinic: hospitalName || order.specifyId?.hospitalId || "",
    hospitalName,
    serviceName,
    resultDateFormatted: order.resultDate ? formatDate(order.resultDate) : "",
    fullOrder: order,
    paymentStatus: order.paymentStatus || "PENDING",
    genomeTestId: order.specifyId?.genomeTestId || "",
    invoiceLink: order.invoiceLink || null,
    orderStatus: order.orderStatus || "",
    paymentType: order.paymentType || "",
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
      className={`px-3 py-2 rounded-full border ${active ? "bg-sky-600 border-sky-600" : "bg-white border-sky-100"
        }`}
    >
      <Text className={`text-xs font-extrabold ${active ? "text-white" : "text-slate-600"}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const base = useStaffDoctorBasePath();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [invoiceOrder, setInvoiceOrder] = useState<{ id: string; invoiceLink: string | null } | null>(null);
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState<OrderResponse | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);

  const handleDownloadOrderPdf = async (orderId: string) => {
    setDownloadingOrderId(orderId);
    try {
      const res = await orderService.getById(orderId);
      const data = (res as { success?: boolean; data?: OrderResponse }).success
        ? (res as { data?: OrderResponse }).data
        : null;
      if (!data) {
        throw new Error((res as { error?: string }).error || "Không tải được đơn hàng");
      }
      await downloadOrderPdf(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Đã xảy ra lỗi.";
      presentFeedbackError({
        title: "Không tải được PDF",
        message: msg,
      });
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await orderService.delete(orderId);
      if (!res.success) throw new Error(res.error || "Không xóa được đơn hàng");
    },
    onSuccess: () => {
      setPendingDeleteOrder(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      presentFeedbackSuccess({ title: "Đã xóa", message: "Đơn hàng đã được xóa." });
    },
    onError: (err: any) =>
      presentFeedbackError({ title: "Lỗi", message: err?.message || "Xóa đơn thất bại" }),
  });

  const {
    data: ordersData,
    isLoading,
    isFetching,
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
    queryKey: ["orders", statusFilter],
    queryFn: async (params) => {
      if (statusFilter !== "all") {
        const statusMap: Record<string, string> = {
          completed: "completed",
          pending: "initiation",
          cancelled: "rejected",
          processing: "in_progress",
        };
        const backendStatus = statusMap[statusFilter] || statusFilter;
        return await orderService.getByStatus(backendStatus, params);
      }
      return await orderService.getAll(params);
    },
    defaultPageSize: 20,
  });

  const orders = useMemo(() => {
    const mapped = ordersData.map(mapOrderResponseToOrder);
    return mapped.sort((a: any, b: any) => {
      const ta = a?.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const tb = b?.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return tb - ta;
    });
  }, [ordersData]);

  const hospitalOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o: any) => {
      const n = String(o.hospitalName || "").trim();
      if (n) set.add(n);
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b, "vi"))];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order: any) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(order.code || "").toLowerCase().includes(q) ||
        String(order.name || "").toLowerCase().includes(q) ||
        String(order.customer || "").toLowerCase().includes(q) ||
        String(order.clinic || "").toLowerCase().includes(q) ||
        String(order.hospitalName || "").toLowerCase().includes(q) ||
        String(order.serviceName || "").toLowerCase().includes(q) ||
        String(order.patientName || "").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;

      const matchesHospital =
        hospitalFilter === "all" ||
        (order.hospitalName && String(order.hospitalName) === hospitalFilter);

      let matchesTime = true;
      const now = new Date();
      const orderDate: Date = order.createdAt;

      if (timeFilter === "today") matchesTime = orderDate.toDateString() === now.toDateString();
      else if (timeFilter === "week")
        matchesTime = orderDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (timeFilter === "month")
        matchesTime = orderDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      return matchesSearch && matchesStatus && matchesTime && matchesHospital;
    });
  }, [orders, searchQuery, statusFilter, timeFilter, hospitalFilter]);

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

  const dayKeys = Object.keys(groupedOrders);
  const listRefreshing = isFetching && !isLoading;

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen options={{ headerShown: false }} />

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
            <Text className="text-slate-900 text-lg font-extrabold">Danh sách đơn hàng</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {filteredOrders.length} đơn • {statusFilter === "all" ? "Tất cả" : getStatusMeta(statusFilter).label}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowFilters((v) => !v)}
            className={`w-10 h-10 rounded-xl border items-center justify-center ${showFilters ? "bg-sky-600 border-sky-600" : "bg-sky-50 border-sky-200"
              }`}
            activeOpacity={0.85}
          >
            <SlidersHorizontal size={18} color={showFilters ? "#FFFFFF" : "#0284C7"} />
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
              className="w-9 h-9 rounded-xl items-center justify-center"
              onPress={() => setSearchQuery("")}
              activeOpacity={0.75}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {showFilters && (
          <View className="mt-3">
            <View className="flex-row items-center mb-2">
              <Calendar size={16} color="#0284C7" />
              <Text className="ml-2 text-xs font-extrabold text-slate-700">Thời gian</Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <Pill label="Hôm nay" active={timeFilter === "today"} onPress={() => setTimeFilter("today")} />
              <Pill label="Tuần này" active={timeFilter === "week"} onPress={() => setTimeFilter("week")} />
              <Pill label="Tháng này" active={timeFilter === "month"} onPress={() => setTimeFilter("month")} />
              <Pill label="Tất cả" active={timeFilter === "all"} onPress={() => setTimeFilter("all")} />
            </View>

            <View className="mt-3 flex-row items-center mb-2">
              <Text className="text-xs font-extrabold text-slate-700">Trạng thái</Text>
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

            {hospitalOptions.length > 1 ? (
              <>
                <View className="mt-3 flex-row items-center mb-2">
                  <Text className="text-xs font-extrabold text-slate-700">Phòng khám / BV</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {hospitalOptions.map((h) => (
                    <Pill
                      key={h}
                      label={h === "all" ? "Tất cả" : h}
                      active={hospitalFilter === h}
                      onPress={() => setHospitalFilter(h)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={listRefreshing}
            onRefresh={() => void refetch()}
            tintColor="#0284C7"
            colors={["#0284C7"]}
          />
        }
      >
        {dayKeys.length === 0 ? (
          <View className="pt-12 items-center px-6">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 items-center justify-center border border-sky-200">
              <Search size={24} color="#0284C7" />
            </View>
            <Text className="mt-4 text-base font-extrabold text-slate-900">Không có đơn hàng</Text>
            <Text className="mt-2 text-xs font-bold text-slate-500 text-center">
              Thử đổi bộ lọc hoặc từ khóa tìm kiếm.
            </Text>
          </View>
        ) : (
          dayKeys.map((date) => (
            <View key={date} className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-[15px] font-extrabold text-slate-900">{date}</Text>
                <View className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200">
                  <Text className="text-xs font-extrabold text-sky-700">
                    {groupedOrders[date].length}
                  </Text>
                </View>
              </View>

              {groupedOrders[date].map((order: any) => {
                const paymentMeta = getPaymentStatusMeta(order.paymentStatus);
                const orderStatusMeta = getOrderStatusBadge(order.orderStatus);
                const full = order.fullOrder as OrderResponse;

                const goDetail = () =>
                  router.push({ pathname: `${base}/order-detail`, params: { orderId: order.id } });

                return (
                  <TouchableOpacity
                    key={order.id}
                    className="bg-white rounded-2xl p-4 mb-3 border border-sky-100"
                    onPress={goDetail}
                    activeOpacity={0.85}
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs font-extrabold text-sky-700" numberOfLines={1}>
                          {order.code}
                        </Text>
                        <Text className="text-[10px] font-bold text-slate-500 mt-0.5" numberOfLines={1}>
                          Tạo: {order.date}
                        </Text>
                        <Text
                          className="text-[10px] font-bold text-emerald-700 mt-0.5"
                          numberOfLines={1}
                        >
                          Ngày trả kết quả: {order.resultDateFormatted || 'N/A'}
                        </Text>
                      </View>
                      <View className="items-end gap-1 shrink-0">
                        <View className={`px-2 py-0.5 rounded-full border ${orderStatusMeta.bg} ${orderStatusMeta.bd}`}>
                          <Text className={`text-[10px] font-extrabold ${orderStatusMeta.fg}`} numberOfLines={1}>
                            {orderStatusMeta.label}
                          </Text>
                        </View>
                        <View className={`px-2 py-0.5 rounded-full border ${paymentMeta.bg} ${paymentMeta.bd}`}>
                          <Text className={`text-[10px] font-extrabold ${paymentMeta.fg}`}>{paymentMeta.label}</Text>
                        </View>
                      </View>
                    </View>

                    <Text className="mt-2 text-[14px] font-extrabold text-slate-900" numberOfLines={2}>
                      {order.name}
                    </Text>

                    {!!(order.hospitalName || order.serviceName) && (
                      <Text className="mt-1 text-[11px] font-semibold text-slate-600" numberOfLines={2}>
                        {order.hospitalName ? `${order.hospitalName}` : ""}
                        {order.hospitalName && order.serviceName ? " · " : ""}
                        {order.serviceName ? order.serviceName : ""}
                      </Text>
                    )}

                    <View className="mt-2 flex-row items-center flex-wrap">
                      <Text className="text-sm font-extrabold text-slate-900">
                        {formatCurrency(order.amount || 0)} VND
                      </Text>
                      {!!order.customer && (
                        <>
                          <Text className="mx-2 text-slate-300">•</Text>
                          <Text className="text-xs font-bold text-slate-600" numberOfLines={1}>
                            {order.customer}
                          </Text>
                        </>
                      )}
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="mt-2 -mx-1"
                      contentContainerStyle={{ paddingHorizontal: 4, gap: 8, flexDirection: "row", alignItems: "center" }}
                    >
                      <TouchableOpacity
                        onPress={(e) => {
                          (e as any)?.stopPropagation?.();
                          goDetail();
                        }}
                        className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 items-center justify-center"
                        activeOpacity={0.8}
                        accessibilityLabel="Xem chi tiết"
                      >
                        <Eye size={18} color="#475569" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={(e) => {
                          (e as any)?.stopPropagation?.();
                          void handleDownloadOrderPdf(order.id);
                        }}
                        disabled={downloadingOrderId === order.id}
                        className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 items-center justify-center"
                        activeOpacity={0.8}
                        accessibilityLabel="Tải PDF đơn hàng"
                      >
                        {downloadingOrderId === order.id ? (
                          <ActivityIndicator size="small" color="#059669" />
                        ) : (
                          <Download size={18} color="#059669" />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={(e) => {
                          (e as any)?.stopPropagation?.();
                          router.push({
                            pathname: `${base}/create-order`,
                            params: { orderId: order.id, initialStep: "1" },
                          } as Parameters<typeof router.push>[0]);
                        }}
                        className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 items-center justify-center"
                        activeOpacity={0.8}
                        accessibilityLabel="Chỉnh sửa đơn hàng"
                      >
                        <Pencil size={18} color="#0891B2" />
                      </TouchableOpacity>

                      {!!order.invoiceLink && (
                        <TouchableOpacity
                          onPress={(e) => {
                            (e as any)?.stopPropagation?.();
                            setInvoiceOrder({ id: order.id, invoiceLink: order.invoiceLink });
                          }}
                          className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 items-center justify-center"
                          activeOpacity={0.8}
                          accessibilityLabel="Hóa đơn"
                        >
                          <FileText size={18} color="#EA580C" />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={(e) => {
                          (e as any)?.stopPropagation?.();
                          setPendingDeleteOrder(full);
                        }}
                        disabled={deleteMutation.isPending}
                        className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 items-center justify-center"
                        activeOpacity={0.8}
                        accessibilityLabel="Xóa đơn"
                      >
                        {deleteMutation.isPending && pendingDeleteOrder?.orderId === full.orderId ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Trash2 size={18} color="#DC2626" />
                        )}
                      </TouchableOpacity>
                    </ScrollView>
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

      <ConfirmModal
        visible={pendingDeleteOrder !== null}
        title="Xóa đơn hàng"
        message={
          pendingDeleteOrder
            ? `Xóa đơn #${pendingDeleteOrder.orderId}? Hành động này không thể hoàn tác.`
            : ""
        }
        confirmText="Xóa"
        cancelText="Hủy"
        destructive
        onCancel={() => setPendingDeleteOrder(null)}
        onConfirm={() => {
          if (pendingDeleteOrder?.orderId) {
            deleteMutation.mutate(pendingDeleteOrder.orderId);
          }
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
