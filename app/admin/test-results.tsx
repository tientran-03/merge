import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Folder,
  RotateCcw,
  Search,
  Send,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PaginationControls } from "@/components/PaginationControls";
import {
  ROLE_ADMIN,
  ROLE_DOCTOR,
  ROLE_LAB_TECHNICIAN,
  ROLE_STAFF,
} from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { hospitalStaffService } from "@/services/hospitalStaffService";
import { notificationService } from "@/services/notificationService";
import { OrderResponse, orderService } from "@/services/orderService";
import {
  PatientMetadataResponse,
  patientMetadataService,
} from "@/services/patientMetadataService";
import { specifyVoteTestService } from "@/services/specifyVoteTestService";
import { resolvePickerOriginalFileName } from "@/utils/document-picker-filename";
import {
  downloadAndShareTestResultPdf,
  minioContextFromOrder,
  viewTestResultPdfInBrowser,
} from "@/utils/test-result-pdf";


const getFileNameWithoutExt = (name: string): string => {
  const n = name.trim();
  const lastDot = n.lastIndexOf(".");
  return lastDot > 0 ? n.substring(0, lastDot) : n;
};


const RESULT_PHASE_ORDER_STATUSES = [
  "completed",
  "awaiting_results_approval",
  "results_approved",
  "result_approved",
];

const isOrderInResultPhase = (status?: string) => {
  const s = String(status || "").toLowerCase();
  return RESULT_PHASE_ORDER_STATUSES.includes(s);
};

const PATIENT_METADATA_STATUS_LABELS: Record<string, string> = {
  sample_run: "Mẫu khởi chạy",
  sample_waiting_analyze: "Mẫu chờ phân tích",
  sample_in_analyze: "Mẫu đang phân tích",
  sample_completed: "Mẫu hoàn thành",
  sample_error: "Mẫu lỗi",
  sample_added: "Mẫu bổ sung",
  sample_rerun: "Mẫu chạy lại",
};

const getMetaStatusLabel = (status?: string): string => {
  const key = String(status || "").toLowerCase();
  return PATIENT_METADATA_STATUS_LABELS[key] || status || "—";
};

/** Dùng style thay vì className động — tránh nativewind/css-interop gọi stringify(props) khi cảnh báo upgrade (lỗi với Navigation context). */
const getMetaStatusPillStyle = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "sample_completed")
    return {
      containerStyle: { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "#a7f3d0" },
      textStyle: { color: "#047857" as const },
    };
  if (s === "sample_waiting_analyze" || s === "sample_run" || s === "sample_added" || s === "sample_rerun")
    return {
      containerStyle: { backgroundColor: "rgba(245, 158, 11, 0.12)", borderColor: "#fde68a" },
      textStyle: { color: "#b45309" as const },
    };
  if (s === "sample_in_analyze")
    return {
      containerStyle: { backgroundColor: "rgba(59, 130, 246, 0.12)", borderColor: "#bfdbfe" },
      textStyle: { color: "#1d4ed8" as const },
    };
  if (s === "sample_error")
    return {
      containerStyle: { backgroundColor: "rgba(239, 68, 68, 0.12)", borderColor: "#fecaca" },
      textStyle: { color: "#b91c1c" as const },
    };
  return {
    containerStyle: { backgroundColor: "rgba(100, 116, 139, 0.1)", borderColor: "#e2e8f0" },
    textStyle: { color: "#475569" as const },
  };
};

const getOrderStatusLabel = (status: string): string => {
  const s = (status || "").toLowerCase();
  const map: Record<string, string> = {
    initiation: "Khởi tạo",
    forward_analysis: "Chờ duyệt",
    accepted: "Đã chấp nhận",
    rejected: "Từ chối",
    in_progress: "Đang phân tích",
    sample_error: "Lỗi mẫu",
    rerun_testing: "Chạy lại",
    completed: "Hoàn thành",
    sample_addition: "Mẫu bổ sung",
    awaiting_results_approval: "Chờ duyệt kết quả",
    results_approved: "Đã duyệt kết quả",
    result_approved: "Đã duyệt kết quả",
    canceled: "Đã hủy",
  };
  return map[s] || status;
};

const getOrderStatusBadge = (status: string) => {
  const s = (status || "").toLowerCase();
  const label = getOrderStatusLabel(status);
  if (s === "completed" || s === "results_approved" || s === "result_approved") {
    return {
      label,
      containerStyle: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
      textStyle: { color: "#047857" as const },
    };
  }
  if (s === "awaiting_results_approval") {
    return {
      label,
      containerStyle: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
      textStyle: { color: "#c2410c" as const },
    };
  }
  return {
    label,
    containerStyle: { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
    textStyle: { color: "#334155" as const },
  };
};

const formatDateVi = (dateString?: string): string => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("vi-VN");
  } catch {
    return dateString;
  }
};

const testNameFromOrder = (o: OrderResponse) =>
  String((o.specifyId?.genomeTest as { testName?: string } | undefined)?.testName || "").trim();


const MINIO_UPLOAD_REPORT_URL = "https://api.htgen.io.vn/api/minio/upload-report";

type PickedReportFile = { uri: string; name: string; mimeType?: string };

/** Danh sách đơn giai đoạn trả KQ — BS / KTV / NV vận hành + admin (không chỉ ROLE_ADMIN). */
function canAccessTestResultsScreen(role?: string | null): boolean {
  return (
    role === ROLE_ADMIN ||
    role === ROLE_DOCTOR ||
    role === ROLE_LAB_TECHNICIAN ||
    role === ROLE_STAFF
  );
}

/** Upload PDF lên MinIO khi «Chờ duyệt KQ» — web: chủ yếu BS; admin web: full; NV chỉ trả KQ, không upload PDF */
function canUploadApprovePdfRole(role?: string | null): boolean {
  return role === ROLE_ADMIN || role === ROLE_DOCTOR || role === ROLE_LAB_TECHNICIAN;
}

