import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  ChevronRight,
  FileText,
  MessageCircle,
  Search,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ForwardSampleAddModal,
  type SampleAddWithOrder,
} from "@/components/modals/ForwardSampleAddModal";
import { useAuth } from "@/contexts/AuthContext";
import { MEDICAL } from "@/lib/theme/medical";
import { getApiResponseData } from "@/lib/types/api-types";
import { orderService, type OrderResponse } from "@/services/orderService";
import { SampleAddResponse, sampleAddService } from "@/services/sampleAddService";
import { sampleAddServiceCatalogService } from "@/services/sampleAddServiceCatalogService";

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("vi-VN");
  } catch {
    return dateString;
  }
};

const formatCurrency = (amount?: number): string => {
  if (amount == null) return "-";
  return new Intl.NumberFormat("vi-VN").format(amount);
};

const getStatusLabel = (status: string): string => {
  const s = (status || "").toLowerCase();
  const map: Record<string, string> = {
    initation: "Khởi tạo",
    forward_analysis: "Chuyển tiếp phân tích",
    accepted: "Đã chấp nhận",
    rejected: "Từ chối",
  };
  return map[s] || status;
};

const paymentStatusLabel = (ps?: string): string => {
  const u = (ps || "").toUpperCase();
  const map: Record<string, string> = {
    COMPLETED: "Đã thanh toán",
    PENDING: "Đang chờ",
    FAILED: "Thất bại",
    UNPAID: "Chưa thanh toán",
  };
  return map[u] || ps || "—";
};

type CustomerSampleAddsQueryData = { success: boolean; data: SampleAddWithOrder[] };

