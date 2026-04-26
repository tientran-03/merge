import { useQuery } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FileText,
  Mail,
  RotateCcw,
  Search,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MINIO_API_BASE_URL } from "@/config/api";
import { useAuth } from "@/contexts/AuthContext";
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { buildDownloadReportUrl } from '@/lib/minioReport';
import { useStaffDoctorBasePath } from '@/lib/staff-doctor-route';
import { MEDICAL } from "@/lib/theme/medical";
import { getApiResponseData } from "@/lib/types/api-types";
import { useSheetBottomInset } from '@/lib/useSheetBottomInset';
import { OrderResponse, orderService } from "@/services/orderService";
import { patientMetadataService } from '@/services/patientMetadataService';
import { patientService } from '@/services/patientService';
import { specifyVoteTestService } from "@/services/specifyVoteTestService";

function computeLabApprovalGate(
  rows: Array<{ labcode?: string; testResultPath?: string }>
): { ok: true } | { ok: false; message: string } {
  const labRows = rows
    .map((r) => ({
      labcode: String(r?.labcode || "").trim(),
      testResultPath: String(r?.testResultPath || "").trim(),
    }))
    .filter((r) => !!r.labcode);

  if (labRows.length === 0) {
    return {
      ok: false,
      message: "Đơn hàng chưa có labcode để duyệt kết quả.",
    };
  }

  const missing = labRows.filter((r) => !r.testResultPath);
  if (missing.length > 0) {
    const codes = missing.map((r) => r.labcode).join(", ");
    return {
      ok: false,
      message: `Còn ${missing.length}/${labRows.length} mẫu chưa có file kết quả (${codes}). Vui lòng upload đủ cho tất cả labcode trên đơn rồi mới duyệt.`,
    };
  }

  return { ok: true };
}
function presentFeedbackAfterModalDismiss(present: () => void) {
  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(() => {
      present();
    });
  });
}

