import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FileText,
  Mail,
  Search,
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
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { buildDownloadReportUrl } from '@/lib/minioReport';
import { MEDICAL } from "@/lib/theme/medical";
import { getApiResponseData } from "@/lib/types/api-types";
import { OrderResponse, orderService } from "@/services/orderService";
import { patientMetadataService } from '@/services/patientMetadataService';
import { patientService } from '@/services/patientService';

const RESULT_ELIGIBLE_STATUSES = new Set([
  "completed",
  "awaiting_results_approval",
  "results_approved",
  "result_approved",
]);

export default function PatientResultsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [focusSearch, setFocusSearch] = useState(false);
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);

  const {
    data: ordersResponse,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["customer-orders-results", user?.id],
    queryFn: () => orderService.getByCustomerId(user!.id, {}),
    enabled: !!user?.id,
    retry: false,
  });

  const orders = useMemo(() => {
    return getApiResponseData<OrderResponse>(ordersResponse) || [];
  }, [ordersResponse]);

  const resultOrders = useMemo(() => {
    return orders.filter((o) =>
      RESULT_ELIGIBLE_STATUSES.has((o.orderStatus || "").toLowerCase())
    );
  }, [orders]);

  const hospitals = useMemo(() => {
    const set = new Set<string>();
    resultOrders.forEach((o) => {
      const name = (o as any).specifyId?.hospital?.hospitalName;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [resultOrders]);

  const filtered = useMemo(() => {
    return resultOrders.filter((order) => {
      const q = searchQuery.toLowerCase().trim();
      const ord = order as any;
      const matchesSearch =
        !q ||
        String(order.orderId || "").toLowerCase().includes(q) ||
        String(order.orderName || "").toLowerCase().includes(q) ||
        String(ord.specifyId?.patient?.patientName || "")
          .toLowerCase()
          .includes(q) ||
        String(ord.specifyId?.genomeTest?.testName || "")
          .toLowerCase()
          .includes(q) ||
        String(ord.specifyId?.hospital?.hospitalName || "")
          .toLowerCase()
          .includes(q);

      const matchesHospital =
        hospitalFilter === "all" ||
        ord.specifyId?.hospital?.hospitalName === hospitalFilter;

      return matchesSearch && matchesHospital;
    });
  }, [resultOrders, searchQuery, hospitalFilter]);

  const collectOrderMetadata = async (
    order: OrderResponse
  ): Promise<Array<{ labcode?: string; testResultPath?: string; status?: string }>> => {
    let metaList: Array<{ labcode?: string; testResultPath?: string; status?: string }> =
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
        status: String(m.status || "").trim(),
      }))
      .filter((m) => !!m.labcode);
  };

  const downloadResultsForOrder = async (order: OrderResponse) => {
    if (downloadingOrderId) return;
    setDownloadingOrderId(order.orderId);
    try {
      const hospitalName = String(order.specifyId?.hospital?.hospitalName || "").trim();
      const patientName = String(order.specifyId?.patient?.patientName || "").trim();
      const phoneNumber = String(order.specifyId?.patient?.patientPhone || "").trim();
      if (!hospitalName || !patientName || !phoneNumber) {
        throw new Error(
          "Thiếu thông tin bệnh viện, bệnh nhân hoặc số điện thoại để tải kết quả."
        );
      }

      const metadataRows = await collectOrderMetadata(order);
      const downloadable = metadataRows.filter((m) => !!m.testResultPath && !!m.labcode);
      if (!downloadable.length) {
        throw new Error("Đơn hàng chưa có file kết quả để tải.");
      }

      const firstLabcode = String(downloadable[0].labcode || "").trim();
      const reportUrl = buildDownloadReportUrl({
        hospitalName,
        patientName,
        phoneNumber,
        labcode: firstLabcode,
      });
      const canOpen = await Linking.canOpenURL(reportUrl);
      if (!canOpen) {
        throw new Error("Thiết bị không mở được liên kết tải kết quả.");
      }
      await Linking.openURL(reportUrl);

      if (downloadable.length > 1) {
        presentFeedbackSuccess({
          title: "Đã mở file kết quả",
          message: `Đã mở file cho labcode ${firstLabcode}. Đơn này còn ${downloadable.length - 1} mẫu khác — bấm Tải lần nữa sau khi tải xong để mở mẫu tiếp theo (hoặc xem Chi tiết đơn).`,
        });
      }
    } catch (err: any) {
      presentFeedbackError({
        title: "Không tải được kết quả",
        message: err?.message || "Không thể tải file kết quả xét nghiệm.",
      });
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const sendResultEmailForOrder = async (order: OrderResponse) => {
    const patientEmail = order.specifyId?.patient?.patientEmail?.trim();
    if (!patientEmail) {
      presentFeedbackError({
        title: "Thiếu email",
        message: "Phiếu xét nghiệm chưa có email bệnh nhân. Vui lòng cập nhật trên hệ thống hoặc liên hệ phòng khám.",
      });
      return;
    }

    const phone = (order.specifyId?.patient?.patientPhone || "").trim();
    const hospitalName = (order.specifyId?.hospital?.hospitalName || "").trim();
    const patientName = (order.specifyId?.patient?.patientName || "").trim();
    const doctorName = (order.specifyId?.doctor?.doctorName || "").trim();

    if (!phone || !hospitalName || !patientName) {
      presentFeedbackError({
        title: "Thiếu thông tin",
        message: "Cần đủ tên bệnh nhân, bệnh viện và số điện thoại để lấy file kết quả từ kho lưu trữ.",
      });
      return;
    }

    setSendingOrderId(order.orderId);
    try {
      let metaList: { labcode?: string; sampleName?: string }[] =
        Array.isArray(order.patientMetadata) ? order.patientMetadata : [];

      const fresh = await orderService.getById(order.orderId);
      if (fresh.success && fresh.data) {
        const pm = fresh.data.patientMetadata;
        if (Array.isArray(pm) && pm.length > 0) {
          metaList = pm;
        }
      }

      if (!metaList.length) {
        const pid = order.specifyId?.patient?.patientId;
        if (pid) {
          const pmRes = await patientMetadataService.getByPatientId(pid);
          if (pmRes.success && Array.isArray(pmRes.data)) {
            const currentSpecifyId = String(order.specifyId?.specifyVoteID || "").trim();
            metaList = pmRes.data.filter((m: any) => {
              const sid = String(m?.specifyId || "").trim();
              return !currentSpecifyId || sid === currentSpecifyId;
            });
          }
        }
      }

      const rows = metaList.filter((m) => m?.labcode?.trim());
      if (!rows.length) {
        presentFeedbackError({
          title: "Chưa có mẫu (labcode)",
          message:
            "Đơn hàng chưa gắn labcode hoặc kết quả chưa được lưu.",
        });
        return;
      }

      let ok = 0;
      let fail = 0;
      let lastError = "";

      for (const m of rows) {
        const labcode = m.labcode!.trim();
        const sampleName = (
          m.sampleName ||
          order.specifyId?.genomeTest?.testName ||
          labcode
        ).trim();
        const testResultUrl = buildDownloadReportUrl({
          hospitalName,
          patientName,
          phoneNumber: phone,
          labcode,
        });
        const res = await patientService.sendTestResultEmail({
          patientEmail,
          patientName,
          doctorName: doctorName || "—",
          sampleName,
          testResultUrl,
        });
        if (res.success) {
          ok++;
        } else {
          fail++;
          if (res.error) lastError = res.error;
        }
      }

      if (ok > 0) {
        presentFeedbackSuccess({
          title: "Đã gửi",
          message:
            `Đã yêu cầu gửi ${ok} email kết quả tới ${patientName} (${patientEmail}).` +
            (fail > 0 ? ` ${fail} mẫu không gửi được.` : "") +
            (lastError && fail > 0 ? ` Chi tiết: ${lastError}` : ""),
        });
      } else {
        presentFeedbackError({
          title: "Gửi không thành công",
          message:
            lastError ||
            "Không gửi được email. Kiểm tra kết nối, cấu hình SMTP trên server hoặc file kết quả trên MinIO.",
        });
      }
    } finally {
      setSendingOrderId(null);
    }
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
              Trả kết quả
            </Text>
            <Text className="mt-0.5 text-xs text-sky-700/80">
              {filtered.length} đơn hàng có kết quả
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
            placeholder="Tìm theo đơn hàng, bệnh nhân, xét nghiệm..."
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

        {hospitals.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-2 -mx-1"
          >
            <View className="flex-row gap-2 px-1">
              <TouchableOpacity
                onPress={() => setHospitalFilter("all")}
                className={`px-3 py-1.5 rounded-full border ${hospitalFilter === "all"
                  ? "bg-sky-600 border-sky-600"
                  : "bg-white border-sky-200"
                  }`}
              >
                <Text
                  className={`text-xs font-bold ${hospitalFilter === "all" ? "text-white" : "text-sky-800"
                    }`}
                >
                  Tất cả
                </Text>
              </TouchableOpacity>
              {hospitals.slice(0, 4).map((h) => (
                <TouchableOpacity
                  key={h}
                  onPress={() => setHospitalFilter(h)}
                  className={`px-3 py-1.5 rounded-full border ${hospitalFilter === h
                    ? "bg-sky-600 border-sky-600"
                    : "bg-white border-sky-200"
                    }`}
                >
                  <Text
                    className={`text-xs font-bold ${hospitalFilter === h ? "text-white" : "text-slate-600"
                      }`}
                    numberOfLines={1}
                  >
                    {h}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor="#0284C7"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
            <FileText size={48} color="#cbd5e1" />
            <Text className="text-sm font-bold text-slate-500 mt-3 text-center">
              Chưa có đơn hàng nào để xem hoặc tải kết quả
            </Text>
          </View>
        ) : (
          filtered.map((order) => {
            const ord = order as any;
            const patientName = ord.specifyId?.patient?.patientName || "N/A";
            const hospitalName = ord.specifyId?.hospital?.hospitalName || "N/A";
            const testName = ord.specifyId?.genomeTest?.testName || "N/A";
            const statusLower = String(order.orderStatus || "").toLowerCase();
            const statusLabel =
              statusLower === "awaiting_results_approval"
                ? "Chờ duyệt KQ"
                : statusLower === "results_approved" || statusLower === "result_approved"
                  ? "KQ đã duyệt"
                  : "Hoàn thành";
            const statusPillClass =
              statusLower === "awaiting_results_approval"
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : statusLower === "results_approved" || statusLower === "result_approved"
                  ? "bg-lime-50 border-lime-200 text-lime-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700";

            return (
              <View
                key={order.orderId}
                className="bg-white rounded-2xl p-4 mb-3 border border-sky-100"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="text-sm font-extrabold text-slate-900 flex-1">
                    {order.orderName || order.orderId}
                  </Text>
                  <View className={`px-2 py-1 rounded-lg border ${statusPillClass}`}>
                    <Text className="text-[10px] font-bold">{statusLabel}</Text>
                  </View>
                </View>

                <View className="mt-2 pt-2 border-t border-sky-50">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-xs text-slate-500">Bệnh nhân:</Text>
                    <Text className="text-xs font-bold text-slate-700 flex-1" numberOfLines={1}>
                      {patientName}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-xs text-slate-500">Xét nghiệm:</Text>
                    <Text className="text-xs font-bold text-slate-700 flex-1" numberOfLines={1}>
                      {testName}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-xs text-slate-500">Bệnh viện:</Text>
                    <Text className="text-xs font-bold text-slate-700 flex-1" numberOfLines={1}>
                      {hospitalName}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-sky-50">
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => downloadResultsForOrder(order)}
                      disabled={downloadingOrderId === order.orderId}
                      className={`flex-row items-center gap-1 px-2 py-1.5 rounded-lg bg-sky-50 ${
                        downloadingOrderId === order.orderId ? "opacity-60" : ""
                      }`}
                    >
                      {downloadingOrderId === order.orderId ? (
                        <ActivityIndicator size="small" color="#0284C7" />
                      ) : (
                        <Download size={14} color="#0284C7" />
                      )}
                      <Text className="text-xs font-bold text-sky-700">Tải</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => sendResultEmailForOrder(order)}
                      disabled={sendingOrderId === order.orderId}
                      className={`flex-row items-center gap-1 px-2 py-1.5 rounded-lg bg-sky-50 ${sendingOrderId === order.orderId ? "opacity-60" : ""
                        }`}
                    >
                      {sendingOrderId === order.orderId ? (
                        <ActivityIndicator size="small" color="#0284C7" />
                      ) : (
                        <Mail size={14} color="#0284C7" />
                      )}
                      <Text className="text-xs font-bold text-sky-700">Gửi mail</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/customer/order-detail",
                        params: { orderId: order.orderId },
                      })
                    }
                    className="flex-row items-center gap-1"
                  >
                    <Text className="text-xs font-bold text-sky-600">Chi tiết</Text>
                    <ChevronRight size={16} color="#0284C7" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
