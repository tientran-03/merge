import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Ban,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  CloudUpload,
  CreditCard,
  FileText,
  Filter,
  FlaskConical,
  Hourglass,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { consumeListFresh } from "@/lib/list-navigation-flags";
import { getApiResponseData } from "@/lib/types/api-types";
import { OrderResponse, orderService } from "@/services/orderService";
import { sampleAddService, type SampleAddResponse } from "@/services/sampleAddService";
import {
  sampleAddServiceConfigService,
  type SampleAddServiceConfigResponse,
} from "@/services/sampleAddServiceConfigService";
import { uploadFileToCloudinary } from "@/utils/cloudinary";

type TimeFilter = "today" | "week" | "month" | "all";
type ListMode = "orders" | "sample_adds";

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

/** Đồng bộ với `ALL_ORDER_STATUSES` / `ORDER_STATUS_CONFIG` trên web admin */
const getStatusLabel = (status: string): string => {
  const s = (status || "").toLowerCase();
  const statusMap: Record<string, string> = {
    initiation: "Khởi tạo",
    forward_analysis: "Chuyển phân tích",
    accepted: "Đã chấp nhận",
    rejected: "Từ chối",
    in_progress: "Đang xử lý",
    sample_error: "Lỗi mẫu",
    rerun_testing: "Chạy lại",
    completed: "Hoàn thành",
    sample_addition: "Bổ sung mẫu",
    awaiting_results_approval: "Chờ duyệt kết quả",
    results_approved: "Đã duyệt kết quả",
    result_approved: "Đã duyệt kết quả",
    canceled: "Đã hủy",
  };
  return statusMap[s] || status;
};

// Get status badge colors (bám màu nhóm trên web)
const getStatusBadge = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "results_approved" || s === "result_approved") {
    return { label: getStatusLabel(status), bg: "bg-emerald-50", fg: "text-emerald-700", bd: "border-emerald-200" };
  }
  if (s === "rejected" || s === "sample_error") {
    return { label: getStatusLabel(status), bg: "bg-red-50", fg: "text-red-700", bd: "border-red-200" };
  }
  if (s === "canceled") {
    return { label: getStatusLabel(status), bg: "bg-slate-100", fg: "text-slate-600", bd: "border-slate-200" };
  }
  if (s === "accepted") {
    return { label: getStatusLabel(status), bg: "bg-green-50", fg: "text-green-700", bd: "border-green-200" };
  }
  if (s === "in_progress") {
    return { label: getStatusLabel(status), bg: "bg-violet-50", fg: "text-violet-700", bd: "border-violet-200" };
  }
  if (s === "initiation") {
    return { label: getStatusLabel(status), bg: "bg-blue-50", fg: "text-blue-700", bd: "border-blue-200" };
  }
  if (s === "forward_analysis") {
    return { label: getStatusLabel(status), bg: "bg-cyan-50", fg: "text-cyan-700", bd: "border-cyan-200" };
  }
  if (s === "sample_addition") {
    return { label: getStatusLabel(status), bg: "bg-orange-50", fg: "text-orange-700", bd: "border-orange-200" };
  }
  if (s === "awaiting_results_approval") {
    return { label: getStatusLabel(status), bg: "bg-amber-50", fg: "text-amber-700", bd: "border-amber-200" };
  }
  if (s === "rerun_testing") {
    return { label: getStatusLabel(status), bg: "bg-yellow-50", fg: "text-yellow-700", bd: "border-yellow-200" };
  }
  return { label: getStatusLabel(status), bg: "bg-slate-50", fg: "text-slate-700", bd: "border-slate-200" };
};

const getPaymentStatusMeta = (paymentStatus?: string) => {
  const status = (paymentStatus || "PENDING").toUpperCase();
  if (status === "COMPLETED") {
    return { label: "Đã thanh toán", bg: "bg-emerald-50", fg: "text-emerald-700", bd: "border-emerald-200" };
  }
  return { label: "Chưa thanh toán", bg: "bg-orange-50", fg: "text-orange-700", bd: "border-orange-200" };
};

const getSampleAddRowId = (item: SampleAddResponse) => item.id || item.sampleAddId || "";

const getSampleAddStatusMeta = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "accepted") {
    return { label: "Đã chấp nhận", bg: "bg-emerald-50", fg: "text-emerald-700", bd: "border-emerald-200" };
  }
  if (s === "rejected") {
    return { label: "Từ chối", bg: "bg-red-50", fg: "text-red-700", bd: "border-red-200" };
  }
  if (s === "forward_analysis") {
    return { label: "Chuyển phân tích", bg: "bg-cyan-50", fg: "text-cyan-700", bd: "border-cyan-200" };
  }
  if (s === "initation" || s === "initiation" || s === "pending") {
    return { label: s === "pending" ? "Chờ xử lý" : "Khởi tạo", bg: "bg-blue-50", fg: "text-blue-700", bd: "border-blue-200" };
  }
  return {
    label: status ? String(status) : "—",
    bg: "bg-slate-50",
    fg: "text-slate-700",
    bd: "border-slate-200",
  };
};

const getSamplePaymentTypeLabel = (t?: string) => {
  const u = (t || "").toUpperCase();
  if (u === "CASH") return "Tiền mặt";
  if (u === "ONLINE_PAYMENT") return "Thanh toán online";
  return "Chưa có";
};

const isPaymentCompleted = (status?: string) =>
  String(status || "").toUpperCase() === "COMPLETED";

