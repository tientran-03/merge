import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  AlertCircle,
  FileText,
  Building2,
  Calendar,
} from "lucide-react-native";
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isStaffLikeOperationalRole } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { orderService, OrderResponse } from "@/services/orderService";
import { getOrderStatusLabel } from "@/lib/constants/order-status";

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("vi-VN").format(amount);
};

// Get status badge colors
const getStatusBadge = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "forward_analysis") {
    return {
      label: "Chờ duyệt phân tích",
      bg: "bg-cyan-50",
      fg: "text-cyan-700",
      bd: "border-cyan-200",
    };
  }
  if (s === "sample_addition") {
    return {
      label: "Bổ sung mẫu",
      bg: "bg-orange-50",
      fg: "text-orange-700",
      bd: "border-orange-200",
    };
  }
  return {
    label: getOrderStatusLabel(status),
    bg: "bg-slate-50",
    fg: "text-slate-700",
    bd: "border-slate-200",
  };
};

export default function AdminApprovalsScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Guard: Chỉ ADMIN mới được vào màn hình này
  useEffect(() => {
    if (!authLoading && user && user.role !== "ROLE_ADMIN") {
      if (isStaffLikeOperationalRole(user.role)) {
        router.replace("/home");
      } else {
        router.replace("/");
      }
    }
  }, [user, authLoading, router]);

  // Fetch pending orders (FORWARD_ANALYSIS and SAMPLE_ADDITION)
  const {
    data: forwardAnalysisOrders = [],
    isLoading: loadingForward,
    refetch: refetchForward,
    isFetching: fetchingForward,
  } = useQuery({
    queryKey: ["orders-forward-analysis"],
    queryFn: async () => {
      const response = await orderService.getByStatus("forward_analysis");
      if (response.success && response.data) {
        return Array.isArray(response.data) ? response.data : [];
      }
      return [];
    },
    enabled: user?.role === "ROLE_ADMIN",
  });

  const {
    data: sampleAdditionOrders = [],
    isLoading: loadingSample,
    refetch: refetchSample,
    isFetching: fetchingSample,
  } = useQuery({
    queryKey: ["orders-sample-addition"],
    queryFn: async () => {
      const response = await orderService.getByStatus("sample_addition");
      if (response.success && response.data) {
        return Array.isArray(response.data) ? response.data : [];
      }
      return [];
    },
    enabled: user?.role === "ROLE_ADMIN",
  });

  // Combine orders
  const pendingOrders = useMemo(() => {
    return [...forwardAnalysisOrders, ...sampleAdditionOrders];
  }, [forwardAnalysisOrders, sampleAdditionOrders]);

  const isLoading = loadingForward || loadingSample;
  const isFetching = fetchingForward || fetchingSample;

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      orderService.updateStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders-forward-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["orders-sample-addition"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      Alert.alert("Thành công", "Đã phê duyệt đơn hàng");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể phê duyệt đơn hàng");
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      orderService.reject(orderId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders-forward-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["orders-sample-addition"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowRejectModal(false);
      setSelectedOrder(null);
      setRejectReason("");
      Alert.alert("Thành công", "Đã từ chối đơn hàng");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể từ chối đơn hàng");
    },
  });

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return pendingOrders;
    const query = searchQuery.toLowerCase();
    return pendingOrders.filter(
      (order) =>
        order.orderId?.toLowerCase().includes(query) ||
        order.orderName?.toLowerCase().includes(query) ||
        order.customerName?.toLowerCase().includes(query) ||
        order.specifyId?.hospitalId?.toLowerCase().includes(query)
    );
  }, [pendingOrders, searchQuery]);

  const handleApprove = (order: OrderResponse) => {
    const newStatus =
      order.orderStatus === "forward_analysis" ? "accepted" : "in_progress";
    Alert.alert(
      "Xác nhận phê duyệt",
      `Bạn có chắc chắn muốn phê duyệt đơn hàng ${order.orderId}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Phê duyệt",
          onPress: () => approveMutation.mutate({ orderId: order.orderId, status: newStatus }),
        },
      ]
    );
  };

  const handleReject = (order: OrderResponse) => {
    setSelectedOrder(order);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleRejectConfirm = () => {
    if (!selectedOrder || !rejectReason.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập lý do từ chối");
      return;
    }
    rejectMutation.mutate({
      orderId: selectedOrder.orderId,
      reason: rejectReason.trim(),
    });
  };

  const refetch = () => {
    refetchForward();
    refetchSample();
  };

  if (authLoading || isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải...</Text>
      </View>
    );
  }

  if (!user || user.role !== "ROLE_ADMIN") {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
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
            <Text className="text-slate-900 text-lg font-extrabold">Thông báo & Phê duyệt</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {filteredOrders.length} đơn hàng chờ phê duyệt
            </Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-sky-50 rounded-xl px-3 py-2 border border-sky-200">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 ml-2 text-sm text-slate-900"
            placeholder="Tìm kiếm đơn hàng..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} className="ml-2">
              <XCircle size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor="#0284C7"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredOrders.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
            <CheckCircle size={48} color="#94A3B8" />
            <Text className="mt-4 text-slate-500 text-sm font-bold text-center">
              {searchQuery ? "Không tìm thấy đơn hàng nào" : "Không có đơn hàng chờ phê duyệt"}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {filteredOrders.map((order) => {
              const statusBadge = getStatusBadge(order.orderStatus);

              return (
                <View
                  key={order.orderId}
                  className="bg-white rounded-2xl p-4 border border-sky-100"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <View className="flex-row items-center mb-1">
                        <FileText size={18} color="#0284C7" />
                        <Text className="ml-2 text-slate-900 text-base font-extrabold">
                          {order.orderName || order.orderId}
                        </Text>
                      </View>
                      <Text className="text-slate-400 text-[10px] mt-1 font-bold">
                        Mã đơn: {order.orderId}
                      </Text>
                      {order.customerName && (
                        <Text className="text-slate-600 text-xs mt-1">
                          Khách hàng: {order.customerName}
                        </Text>
                      )}
                      {order.specifyId?.hospitalId && (
                        <View className="flex-row items-center mt-1">
                          <Building2 size={12} color="#64748B" />
                          <Text className="text-slate-600 text-xs ml-1">
                            {order.specifyId.hospitalId}
                          </Text>
                        </View>
                      )}
                      {order.createdAt && (
                        <View className="flex-row items-center mt-1">
                          <Calendar size={12} color="#64748B" />
                          <Text className="text-slate-500 text-xs ml-1">
                            {formatDate(order.createdAt)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View
                      className={`px-2 py-1 rounded-full border ${statusBadge.bg} ${statusBadge.bd}`}
                    >
                      <Text className={`text-[10px] font-bold ${statusBadge.fg}`}>
                        {statusBadge.label}
                      </Text>
                    </View>
                  </View>

                  {order.paymentAmount && (
                    <View className="mb-3">
                      <Text className="text-slate-600 text-xs">
                        Số tiền: <Text className="font-bold">{formatCurrency(order.paymentAmount)} VNĐ</Text>
                      </Text>
                    </View>
                  )}

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedOrder(order);
                        setShowDetailModal(true);
                      }}
                      className="flex-1 py-2 rounded-xl bg-sky-50 border border-sky-200 items-center"
                      activeOpacity={0.7}
                    >
                      <Eye size={16} color="#0284C7" />
                      <Text className="text-sky-700 text-xs font-bold mt-1">Xem chi tiết</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleApprove(order)}
                      disabled={approveMutation.isPending}
                      className="flex-1 py-2 rounded-xl bg-green-50 border border-green-200 items-center"
                      activeOpacity={0.7}
                      style={{ opacity: approveMutation.isPending ? 0.5 : 1 }}
                    >
                      {approveMutation.isPending ? (
                        <ActivityIndicator size="small" color="#16A34A" />
                      ) : (
                        <>
                          <CheckCircle size={16} color="#16A34A" />
                          <Text className="text-green-700 text-xs font-bold mt-1">Phê duyệt</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleReject(order)}
                      disabled={rejectMutation.isPending}
                      className="flex-1 py-2 rounded-xl bg-red-50 border border-red-200 items-center"
                      activeOpacity={0.7}
                      style={{ opacity: rejectMutation.isPending ? 0.5 : 1 }}
                    >
                      <XCircle size={16} color="#EF4444" />
                      <Text className="text-red-700 text-xs font-bold mt-1">Từ chối</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[80%]">
            <View className="px-6 py-4 border-b border-sky-100">
              <View className="flex-row items-center justify-between">
                <Text className="text-slate-900 text-lg font-extrabold">Từ chối đơn hàng</Text>
                <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                  <XCircle size={24} color="#64748B" />
                </TouchableOpacity>
              </View>
              {selectedOrder && (
                <Text className="text-slate-500 text-xs mt-1">
                  Mã đơn: {selectedOrder.orderId}
                </Text>
              )}
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
              <View className="mb-4">
                <Text className="text-slate-700 text-sm font-bold mb-2">
                  Lý do từ chối <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-slate-900 text-sm"
                  placeholder="Nhập lý do từ chối đơn hàng..."
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                  style={{ minHeight: 100 }}
                />
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setShowRejectModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 items-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-slate-700 text-sm font-bold">Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRejectConfirm}
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-red-600 items-center"
                  activeOpacity={0.7}
                  style={{ opacity: !rejectReason.trim() || rejectMutation.isPending ? 0.5 : 1 }}
                >
                  {rejectMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-white text-sm font-extrabold">Xác nhận từ chối</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          visible={showDetailModal}
          order={selectedOrder}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// Order Detail Modal Component
function OrderDetailModal({
  visible,
  order,
  onClose,
}: {
  visible: boolean;
  order: OrderResponse;
  onClose: () => void;
}) {
  const statusBadge = getStatusBadge(order.orderStatus);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[90%]">
          <View className="px-6 py-4 border-b border-sky-100">
            <View className="flex-row items-center justify-between">
              <Text className="text-slate-900 text-lg font-extrabold">Chi tiết đơn hàng</Text>
              <TouchableOpacity onPress={onClose}>
                <XCircle size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            <View className="mb-4">
              <Text className="text-slate-500 text-xs font-bold mb-1">Mã đơn hàng</Text>
              <Text className="text-slate-900 text-base font-extrabold">{order.orderId}</Text>
            </View>

            <View className="mb-4">
              <Text className="text-slate-500 text-xs font-bold mb-1">Tên đơn hàng</Text>
              <Text className="text-slate-900 text-sm">{order.orderName || "N/A"}</Text>
            </View>

            <View className="mb-4">
              <Text className="text-slate-500 text-xs font-bold mb-1">Trạng thái</Text>
              <View className="mt-1">
                <View className={`px-3 py-1.5 rounded-full border self-start ${statusBadge.bg} ${statusBadge.bd}`}>
                  <Text className={`text-xs font-bold ${statusBadge.fg}`}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>
            </View>

            {order.customerName && (
              <View className="mb-4">
                <Text className="text-slate-500 text-xs font-bold mb-1">Khách hàng</Text>
                <Text className="text-slate-900 text-sm">{order.customerName}</Text>
              </View>
            )}

            {order.paymentAmount && (
              <View className="mb-4">
                <Text className="text-slate-500 text-xs font-bold mb-1">Số tiền</Text>
                <Text className="text-slate-900 text-sm font-bold">
                  {formatCurrency(order.paymentAmount)} VNĐ
                </Text>
              </View>
            )}

            {order.paymentStatus && (
              <View className="mb-4">
                <Text className="text-slate-500 text-xs font-bold mb-1">Trạng thái thanh toán</Text>
                <Text className="text-slate-900 text-sm">{order.paymentStatus}</Text>
              </View>
            )}

            {order.orderNote && (
              <View className="mb-4">
                <Text className="text-slate-500 text-xs font-bold mb-1">Ghi chú</Text>
                <Text className="text-slate-900 text-sm">{order.orderNote}</Text>
              </View>
            )}

            {order.createdAt && (
              <View className="mb-4">
                <Text className="text-slate-500 text-xs font-bold mb-1">Ngày tạo</Text>
                <Text className="text-slate-900 text-sm">{formatDate(order.createdAt)}</Text>
              </View>
            )}

            {order.specifyId && (
              <View className="mb-4">
                <Text className="text-slate-500 text-xs font-bold mb-2">Thông tin chỉ định</Text>
                <View className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  {order.specifyId.specifyVoteID && (
                    <Text className="text-slate-700 text-xs mb-1">
                      Mã chỉ định: {order.specifyId.specifyVoteID}
                    </Text>
                  )}
                  {order.specifyId.serviceType && (
                    <Text className="text-slate-700 text-xs mb-1">
                      Loại dịch vụ: {order.specifyId.serviceType}
                    </Text>
                  )}
                  {order.specifyId.specifyNote && (
                    <Text className="text-slate-700 text-xs">
                      Ghi chú: {order.specifyId.specifyNote}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