export default function PatientResultsScreen() {
  const router = useRouter();
  const base = useStaffDoctorBasePath();
  const { user } = useAuth();
  const sheetBottomInset = useSheetBottomInset(16);
  const [searchQuery, setSearchQuery] = useState("");
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [focusSearch, setFocusSearch] = useState(false);
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);
  const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null);
  const [rerunningOrderId, setRerunningOrderId] = useState<string | null>(null);
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);
  const [uploadModalOrder, setUploadModalOrder] = useState<OrderResponse | null>(null);
  const [uploadLabcodes, setUploadLabcodes] = useState<Array<{ labcode: string; testResultPath?: string; status?: string }>>([]);
  const [selectedUploadLabcode, setSelectedUploadLabcode] = useState<string>("");
  const [selectedReportFile, setSelectedReportFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);

  const labApprovalGate = useMemo(() => computeLabApprovalGate(uploadLabcodes), [uploadLabcodes]);

  const {
    data: ordersResponse,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["doctor-patient-results", user?.hospitalId],
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

  const orders = useMemo(() => {
    return getApiResponseData<OrderResponse>(ordersResponse) || [];
  }, [ordersResponse]);

  const resultOrders = useMemo(() => {
    const allowed = new Set([
      "completed",
      "awaiting_results_approval",
      "results_approved",
      "result_approved",
    ]);
    return orders.filter((o) => allowed.has((o.orderStatus || "").toLowerCase()));
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
          message: `Đã mở file cho labcode ${firstLabcode}. Đơn này còn ${downloadable.length - 1} labcode khác, bạn có thể tải tiếp ở lần bấm sau.`,
        });
      }
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
            "Đơn hàng chưa gắn labcode hoặc kết quả chưa được lưu",
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

  const collectOrderMetadata = async (
    order: OrderResponse
  ): Promise<Array<{ labcode?: string; testResultPath?: string; status?: string }>> => {
    const normalizeRows = (rows: any[]) =>
      rows
        .map((m) => ({
          labcode: String(m?.labcode || "").trim(),
          // Some endpoints return camelCase, some may return snake_case.
          testResultPath: String(m?.testResultPath || m?.test_result_path || "").trim(),
          status: String(m?.status || "").trim(),
        }))
        .filter((m) => !!m.labcode);

    let metaList: Array<{ labcode?: string; testResultPath?: string; status?: string }> =
      Array.isArray(order.patientMetadata) ? (order.patientMetadata as any[]) : [];

    const fresh = await orderService.getById(order.orderId);
    if (fresh.success && fresh.data && Array.isArray(fresh.data.patientMetadata)) {
      metaList = fresh.data.patientMetadata as any[];
    }

    let normalized = normalizeRows(metaList as any[]);
    const needsPatientMetadataFallback =
      normalized.length === 0 || normalized.every((m) => !m.testResultPath);

    if (needsPatientMetadataFallback) {
      const pid = order.specifyId?.patient?.patientId;
      if (pid) {
        const pmRes = await patientMetadataService.getByPatientId(pid);
        if (pmRes.success && Array.isArray(pmRes.data)) {
          const currentSpecifyId = String(order.specifyId?.specifyVoteID || "").trim();
          const fromPatient = (pmRes.data as any[]).filter((m: any) => {
            const sid = String(m?.specifyId || "").trim();
            return !currentSpecifyId || sid === currentSpecifyId;
          });
          const normalizedFromPatient = normalizeRows(fromPatient);
          if (normalizedFromPatient.length > 0) {
            normalized = normalizedFromPatient;
          }
        }
      }
    }

    return normalized;
  };

  const openUploadModalForOrder = async (order: OrderResponse) => {
    try {
      const rows = await collectOrderMetadata(order);
      if (!rows.length) {
        presentFeedbackError({
          title: "Thiếu labcode",
          message: "Đơn hàng chưa có labcode để upload kết quả.",
        });
        return;
      }
      setUploadModalOrder(order);
      setUploadLabcodes(rows.map((r) => ({ labcode: String(r.labcode), testResultPath: r.testResultPath, status: r.status })));
      setSelectedUploadLabcode(rows[0]?.labcode || "");
      setSelectedReportFile(null);
    } catch (err: any) {
      presentFeedbackError({
        title: "Lỗi",
        message: err?.message || "Không thể tải danh sách labcode.",
      });
    }
  };

  const pickReportPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type:
          Platform.OS === "android"
            ? ["application/pdf", "application/octet-stream"]
            : "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      const name = (asset.name || "report.pdf").trim();
      if (!name.toLowerCase().endsWith(".pdf")) {
        presentFeedbackError({
          title: "Sai định dạng",
          message: "Chỉ chấp nhận file PDF (.pdf).",
        });
        return;
      }
      setSelectedReportFile({
        uri: asset.uri,
        name,
        mimeType: "application/pdf",
      });
    } catch (err: any) {
      presentFeedbackError({
        title: "Lỗi chọn file",
        message: err?.message || "Không thể chọn file PDF.",
      });
    }
  };

  const uploadSelectedReport = async () => {
    if (!uploadModalOrder) return;
    if (!selectedUploadLabcode) {
      presentFeedbackError({ title: "Thiếu labcode", message: "Vui lòng chọn labcode." });
      return;
    }
    if (!selectedReportFile) {
      presentFeedbackError({ title: "Thiếu file", message: "Vui lòng chọn file PDF kết quả." });
      return;
    }

    const hospitalName = String(uploadModalOrder.specifyId?.hospital?.hospitalName || "").trim();
    const patientName = String(uploadModalOrder.specifyId?.patient?.patientName || "").trim();
    const phoneNumber = String(uploadModalOrder.specifyId?.patient?.patientPhone || "").trim();
    if (!hospitalName || !patientName || !phoneNumber) {
      presentFeedbackError({
        title: "Thiếu thông tin",
        message: "Cần đủ thông tin bệnh viện, bệnh nhân và số điện thoại để upload.",
      });
      return;
    }

    setUploadingOrderId(uploadModalOrder.orderId);
    try {
      const buildUploadFormData = () => {
        const fd = new FormData();
        fd.append("hospitalName", hospitalName);
        fd.append("patientName", patientName);
        fd.append("phoneNumber", phoneNumber);
        fd.append("labcode", selectedUploadLabcode);
        fd.append("report", {
          uri: selectedReportFile.uri,
          name: selectedReportFile.name,
          type: selectedReportFile.mimeType || "application/pdf",
        } as any);
        return fd;
      };

      // Same flow as htgen_fe approve-result-modal: POST multipart to MinIO API (not Spring API host).
      const uploadRes = await fetch(`${MINIO_API_BASE_URL}/upload-report`, {
        method: "POST",
        body: buildUploadFormData(),
      });
      const uploadJson = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok || !uploadJson?.success) {
        throw new Error(
          (uploadJson && (uploadJson.error || uploadJson.message)) ||
          "Upload file kết quả thất bại."
        );
      }

      // Same as web: store sentinel so downstream download/email uses MinIO path by patient context.
      const mark = await patientMetadataService.updateTestResultPath(
        selectedUploadLabcode,
        "minio"
      );
      if (!mark.success) {
        throw new Error(
          mark.error || "Upload thành công nhưng không thể cập nhật trạng thái kết quả."
        );
      }

      const refreshed = await collectOrderMetadata(uploadModalOrder);
      setUploadLabcodes(
        refreshed.map((r) => ({
          labcode: String(r.labcode),
          testResultPath: r.testResultPath,
          status: r.status,
        }))
      );
      setSelectedReportFile(null);

      setUploadModalOrder(null);
      presentFeedbackAfterModalDismiss(() =>
        presentFeedbackSuccess({
          title: "Thành công",
          message: `Đã upload kết quả cho labcode ${selectedUploadLabcode}.`,
        })
      );
      refetch();
    } catch (err: any) {
      Alert.alert(
        "Upload thất bại",
        err?.message || "Không thể upload file kết quả.",
        [{ text: "OK" }],
        { cancelable: true }
      );
    } finally {
      setUploadingOrderId(null);
    }
  };

  const approveResultsForOrder = async (order: OrderResponse) => {
    if (approvingOrderId) return;
    const approveOpenedFromUploadModal = uploadModalOrder?.orderId === order.orderId;
    setApprovingOrderId(order.orderId);
    try {
      const specifyId = order.specifyId?.specifyVoteID;
      const metadataRows = await collectOrderMetadata(order);
      const gate = computeLabApprovalGate(metadataRows);
      if (!gate.ok) {
        throw new Error(gate.message);
      }

      const orderStatusRes = await orderService.updateStatus(order.orderId, "results_approved");
      if (!orderStatusRes.success) {
        throw new Error(orderStatusRes.error || "Không thể cập nhật trạng thái đơn hàng.");
      }

      if (specifyId) {
        const specifyRes = await specifyVoteTestService.updateStatus(specifyId, "results_approved");
        if (!specifyRes.success) {
          throw new Error(specifyRes.error || "Không thể cập nhật trạng thái phiếu xét nghiệm.");
        }
      }

      const resultDateRes = await orderService.updateResultDate(order.orderId, new Date().toISOString());
      if (!resultDateRes.success) {
        throw new Error(resultDateRes.error || "Không thể cập nhật ngày trả kết quả.");
      }

      if (approveOpenedFromUploadModal) {
        setUploadModalOrder(null);
        setSelectedReportFile(null);
      }

      presentFeedbackAfterModalDismiss(() =>
        presentFeedbackSuccess({
          title: "Thành công",
          message: `Đã phê duyệt kết quả đơn ${order.orderId}.`,
        })
      );
      refetch();
    } catch (err: any) {
      if (approveOpenedFromUploadModal) {
        setUploadModalOrder(null);
        setSelectedReportFile(null);
      }
      presentFeedbackAfterModalDismiss(() =>
        presentFeedbackError({
          title: "Lỗi",
          message: err?.message || "Không thể phê duyệt kết quả.",
        })
      );
    } finally {
      setApprovingOrderId(null);
    }
  };

  const rerunOrder = async (order: OrderResponse) => {
    if (rerunningOrderId) return;
    setRerunningOrderId(order.orderId);
    try {
      const specifyId = order.specifyId?.specifyVoteID;
      const labcodes = (await collectOrderMetadata(order))
        .map((m) => String(m.labcode || "").trim())
        .filter(Boolean);
      for (const labcode of labcodes) {
        await patientMetadataService.updateStatus(labcode, "sample_rerun").catch(() => { });
      }
      await orderService.updateStatus(order.orderId, "rerun_testing");
      if (specifyId) {
        await specifyVoteTestService.updateStatus(specifyId, "rerun_testing");
      }
      presentFeedbackSuccess({
        title: "Đã yêu cầu chạy lại",
        message: `Đơn ${order.orderId} đã chuyển sang trạng thái chạy lại.`,
      });
      refetch();
    } catch (err: any) {
      presentFeedbackError({
        title: "Lỗi",
        message: err?.message || "Không thể chạy lại mẫu.",
      });
    } finally {
      setRerunningOrderId(null);
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
              {user?.hospitalId ? " (theo bệnh viện của bạn)" : ""}
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
              Chưa có đơn hàng đủ điều kiện hiển thị trả kết quả
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
                    <Text className="text-[10px] font-bold">
                      {statusLabel}
                    </Text>
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
                      className="flex-row items-center gap-1 px-2 py-1.5 rounded-lg bg-sky-50"
                    >
                      <Download size={14} color="#0284C7" />
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
                    <TouchableOpacity
                      onPress={() => openUploadModalForOrder(order)}
                      disabled={approvingOrderId === order.orderId || uploadingOrderId === order.orderId}
                      className={`flex-row items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-50 ${approvingOrderId === order.orderId || uploadingOrderId === order.orderId ? "opacity-60" : ""
                        }`}
                    >
                      {approvingOrderId === order.orderId || uploadingOrderId === order.orderId ? (
                        <ActivityIndicator size="small" color="#B45309" />
                      ) : (
                        <FileText size={14} color="#B45309" />
                      )}
                      <Text className="text-xs font-bold text-amber-700">Duyệt KQ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => rerunOrder(order)}
                      disabled={rerunningOrderId === order.orderId}
                      className={`flex-row items-center gap-1 px-2 py-1.5 rounded-lg bg-orange-50 ${rerunningOrderId === order.orderId ? "opacity-60" : ""
                        }`}
                    >
                      {rerunningOrderId === order.orderId ? (
                        <ActivityIndicator size="small" color="#C2410C" />
                      ) : (
                        <RotateCcw size={14} color="#C2410C" />
                      )}
                      <Text className="text-xs font-bold text-orange-700">Chạy lại</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: `${base}/order-detail`,
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

      <Modal
        visible={!!uploadModalOrder}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!uploadingOrderId) {
            setUploadModalOrder(null);
            setSelectedReportFile(null);
          }
        }}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            className="flex-1"
            onPress={() => {
              if (!uploadingOrderId) {
                setUploadModalOrder(null);
                setSelectedReportFile(null);
              }
            }}
          />
          <View className="max-h-[80%] rounded-t-3xl bg-white p-4" style={{ paddingBottom: sheetBottomInset }}>
            <Text className="text-base font-extrabold text-slate-900">Duyệt kết quả xét nghiệm</Text>
            <Text className="mt-1 text-xs text-slate-500">
              Đơn: {uploadModalOrder?.orderId || "-"}
            </Text>

            <Text className="mt-3 text-xs font-bold text-slate-600">Chọn labcode</Text>
            <ScrollView className="mt-2 max-h-40">
              {uploadLabcodes.map((row) => {
                const isSelected = selectedUploadLabcode === row.labcode;
                return (
                  <TouchableOpacity
                    key={row.labcode}
                    onPress={() => setSelectedUploadLabcode(row.labcode)}
                    className={`mb-2 rounded-xl border px-3 py-2 ${isSelected ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
                      }`}
                  >
                    <Text className="text-sm font-bold text-slate-800">{row.labcode}</Text>
                    <Text className={`text-xs ${row.testResultPath ? "text-emerald-700" : "text-amber-700"}`}>
                      {row.testResultPath
                        ? "Đã có kết quả (có thể upload lại)"
                        : "Chưa có kết quả"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {!labApprovalGate.ok ? (
              <Text className="mt-2 text-xs text-amber-900 font-semibold leading-5">
                {labApprovalGate.message}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={pickReportPdf}
              disabled={!!uploadingOrderId}
              className="mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-4"
            >
              <Text className="text-center text-sm font-bold text-slate-700">
                {selectedReportFile ? selectedReportFile.name : "Chọn file PDF kết quả"}
              </Text>
            </TouchableOpacity>

            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  if (!uploadingOrderId) {
                    setUploadModalOrder(null);
                    setSelectedReportFile(null);
                  }
                }}
                disabled={!!uploadingOrderId}
                className="flex-1 rounded-xl bg-slate-100 py-3"
              >
                <Text className="text-center text-sm font-bold text-slate-700">Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={uploadSelectedReport}
                disabled={!!uploadingOrderId}
                className={`flex-1 rounded-xl py-3 ${uploadingOrderId ? "bg-emerald-400" : "bg-emerald-600"}`}
              >
                {uploadingOrderId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-center text-sm font-bold text-white">Upload</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!uploadModalOrder || uploadingOrderId) return;
                  await approveResultsForOrder(uploadModalOrder);
                }}
                disabled={
                  !!uploadingOrderId ||
                  !uploadModalOrder ||
                  approvingOrderId === uploadModalOrder.orderId ||
                  !labApprovalGate.ok
                }
                className={`flex-1 rounded-xl py-3 ${approvingOrderId === uploadModalOrder?.orderId ? "bg-amber-400" : "bg-amber-600"
                  } ${!labApprovalGate.ok ? "opacity-45" : ""}`}
              >
                {approvingOrderId === uploadModalOrder?.orderId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-center text-sm font-bold text-white">Hoàn tất duyệt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