/** 12 trạng thái — khớp web `ALL_ORDER_STATUSES` (packages/utils/constants/order-status.ts) */
const ALL_ORDER_STATUS_UPDATE_OPTIONS: {
  value: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}[] = [
    { value: "initiation", label: "Khởi tạo", icon: CircleDot },
    { value: "forward_analysis", label: "Chuyển phân tích", icon: Send },
    { value: "accepted", label: "Đã chấp nhận", icon: CheckCircle2 },
    { value: "rejected", label: "Từ chối", icon: XCircle },
    { value: "in_progress", label: "Đang xử lý", icon: Clock },
    { value: "sample_error", label: "Lỗi mẫu", icon: AlertCircle },
    { value: "rerun_testing", label: "Chạy lại", icon: RotateCcw },
    { value: "completed", label: "Hoàn thành", icon: BadgeCheck },
    { value: "sample_addition", label: "Bổ sung mẫu", icon: Package },
    { value: "awaiting_results_approval", label: "Chờ duyệt kết quả", icon: Hourglass },
    { value: "results_approved", label: "Đã duyệt kết quả", icon: ShieldCheck },
    { value: "canceled", label: "Đã hủy", icon: Ban },
  ];

function FilterPill({
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

export default function AdminOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Tất cả hooks phải được gọi trước khi có early return
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [listMode, setListMode] = useState<ListMode>("orders");
  const [editingSampleAdd, setEditingSampleAdd] = useState<SampleAddResponse | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [editingPaymentType, setEditingPaymentType] = useState<"CASH" | "ONLINE_PAYMENT" | "">("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Fetch all orders with pagination
  const {
    data: ordersData,
    isLoading,
    error,
    refetch,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
    resetToFirstPage,
  } = usePaginatedQuery<OrderResponse>({
    queryKey: ["admin-orders", statusFilter, timeFilter],
    queryFn: async (params) => await orderService.getAll(params),
    defaultPageSize: 20,
    enabled: user?.role === "ROLE_ADMIN", // Chỉ fetch khi là admin
  });

  useFocusEffect(
    useCallback(() => {
      if (consumeListFresh("admin-orders")) {
        resetToFirstPage();
      }
    }, [resetToFirstPage])
  );

  const {
    data: sampleAddsResponse,
    isLoading: loadingSampleAdds,
    isError: sampleAddsError,
    refetch: refetchSampleAdds,
  } = useQuery({
    queryKey: ["admin-order-mgmt-sample-adds"],
    queryFn: () => sampleAddService.getAll(),
    enabled: user?.role === "ROLE_ADMIN",
    retry: false,
  });

  const { data: sampleAddServicesResponse } = useQuery({
    queryKey: ["sample-add-services-config"],
    queryFn: () => sampleAddServiceConfigService.getAll(),
    enabled: user?.role === "ROLE_ADMIN",
    retry: false,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      orderService.updateStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-mgmt-sample-adds"] });
      setShowStatusModal(false);
      setSelectedOrder(null);
      Alert.alert("Thành công", "Cập nhật trạng thái đơn hàng thành công");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể cập nhật trạng thái đơn hàng");
    },
  });

  const orders = useMemo(() => {
    return ordersData;
  }, [ordersData]);

  // Get unique hospitals for filter
  const hospitals = useMemo(() => {
    const hospitalSet = new Set<string>();
    orders.forEach((order) => {
      const hospitalName = order.specifyId?.hospital?.hospitalName;
      if (hospitalName) hospitalSet.add(hospitalName);
    });
    return Array.from(hospitalSet).sort();
  }, [orders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(order.orderId || "").toLowerCase().includes(q) ||
        String(order.orderName || "").toLowerCase().includes(q) ||
        String(order.customerName || "").toLowerCase().includes(q) ||
        String(order.specifyId?.hospital?.hospitalName || "").toLowerCase().includes(q) ||
        String(order.specifyId?.genomeTest?.testName || "").toLowerCase().includes(q);

      // Status filter
      const matchesStatus = statusFilter === "all" || order.orderStatus?.toLowerCase() === statusFilter.toLowerCase();

      // Hospital filter
      const matchesHospital =
        hospitalFilter === "all" ||
        order.specifyId?.hospital?.hospitalName === hospitalFilter;

      // Time filter
      let matchesTime = true;
      if (order.createdAt) {
        const now = new Date();
        const orderDate = new Date(order.createdAt);
        if (timeFilter === "today") {
          matchesTime = orderDate.toDateString() === now.toDateString();
        } else if (timeFilter === "week") {
          matchesTime = orderDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (timeFilter === "month") {
          matchesTime = orderDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
      }

      return matchesSearch && matchesStatus && matchesHospital && matchesTime;
    });
    return [...filtered].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [orders, searchQuery, statusFilter, hospitalFilter, timeFilter]);

  // Group orders by date
  const groupedOrders = useMemo(() => {
    const groups: Record<string, OrderResponse[]> = {};
    filteredOrders.forEach((order) => {
      const date = formatDate(order.createdAt);
      if (!groups[date]) groups[date] = [];
      groups[date].push(order);
    });
    return groups;
  }, [filteredOrders]);

  const sampleAddsList = useMemo(
    () => getApiResponseData<SampleAddResponse>(sampleAddsResponse) || [],
    [sampleAddsResponse]
  );
  const sampleAddServices = useMemo(
    () => getApiResponseData<SampleAddServiceConfigResponse>(sampleAddServicesResponse) || [],
    [sampleAddServicesResponse]
  );

  const filteredSampleAdds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return sampleAddsList.filter((s) => {
      if (!q) return true;
      const id = getSampleAddRowId(s).toLowerCase();
      return (
        id.includes(q) ||
        (s.sampleName || "").toLowerCase().includes(q) ||
        (s.orderId || "").toLowerCase().includes(q) ||
        (s.patientName || "").toLowerCase().includes(q)
      );
    });
  }, [sampleAddsList, searchQuery]);

  const groupedSampleAdds = useMemo(() => {
    const groups: Record<string, SampleAddResponse[]> = {};
    filteredSampleAdds.forEach((item) => {
      const raw = item.requestDate || (item as { createdAt?: string }).createdAt;
      const date = raw ? formatDate(raw) : "";
      const key = date || "Khác";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredSampleAdds]);

  const activeFilterCount = useMemo(() => {
    if (listMode !== "orders") return 0;
    let count = 0;
    if (statusFilter !== "all") count++;
    if (hospitalFilter !== "all") count++;
    if (timeFilter !== "all") count++;
    return count;
  }, [listMode, statusFilter, hospitalFilter, timeFilter]);

  const sampleDayKeys = useMemo(
    () =>
      Object.keys(groupedSampleAdds).sort((a, b) => {
        return new Date(b).getTime() - new Date(a).getTime();
      }),
    [groupedSampleAdds]
  );

  const handleUpdateStatus = (order: OrderResponse) => {
    setSelectedOrder(order);
    setShowStatusModal(true);
  };

  const refetchSampleAddData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-order-mgmt-sample-adds"] });
    queryClient.invalidateQueries({ queryKey: ["sample-adds"] });
    queryClient.invalidateQueries({ queryKey: ["invoice-create-sample-adds"] });
  }, [queryClient]);

  const handleApproveSampleAdd = useCallback(
    async (sample: SampleAddResponse) => {
      const rowId = getSampleAddRowId(sample);
      if (!rowId) return;
      try {
        const completed = isPaymentCompleted(sample.paymentStatus);
        if (!completed) {
          Alert.alert(
            "Mẫu chưa thanh toán",
            "Cần upload hóa đơn để phê duyệt mẫu bổ sung này. Bạn có muốn chọn file hóa đơn ngay không?",
            [
              { text: "Hủy", style: "cancel" },
              {
                text: "Chọn file",
                onPress: async () => {
                  const picked = await DocumentPicker.getDocumentAsync({
                    type: ["image/*", "application/pdf"],
                    copyToCacheDirectory: true,
                    multiple: false,
                  });
                  if (picked.canceled || !picked.assets?.[0]) return;
                  const file = picked.assets[0];
                  if (typeof file.size === "number" && file.size > 10 * 1024 * 1024) {
                    Alert.alert("File quá lớn", "Vui lòng chọn file <= 10MB.");
                    return;
                  }
                  const uploaded = await uploadFileToCloudinary(file.uri, {
                    folder: "invoices",
                    fileName: file.name || undefined,
                    mimeType: file.mimeType || undefined,
                  });
                  const invoiceLink = uploaded.secureUrl || uploaded.url;
                  if (!invoiceLink) {
                    throw new Error("Không upload được hóa đơn");
                  }
                  const ps = await sampleAddService.updatePaymentStatus(rowId, "COMPLETED");
                  if (!ps.success) throw new Error(ps.error || "Không cập nhật được trạng thái thanh toán");
                  const iv = await sampleAddService.updateInvoiceLink(rowId, invoiceLink);
                  if (!iv.success) throw new Error(iv.error || "Không lưu được hóa đơn");
                  const st = await sampleAddService.updateStatus(rowId, "accepted");
                  if (!st.success) throw new Error(st.error || "Không cập nhật được trạng thái mẫu");
                  refetchSampleAddData();
                  Alert.alert("Thành công", "Đã phê duyệt mẫu bổ sung và cập nhật hóa đơn.");
                },
              },
            ]
          );
          return;
        }

        const st = await sampleAddService.updateStatus(rowId, "accepted");
        if (!st.success) throw new Error(st.error || "Không cập nhật được trạng thái mẫu");
        refetchSampleAddData();
        Alert.alert("Thành công", "Đã phê duyệt mẫu bổ sung.");
      } catch (e: any) {
        Alert.alert("Lỗi", e?.message || "Không thể phê duyệt mẫu bổ sung");
      }
    },
    [refetchSampleAddData]
  );

  const handleRejectSampleAdd = useCallback(
    (sample: SampleAddResponse) => {
      const rowId = getSampleAddRowId(sample);
      if (!rowId) return;
      Alert.prompt?.(
        "Từ chối mẫu bổ sung",
        "Nhập lý do từ chối",
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Từ chối",
            style: "destructive",
            onPress: async (reason) => {
              try {
                const rejectReason = String(reason || "").trim();
                if (!rejectReason) {
                  Alert.alert("Thiếu lý do", "Vui lòng nhập lý do từ chối.");
                  return;
                }
                const st = await sampleAddService.updateStatus(rowId, "rejected");
                if (!st.success) throw new Error(st.error || "Không cập nhật được trạng thái");
                const currentNote = String(sample.note || "").trim();
                const updatedNote = currentNote
                  ? `${currentNote}\n[Từ chối] ${rejectReason}`
                  : `[Từ chối] ${rejectReason}`;
                const updatePayload: any = {
                  sampleName: sample.sampleName,
                  orderId: sample.orderId,
                  note: updatedNote,
                };
                if (sample.specifyId) updatePayload.specifyId = sample.specifyId;
                if (sample.patientId) updatePayload.patientId = sample.patientId;
                const up = await sampleAddService.update(rowId, updatePayload);
                if (!up.success) throw new Error(up.error || "Không lưu được lý do từ chối");
                refetchSampleAddData();
                Alert.alert("Thành công", "Đã từ chối mẫu bổ sung.");
              } catch (e: any) {
                Alert.alert("Lỗi", e?.message || "Không thể từ chối mẫu bổ sung");
              }
            },
          },
        ],
        "plain-text"
      );
      if (!Alert.prompt) {
        Alert.alert("Hỗ trợ nhập lý do", "Thiết bị này không hỗ trợ popup nhập nhanh. Hãy dùng chức năng Sửa để thêm ghi chú từ chối rồi đổi trạng thái.");
      }
    },
    [refetchSampleAddData]
  );

  const handleRetrySamplePayment = useCallback(
    (sample: SampleAddResponse) => {
      const rowId = getSampleAddRowId(sample);
      if (!rowId || !sample.orderId) {
        Alert.alert("Thiếu dữ liệu", "Mẫu bổ sung chưa có mã đơn hàng để thanh toán lại.");
        return;
      }
      const service = sampleAddServices.find((s) => s.sampleName === sample.sampleName);
      const amount = service?.finalPrice;
      if (!amount || amount <= 0) {
        Alert.alert("Thiếu cấu hình giá", "Không tìm thấy giá dịch vụ mẫu bổ sung để thanh toán lại.");
        return;
      }
      router.push({
        pathname: "/payment",
        params: {
          orderId: sample.orderId,
          orderName: sample.sampleName || "Mẫu bổ sung",
          amount: String(Math.round(amount)),
          sampleAddId: rowId,
        },
      });
    },
    [router, sampleAddServices]
  );

  const handleDeleteSampleAdd = useCallback(
    (sample: SampleAddResponse) => {
      const rowId = getSampleAddRowId(sample);
      if (!rowId) return;
      Alert.alert("Xác nhận xóa", `Bạn có chắc muốn xóa mẫu bổ sung "${sample.sampleName || rowId}"?`, [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            const res = await sampleAddService.delete(rowId);
            if (!res.success) {
              Alert.alert("Lỗi", res.error || "Không thể xóa mẫu bổ sung");
              return;
            }
            refetchSampleAddData();
            Alert.alert("Thành công", "Đã xóa mẫu bổ sung.");
          },
        },
      ]);
    },
    [refetchSampleAddData]
  );

  const handleStatusSelect = (newStatus: string) => {
    if (!selectedOrder) return;
    updateStatusMutation.mutate({
      orderId: selectedOrder.orderId,
      status: newStatus,
    });
  };

  // Guard: Chỉ ADMIN — sau toàn bộ hooks
  if (user?.role !== "ROLE_ADMIN") {
    return null;
  }

  if (listMode === "orders" && isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (listMode === "orders" && error) {
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

  const dayKeys = Object.keys(groupedOrders).sort((a, b) => {
    const maxA = Math.max(
      ...groupedOrders[a].map((o) => (o.createdAt ? new Date(o.createdAt).getTime() : 0))
    );
    const maxB = Math.max(
      ...groupedOrders[b].map((o) => (o.createdAt ? new Date(o.createdAt).getTime() : 0))
    );
    return maxB - maxA;
  });

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen
        options={{
          title: "Quản lý đơn hàng",
          headerStyle: { backgroundColor: "#0891b2" },
          headerTintColor: "#fff",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.push("/admin-home")}
              className="ml-2"
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Header với search và filter */}
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center mb-3">
          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">Quản lý đơn hàng</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {listMode === "orders"
                ? `${filteredOrders.length} đơn hàng`
                : `${filteredSampleAdds.length} mẫu bổ sung`}
            </Text>
          </View>

          {listMode === "orders" ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/quick-order",
                  params: { source: "admin" },
                })
              }
              className="h-10 px-3 rounded-xl bg-cyan-600 items-center justify-center mr-2 flex-row"
              activeOpacity={0.85}
            >
              <Zap size={14} color="#FFFFFF" />
              <Text className="ml-1 text-[11px] font-extrabold text-white">Nhanh</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() =>
              listMode === "orders"
                ? router.push({
                  pathname: "/create-order",
                  params: { source: "admin" },
                })
                : router.push("/new-sample-add")
            }
            className="w-10 h-10 rounded-xl bg-emerald-600 items-center justify-center mr-2"
            activeOpacity={0.85}
          >
            <Plus size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => listMode === "orders" && setShowFilters((v) => !v)}
            disabled={listMode !== "orders"}
            className={`w-10 h-10 rounded-xl border items-center justify-center relative ${listMode !== "orders"
                ? "bg-slate-100 border-slate-200 opacity-40"
                : showFilters
                  ? "bg-sky-600 border-sky-600"
                  : "bg-sky-50 border-sky-200"
              }`}
            activeOpacity={0.85}
          >
            <SlidersHorizontal
              size={18}
              color={listMode !== "orders" ? "#94A3B8" : showFilters ? "#FFFFFF" : "#0284C7"}
            />
            {activeFilterCount > 0 && (
              <View className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white items-center justify-center">
                <Text className="text-[10px] font-bold text-white">{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2 mb-3">
          <TouchableOpacity
            className={`flex-1 rounded-xl py-2.5 px-2 border ${listMode === "orders" ? "bg-sky-600 border-sky-600" : "bg-white border-slate-200"
              }`}
            onPress={() => setListMode("orders")}
            activeOpacity={0.85}
          >
            <Text
              className={`text-center text-[12px] font-extrabold ${listMode === "orders" ? "text-white" : "text-slate-600"
                }`}
            >
              Đơn hàng
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 rounded-xl py-2.5 px-2 border ${listMode === "sample_adds" ? "bg-sky-600 border-sky-600" : "bg-white border-slate-200"
              }`}
            onPress={() => {
              setListMode("sample_adds");
              setShowFilters(false);
            }}
            activeOpacity={0.85}
          >
            <Text
              className={`text-center text-[12px] font-extrabold ${listMode === "sample_adds" ? "text-white" : "text-slate-600"
                }`}
            >
              Mẫu bổ sung
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View className="flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder={
              listMode === "orders"
                ? "Tìm theo mã / tên đơn / bệnh viện..."
                : "Tìm theo mã mẫu / tên mẫu / mã đơn..."
            }
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

        {/* Filter panel (chỉ áp dụng cho danh sách đơn hàng) */}
        {listMode === "orders" && showFilters && (
          <View className="mt-3">
            {/* Time filter */}
            <View className="mb-3">
              <View className="flex-row items-center mb-2">
                <Calendar size={16} color="#0284C7" />
                <Text className="ml-2 text-xs font-extrabold text-slate-700">Thời gian</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <FilterPill label="Hôm nay" active={timeFilter === "today"} onPress={() => setTimeFilter("today")} />
                <FilterPill label="Tuần này" active={timeFilter === "week"} onPress={() => setTimeFilter("week")} />
                <FilterPill label="Tháng này" active={timeFilter === "month"} onPress={() => setTimeFilter("month")} />
                <FilterPill label="Tất cả" active={timeFilter === "all"} onPress={() => setTimeFilter("all")} />
              </View>
            </View>

            {/* Status filter — đủ 12 trạng thái như web */}
            <View className="mb-3">
              <View className="flex-row items-center mb-2">
                <Filter size={16} color="#0284C7" />
                <Text className="ml-2 text-xs font-extrabold text-slate-700">Trạng thái</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: "row", flexWrap: "nowrap", gap: 8, paddingRight: 8, alignItems: "center" }}
              >
                <FilterPill label="Tất cả" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
                <FilterPill
                  label="Khởi tạo"
                  active={statusFilter === "initiation"}
                  onPress={() => setStatusFilter("initiation")}
                />
                <FilterPill
                  label="Chuyển PT"
                  active={statusFilter === "forward_analysis"}
                  onPress={() => setStatusFilter("forward_analysis")}
                />
                <FilterPill
                  label="Đã CN"
                  active={statusFilter === "accepted"}
                  onPress={() => setStatusFilter("accepted")}
                />
                <FilterPill
                  label="Từ chối"
                  active={statusFilter === "rejected"}
                  onPress={() => setStatusFilter("rejected")}
                />
                <FilterPill
                  label="Đang XL"
                  active={statusFilter === "in_progress"}
                  onPress={() => setStatusFilter("in_progress")}
                />
                <FilterPill
                  label="Lỗi mẫu"
                  active={statusFilter === "sample_error"}
                  onPress={() => setStatusFilter("sample_error")}
                />
                <FilterPill
                  label="Chạy lại"
                  active={statusFilter === "rerun_testing"}
                  onPress={() => setStatusFilter("rerun_testing")}
                />
                <FilterPill
                  label="Hoàn thành"
                  active={statusFilter === "completed"}
                  onPress={() => setStatusFilter("completed")}
                />
                <FilterPill
                  label="Bổ sung"
                  active={statusFilter === "sample_addition"}
                  onPress={() => setStatusFilter("sample_addition")}
                />
                <FilterPill
                  label="Chờ DKQ"
                  active={statusFilter === "awaiting_results_approval"}
                  onPress={() => setStatusFilter("awaiting_results_approval")}
                />
                <FilterPill
                  label="Đã DKQ"
                  active={statusFilter === "results_approved"}
                  onPress={() => setStatusFilter("results_approved")}
                />
                <FilterPill
                  label="Đã hủy"
                  active={statusFilter === "canceled"}
                  onPress={() => setStatusFilter("canceled")}
                />
              </ScrollView>
            </View>

            {/* Hospital filter */}
            {hospitals.length > 0 && (
              <View className="mb-3">
                <View className="flex-row items-center mb-2">
                  <Text className="text-xs font-extrabold text-slate-700">Bệnh viện</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                  <FilterPill
                    label="Tất cả"
                    active={hospitalFilter === "all"}
                    onPress={() => setHospitalFilter("all")}
                  />
                  {hospitals.map((hospital) => (
                    <FilterPill
                      key={hospital}
                      label={hospital}
                      active={hospitalFilter === hospital}
                      onPress={() => setHospitalFilter(hospital)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Danh sách đơn hàng hoặc mẫu bổ sung */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
      >
        {listMode === "orders" ? (
          dayKeys.length === 0 ? (
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
                    <Text className="text-xs font-extrabold text-sky-700">{groupedOrders[date].length}</Text>
                  </View>
                </View>

                {groupedOrders[date].map((order) => {
                  const statusBadge = getStatusBadge(order.orderStatus || "");
                  const paymentMeta = getPaymentStatusMeta(order.paymentStatus);

                  return (
                    <TouchableOpacity
                      key={order.orderId}
                      className="bg-white rounded-2xl p-4 mb-3 border border-sky-100"
                      onPress={() =>
                        router.push({
                          pathname: "/order-detail",
                          params: { orderId: order.orderId },
                        })
                      }
                      activeOpacity={0.85}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-1 pr-2">
                          <Text className="text-xs font-extrabold text-sky-700" numberOfLines={1}>
                            {order.orderId}
                          </Text>
                          <Text className="text-[10px] font-bold text-slate-500 mt-0.5" numberOfLines={1}>
                            {formatDate(order.createdAt)}
                          </Text>
                        </View>

                        <TouchableOpacity
                          className={`px-2.5 py-1 rounded-full border ${statusBadge.bg} ${statusBadge.bd}`}
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            handleUpdateStatus(order);
                          }}
                          disabled={updateStatusMutation.isPending}
                          activeOpacity={0.8}
                        >
                          <Text className={`text-xs font-extrabold ${statusBadge.fg}`}>{statusBadge.label}</Text>
                        </TouchableOpacity>
                      </View>

                      <Text className="mt-2 text-[14px] font-extrabold text-slate-900" numberOfLines={2}>
                        {order.orderName}
                      </Text>

                      <View className="mt-2 flex-row items-center flex-wrap">
                        {typeof order.paymentAmount === "number" && order.paymentAmount > 0 && (
                          <>
                            <Text className="text-sm font-extrabold text-slate-900">
                              {formatCurrency(order.paymentAmount)} VND
                            </Text>
                            <Text className="mx-2 text-slate-300">•</Text>
                          </>
                        )}

                        {order.specifyId?.hospital?.hospitalName && (
                          <>
                            <Text className="text-xs font-bold text-slate-600" numberOfLines={1}>
                              {order.specifyId.hospital.hospitalName}
                            </Text>
                            <Text className="mx-2 text-slate-300">•</Text>
                          </>
                        )}

                        <View className={`px-2 py-0.5 rounded-full border ${paymentMeta.bg} ${paymentMeta.bd}`}>
                          <Text className={`text-[10px] font-extrabold ${paymentMeta.fg}`}>{paymentMeta.label}</Text>
                        </View>
                      </View>

                      <View className="mt-3 flex-row items-center justify-between">
                        <Text className="text-xs font-bold text-slate-500" numberOfLines={1}>
                          {order.customerName || order.specifyId?.patient?.patientName || ""}
                        </Text>

                        <View className="flex-row gap-2">
                          {isPaymentCompleted(order.paymentStatus) ? (
                            <TouchableOpacity
                              className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 items-center justify-center"
                              onPress={(e) => {
                                e.stopPropagation();
                                router.push({
                                  pathname: "/invoice",
                                  params: { orderId: order.orderId },
                                } as any);
                              }}
                              activeOpacity={0.85}
                            >
                              <FileText size={16} color="#7C3AED" />
                            </TouchableOpacity>
                          ) : null}

                          <TouchableOpacity
                            className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 items-center justify-center"
                            onPress={(e) => {
                              e.stopPropagation();
                              router.push({
                                pathname: "/update-order-wizard",
                                params: { orderId: order.orderId, source: "admin" },
                              });
                            }}
                            activeOpacity={0.85}
                          >
                            <Pencil size={16} color="#059669" />
                          </TouchableOpacity>

                          <View className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center">
                            <ChevronRight size={18} color="#0284C7" />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )
        ) : sampleAddsError ? (
          <View className="pt-12 items-center px-6">
            <Text className="text-base font-extrabold text-slate-900 text-center">Không tải được mẫu bổ sung</Text>
            <TouchableOpacity
              className="mt-4 bg-sky-600 py-3 px-6 rounded-2xl"
              onPress={() => refetchSampleAdds()}
              activeOpacity={0.85}
            >
              <Text className="text-white text-sm font-extrabold">Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : loadingSampleAdds ? (
          <View className="pt-16 items-center">
            <ActivityIndicator size="large" color="#0284C7" />
            <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải mẫu bổ sung...</Text>
          </View>
        ) : sampleDayKeys.length === 0 ? (
          <View className="pt-12 items-center px-6">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 items-center justify-center border border-sky-200">
              <FlaskConical size={24} color="#0284C7" />
            </View>
            <Text className="mt-4 text-base font-extrabold text-slate-900">Không có mẫu bổ sung</Text>
            <Text className="mt-2 text-xs font-bold text-slate-500 text-center">
              Thử đổi từ khóa tìm kiếm hoặn thêm mẫu mới bằng nút +.
            </Text>
          </View>
        ) : (
          sampleDayKeys.map((date) => (
            <View key={`sa-${date}`} className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-[15px] font-extrabold text-slate-900">{date}</Text>
                <View className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200">
                  <Text className="text-xs font-extrabold text-sky-700">{groupedSampleAdds[date].length}</Text>
                </View>
              </View>

              {groupedSampleAdds[date].map((sa) => {
                const rowId = getSampleAddRowId(sa);
                const st = getSampleAddStatusMeta(sa.status);
                const pay = getPaymentStatusMeta(sa.paymentStatus);
                return (
                  <TouchableOpacity
                    key={rowId || `${date}-${sa.sampleName}`}
                    className="bg-white rounded-2xl p-4 mb-3 border border-sky-100"
                    onPress={() => {
                      if (sa.orderId) {
                        router.push({ pathname: "/order-detail", params: { orderId: sa.orderId } });
                      }
                    }}
                    activeOpacity={0.85}
                    disabled={!sa.orderId}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-extrabold text-sky-700" numberOfLines={1}>
                          {rowId || "—"}
                        </Text>
                        <Text className="text-[10px] font-bold text-slate-500 mt-0.5" numberOfLines={1}>
                          Đơn: {sa.orderId || "—"}
                          {sa.requestDate || (sa as { createdAt?: string }).createdAt
                            ? ` · ${formatDate(sa.requestDate || (sa as { createdAt?: string }).createdAt)}`
                            : ""}
                        </Text>
                      </View>
                      <View className={`px-2.5 py-1 rounded-full border ${st.bg} ${st.bd}`}>
                        <Text className={`text-xs font-extrabold ${st.fg}`}>{st.label}</Text>
                      </View>
                    </View>

                    <Text className="mt-2 text-[14px] font-extrabold text-slate-900" numberOfLines={2}>
                      {sa.sampleName || "Mẫu bổ sung"}
                    </Text>

                    <View className="mt-2 flex-row items-center flex-wrap">
                      <View className={`px-2 py-0.5 rounded-full border ${pay.bg} ${pay.bd}`}>
                        <Text className={`text-[10px] font-extrabold ${pay.fg}`}>{pay.label}</Text>
                      </View>
                      <Text className="mx-2 text-slate-300">•</Text>
                      <Text className="text-xs font-bold text-slate-600" numberOfLines={1}>
                        {getSamplePaymentTypeLabel(sa.paymentType)}
                      </Text>
                    </View>

                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-xs font-bold text-slate-500 flex-1 pr-2" numberOfLines={1}>
                        {sa.patientName || "—"}
                      </Text>
                      <View className="flex-row gap-2">
                        {sa.status !== "accepted" && sa.status !== "rejected" ? (
                          <>
                            <TouchableOpacity
                              className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 items-center justify-center"
                              onPress={(e) => {
                                e.stopPropagation();
                                handleApproveSampleAdd(sa);
                              }}
                              activeOpacity={0.85}
                            >
                              <CheckCircle2 size={16} color="#059669" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 items-center justify-center"
                              onPress={(e) => {
                                e.stopPropagation();
                                handleRejectSampleAdd(sa);
                              }}
                              activeOpacity={0.85}
                            >
                              <XCircle size={16} color="#DC2626" />
                            </TouchableOpacity>
                          </>
                        ) : null}

                        <TouchableOpacity
                          className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 items-center justify-center"
                          onPress={(e) => {
                            e.stopPropagation();
                            setEditingSampleAdd(sa);
                            setEditingNote(String(sa.note || ""));
                            const pt = String(sa.paymentType || "").toUpperCase();
                            setEditingPaymentType(
                              pt === "CASH" || pt === "ONLINE_PAYMENT" ? (pt as "CASH" | "ONLINE_PAYMENT") : ""
                            );
                          }}
                          activeOpacity={0.85}
                        >
                          <Pencil size={16} color="#B45309" />
                        </TouchableOpacity>

                        {String(sa.paymentType || "").toUpperCase() !== "CASH" &&
                          !isPaymentCompleted(sa.paymentStatus) ? (
                          <TouchableOpacity
                            className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 items-center justify-center"
                            onPress={(e) => {
                              e.stopPropagation();
                              handleRetrySamplePayment(sa);
                            }}
                            activeOpacity={0.85}
                          >
                            <CreditCard size={16} color="#4F46E5" />
                          </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                          className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 items-center justify-center"
                          onPress={(e) => {
                            e.stopPropagation();
                            const keyword = String(sa.sampleName || sa.orderId || "").trim();
                            router.push({
                              pathname: "/patient-metadatas",
                              params: keyword ? { q: keyword } : undefined,
                            } as any);
                          }}
                          activeOpacity={0.85}
                        >
                          <CloudUpload size={16} color="#0891B2" />
                        </TouchableOpacity>

                        {sa.orderId && isPaymentCompleted(sa.paymentStatus) ? (
                          <TouchableOpacity
                            className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 items-center justify-center"
                            onPress={(e) => {
                              e.stopPropagation();
                              router.push({
                                pathname: "/invoice",
                                params: { orderId: sa.orderId },
                              } as any);
                            }}
                            activeOpacity={0.85}
                          >
                            <FileText size={16} color="#7C3AED" />
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 items-center justify-center"
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteSampleAdd(sa);
                          }}
                          activeOpacity={0.85}
                        >
                          <Trash2 size={16} color="#E11D48" />
                        </TouchableOpacity>
                        <View className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center">
                          <ChevronRight size={18} color="#0284C7" />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {listMode === "orders" && totalPages > 1 && (
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
        visible={!!editingSampleAdd}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submittingEdit) {
            setEditingSampleAdd(null);
          }
        }}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center px-4"
          activeOpacity={1}
          onPress={() => {
            if (!submittingEdit) setEditingSampleAdd(null);
          }}
        >
          <TouchableOpacity
            className="bg-white rounded-3xl p-6 w-full max-w-[420px]"
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-extrabold text-slate-900 mb-2">Chỉnh sửa mẫu bổ sung</Text>
            <Text className="text-xs text-slate-500 mb-4">
              {editingSampleAdd?.sampleName || "Mẫu bổ sung"} • {editingSampleAdd?.orderId || "—"}
            </Text>

            <Text className="text-xs font-bold text-slate-600 mb-1">Hình thức thanh toán</Text>
            <View className="flex-row gap-2 mb-4">
              <TouchableOpacity
                className={`flex-1 rounded-xl px-3 py-2.5 border ${editingPaymentType === "CASH"
                    ? "bg-sky-600 border-sky-600"
                    : "bg-white border-slate-200"
                  }`}
                onPress={() => setEditingPaymentType("CASH")}
                activeOpacity={0.85}
              >
                <Text
                  className={`text-center text-xs font-extrabold ${editingPaymentType === "CASH" ? "text-white" : "text-slate-700"
                    }`}
                >
                  Tiền mặt
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-xl px-3 py-2.5 border ${editingPaymentType === "ONLINE_PAYMENT"
                    ? "bg-sky-600 border-sky-600"
                    : "bg-white border-slate-200"
                  }`}
                onPress={() => setEditingPaymentType("ONLINE_PAYMENT")}
                activeOpacity={0.85}
              >
                <Text
                  className={`text-center text-xs font-extrabold ${editingPaymentType === "ONLINE_PAYMENT" ? "text-white" : "text-slate-700"
                    }`}
                >
                  Online
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold text-slate-600 mb-1">Ghi chú</Text>
            <TextInput
              value={editingNote}
              onChangeText={setEditingNote}
              placeholder="Nhập ghi chú..."
              className="min-h-[100px] rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800"
              multiline
              textAlignVertical="top"
            />

            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-slate-100 items-center"
                onPress={() => setEditingSampleAdd(null)}
                disabled={submittingEdit}
                activeOpacity={0.85}
              >
                <Text className="text-slate-700 text-sm font-extrabold">Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-amber-600 items-center"
                disabled={submittingEdit || !editingSampleAdd}
                activeOpacity={0.85}
                onPress={async () => {
                  if (!editingSampleAdd) return;
                  try {
                    setSubmittingEdit(true);
                    const rowId = getSampleAddRowId(editingSampleAdd);
                    if (!rowId) throw new Error("Không tìm thấy mã mẫu bổ sung");
                    const updatePayload: any = {
                      sampleName: editingSampleAdd.sampleName,
                      orderId: editingSampleAdd.orderId,
                      note: editingNote.trim() || undefined,
                    };
                    if (editingSampleAdd.specifyId) updatePayload.specifyId = editingSampleAdd.specifyId;
                    if (editingSampleAdd.patientId) updatePayload.patientId = editingSampleAdd.patientId;
                    const up = await sampleAddService.update(rowId, updatePayload);
                    if (!up.success) throw new Error(up.error || "Không lưu được thông tin");
                    if (editingPaymentType) {
                      const pt = await sampleAddService.updatePaymentType(rowId, editingPaymentType);
                      if (!pt.success) throw new Error(pt.error || "Không cập nhật được hình thức thanh toán");
                    }
                    refetchSampleAddData();
                    setEditingSampleAdd(null);
                    Alert.alert("Thành công", "Đã cập nhật mẫu bổ sung.");
                  } catch (e: any) {
                    Alert.alert("Lỗi", e?.message || "Không thể cập nhật mẫu bổ sung");
                  } finally {
                    setSubmittingEdit(false);
                  }
                }}
              >
                {submittingEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white text-sm font-extrabold">Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Status update modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!updateStatusMutation.isPending) {
            setShowStatusModal(false);
            setSelectedOrder(null);
          }
        }}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center px-4"
          activeOpacity={1}
          onPress={() => {
            if (!updateStatusMutation.isPending) {
              setShowStatusModal(false);
              setSelectedOrder(null);
            }
          }}
        >
          <TouchableOpacity
            className="bg-white rounded-3xl p-6 w-full max-w-[400px]"
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-extrabold text-slate-900 mb-2">Cập nhật trạng thái</Text>
            <Text className="text-sm text-slate-600 mb-4" numberOfLines={2}>
              Đơn hàng: {selectedOrder?.orderName || selectedOrder?.orderId}
            </Text>
            <Text className="text-xs text-slate-500 mb-4">
              Trạng thái hiện tại: {getStatusLabel(selectedOrder?.orderStatus || "")}
            </Text>

            <ScrollView className="max-h-[340px] mb-4" showsVerticalScrollIndicator={false}>
              {ALL_ORDER_STATUS_UPDATE_OPTIONS.map((status) => {
                const Icon = status.icon;
                const isCurrent = selectedOrder?.orderStatus?.toLowerCase() === status.value.toLowerCase();
                return (
                  <TouchableOpacity
                    key={status.value}
                    className={`flex-row items-center p-3 rounded-xl mb-2 border ${isCurrent ? "bg-sky-50 border-sky-300" : "bg-white border-slate-200"
                      }`}
                    onPress={() => {
                      if (!isCurrent && !updateStatusMutation.isPending) {
                        handleStatusSelect(status.value);
                      }
                    }}
                    disabled={isCurrent || updateStatusMutation.isPending}
                    activeOpacity={0.7}
                  >
                    <Icon size={20} color={isCurrent ? "#0284C7" : "#64748B"} />
                    <Text
                      className={`ml-3 flex-1 text-sm font-bold ${isCurrent ? "text-sky-700" : "text-slate-700"
                        }`}
                    >
                      {status.label}
                    </Text>
                    {isCurrent && (
                      <View className="w-5 h-5 rounded-full bg-sky-600 items-center justify-center">
                        <Text className="text-white text-xs font-bold">✓</Text>
                      </View>
                    )}
                    {updateStatusMutation.isPending && !isCurrent && (
                      <ActivityIndicator size="small" color="#0284C7" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-slate-100 items-center"
                onPress={() => {
                  if (!updateStatusMutation.isPending) {
                    setShowStatusModal(false);
                    setSelectedOrder(null);
                  }
                }}
                disabled={updateStatusMutation.isPending}
                activeOpacity={0.85}
              >
                <Text className="text-slate-700 text-sm font-extrabold">Đóng</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