export default function AdminTestResultsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ q?: string }>();

  /** Web: chỉ bác sĩ; màn này chủ yếu ROLE_ADMIN — cho phép BS/KTV lab nếu sau này mở quyền truy cập */
  const canRequestRerunSample =
    user?.role === ROLE_ADMIN ||
    user?.role === ROLE_DOCTOR ||
    user?.role === ROLE_LAB_TECHNICIAN;

  const [searchQuery, setSearchQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [hospitalFilter, setHospitalFilter] = useState<string>("all");
  const [labModalOrder, setLabModalOrder] = useState<OrderResponse | null>(null);
  const [uploadModalOrder, setUploadModalOrder] = useState<OrderResponse | null>(null);
  const [rerunningOrderId, setRerunningOrderId] = useState<string | null>(null);
  /** Chọn nhiều PDF (tên = labcode) — khớp `folder-upload-modal` trên web */
  const [bulkPickedFiles, setBulkPickedFiles] = useState<PickedReportFile[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const q = typeof params.q === "string" ? params.q.trim() : "";
    if (q) setSearchQuery(q);
  }, [params.q]);

  const {
    data: ordersRaw,
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
    queryKey: ["admin-test-results-orders"],
    queryFn: async (params) => await orderService.getAll(params),
    defaultPageSize: 50,
    enabled: canAccessTestResultsScreen(user?.role),
  });

  const orderForLabsModal = labModalOrder || uploadModalOrder;
  const specifyIdForLabQuery = String(orderForLabsModal?.specifyId?.specifyVoteID || "").trim();

  const { data: labMetaResponse, isFetching: loadingLabs } = useQuery({
    queryKey: ["admin-test-results-labs", specifyIdForLabQuery],
    queryFn: () => patientMetadataService.getBySpecifyId(specifyIdForLabQuery),
    enabled: Boolean(specifyIdForLabQuery) && !!orderForLabsModal,
    retry: false,
  });

  const labRows: PatientMetadataResponse[] = useMemo(() => {
    if (!labMetaResponse?.success || !Array.isArray(labMetaResponse.data)) return [];
    return labMetaResponse.data;
  }, [labMetaResponse]);


  const bulkPdfMatchRows = useMemo(() => {
    if (labRows.length === 0) return [];
    return labRows.map((m) => {
      const lc = String(m.labcode || "").trim();
      const matchedFile =
        bulkPickedFiles.length === 0
          ? undefined
          : bulkPickedFiles.find((f) => getFileNameWithoutExt(f.name) === lc);
      return { labcode: lc, matchedFile, hadPath: !!m.testResultPath };
    });
  }, [labRows, bulkPickedFiles]);

  const bulkMatchedCount = useMemo(
    () => bulkPdfMatchRows.filter((r) => r.matchedFile).length,
    [bulkPdfMatchRows],
  );

  const hospitals = useMemo(() => {
    const set = new Set<string>();
    ordersRaw.forEach((o) => {
      if (!o) return;
      const n = o.specifyId?.hospital?.hospitalName;
      if (n) set.add(n);
    });
    return ["all", ...Array.from(set).sort()];
  }, [ordersRaw]);

  const filteredOrders = useMemo(() => {
    const filtered = ordersRaw
      .filter((o): o is OrderResponse => o != null && typeof o === "object")
      .filter((o) => {
        if (!isOrderInResultPhase(o.orderStatus)) return false;

        if (orderStatusFilter !== "all") {
          if (String(o.orderStatus || "").toLowerCase() !== orderStatusFilter.toLowerCase()) return false;
        }

        if (hospitalFilter !== "all") {
          if (String(o.specifyId?.hospital?.hospitalName || "") !== hospitalFilter) return false;
        }

        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        const testName = testNameFromOrder(o).toLowerCase();
        const samples = (o.specifyId?.genomeTest as { testSample?: string[] } | undefined)?.testSample;
        const sampleStr = Array.isArray(samples) ? samples.join(" ").toLowerCase() : "";
        return (
          String(o.orderId || "")
            .toLowerCase()
            .includes(q) ||
          String(o.barcodeId || "")
            .toLowerCase()
            .includes(q) ||
          String(o.orderNote || "")
            .toLowerCase()
            .includes(q) ||
          String(o.specifyId?.hospital?.hospitalName || "")
            .toLowerCase()
            .includes(q) ||
          String(o.specifyId?.patient?.patientName || "")
            .toLowerCase()
            .includes(q) ||
          testName.includes(q) ||
          sampleStr.includes(q)
        );
      });

    // Ưu tiên đơn vừa trả kết quả/duyệt kết quả lên đầu (resultDate mới nhất).
    return filtered.sort((a, b) => {
      const aResultDate = Date.parse(String((a as any).resultDate || ""));
      const bResultDate = Date.parse(String((b as any).resultDate || ""));
      const aTime = Number.isFinite(aResultDate) ? aResultDate : Date.parse(String(a.createdAt || "")) || 0;
      const bTime = Number.isFinite(bResultDate) ? bResultDate : Date.parse(String(b.createdAt || "")) || 0;
      return bTime - aTime;
    });
  }, [ordersRaw, searchQuery, orderStatusFilter, hospitalFilter]);

  const finalizeOrderMutation = useMutation({
    mutationFn: async (order: OrderResponse) => {
      const specifyId = order.specifyId?.specifyVoteID;
      const resOrder = await orderService.updateStatus(order.orderId, "completed");
      if (!resOrder.success)
        throw new Error(resOrder.error || "Không cập nhật được trạng thái đơn (hoàn thành)");
      if (specifyId) {
        const resSp = await specifyVoteTestService.updateStatus(specifyId, "completed");
        if (!resSp.success)
          throw new Error(resSp.error || "Không cập nhật được trạng thái phiếu (hoàn thành)");
      }
      const now = new Date().toISOString();
      const resDt = await orderService.updateResultDate(order.orderId, now);
      if (!resDt.success) throw new Error(resDt.error || "Không cập nhật được ngày trả kết quả");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-test-results-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });


  const finalizeResultsApprovedForOrder = async (order: OrderResponse) => {
    const specifyId = order.specifyId?.specifyVoteID;
    const r1 = await orderService.updateStatus(order.orderId, "results_approved");
    if (!r1.success) throw new Error(r1.error || "Không cập nhật được trạng thái đơn");
    if (specifyId) {
      const r2 = await specifyVoteTestService.updateStatus(specifyId, "results_approved");
      if (!r2.success) throw new Error(r2.error || "Không cập nhật được trạng thái phiếu");
    }
    const r3 = await orderService.updateResultDate(order.orderId, new Date().toISOString());
    if (!r3.success) throw new Error(r3.error || "Không cập nhật được ngày trả kết quả");
  };


  const notifyStaffAllResultsCompleted = async (order: OrderResponse) => {
    const staffId = String(order.staffId || "").trim();
    if (!staffId || !user?.id) return;
    try {
      const staffRes = await hospitalStaffService.getById(staffId);
      const uid =
        staffRes.success && staffRes.data?.userId ? String(staffRes.data.userId).trim() : "";
      if (!uid) return;
      await notificationService.sendToUser(uid, {
        title: "Tất cả kết quả xét nghiệm đã hoàn thành",
        body: `Đơn hàng ${order.orderId} - tất cả labcode đã có kết quả, trạng thái chuyển sang duyệt kết quả hoàn tất`,
        senderId: user.id,
        senderRole: user?.role || undefined,
        senderName: user.name || "Hệ thống",
        notificationType: "TEST_RESULT",
        data: {
          orderId: String(order.orderId),
          specifyId: String(order.specifyId?.specifyVoteID || ""),
          type: "ALL_RESULTS_COMPLETED",
        },
      });
    } catch (e) {
      console.warn("[test-results] notify staff (all results):", e);
    }
  };

  /** Giống web `handleApproveComplete` — chuyển sang đã duyệt kết quả + thông báo NV (staffId) */
  const approveResultsCompleteMutation = useMutation({
    mutationFn: async (order: OrderResponse) => {
      await finalizeResultsApprovedForOrder(order);
      await notifyStaffAllResultsCompleted(order);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-test-results-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-test-results-labs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  /** Giống web `patient-result-list` — `handleRerunTest`: tất cả mẫu → sample_rerun, đơn/phiếu → rerun_testing, thông báo người thu mẫu */
  const rerunTestMutation = useMutation({
    mutationFn: async (order: OrderResponse) => {
      const specifyId = String(order.specifyId?.specifyVoteID || "").trim();
      if (specifyId) {
        const metaRes = await patientMetadataService.getBySpecifyId(specifyId);
        const list: PatientMetadataResponse[] =
          metaRes.success && Array.isArray(metaRes.data) ? metaRes.data : [];
        for (const m of list) {
          const lc = String(m.labcode || "").trim();
          if (!lc) continue;
          const up = await patientMetadataService.updateStatus(lc, "sample_rerun");
          if (!up.success) {
            console.warn("[test-results] sample_rerun for", lc, up.error);
          }
        }
      }
      const rOrder = await orderService.updateStatus(order.orderId, "rerun_testing");
      if (!rOrder.success) throw new Error(rOrder.error || "Không cập nhật được trạng thái đơn");
      if (specifyId) {
        const rSp = await specifyVoteTestService.updateStatus(specifyId, "rerun_testing");
        if (!rSp.success) throw new Error(rSp.error || "Không cập nhật được trạng thái phiếu");
      }
      const sampleCollectorId = String(order.sampleCollectorId || "").trim();
      if (sampleCollectorId && user?.id) {
        try {
          const staffRes = await hospitalStaffService.getById(sampleCollectorId);
          const staffUserId =
            staffRes.success && staffRes.data?.userId ? String(staffRes.data.userId).trim() : "";
          if (staffUserId) {
            await notificationService.sendToUser(staffUserId, {
              title: "Yêu cầu chạy lại mẫu",
              body: `Đơn hàng ${order.orderId} cần chạy lại mẫu. Vui lòng thu mẫu lại.`,
              senderId: user.id,
              senderRole: user.role || undefined,
              senderName: user.name || "Hệ thống",
              notificationType: "ORDER",
              data: {
                orderId: String(order.orderId),
                specifyId,
                type: "RERUN_TESTING",
              },
            });
          }
        } catch (e) {
          console.warn("[test-results] notify sample collector (rerun):", e);
        }
      }
    },
    onSuccess: (_, order) => {
      queryClient.invalidateQueries({ queryKey: ["admin-test-results-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-test-results-labs"] });
      queryClient.invalidateQueries({ queryKey: ["patient-metadatas"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      Alert.alert("Thành công", `Đơn ${order.orderId} đã yêu cầu chạy lại mẫu.`);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Có lỗi khi yêu cầu chạy lại mẫu.";
      Alert.alert("Lỗi", msg);
    },
    onSettled: () => setRerunningOrderId(null),
  });

  const confirmRerunTest = (order: OrderResponse) => {
    if (rerunTestMutation.isPending || rerunningOrderId) return;
    Alert.alert(
      "Chạy lại mẫu",
      `Xác nhận yêu cầu chạy lại mẫu cho đơn ${order.orderId}?\n\n` +
      "Tất cả mẫu trên phiếu chuyển «Mẫu chạy lại», đơn và phiếu chuyển «Chạy lại xét nghiệm», và hệ thống gửi thông báo cho người thu mẫu (giống web).",
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Xác nhận",
          style: "destructive",
          onPress: () => {
            setRerunningOrderId(order.orderId);
            rerunTestMutation.mutate(order);
          },
        },
      ],
    );
  };

  const uploadReportForLabcode = async (
    order: OrderResponse,
    labcode: string,
    file: PickedReportFile,
  ) => {
    const hospitalName = order.specifyId?.hospital?.hospitalName;
    const patientName = order.specifyId?.patient?.patientName;
    const phoneNumber = order.specifyId?.patient?.patientPhone;
    if (!hospitalName || !patientName || !phoneNumber) {
      throw new Error("Thiếu BV / bệnh nhân / SĐT trên phiếu — không upload được (giống điều kiện web).");
    }
    const form = new FormData();
    form.append("hospitalName", hospitalName);
    form.append("patientName", patientName);
    form.append("phoneNumber", phoneNumber);
    form.append("labcode", labcode);
    form.append("report", {
      uri: file.uri,
      name: file.name || "report.pdf",
      type: file.mimeType || "application/pdf",
    } as any);
    const res = await fetch(MINIO_UPLOAD_REPORT_URL, { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || `Upload thất bại (${res.status})`);
    }
    const marker = await patientMetadataService.updateTestResultPath(labcode, "minio");
    if (!marker.success) throw new Error(marker.error || "Không lưu marker kết quả (minio)");
  };

  const confirmFinalize = (order: OrderResponse, title: string, message: string) => {
    if (finalizeOrderMutation.isPending || approveResultsCompleteMutation.isPending) return;
    Alert.alert(title, message, [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xác nhận",
        style: "default",
        onPress: () => {
          finalizeOrderMutation.mutate(order, {
            onSuccess: () => Alert.alert("Thành công", `Đơn ${order.orderId} đã được cập nhật.`),
            onError: (e: any) =>
              Alert.alert("Lỗi", e?.message || "Không thực hiện được. Vui lòng thử lại."),
          });
        },
      },
    ]);
  };

  /**
   * Web `approve-result-modal`: nút «Xong» chỉ bật khi mọi labcode đã có `testResultPath` (đã upload PDF).
   * Folder upload: mỗi file PDF đặt tên `{labcode}.pdf` khớp từng mã — tương đương chọn folder nhiều PDF trên web.
   */
  const confirmApproveResultsComplete = (order: OrderResponse) => {
    if (approveResultsCompleteMutation.isPending || finalizeOrderMutation.isPending) return;
    const specifyId = String(order.specifyId?.specifyVoteID || "").trim();
    if (!specifyId) {
      Alert.alert("Thiếu phiếu", "Không xác định được phiếu chỉ định để kiểm tra mẫu.");
      return;
    }
    void (async () => {
      try {
        const metaRes = await patientMetadataService.getBySpecifyId(specifyId);
        const list: PatientMetadataResponse[] =
          metaRes.success && Array.isArray(metaRes.data) ? metaRes.data : [];
        if (list.length === 0) {
          Alert.alert("Không có mẫu", "Phiếu chưa có labcode — không thể duyệt hoàn tất.");
          return;
        }
        const missing = list.filter((m) => !String(m.testResultPath || "").trim());
        if (missing.length > 0) {
          const codes = missing
            .map((m) => String(m.labcode || "").trim())
            .filter(Boolean)
            .slice(0, 10);
          const extra = missing.length > 10 ? ` …(+${missing.length - 10})` : "";
          Alert.alert(
            "Chưa đủ PDF theo từng labcode",
            `Giống web: cần upload file PDF cho mọi mã mẫu (tên file = labcode.pdf, ví dụ hai mã thì hai file trong cùng folder khi upload hàng loạt).\n\n` +
            `Hãy bấm lại «Duyệt kết quả xét nghiệm» để upload folder PDF.\n\n` +
            `Chưa có kết quả trên hệ thống (${missing.length}): ${codes.join(", ")}${extra}`,
          );
          return;
        }
        Alert.alert(
          "Duyệt kết quả hoàn tất",
          `Xác nhận đơn ${order.orderId} đã duyệt kết quả (chuyển sang «Đã duyệt kết quả» — giống nút «Xong» trên web sau khi đã upload đủ PDF)?`,
          [
            { text: "Huỷ", style: "cancel" },
            {
              text: "Duyệt",
              onPress: () => {
                approveResultsCompleteMutation.mutate(order, {
                  onSuccess: () =>
                    Alert.alert("Thành công", `Đơn ${order.orderId}: đã duyệt kết quả hoàn tất.`),
                  onError: (e: any) =>
                    Alert.alert("Lỗi", e?.message || "Không cập nhật được. Vui lòng thử lại."),
                });
              },
            },
          ],
        );
      } catch (e) {
        Alert.alert("Lỗi", e instanceof Error ? e.message : "Không kiểm tra được danh sách mẫu.");
      }
    })();
  };

  /** 1 nút duyệt: luôn mở luồng upload PDF theo labcode.
   * Dù đã có kết quả trước đó, mỗi lần duyệt vẫn phải nộp lại đủ bộ PDF.
   */
  const handleApproveResultsUnified = (order: OrderResponse) => {
    void (async () => {
      const sid = String(order.specifyId?.specifyVoteID || "").trim();
      if (!sid) {
        Alert.alert("Thiếu phiếu", "Không xác định được phiếu chỉ định.");
        return;
      }
      openApproveResultModalForOrder(order);
    })();
  };

  const pickBulkApprovePdfs = async () => {
    if (bulkUploading) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: true,
        copyToCacheDirectory: true,
      } as any);
      if (result.canceled || !result.assets?.length) return;
      const pdfs: PickedReportFile[] = [];
      for (const a of result.assets) {
        const name = resolvePickerOriginalFileName(a);
        const lower = name.toLowerCase();
        const mt = String(a.mimeType || "").toLowerCase();
        if (!lower.endsWith(".pdf") && mt !== "application/pdf") continue;
        pdfs.push({
          uri: a.uri,
          name: name || "report.pdf",
          mimeType: a.mimeType || "application/pdf",
        });
      }
      if (pdfs.length === 0) {
        Alert.alert("Không có PDF", "Chỉ nhận file PDF (giống folder kết quả trên web).");
        return;
      }
      setBulkPickedFiles(pdfs);
    } catch (e: unknown) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Không chọn được file.");
    }
  };

  const submitBulkFolderUpload = async () => {
    if (!uploadModalOrder || bulkUploading) return;
    const toUpload = bulkPdfMatchRows.filter((r) => r.matchedFile);
    // Chỉ bắt buộc upload cho các labcode CHƯA có PDF kết quả sẵn (testResultPath rỗng).
    const requiredRows = bulkPdfMatchRows.filter((r) => !!r.labcode && !r.hadPath);
    const requiredCount = requiredRows.length;
    if (toUpload.length === 0) {
      Alert.alert(
        "Chưa khớp",
        "Không có file PDF nào trùng tên với labcode (tên file = labcode.pdf, ví dụ LC001.pdf).",
      );
      return;
    }
    if (requiredCount === 0) {
      Alert.alert("Không có mẫu", "Phiếu chưa có labcode để duyệt kết quả.");
      return;
    }
    if (toUpload.length < requiredCount) {
      const missing = requiredRows
        .filter((r) => !r.matchedFile)
        .map((r) => r.labcode)
        .slice(0, 10);
      const hidden = Math.max(0, requiredCount - toUpload.length - 10);
      Alert.alert(
        "Thiếu file PDF",
        `Cần upload đủ ${requiredCount} file PDF cho các labcode chưa có kết quả trước đó.\n\nThiếu: ${missing.join(", ")}${hidden > 0 ? ` …(+${hidden})` : ""}`,
      );
      return;
    }
    setBulkUploading(true);
    setBulkProgress({ done: 0, total: toUpload.length });
    let ok = 0;
    const errors: string[] = [];
    for (let i = 0; i < toUpload.length; i++) {
      const row = toUpload[i];
      try {
        await uploadReportForLabcode(uploadModalOrder, row.labcode, row.matchedFile!);
        ok += 1;
      } catch (e) {
        errors.push(`${row.labcode}: ${e instanceof Error ? e.message : "lỗi"}`);
      }
      setBulkProgress({ done: i + 1, total: toUpload.length });
    }
    setBulkUploading(false);

    queryClient.invalidateQueries({ queryKey: ["admin-test-results-labs"] });
    queryClient.invalidateQueries({ queryKey: ["admin-test-results-orders"] });

    let autoApproved = false;
    if (uploadModalOrder && ok === requiredCount && errors.length === 0) {
      try {
        await finalizeResultsApprovedForOrder(uploadModalOrder);
        await notifyStaffAllResultsCompleted(uploadModalOrder);
        autoApproved = true;
        queryClient.invalidateQueries({ queryKey: ["admin-test-results-orders"] });
        queryClient.invalidateQueries({ queryKey: ["admin-test-results-labs"] });
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      } catch (e) {
        console.warn("[test-results] auto results_approved after bulk:", e);
      }
    }

    if (errors.length > 0 && ok === 0) {
      Alert.alert("Lỗi upload", errors.slice(0, 8).join("\n"));
      return;
    }
    if (ok === 0) return;

    if (autoApproved) {
      Alert.alert(
        "Hoàn tất",
        `Đã upload ${ok} kết quả. Mọi labcode đã có file — đơn chuyển «Đã duyệt kết quả» (giống web).`,
      );
      resetUploadModal();
    } else if (errors.length > 0) {
      Alert.alert(
        "Một phần thành công",
        `Thành công ${ok} file.\n${errors.slice(0, 6).join("\n")}${errors.length > 6 ? "\n…" : ""}`,
      );
    } else {
      Alert.alert(
        "Đã upload",
        `Đã upload ${ok}/${requiredCount} file. Cần upload lại đủ toàn bộ PDF theo labcode để duyệt hoàn tất.`,
      );
      resetUploadModal();
    }
  };

  const resetUploadModal = () => {
    setUploadModalOrder(null);
    setBulkPickedFiles([]);
    setBulkProgress({ done: 0, total: 0 });
  };

  /** Bước 1 giống web: hiện yêu cầu folder + PDF theo từng mã → bước 2 mở form chọn file */
  const openApproveResultModalForOrder = (order: OrderResponse) => {
    void (async () => {
      const sid = String(order.specifyId?.specifyVoteID || "").trim();
      if (!sid) {
        Alert.alert("Thiếu phiếu", "Không xác định được phiếu chỉ định.");
        return;
      }
      let codes: string[] = [];
      try {
        const metaRes = await patientMetadataService.getBySpecifyId(sid);
        const list =
          metaRes.success && Array.isArray(metaRes.data) ? metaRes.data : [];
        codes = list.map((m) => String(m.labcode || "").trim()).filter(Boolean);
      } catch {
        Alert.alert("Lỗi", "Không tải được danh sách labcode.");
        return;
      }
      const n = codes.length;
      const codeLine = codes.length ? codes.join(", ") : "—";
      const twoHint =
        n === 2
          ? `\n\nVới 2 mẫu: trong folder cần đúng 2 file PDF — ${codes[0]}.pdf và ${codes[1]}.pdf`
          : n > 1
            ? `\n\nCần ${n} file PDF, mỗi file trùng tên một mã (vd: ${codes[0]}.pdf …).`
            : n === 1
              ? `\n\nCần 1 file PDF: ${codes[0]}.pdf`
              : "\n\nChưa có labcode trên phiếu — vẫn mở form để kiểm tra.";

      Alert.alert(
        "Duyệt kết quả xét nghiệm — yêu cầu (giống web)",
        `Upload folder chứa các file PDF đặt tên theo labcode (tên file = mã.pdf, không thêm ký tự lạ).\n\nMã trên phiếu: ${codeLine}${twoHint}\n\nBấm «Tiếp tục» để chọn folder / nhiều PDF cùng lúc (mobile tương đương chọn cả folder trên web).`,
        [
          { text: "Huỷ", style: "cancel" },
          {
            text: "Tiếp tục",
            onPress: () => {
              setLabModalOrder(null);
              setBulkPickedFiles([]);
              setUploadModalOrder(order);
            },
          },
        ],
      );
    })();
  };

  if (!canAccessTestResultsScreen(user?.role)) {
    return (
      <SafeAreaView className="flex-1 bg-sky-50 justify-center items-center px-6" edges={["top", "left", "right"]}>
        <Text className="text-slate-700 text-center font-bold mb-2">Không có quyền truy cập</Text>
        <Text className="text-slate-500 text-sm text-center mb-4">
          Màn «Trả kết quả xét nghiệm» dành cho quản trị, bác sĩ, kỹ thuật viên lab hoặc nhân viên vận hành.
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="px-6 py-3 bg-sky-600 rounded-xl">
          <Text className="text-white font-bold">Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải danh sách đơn...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 px-4">
        <Text className="text-red-600 text-center font-bold mb-4">
          {(error as Error)?.message || "Có lỗi xảy ra khi tải dữ liệu"}
        </Text>
        <TouchableOpacity onPress={() => refetch()} className="px-6 py-3 bg-sky-600 rounded-xl">
          <Text className="text-white font-bold">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ORDER_STATUS_CHIPS: { value: string; label: string }[] = [
    { value: "all", label: "Tất cả" },
    { value: "awaiting_results_approval", label: "Chờ duyệt KQ" },
    { value: "results_approved", label: "Đã duyệt KQ" },
    { value: "completed", label: "Hoàn thành" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f9ff" }} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

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
            <Text className="text-slate-900 text-lg font-extrabold">Trả kết quả xét nghiệm</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Chờ duyệt KQ / đã duyệt / hoàn thành — «Duyệt kết quả xét nghiệm» = upload folder PDF theo labcode (BS/KTV/admin)
            </Text>
          </View>
        </View>

        <View
          className="flex-row items-center px-3 py-2 rounded-xl border mb-3"
          style={
            focusSearch
              ? { backgroundColor: "#ffffff", borderColor: "#38bdf8" }
              : { backgroundColor: "#f0f9ff", borderColor: "#bae6fd" }
          }
        >
          <Search size={18} color="#64748b" />
          <TextInput
            className="flex-1 ml-2 text-slate-900 text-sm"
            placeholder="Mã đơn, barcode, BV, dịch vụ, BN, ghi chú..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} className="ml-2" activeOpacity={0.7}>
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        <Text className="text-[11px] font-bold text-slate-500 mb-1">Trạng thái đơn</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-3">
          {ORDER_STATUS_CHIPS.map((c) => (
            <TouchableOpacity
              key={c.value}
              onPress={() => setOrderStatusFilter(c.value)}
              className="px-4 py-2 rounded-xl border"
              style={
                orderStatusFilter === c.value
                  ? { backgroundColor: "#0284c7", borderColor: "#0284c7" }
                  : { backgroundColor: "#ffffff", borderColor: "#bae6fd" }
              }
              activeOpacity={0.85}
            >
              <Text
                className="text-xs font-bold"
                style={{ color: orderStatusFilter === c.value ? "#ffffff" : "#475569" }}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text className="text-[11px] font-bold text-slate-500 mb-1">Bệnh viện / phòng khám</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          {hospitals.map((h) => (
            <TouchableOpacity
              key={h}
              onPress={() => setHospitalFilter(h)}
              className="px-4 py-2 rounded-xl border max-w-[220px]"
              style={
                hospitalFilter === h
                  ? { backgroundColor: "#0891b2", borderColor: "#0891b2" }
                  : { backgroundColor: "#ffffff", borderColor: "#bae6fd" }
              }
              activeOpacity={0.85}
            >
              <Text
                numberOfLines={1}
                className="text-xs font-bold"
                style={{ color: hospitalFilter === h ? "#ffffff" : "#475569" }}
              >
                {h === "all" ? "Tất cả BV" : h}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />}
      >
        {filteredOrders.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-24 h-24 rounded-full bg-sky-100 items-center justify-center mb-6">
              <FileText size={48} color="#0284C7" />
            </View>
            <Text className="text-slate-900 text-xl font-extrabold mb-2 text-center">
              {searchQuery || orderStatusFilter !== "all" || hospitalFilter !== "all"
                ? "Không có đơn phù hợp"
                : "Chưa có đơn ở giai đoạn trả kết quả"}
            </Text>
            <Text className="text-slate-500 text-sm text-center px-4">
              Điều chỉnh ô tìm kiếm hoặc bộ lọc — dữ liệu lấy từ cùng API đơn hàng như màn quản lý đơn.
            </Text>
          </View>
        ) : (
          <>
            <View className="mb-3 flex-row flex-wrap justify-between gap-2">
              <Text className="text-slate-600 text-sm font-bold">
                {filteredOrders.length} đơn (trang hiện tại: {ordersRaw.length} bản ghi tải về)
              </Text>
            </View>

            {filteredOrders.map((order, orderIdx) => {
              const badge = getOrderStatusBadge(String(order.orderStatus || ""));
              const hid = String(order.specifyId?.hospitalId || "").trim();
              const os = String(order.orderStatus || "").toLowerCase();
              const isCompleted = os === "completed";
              const showReturn = hid !== "1" && !isCompleted;
              const showCompleteCenter = hid === "1" && !isCompleted;
              const showUploadApprovePdf = [
                "awaiting_results_approval",
                "results_approved",
                "result_approved",
                "completed",
              ].includes(os);
              // Cho phép chạy lại mẫu cả khi đơn đã hoàn thành.
              const showRerunSample = canRequestRerunSample && os !== "rerun_testing";
              const isRerunningThis =
                rerunTestMutation.isPending && rerunningOrderId === order.orderId;
              const busy =
                finalizeOrderMutation.isPending ||
                approveResultsCompleteMutation.isPending ||
                bulkUploading ||
                rerunTestMutation.isPending;

              const rowKey = String(order.orderId ?? `row-${orderIdx}`);
              return (
                <View key={rowKey} className="bg-white rounded-xl p-4 mb-3 border border-sky-100">
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 pr-2">
                      <Text className="text-slate-900 font-extrabold text-base">{order.orderId ?? "—"}</Text>
                      <Text className="text-slate-500 text-xs mt-0.5">Barcode: {order.barcodeId || "—"}</Text>
                    </View>
                    <View className="px-2 py-1 rounded-lg border" style={badge.containerStyle}>
                      <Text className="text-[10px] font-extrabold" style={badge.textStyle}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-slate-700 text-sm mb-1">
                    {`BV: ${order.specifyId?.hospital?.hospitalName || "—"}`}
                  </Text>
                  <Text className="text-slate-700 text-sm mb-1">
                    {`Dịch vụ: ${testNameFromOrder(order) || "—"}`}
                  </Text>
                  <Text className="text-slate-700 text-sm mb-1">
                    {`BN: ${order.specifyId?.patient?.patientName || "—"}`}
                  </Text>
                  <Text className="text-slate-500 text-xs mb-2">
                    {`Ngày tiếp nhận: ${formatDateVi(order.createdAt)}`}
                  </Text>
                  {!!order.orderNote && (
                    <Text className="text-slate-600 text-xs mb-3" numberOfLines={2}>
                      Ghi chú: {order.orderNote}
                    </Text>
                  )}

                  <View className="flex-row flex-wrap gap-2 mt-1">
                    <TouchableOpacity
                      onPress={() => {
                        setUploadModalOrder(null);
                        setLabModalOrder(order);
                      }}
                      className="flex-row items-center px-3 py-2 rounded-lg bg-slate-100 border border-slate-200"
                      activeOpacity={0.85}
                    >
                      <FlaskConical size={16} color="#475569" />
                      <Text className="text-slate-800 text-xs font-bold ml-1">Mẫu & kết quả</Text>
                    </TouchableOpacity>

                    {showUploadApprovePdf && canUploadApprovePdfRole(user?.role) && (
                      <TouchableOpacity
                        disabled={busy}
                        onPress={() => handleApproveResultsUnified(order)}
                        className="flex-row items-center px-3 py-2 rounded-lg border"
                        style={
                          busy
                            ? { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" }
                            : { backgroundColor: "#fffbeb", borderColor: "#fde68a" }
                        }
                        activeOpacity={0.85}
                      >
                        <Folder size={16} color={busy ? "#94a3b8" : "#b45309"} />
                        <Text
                          className="text-xs font-bold ml-1"
                          style={{ color: busy ? "#94a3b8" : "#78350f" }}
                        >
                          Duyệt kết quả xét nghiệm
                        </Text>
                      </TouchableOpacity>
                    )}

                    {showRerunSample && (
                      <TouchableOpacity
                        disabled={busy}
                        onPress={() => confirmRerunTest(order)}
                        className="flex-row items-center px-3 py-2 rounded-lg border"
                        style={
                          busy
                            ? { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" }
                            : { backgroundColor: "#fff7ed", borderColor: "#fed7aa" }
                        }
                        activeOpacity={0.85}
                      >
                        {isRerunningThis ? (
                          <ActivityIndicator size="small" color="#ea580c" />
                        ) : (
                          <RotateCcw size={16} color={busy ? "#94a3b8" : "#c2410c"} />
                        )}
                        <Text
                          className="text-xs font-bold ml-1"
                          style={{ color: busy ? "#94a3b8" : "#7c2d12" }}
                        >
                          Chạy lại mẫu
                        </Text>
                      </TouchableOpacity>
                    )}

                    {showReturn && (
                      <TouchableOpacity
                        disabled={busy}
                        onPress={() =>
                          confirmFinalize(
                            order,
                            "Trả kết quả",
                            `Xác nhận trả kết quả cho đơn ${order.orderId}? (Chuyển đơn + phiếu sang "Hoàn thành", ghi nhận ngày trả kết quả.)`
                          )
                        }
                        className="flex-row items-center px-3 py-2 rounded-lg border"
                        style={
                          busy
                            ? { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" }
                            : { backgroundColor: "#0284c7", borderColor: "#0284c7" }
                        }
                        activeOpacity={0.85}
                      >
                        <Send size={16} color={busy ? "#94a3b8" : "#fff"} />
                        <Text
                          className="text-xs font-bold ml-1"
                          style={{ color: busy ? "#94a3b8" : "#ffffff" }}
                        >
                          Trả kết quả
                        </Text>
                      </TouchableOpacity>
                    )}

                    {showCompleteCenter && (
                      <TouchableOpacity
                        disabled={busy}
                        onPress={() =>
                          confirmFinalize(
                            order,
                            "Hoàn thiện đơn hàng",
                            `Xác nhận hoàn thiện đơn ${order.orderId} (BV trung tâm)?`
                          )
                        }
                        className="flex-row items-center px-3 py-2 rounded-lg border"
                        style={
                          busy
                            ? { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" }
                            : { backgroundColor: "#059669", borderColor: "#059669" }
                        }
                        activeOpacity={0.85}
                      >
                        <CheckCircle2 size={16} color={busy ? "#94a3b8" : "#fff"} />
                        <Text
                          className="text-xs font-bold ml-1"
                          style={{ color: busy ? "#94a3b8" : "#ffffff" }}
                        >
                          Hoàn thiện
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalElements={totalElements}
                pageSize={pageSize}
                onPageChange={goToPage}
                isLoading={isFetching}
              />
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={!!labModalOrder} animationType="slide" transparent onRequestClose={() => setLabModalOrder(null)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[85%] px-4 pt-4 pb-8">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-slate-900 text-lg font-extrabold">Mẫu theo phiếu</Text>
              <TouchableOpacity onPress={() => setLabModalOrder(null)} className="p-2" hitSlop={12}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-slate-500 mb-3">
              Đơn: {labModalOrder?.orderId} — Phiếu: {specifyIdForLabQuery || "—"}
            </Text>

            {loadingLabs ? (
              <View className="py-10 items-center">
                <ActivityIndicator color="#0284C7" />
                <Text className="mt-2 text-sm text-slate-500 font-medium">Đang tải labcode...</Text>
              </View>
            ) : labRows.length === 0 ? (
              <Text className="text-center text-slate-500 py-8">Chưa có metadata mẫu cho phiếu này.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {labRows.map((m, idx) => {
                  const pill = getMetaStatusPillStyle(m.status);
                  const path = String(m.testResultPath || "").trim();
                  return (
                    <View
                      key={String(m.labcode || idx)}
                      className="border border-slate-200 rounded-xl p-3 mb-3 bg-slate-50"
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 pr-2">
                          <Text className="text-slate-900 font-extrabold">{m.labcode || "—"}</Text>
                          {!!m.sampleName && (
                            <Text className="text-slate-600 text-sm mt-1">Mẫu: {m.sampleName}</Text>
                          )}
                        </View>
                        {!!m.status && (
                          <View className="px-2 py-1 rounded-lg border" style={pill.containerStyle}>
                            <Text className="text-[10px] font-bold" style={pill.textStyle}>
                              {getMetaStatusLabel(m.status)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View className="flex-row justify-end flex-wrap gap-2 mt-2 pt-2 border-t border-slate-200">
                        {path ? (
                          <>
                            <TouchableOpacity
                              onPress={() =>
                                void viewTestResultPdfInBrowser(
                                  path,
                                  m,
                                  minioContextFromOrder(labModalOrder)
                                )
                              }
                              className="flex-row items-center px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200"
                              activeOpacity={0.85}
                            >
                              <ExternalLink size={14} color="#0369a1" />
                              <Text className="text-sky-800 text-xs font-bold ml-1">Xem kết quả</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                void downloadAndShareTestResultPdf(
                                  path,
                                  m,
                                  minioContextFromOrder(labModalOrder)
                                )
                              }
                              className="flex-row items-center px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200"
                              activeOpacity={0.85}
                            >
                              <Download size={14} color="#047857" />
                              <Text className="text-emerald-800 text-xs font-bold ml-1">Tải PDF</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <Text className="text-[11px] text-slate-500">Chưa có file kết quả</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!uploadModalOrder} animationType="slide" transparent onRequestClose={resetUploadModal}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[88%] px-4 pt-4 pb-8">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-slate-900 text-lg font-extrabold">Duyệt kết quả xét nghiệm</Text>
              <TouchableOpacity onPress={resetUploadModal} className="p-2" hitSlop={12}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-slate-500 mb-2">
              Đơn hàng: <Text className="font-bold text-slate-700">{uploadModalOrder?.orderId}</Text>
              {" — "}
              Upload folder chứa các file PDF đặt tên theo labcode (giống web)
            </Text>

            {loadingLabs ? (
              <View className="py-10 items-center">
                <ActivityIndicator color="#0284C7" />
                <Text className="mt-2 text-sm text-slate-500 font-medium">Đang tải labcode...</Text>
              </View>
            ) : labRows.length === 0 ? (
              <Text className="text-center text-slate-500 py-8">Chưa có labcode trên phiếu.</Text>
            ) : (
              <>
                <View className="mb-3 p-3 rounded-xl border border-sky-300 bg-sky-50">
                  <Text className="text-xs font-extrabold text-sky-900 mb-1.5">Yêu cầu (giống web)</Text>
                  <Text className="text-xs text-sky-950 leading-5">
                    Trong folder phải có đủ file PDF kết quả:{" "}
                    <Text className="font-bold">số file = số mã labcode</Text>. Đặt tên mỗi file = đúng mã (không cần
                    thêm gì ngoài .pdf), ví dụ mã <Text className="font-mono font-bold">LC01</Text> →{" "}
                    <Text className="font-mono font-bold">LC01.pdf</Text>
                    {labRows.length === 2 ? (
                      <>
                        . Với <Text className="font-bold">2 mẫu</Text> trên phiếu → folder có{" "}
                        <Text className="font-bold">2 file PDF</Text> tương ứng 2 mã.
                      </>
                    ) : (
                      <>
                        . Phiếu này có <Text className="font-bold">{labRows.length}</Text> mã → cần{" "}
                        <Text className="font-bold">{labRows.length}</Text> file PDF trong folder.
                      </>
                    )}
                  </Text>
                  <Text className="text-[11px] text-sky-800 mt-2 font-semibold">
                    Mã cần có file:{" "}
                    {labRows
                      .map((m) => String(m.labcode || "").trim())
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                  <Text className="text-[11px] text-sky-700 mt-1.5">
                    Trên điện thoại: bấm «Chọn folder / nhiều PDF» và chọn cùng lúc tất cả file (tương đươn chọn cả
                    folder trên trình duyệt). Mỗi lần duyệt đều phải nộp lại đủ bộ PDF.
                  </Text>
                </View>

                <ScrollView className="max-h-[420px]" showsVerticalScrollIndicator>
                  <Text className="text-sm font-semibold text-slate-800 mb-2">Chọn folder chứa kết quả</Text>
                  <TouchableOpacity
                    onPress={pickBulkApprovePdfs}
                    disabled={bulkUploading}
                    className="items-center justify-center px-4 py-8 rounded-xl border-2 border-dashed mb-3"
                    style={
                      bulkUploading
                        ? { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" }
                        : { backgroundColor: "#ffffff", borderColor: "#7dd3fc" }
                    }
                    activeOpacity={0.85}
                  >
                    <Folder size={40} color="#94a3b8" />
                    <Text className="text-sm text-slate-700 font-bold mt-2 text-center">
                      Nhấn để chọn folder kết quả
                    </Text>
                    <Text className="text-xs text-slate-500 mt-1 text-center px-2">
                      Chọn nhiều PDF cùng lúc (mỗi tên file = mã labcode.pdf) — giống web
                    </Text>
                  </TouchableOpacity>
                  {bulkPickedFiles.length > 0 && (
                    <Text className="text-[11px] text-slate-500 mb-2">
                      Đã chọn {bulkPickedFiles.length} file — khớp {bulkMatchedCount}/{bulkPdfMatchRows.length} labcode
                    </Text>
                  )}
                  {bulkUploading && bulkProgress.total > 0 && (
                    <Text className="text-xs text-orange-800 font-bold mb-2">
                      Đang tải: {bulkProgress.done}/{bulkProgress.total}
                    </Text>
                  )}
                  <Text className="text-[11px] font-bold text-slate-600 mb-1">Khớp theo labcode</Text>
                  {bulkPdfMatchRows.map((row) => (
                    <View
                      key={row.labcode}
                      className="flex-row items-center justify-between py-2 border-b border-slate-100"
                    >
                      <Text className="text-xs font-bold text-slate-800 flex-1">{row.labcode}</Text>
                      <Text
                        className="text-[10px] font-bold flex-1 text-right"
                        style={{
                          color: row.matchedFile || row.hadPath ? "#047857" : "#dc2626",
                        }}
                        numberOfLines={2}
                      >
                        {row.matchedFile
                          ? row.matchedFile.name
                          : row.hadPath
                            ? "Đã có kết quả"
                            : "Thiếu file upload lại"}
                      </Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    onPress={submitBulkFolderUpload}
                    disabled={bulkUploading}
                    className="mt-3 py-3 rounded-xl items-center"
                    style={{
                      backgroundColor: bulkUploading ? "#cbd5e1" : "#ea580c",
                    }}
                    activeOpacity={0.85}
                  >
                    {bulkUploading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-extrabold">Upload các file đã khớp</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