export default function CustomerSampleAddsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [focusSearch, setFocusSearch] = useState(false);
  const [forwardModal, setForwardModal] = useState<{
    open: boolean;
    data: SampleAddWithOrder | null;
  }>({ open: false, data: null });

  const {
    data: ordersResponse,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<CustomerSampleAddsQueryData>({
    queryKey: ["customer-sample-adds", user?.id],
    queryFn: async () => {
      if (!user?.id) return { success: false, data: [] as SampleAddWithOrder[] };
      const ordersRes = await orderService.getByCustomerId(user.id, {});
      const orders = getApiResponseData<OrderResponse>(ordersRes) || [];
      const allSampleAdds: SampleAddWithOrder[] = [];

      for (const order of orders) {
        try {
          const saRes = await sampleAddService.getByOrderId(order.orderId);
          const items = (saRes?.success && saRes?.data ? saRes.data : []) as SampleAddResponse[];
          const specify = order.specifyId;
          const withOrder = items.map((sa) => ({
            ...sa,
            id: sa.id ?? sa.sampleAddId,
            orderName: order.orderName,
            patientName: specify?.patient?.patientName ?? sa.patientName,
            hospitalName: specify?.hospital?.hospitalName,
            staffId: order.staffId,
          }));
          allSampleAdds.push(...withOrder);
        } catch {
        }
      }
      return { success: true, data: allSampleAdds };
    },
    enabled: !!user?.id,
    retry: false,
  });

  const sampleAdds = useMemo(
    () => ordersResponse?.data ?? [],
    [ordersResponse],
  );

  const filtered = useMemo(() => {
    return sampleAdds.filter((sa: SampleAddWithOrder) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(sa.sampleName || "").toLowerCase().includes(q) ||
        String(sa.orderId || "").toLowerCase().includes(q) ||
        String(sa.orderName || "").toLowerCase().includes(q) ||
        String(sa.patientName || "").toLowerCase().includes(q) ||
        String(sa.hospitalName || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (sa.status || "").toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [sampleAdds, searchQuery, statusFilter]);

  const openForward = (sa: SampleAddWithOrder) => {
    setForwardModal({ open: true, data: sa });
  };

  const handleRetryPayment = async (sa: SampleAddWithOrder) => {
    const sid = sa.id || sa.sampleAddId;
    if (!sid || !sa.orderId) {
      Alert.alert("Lỗi", "Thiếu thông tin thanh toán");
      return;
    }
    try {
      const res = await sampleAddServiceCatalogService.getBySampleName(sa.sampleName);
      let amount = 0;
      if (res.success && res.data) {
        amount = res.data.finalPrice;
      } else {
        const allRes = await sampleAddServiceCatalogService.getAll();
        if (allRes.success && Array.isArray(allRes.data)) {
          const found = allRes.data.find(s => s.sampleName === sa.sampleName);
          amount = found?.finalPrice ?? 0;
        }
      }
      if (!amount) {
        Alert.alert("Lỗi", "Không lấy được giá dịch vụ");
        return;
      }
      router.push({
        pathname: "/customer/payment",
        params: {
          orderId: sa.orderId,
          sampleAddId: sid,
          orderName: `Bổ sung mẫu - ${sa.sampleName}`,
          amount: String(amount),
          specifyId: sa.specifyId || "",
          patientId: sa.patientId || "",
          patientName: sa.patientName || "",
          sampleName: sa.sampleName,
          hasFastq: sa.customerFastq ? "true" : "false",
          returnPath: "/customer/sample-adds",
          cancelPath: "/customer/sample-adds",
        },
      });
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Không thể mở thanh toán");
    }
  };

  const showNote = (sa: SampleAddWithOrder) => {
    const note = (sa.note || "").trim();
    Alert.alert("Ghi chú", note || "Không có ghi chú");
  };

  const openInvoice = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert("Lỗi", "Không mở được liên kết hóa đơn");
    });
  };

  const canForward = (sa: SampleAddWithOrder) => {
    const st = (sa.status || "").toLowerCase();
    const ps = (sa.paymentStatus || "").toUpperCase();
    return st === "initation" && ps !== "COMPLETED";
  };

  const canRetryPay = (sa: SampleAddWithOrder) => {
    const pt = (sa.paymentType || "").toUpperCase();
    const ps = (sa.paymentStatus || "").toUpperCase();
    return pt === "ONLINE_PAYMENT" && ps !== "COMPLETED" && ps !== "PENDING";
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={MEDICAL.primary} />
        <Text className="mt-3 text-sky-700 text-sm font-bold">Đang tải...</Text>
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
          <TouchableOpacity
            className="bg-sky-600 py-3 rounded-2xl items-center mt-4"
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
    <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

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
            <Text className="text-sky-950 text-lg font-extrabold">
              Bổ sung mẫu
            </Text>
            <Text className="mt-0.5 text-xs text-sky-700/80">
              {filtered.length} yêu cầu
            </Text>
          </View>
        </View>

        <View
          className={`mt-3 flex-row items-center rounded-2xl px-3 bg-sky-50 border ${focusSearch ? "border-sky-400 bg-white" : "border-sky-100"
            }`}
        >
          <Search size={18} color={MEDICAL.primaryDark} />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-sky-950 font-semibold"
            placeholder="Tìm theo mẫu, đơn hàng, bệnh nhân..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
          />
          {searchQuery.trim() ? (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center bg-white border border-sky-200"
              onPress={() => setSearchQuery("")}
            >
              <X size={16} color={MEDICAL.primaryDark} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3 -mx-1"
        >
          <View className="flex-row gap-2 px-1">
            {["all", "initation", "forward_analysis", "accepted", "rejected"].map(
              (s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded-xl border ${statusFilter === s
                    ? "bg-sky-600 border-sky-600"
                    : "bg-white border-sky-100"
                    }`}
                >
                  <Text
                    className={`text-xs font-extrabold ${statusFilter === s ? "text-white" : "text-sky-800"
                      }`}
                  >
                    {s === "all" ? "Tất cả" : getStatusLabel(s)}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 bg-sky-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor={MEDICAL.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View className="bg-white rounded-3xl p-8 items-center border border-sky-100 shadow-sm shadow-sky-900/5">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 border border-sky-200 items-center justify-center mb-2">
              <FileText size={28} color={MEDICAL.primary} />
            </View>
            <Text className="text-sm font-extrabold text-sky-950 mt-3 text-center">
              Không có yêu cầu bổ sung mẫu nào
            </Text>
          </View>
        ) : (
          filtered.map((sa: SampleAddWithOrder) => (
            <View
              key={sa.id || sa.sampleAddId || sa.orderId + (sa.sampleName || "")}
              className="bg-white rounded-2xl p-4 mb-3 border border-sky-100 shadow-sm shadow-sky-900/5"
            >
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/customer/order-detail",
                    params: { orderId: sa.orderId },
                  })
                }
                activeOpacity={0.85}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="text-sm font-extrabold text-sky-950 flex-1">
                    {sa.sampleName || "N/A"}
                  </Text>
                  <View className="px-2 py-1 rounded-lg bg-sky-50 border border-sky-200">
                    <Text className="text-[10px] font-bold text-sky-700">
                      {getStatusLabel(sa.status || "")}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs text-sky-700/80">Thanh toán</Text>
                  <Text className="text-[10px] font-bold text-sky-800">
                    {paymentStatusLabel(sa.paymentStatus)}
                  </Text>
                </View>
                <View className="mt-2 pt-2 border-t border-sky-50">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-xs text-sky-700/80">Đơn hàng:</Text>
                    <Text className="text-xs font-bold text-sky-900 flex-1" numberOfLines={1}>
                      {sa.orderName || sa.orderId || "N/A"}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-xs text-sky-700/80">Bệnh nhân:</Text>
                    <Text className="text-xs font-bold text-sky-900 flex-1" numberOfLines={1}>
                      {sa.patientName || "N/A"}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-sky-700/80">Bệnh viện:</Text>
                    <Text className="text-xs font-bold text-sky-900 flex-1" numberOfLines={1}>
                      {sa.hospitalName || "N/A"}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-end mt-3">
                  <Text className="text-xs font-bold text-sky-600 mr-1">Xem đơn hàng</Text>
                  <ChevronRight size={16} color={MEDICAL.primary} />
                </View>
              </TouchableOpacity>

              <View className="flex-row flex-wrap justify-end gap-2 mt-3 pt-3 border-t border-sky-50">
                <TouchableOpacity
                  onPress={() => showNote(sa)}
                  className="flex-row items-center px-3 py-2 rounded-xl bg-amber-50 border border-amber-200"
                >
                  <MessageCircle size={16} color="#d97706" />
                  <Text className="text-[11px] font-extrabold text-amber-800 ml-1">Ghi chú</Text>
                </TouchableOpacity>
                {sa.invoiceLink && String(sa.paymentStatus || "").toUpperCase() === "COMPLETED" ? (
                  <TouchableOpacity
                    onPress={() => openInvoice(sa.invoiceLink!)}
                    className="flex-row items-center px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200"
                  >
                    <FileText size={16} color="#059669" />
                    <Text className="text-[11px] font-extrabold text-emerald-800 ml-1">Hóa đơn</Text>
                  </TouchableOpacity>
                ) : null}
                {canForward(sa) ? (
                  <TouchableOpacity
                    onPress={() => openForward(sa)}
                    className="flex-row items-center px-3 py-2 rounded-xl bg-sky-50 border border-sky-200"
                  >
                    <ArrowRight size={16} color={MEDICAL.primary} />
                    <Text className="text-[11px] font-extrabold text-sky-800 ml-1">Chuyển tiếp</Text>
                  </TouchableOpacity>
                ) : null}
                {canRetryPay(sa) ? (
                  <TouchableOpacity
                    onPress={() => handleRetryPayment(sa)}
                    className="flex-row items-center px-3 py-2 rounded-xl bg-amber-50 border border-amber-200"
                  >
                    <Banknote size={16} color="#d97706" />
                    <Text className="text-[11px] font-extrabold text-amber-900 ml-1">Thanh toán lại</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ForwardSampleAddModal
        visible={forwardModal.open}
        onClose={() => setForwardModal({ open: false, data: null })}
        sampleAddData={forwardModal.data}
        onSuccess={() => refetch()}
      />
    </SafeAreaView>
  );
}
