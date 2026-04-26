import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  Mail,
  Search,
  Send,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { presentFeedbackError, presentFeedbackSuccess } from "@/lib/feedbackModal";
import { buildDownloadReportUrl } from "@/lib/minioReport";
import { MEDICAL } from "@/lib/theme/medical";
import { getApiResponseData } from "@/lib/types/api-types";
import { OrderResponse, orderService } from "@/services/orderService";
import { patientMetadataService } from "@/services/patientMetadataService";
import { patientService } from "@/services/patientService";
import { specifyVoteTestService } from "@/services/specifyVoteTestService";

export default function StaffPatientResultsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);
  const [returningOrderId, setReturningOrderId] = useState<string | null>(null);
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);

  const { data: ordersResponse, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["staff-patient-results", user?.hospitalId],
    queryFn: async () => {
      const [completedRes, awaitingRes, approvedRes] = await Promise.all([
        orderService.getByStatus("completed", { page: 0, size: 500 }),
        orderService.getByStatus("awaiting_results_approval", { page: 0, size: 500 }),
        orderService.getByStatus("results_approved", { page: 0, size: 500 }),
      ]);
      const completed = getApiResponseData<OrderResponse>(completedRes) || [];
      const awaiting = getApiResponseData<OrderResponse>(awaitingRes) || [];
      const approved = getApiResponseData<OrderResponse>(approvedRes) || [];
      const byId = new Map<string, OrderResponse>();
      [...completed, ...awaiting, ...approved].forEach((o) => {
        if (o?.orderId) byId.set(String(o.orderId), o);
      });
      return { success: true, data: Array.from(byId.values()) };
    },
    enabled: !!user,
    retry: false,
  });

  const orders = useMemo(
    () => getApiResponseData<OrderResponse>(ordersResponse) || [],
    [ordersResponse]
  );

  const resultOrders = useMemo(() => {
    const allowed = new Set([
      "completed",
      "awaiting_results_approval",
      "results_approved",
      "result_approved",
    ]);
    return orders.filter((o) => allowed.has((o.orderStatus || "").toLowerCase()));
  }, [orders]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return resultOrders.filter((order) => {
      const ord = order as any;
      return (
        !q ||
        String(order.orderId || "").toLowerCase().includes(q) ||
        String(order.orderName || "").toLowerCase().includes(q) ||
        String(ord.specifyId?.patient?.patientName || "").toLowerCase().includes(q) ||
        String(ord.specifyId?.genomeTest?.testName || "").toLowerCase().includes(q) ||
        String(ord.specifyId?.hospital?.hospitalName || "").toLowerCase().includes(q)
      );
    });
  }, [resultOrders, searchQuery]);

  const collectOrderMetadata = async (order: OrderResponse) => {
    let metaList: Array<{ labcode?: string; testResultPath?: string; sampleName?: string; specifyId?: string }> =
      Array.isArray(order.patientMetadata) ? (order.patientMetadata as any[]) : [];
    const fresh = await orderService.getById(order.orderId);
    if (fresh.success && fresh.data && Array.isArray(fresh.data.patientMetadata)) {
      metaList = fresh.data.patientMetadata as any[];
    }
    if (!metaList.length) {
      const pid = order.specifyId?.patient?.patientId;
      if (pid) {
        const pmRes = await patientMetadataService.getByPatientId(pid);
        if (pmRes.success && Array.isArray(pmRes.data)) {
          const currentSpecifyId = String(order.specifyId?.specifyVoteID || "").trim();
          metaList = (pmRes.data as any[]).filter((m: any) => {
            const sid = String(m?.specifyId || "").trim();
            return !currentSpecifyId || sid === currentSpecifyId;
          });
        }
      }
    }
    return metaList
      .map((m) => ({
        labcode: String(m.labcode || "").trim(),
        testResultPath: String(m.testResultPath || "").trim(),
        sampleName: String(m.sampleName || "").trim(),
      }))
      .filter((m) => !!m.labcode);
  };

  const downloadResultsForOrder = async (order: OrderResponse) => {
    try {
      const hospitalName = String(order.specifyId?.hospital?.hospitalName || "").trim();
      const patientName = String(order.specifyId?.patient?.patientName || "").trim();
      const phoneNumber = String(order.specifyId?.patient?.patientPhone || "").trim();
      if (!hospitalName || !patientName || !phoneNumber) {
        throw new Error("Thiếu thông tin bệnh viện, bệnh nhân hoặc số điện thoại để tải kết quả.");
      }
      const metadataRows = await collectOrderMetadata(order);
      const downloadable = metadataRows.filter((m) => !!m.testResultPath && !!m.labcode);
      if (!downloadable.length) {
        throw new Error("Đơn hàng chưa có file kết quả để tải.");
      }
      const firstLabcode = String(downloadable[0].labcode || "").trim();
      const reportUrl = buildDownloadReportUrl({ hospitalName, patientName, phoneNumber, labcode: firstLabcode });
      const canOpen = await Linking.canOpenURL(reportUrl);
      if (!canOpen) throw new Error("Thiết bị không mở được liên kết tải kết quả.");
      await Linking.openURL(reportUrl);
    } catch (err: any) {
      presentFeedbackError({
        title: "Không tải được kết quả",
        message: err?.message || "Không thể tải file kết quả xét nghiệm.",
      });
    }
  };

  const sendResultEmailForOrder = async (order: OrderResponse) => {
    const patientEmail = order.specifyId?.patient?.patientEmail?.trim();
    if (!patientEmail) {
      presentFeedbackError({ title: "Thiếu email", message: "Phiếu xét nghiệm chưa có email bệnh nhân." });
      return;
    }
    const phone = (order.specifyId?.patient?.patientPhone || "").trim();
    const hospitalName = (order.specifyId?.hospital?.hospitalName || "").trim();
    const patientName = (order.specifyId?.patient?.patientName || "").trim();
    const doctorName = (order.specifyId?.doctor?.doctorName || "").trim();
    if (!phone || !hospitalName || !patientName) {
      presentFeedbackError({ title: "Thiếu thông tin", message: "Thiếu thông tin để gửi email kết quả." });
      return;
    }
    setSendingOrderId(order.orderId);
    try {
      const metaList = await collectOrderMetadata(order);
      const rows = metaList.filter((m) => m.labcode && m.testResultPath);
      if (!rows.length) {
        presentFeedbackError({ title: "Chưa có kết quả", message: "Đơn hàng chưa có file kết quả để gửi email." });
        return;
      }
      let ok = 0;
      for (const m of rows) {
        const testResultUrl = buildDownloadReportUrl({
          hospitalName,
          patientName,
          phoneNumber: phone,
          labcode: m.labcode!,
        });
        const res = await patientService.sendTestResultEmail({
          patientEmail,
          patientName,
          doctorName: doctorName || "—",
          sampleName: m.sampleName || m.labcode!,
          testResultUrl,
        });
        if (res.success) ok++;
      }
      if (ok > 0) {
        presentFeedbackSuccess({
          title: "Đã gửi",
          message: `Đã yêu cầu gửi ${ok} email kết quả tới ${patientName}.`,
        });
      } else {
        presentFeedbackError({ title: "Gửi không thành công", message: "Không gửi được email kết quả." });
      }
    } finally {
      setSendingOrderId(null);
    }
  };

  const updateCompletedFlow = async (order: OrderResponse, successMessage: string) => {
    const specifyId = order.specifyId?.specifyVoteID;
    const orderRes = await orderService.updateStatus(order.orderId, "completed");
    if (!orderRes.success) throw new Error(orderRes.error || "Không thể cập nhật trạng thái đơn hàng.");
    if (specifyId) {
      const specifyRes = await specifyVoteTestService.updateStatus(specifyId, "completed");
      if (!specifyRes.success) throw new Error(specifyRes.error || "Không thể cập nhật trạng thái phiếu.");
    }
    const resultDateRes = await orderService.updateResultDate(order.orderId, new Date().toISOString());
    if (!resultDateRes.success) throw new Error(resultDateRes.error || "Không thể cập nhật ngày trả kết quả.");
    presentFeedbackSuccess({ title: "Thành công", message: successMessage });
    refetch();
  };

  const returnResultForOrder = async (order: OrderResponse) => {
    if (returningOrderId) return;
    setReturningOrderId(order.orderId);
    try {
      await updateCompletedFlow(order, `Đơn ${order.orderId} đã trả kết quả thành công.`);
      if (order.specifyId?.sendEmailPatient) {
        await sendResultEmailForOrder(order);
      }
    } catch (err: any) {
      presentFeedbackError({
        title: "Lỗi",
        message: err?.message || "Không thể trả kết quả.",
      });
    } finally {
      setReturningOrderId(null);
    }
  };

  const completeOrderForHospitalOne = async (order: OrderResponse) => {
    if (completingOrderId) return;
    setCompletingOrderId(order.orderId);
    try {
      await updateCompletedFlow(order, `Đơn ${order.orderId} đã hoàn thiện.`);
    } catch (err: any) {
      presentFeedbackError({
        title: "Lỗi",
        message: err?.message || "Không thể hoàn thiện đơn hàng.",
      });
    } finally {
      setCompletingOrderId(null);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={MEDICAL.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <Stack.Screen options={{ headerShown: false }} />
        <TouchableOpacity className="bg-sky-600 py-3 rounded-2xl items-center mt-4 px-4" onPress={() => refetch()}>
          <Text className="text-white text-sm font-extrabold">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3">
            <ArrowLeft size={20} color={MEDICAL.primary} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-sky-950 text-lg font-extrabold">Trả kết quả xét nghiệm</Text>
            <Text className="mt-0.5 text-xs text-sky-700/80">{filtered.length} đơn hàng</Text>
          </View>
        </View>
        <View className={`mt-3 flex-row items-center rounded-2xl px-3 bg-sky-50 border ${focusSearch ? "border-sky-400 bg-white" : "border-sky-100"}`}>
          <Search size={18} color={MEDICAL.primaryDark} />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-sky-950 font-semibold"
            placeholder="Tìm theo đơn hàng, bệnh nhân..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
          />
          {!!searchQuery.trim() && (
            <TouchableOpacity className="w-9 h-9 rounded-xl items-center justify-center bg-white border border-sky-200" onPress={() => setSearchQuery("")}>
              <X size={16} color={MEDICAL.primaryDark} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor="#0284C7" />}
      >
        {filtered.map((order) => {
          const ord = order as any;
          const hospitalId = String(ord.specifyId?.hospitalId || ord.specifyId?.hospital?.hospitalId || "");
          const isHospitalOne = hospitalId === "1";
          const isCompleted = String(order.orderStatus || "").toLowerCase() === "completed";
          return (
            <View key={order.orderId} className="bg-white rounded-2xl p-4 mb-3 border border-sky-100">
              <Text className="text-sm font-extrabold text-slate-900">{order.orderName || order.orderId}</Text>
              <Text className="text-xs text-slate-600 mt-1">{ord.specifyId?.patient?.patientName || "N/A"}</Text>
              <Text className="text-xs text-slate-500 mt-1">{ord.specifyId?.genomeTest?.testName || "N/A"}</Text>
              <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-sky-50">
                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={() => downloadResultsForOrder(order)} className="flex-row items-center gap-1 px-2 py-1.5 rounded-lg bg-sky-50">
                    <Download size={14} color="#0284C7" />
                    <Text className="text-xs font-bold text-sky-700">Tải</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => sendResultEmailForOrder(order)}
                    disabled={sendingOrderId === order.orderId}
                    className={`flex-row items-center gap-1 px-2 py-1.5 rounded-lg bg-violet-50 ${sendingOrderId === order.orderId ? "opacity-60" : ""}`}
                  >
                    {sendingOrderId === order.orderId ? <ActivityIndicator size="small" color="#7C3AED" /> : <Mail size={14} color="#7C3AED" />}
                    <Text className="text-xs font-bold text-violet-700">Gửi mail</Text>
                  </TouchableOpacity>
                  {!isHospitalOne && !isCompleted && (
                    <TouchableOpacity
                      onPress={() => returnResultForOrder(order)}
                      disabled={returningOrderId === order.orderId}
                      className={`flex-row items-center gap-1 px-2 py-1.5 rounded-lg bg-blue-50 ${returningOrderId === order.orderId ? "opacity-60" : ""}`}
                    >
                      {returningOrderId === order.orderId ? <ActivityIndicator size="small" color="#2563EB" /> : <Send size={14} color="#2563EB" />}
                      <Text className="text-xs font-bold text-blue-700">Trả KQ</Text>
                    </TouchableOpacity>
                  )}
                  {isHospitalOne && !isCompleted && (
                    <TouchableOpacity
                      onPress={() => completeOrderForHospitalOne(order)}
                      disabled={completingOrderId === order.orderId}
                      className={`flex-row items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-50 ${completingOrderId === order.orderId ? "opacity-60" : ""}`}
                    >
                      {completingOrderId === order.orderId ? <ActivityIndicator size="small" color="#059669" /> : <CheckCircle2 size={14} color="#059669" />}
                      <Text className="text-xs font-bold text-emerald-700">Hoàn thiện</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/staff/order-detail", params: { orderId: order.orderId } })}
                  className="flex-row items-center gap-1"
                >
                  <Text className="text-xs font-bold text-sky-600">Chi tiết</Text>
                  <ChevronRight size={16} color="#0284C7" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
