import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Search,
  X,
  FileText,
  CloudUpload,
  ShieldCheck,
  ArrowUp,
  Download,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GenAnalysisModal, type GenAnalysisPatient } from "@/components/GenAnalysisModal";
import { PaginationControls } from "@/components/PaginationControls";
import { ROLE_ADMIN, ROLE_DOCTOR, ROLE_LAB_TECHNICIAN } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { doctorService } from "@/services/doctorService";
import { notificationService } from "@/services/notificationService";
import { orderService, type OrderResponse } from "@/services/orderService";
import { patientMetadataService, PatientMetadataResponse } from "@/services/patientMetadataService";
import { specifyVoteTestService } from "@/services/specifyVoteTestService";
import { resolvePickerOriginalFileName } from "@/utils/document-picker-filename";
import { downloadAndShareAnalysisResultsZip } from "@/utils/download-analysis-zip";
import {
  openMinioFastqInBrowser,
  openMinioFastqcReportInBrowser,
} from "@/utils/fastq-minio";
import { quickValidateFastqPair, type FastqValidationResponse } from "@/utils/fastq-quick-validate";
import {
  deleteChunkUploadSessionForLab,
  isGzipFastqFilename,
  pollFastqcDone,
  uploadOneFastqFile,
  type HtgenUploadMetadata,
} from "@/utils/fastq-upload";

/** File từ cache + tên gốc từ DocumentPicker (tránh `File.name` = hash cache). */
type PickedFastqSlot = { file: File; originalName: string };

// Đồng bộ nhãn status với web (PATIENT_METADATA_STATUS_CONFIG)
const PATIENT_METADATA_STATUS_LABELS: Record<string, string> = {
  sample_run: "Mẫu khởi chạy",
  sample_waiting_analyze: "Mẫu chờ phân tích",
  sample_in_analyze: "Mẫu đang phân tích",
  sample_completed: "Mẫu hoàn thành",
  sample_error: "Mẫu lỗi",
  sample_added: "Mẫu bổ sung",
  sample_rerun: "Mẫu chạy lại",
};

const getStatusLabel = (status?: string): string => {
  if (!status?.trim()) return "—";
  const key = status.toLowerCase();
  return PATIENT_METADATA_STATUS_LABELS[key] || status;
};

const getStatusPillClass = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "sample_completed")
    return {
      bg: "bg-emerald-500/12",
      text: "text-emerald-700",
      border: "border-emerald-200",
    };
  if (s === "sample_in_analyze" || s === "sample_waiting_analyze" || s === "sample_run")
    return {
      bg: "bg-sky-500/12",
      text: "text-sky-700",
      border: "border-sky-200",
    };
  if (s === "sample_error")
    return {
      bg: "bg-red-500/12",
      text: "text-red-700",
      border: "border-red-200",
    };
  if (s === "sample_added" || s === "sample_rerun")
    return {
      bg: "bg-amber-500/12",
      text: "text-amber-700",
      border: "border-amber-200",
    };
  return { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-200" };
};

const isSampleCompletedStatus = (s?: string) =>
  (s || "").toLowerCase() === "sample_completed";

/**
 * Phê duyệt đầu ra — khớp web `patient-metadata-list`: `sample_in_analyze` | `sample_rerun`.
 * Thêm `sample_completed` cho mobile khi pipeline đã xong mà cần chốt phiếu/đơn (không có trên nút web từng dòng).
 */
const canApproveOutputSample = (s?: string) => {
  const x = (s || "").toLowerCase();
  return x === "sample_in_analyze" || x === "sample_rerun" || x === "sample_completed";
};

/**
 * htgen_fe: LAB + BS (`canApproveResults`).
 * admin_fe: không khóa vai trò — ai vào trang cũng phê duyệt được; mobile cho thêm ADMIN cho đúng thực tế dùng admin web.
 */
const canApproveResultsRole = (role?: string | null) =>
  role === ROLE_LAB_TECHNICIAN || role === ROLE_DOCTOR || role === ROLE_ADMIN;

/** Chỉ tải ZIP khi pipeline đã có kết quả (`sample_completed`). `sample_rerun` = chờ FASTQ mới — không tải ZIP. */
const canDownloadAnalysisZip = (s?: string) => {
  const x = (s || "").toLowerCase();
  return x === "sample_completed";
};

type ApproveSender = { id: string; name: string; role?: string };

const pickFirstOrderBySpecify = async (specifyId: string): Promise<OrderResponse | null> => {
  const ordResFirst = await orderService.getBySpecifyId(specifyId);
  if (ordResFirst.success && ordResFirst.data) {
    const raw = ordResFirst.data as unknown;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw[0] as OrderResponse;
    }
    const pageLike = raw as { content?: OrderResponse[] };
    if (Array.isArray(pageLike.content) && pageLike.content.length > 0) {
      return pageLike.content[0];
    }
    const one = raw as Partial<OrderResponse>;
    if (one && typeof one === "object" && String(one.orderId || "").trim()) {
      return one as OrderResponse;
    }
  }

  // Fallback mạnh tay: có backend trả payload không đúng shape cho endpoint theo specify.
  const all = await orderService.getAll();
  if (all.success && all.data) {
    const allRaw = all.data as unknown;
    const allItems: OrderResponse[] = Array.isArray(allRaw)
      ? (allRaw as OrderResponse[])
      : Array.isArray((allRaw as { content?: OrderResponse[] })?.content)
        ? ((allRaw as { content: OrderResponse[] }).content)
        : [];
    const found = allItems.find(
      (o) => String(o.specifyId?.specifyVoteID || "").trim() === specifyId,
    );
    if (found) return found;
  }
  return null;
};

/** Khớp web `approve-results-modal`: duyệt mẫu là chuyển phiếu + đơn sang «chờ duyệt kết quả». */
async function syncSpecifyAndOrderWhenAllSamplesCompleted(
  specifyId: string,
  approvedLabcode: string,
  sender?: ApproveSender | null,
): Promise<{ transitioned: boolean; orderId?: string }> {
  const metadataRes = await patientMetadataService.getBySpecifyId(specifyId);
  if (!metadataRes.success || !Array.isArray(metadataRes.data) || metadataRes.data.length === 0) {
    throw new Error(`Không lấy được danh sách mẫu của phiếu ${specifyId}.`);
  }

  const allSamplesCompleted = metadataRes.data.every(
    (m) => String(m.status || "").toLowerCase() === "sample_completed",
  );

  // Chỉ chuyển trạng thái phiếu/đơn khi TẤT CẢ mẫu (mọi labcode) của phiếu đã hoàn thành.
  if (!allSamplesCompleted) {
    console.log(
      "[patient-metadatas] chưa đủ điều kiện chuyển trạng thái đơn/phiếu",
      JSON.stringify({
        specifyId,
        approvedLabcode,
        totalSamples: metadataRes.data.length,
        completedSamples: metadataRes.data.filter(
          (m) => String(m.status || "").toLowerCase() === "sample_completed",
        ).length,
      }),
    );
    return { transitioned: false };
  }

  const order = await pickFirstOrderBySpecify(specifyId);
  if (!order) {
    throw new Error(`Không tìm thấy đơn theo phiếu ${specifyId}.`);
  }
  const ost = String(order.orderStatus || "").toLowerCase();
  if (
    ost === "awaiting_results_approval" ||
    ost === "results_approved" ||
    ost === "result_approved" ||
    ost === "completed"
  ) {
    return { transitioned: true, orderId: order.orderId };
  }

  const sp = await specifyVoteTestService.updateStatus(specifyId, "awaiting_results_approval");
  if (!sp.success) {
    throw new Error(sp.error || "Không cập nhật được trạng thái phiếu sang chờ duyệt kết quả.");
  }

  const od = await orderService.updateStatus(order.orderId, "awaiting_results_approval");
  if (!od.success) {
    throw new Error(od.error || `Không cập nhật được trạng thái đơn ${order.orderId}.`);
  }

  const specify = order.specifyId;
  const doctorId =
    specify && typeof specify === "object" && "doctorId" in specify
      ? String((specify as { doctorId?: string }).doctorId || "").trim()
      : "";
  if (doctorId && sender?.id) {
    try {
      const docRes = await doctorService.getById(doctorId);
      const doctorUserId =
        docRes.success && docRes.data?.userId ? String(docRes.data.userId).trim() : "";
      if (doctorUserId) {
        await notificationService.sendToUser(doctorUserId, {
          title: "Kết quả phân tích chờ duyệt",
          body: `Tất cả mẫu đơn hàng ${order.orderId} đã phân tích xong, chờ duyệt kết quả.`,
          senderId: sender.id,
          senderRole: sender.role || ROLE_LAB_TECHNICIAN,
          senderName: sender.name || "HT Genetic",
          notificationType: "ORDER",
          data: {
            orderId: String(order.orderId),
            specifyId: String(specifyId),
            type: "AWAITING_RESULTS_APPROVAL",
          },
        });
      }
    } catch (e) {
      console.warn("[patient-metadatas] notify doctor (AWAITING_RESULTS_APPROVAL):", e);
    }
  }

  return { transitioned: true, orderId: order.orderId };
}

export default function PatientMetadatasScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fastqUpload, setFastqUpload] = useState<{
    labcode: string;
    message: string;
    percent: number;
  } | null>(null);
  const [fastqUploadMinimized, setFastqUploadMinimized] = useState(false);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genPatients, setGenPatients] = useState<GenAnalysisPatient[]>([]);
  // Enforce: only show metadata when the order is paid (paymentStatus=COMPLETED)
  const [paidBySpecify, setPaidBySpecify] = useState<Record<string, boolean>>({});

  /** Giống web `FastqUploadModal`: chọn R1 và R2 riêng, kiểm tra nhanh, rồi mới bắt đầu upload. */
  const [fastqModalOpen, setFastqModalOpen] = useState(false);
  const [fastqModalPreparing, setFastqModalPreparing] = useState(false);
  const [fastqModalContext, setFastqModalContext] = useState<{
    metadata: PatientMetadataResponse;
    htMeta: HtgenUploadMetadata;
  } | null>(null);
  const [fastqModalSlot1, setFastqModalSlot1] = useState<PickedFastqSlot | null>(null);
  const [fastqModalSlot2, setFastqModalSlot2] = useState<PickedFastqSlot | null>(null);
  const [fastqModalValidation, setFastqModalValidation] = useState<FastqValidationResponse | null>(
    null,
  );
  const [downloadingZipLabcode, setDownloadingZipLabcode] = useState<string | null>(null);

  useEffect(() => {
    setFastqModalValidation(null);
  }, [fastqModalSlot1, fastqModalSlot2]);

  useEffect(() => {
    const q = typeof params.q === "string" ? params.q.trim() : "";
    if (q) setSearchQuery(q);
  }, [params.q]);

  const {
    data: metadataList,
    isLoading,
    error,
    refetch,
    isFetching,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<PatientMetadataResponse>({
    queryKey: ["patient-metadatas", statusFilter],
    queryFn: async (params) => await patientMetadataService.getAll(params),
    defaultPageSize: 20,
  });

  const filtered = useMemo(() => {
    let data = [...metadataList];

    // Hide metadata for unpaid orders (require paymentStatus=COMPLETED)
    data = data.filter((m) => {
      const sid = String(m.specifyId || "").trim();
      if (!sid) return false;
      // Don't block initial render while payment status is still loading.
      // If we haven't checked yet, keep the row visible and reconcile once known.
      const paid = paidBySpecify[sid];
      return paid !== false;
    });
    
    // Search filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      data = data.filter((m) => {
        return (
          (m.labcode || "").toLowerCase().includes(q) ||
          (m.sampleName || "").toLowerCase().includes(q) ||
          (m.patientId || "").toLowerCase().includes(q) ||
          (m.patientName || "").toLowerCase().includes(q) ||
          (m.specifyId || "").toLowerCase().includes(q)
        );
      });
    }

    // Status filter (sample_*)
    if (statusFilter !== "all") {
      data = data.filter(
        (m) => (m.status || "").toLowerCase() === statusFilter.toLowerCase()
      );
    }

    return data.sort((a, b) => {
      // Sort by labcode or date if available
      return (b.labcode || "").localeCompare(a.labcode || "");
    });
  }, [metadataList, searchQuery, statusFilter, paidBySpecify]);

  // Build paid map per specifyId based on linked orders
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const sids = Array.from(
        new Set(
          (metadataList || [])
            .map((m) => String(m.specifyId || "").trim())
            .filter(Boolean),
        ),
      );
      if (sids.length === 0) {
        setPaidBySpecify({});
        return;
      }

      // Fetch in parallel to avoid long sequential waits.
      const settled = await Promise.allSettled(
        sids.map(async (sid) => {
          const ordRes = await orderService.getBySpecifyId(sid);
          if (ordRes.success && ordRes.data) {
            const raw = ordRes.data as unknown;
            const orders = Array.isArray(raw)
              ? raw
              : Array.isArray((raw as { content?: unknown[] })?.content)
                ? ((raw as { content: unknown[] }).content)
                : [];
            const paid = orders.some(
              (o: any) => String(o?.paymentStatus || "").toUpperCase() === "COMPLETED",
            );
            return [sid, paid] as const;
          }
          return [sid, false] as const;
        }),
      );

      const next: Record<string, boolean> = {};
      for (const r of settled) {
        if (r.status === "fulfilled") {
          next[r.value[0]] = r.value[1];
        } else {
          // If we can't check payment status, don't hide rows by default.
          // Mark as paid=true so the list still shows; backend/network can be flaky.
          // We'll reconcile on next refresh.
          const unknownSid = String((r as any)?.reason?.sid || "");
          if (unknownSid) next[unknownSid] = true;
        }
      }

      if (!cancelled) {
        setPaidBySpecify((prev) => ({ ...prev, ...next }));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [metadataList]);

  /** Giống web: FASTQ trên MinIO theo BV + labcode; BV lấy từ phiếu chỉ định. */
  const canShowFastqActions = (m: PatientMetadataResponse) =>
    Boolean(m.labcode?.trim() && m.specifyId?.trim() && m.hasFastq !== false);

  /**
   * Upload FASTQ: cho phép với mẫu chờ phân tích, mẫu bổ sung, hoặc mẫu chạy lại.
   */
  const canUploadFastqWhileWaiting = (m: PatientMetadataResponse) => {
    const st = (m.status || "").toLowerCase();
    if (st !== "sample_waiting_analyze" && st !== "sample_added" && st !== "sample_rerun") return false;
    return Boolean(
      m.labcode?.trim() && m.specifyId?.trim() && (m.patientId || "").trim(),
    );
  };

  /** Giống web `patient-metadata-list`: có FASTQ + trạng thái cho phép gửi pipeline. */
  const canShowGenAnalysis = (m: PatientMetadataResponse) => {
    if (m.hasFastq !== true) return false;
    const s = (m.status || "").toLowerCase();
    return [
      "sample_waiting_analyze",
      "sample_added",
      "sample_completed",
      "sample_rerun",
      "sample_in_analyze",
    ].includes(s);
  };

  const prepareAndOpenGenAnalysis = async (metadata: PatientMetadataResponse) => {
    const sid = String(metadata.specifyId || "").trim();
    const lab = String(metadata.labcode || "").trim();
    if (!sid || !lab) {
      Alert.alert("Thiếu thông tin", "Cần labcode và phiếu chỉ định để gửi phân tích gen.");
      return;
    }
    try {
      const res = await specifyVoteTestService.getById(sid);
      const hospitalName = String(res.success && res.data?.hospital?.hospitalName ? res.data.hospital.hospitalName : "").trim();
      if (!hospitalName) {
        Alert.alert("Thiếu thông tin", "Không lấy được tên bệnh viện từ phiếu chỉ định.");
        return;
      }
      setGenPatients([
        {
          labcode: lab,
          patientId: metadata.patientId,
          patientName: metadata.patientName,
          sampleName: metadata.sampleName,
          status: metadata.status,
          specifyId: metadata.specifyId,
          hospitalName,
        },
      ]);
      setGenModalOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Không mở được form phân tích.";
      Alert.alert("Lỗi", msg);
    }
  };

  const handleViewFastq = async (metadata: PatientMetadataResponse, which: 1 | 2) => {
    const lab = String(metadata.labcode || "").trim();
    const sid = String(metadata.specifyId || "").trim();
    if (!lab || !sid) {
      Alert.alert(
        "Thiếu thông tin",
        "Cần labcode và phiếu chỉ định để mở FASTQ từ MinIO (giống web)."
      );
      return;
    }
    try {
      const res = await specifyVoteTestService.getById(sid);
      const hospitalName = String(
        res.success && res.data?.hospital?.hospitalName ? res.data.hospital.hospitalName : ""
      ).trim();
      if (!hospitalName) {
        Alert.alert("Thiếu thông tin", "Không lấy được tên bệnh viện từ phiếu chỉ định.");
        return;
      }
      await openMinioFastqInBrowser(hospitalName, lab, which);
    } catch (error: unknown) {
      console.error(`Error viewing FASTQ${which}:`, error);
      const msg = error instanceof Error ? error.message : `Không mở được FASTQ${which}.`;
      Alert.alert("Lỗi", msg);
    }
  };

  const handleViewFastqReport = async (metadata: PatientMetadataResponse, which: 1 | 2) => {
    const lab = String(metadata.labcode || "").trim();
    const sid = String(metadata.specifyId || "").trim();
    if (!lab || !sid) {
      Alert.alert(
        "Thiếu thông tin",
        "Cần labcode và phiếu chỉ định để mở report FASTQ từ MinIO."
      );
      return;
    }
    try {
      const res = await specifyVoteTestService.getById(sid);
      const hospitalName = String(
        res.success && res.data?.hospital?.hospitalName ? res.data.hospital.hospitalName : ""
      ).trim();
      if (!hospitalName) {
        Alert.alert("Thiếu thông tin", "Không lấy được tên bệnh viện từ phiếu chỉ định.");
        return;
      }
      await openMinioFastqcReportInBrowser(hospitalName, lab, which);
    } catch (error: unknown) {
      console.error(`Error viewing FASTQ report ${which}:`, error);
      const msg =
        error instanceof Error ? error.message : `Không mở được report FASTQ${which}.`;
      Alert.alert("Lỗi", msg);
    }
  };

  const closeFastqPickModal = () => {
    setFastqModalOpen(false);
    setFastqModalContext(null);
    setFastqModalSlot1(null);
    setFastqModalSlot2(null);
    setFastqModalValidation(null);
  };

  const handleUploadFastq = async (metadata: PatientMetadataResponse) => {
    if (!canUploadFastqWhileWaiting(metadata)) return;
    const lab = String(metadata.labcode || "").trim();
    const sid = String(metadata.specifyId || "").trim();
    const pid = String(metadata.patientId || "").trim();
    if (!lab || !sid || !pid) {
      Alert.alert("Thiếu thông tin", "Cần labcode, phiếu chỉ định và mã bệnh nhân.");
      return;
    }

    setFastqModalPreparing(true);
    try {
      const res = await specifyVoteTestService.getById(sid);
      if (!res.success || !res.data) {
        Alert.alert("Lỗi", "Không lấy được phiếu chỉ định.");
        return;
      }
      const hospitalName = String(res.data.hospital?.hospitalName || "").trim();
      const patientName = String(
        metadata.patientName || res.data.patient?.patientName || "",
      ).trim();
      const phoneNumber = String(res.data.patient?.patientPhone || "").trim();
      if (!hospitalName) {
        Alert.alert("Thiếu thông tin", "Không có tên bệnh viện trên phiếu chỉ định.");
        return;
      }
      if (!phoneNumber) {
        Alert.alert("Thiếu thông tin", "Cần số điện thoại bệnh nhân trên phiếu để upload FASTQ (giống web).");
        return;
      }

      const sampleName = String(metadata.sampleName || metadata.labcode || "").trim() || lab;
      const htMeta: HtgenUploadMetadata = {
        patientId: pid,
        patientName,
        phoneNumber,
        sampleName,
        hospitalName,
        labcode: lab,
      };

      setFastqModalContext({ metadata, htMeta });
      setFastqModalSlot1(null);
      setFastqModalSlot2(null);
      setFastqModalValidation(null);
      setFastqModalOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Không mở được form upload.";
      Alert.alert("Lỗi", msg);
    } finally {
      setFastqModalPreparing(false);
    }
  };

  const pickFastqForModal = async (which: 1 | 2) => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (pick.canceled || !pick.assets?.[0]) return;
      const asset = pick.assets[0];
      const f = new File(asset as DocumentPicker.DocumentPickerAsset);
      const originalName = resolvePickerOriginalFileName(asset);
      if (!f.exists || !f.size) {
        Alert.alert("Lỗi", "Không đọc được file. Thử chọn lại.");
        return;
      }
      const slot: PickedFastqSlot = { file: f, originalName };
      if (which === 1) setFastqModalSlot1(slot);
      else setFastqModalSlot2(slot);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Không chọn được file.";
      Alert.alert("Lỗi", msg);
    }
  };

  const handleFastqModalValidate = () => {
    if (!fastqModalSlot1 || !fastqModalSlot2) return;
    setFastqModalValidation(
      quickValidateFastqPair(
        { name: fastqModalSlot1.originalName, size: fastqModalSlot1.file.size },
        { name: fastqModalSlot2.originalName, size: fastqModalSlot2.file.size },
      ),
    );
  };

  /** Upload lên MinIO (chunk) giống web sau khi đã chọn đủ 2 file trong modal. */
  const runFastqUploadPipeline = async (
    metadata: PatientMetadataResponse,
    htMeta: HtgenUploadMetadata,
    slot1: PickedFastqSlot,
    slot2: PickedFastqSlot,
  ) => {
    const lab = htMeta.labcode;
    const hospitalName = htMeta.hospitalName;

    const file1 = slot1.file;
    const file2 = slot2.file;
    const n1 = String(slot1.originalName || "").trim();
    const n2 = String(slot2.originalName || "").trim();
    if (!isGzipFastqFilename(n1) || !isGzipFastqFilename(n2)) {
      Alert.alert(
        "Cần file .fastq.gz",
        "Pipeline MinIO trên app yêu cầu FASTQ đã nén GZIP (*.fastq.gz / *.fq.gz), khớp với bước merge trên Htgen.",
      );
      return;
    }

    try {
      if (Platform.OS !== "web") {
        await deleteChunkUploadSessionForLab(htMeta);
      }

      setFastqUpload({ labcode: lab, message: "Đang upload FASTQ read 1...", percent: 0 });
      setFastqUploadMinimized(false);
      await uploadOneFastqFile(htMeta, "1", file1, {
        onProgress: (p) =>
          setFastqUpload({
            labcode: lab,
            message: "Đang upload FASTQ read 1...",
            percent: Math.round(p * 0.45),
          }),
        onLog: (msg) =>
          setFastqUpload((prev) => ({
            labcode: lab,
            message: msg,
            percent: prev?.percent ?? 0,
          })),
      });

      setFastqUpload({ labcode: lab, message: "Đang upload FASTQ read 2...", percent: 45 });
      await uploadOneFastqFile(htMeta, "2", file2, {
        onProgress: (p) =>
          setFastqUpload({
            labcode: lab,
            message: "Đang upload FASTQ read 2...",
            percent: 45 + Math.round(p * 0.45),
          }),
        onLog: (msg) =>
          setFastqUpload((prev) => ({
            labcode: lab,
            message: msg,
            percent: prev?.percent ?? 0,
          })),
      });
      setFastqUpload({ labcode: lab, message: "Đang hoàn tất upload...", percent: 90 });

      setFastqUpload({ labcode: lab, message: "Đang chờ FastQC...", percent: 92 });
      await pollFastqcDone(hospitalName, lab, {
        maxAttempts: 72,
        intervalMs: 5000,
        onLog: (m) => setFastqUpload({ labcode: lab, message: m, percent: 95 }),
      });

      setFastqUpload({ labcode: lab, message: "Đang cập nhật hệ thống...", percent: 97 });
      const stUp = await patientMetadataService.updateStatus(lab, "sample_waiting_analyze");
      if (!stUp.success) {
        console.warn("[patient-metadatas] updateStatus after fastq:", stUp.error);
      }
      const hq = await patientMetadataService.updateHasFastq(lab, true);
      if (!hq.success) {
        setFastqUpload(null);
        Alert.alert("Upload xong nhưng chưa lưu cờ FASTQ", hq.error || "Không gọi được API hasFastq.");
        await refetch();
        return;
      }

      setFastqUpload(null);
      setFastqUploadMinimized(false);
      await refetch();
      Alert.alert("Thành công", `Đã upload FASTQ cho mẫu ${lab}. Bạn có muốn gửi yêu cầu phân tích gen ngay?`, [
        { text: "Để sau", style: "cancel" },
        {
          text: "Phân tích gen",
          onPress: () => void prepareAndOpenGenAnalysis(metadata),
        },
      ]);
    } catch (e: unknown) {
      setFastqUpload(null);
      setFastqUploadMinimized(false);
      const msg = e instanceof Error ? e.message : "Upload thất bại.";
      Alert.alert("Lỗi", msg);
    }
  };

  const handleFastqModalStartUpload = async () => {
    if (!fastqModalContext || !fastqModalSlot1 || !fastqModalSlot2) return;
    const { metadata, htMeta } = fastqModalContext;
    const s1 = fastqModalSlot1;
    const s2 = fastqModalSlot2;
    closeFastqPickModal();
    await runFastqUploadPipeline(metadata, htMeta, s1, s2);
  };

  const handleApprove = async (metadata: PatientMetadataResponse) => {
    if (!canApproveOutputSample(metadata.status)) {
      Alert.alert(
        "Không hợp lệ",
        "Chỉ phê duyệt khi mẫu đang phân tích, mẫu chạy lại, hoặc đã hoàn thành phân tích (giống web).",
      );
      return;
    }
    if (!canApproveResultsRole(user?.role)) {
      Alert.alert(
        "Không đủ quyền",
        "Chỉ quản trị viên, kỹ thuật viên lab hoặc bác sĩ mới duyệt kết quả đầu ra (khớp admin web / htgen web).",
      );
      return;
    }
    const alreadyPipelineDone =
      (metadata.status || "").toLowerCase() === "sample_completed";
    Alert.alert(
      "Duyệt kết quả đầu ra",
      alreadyPipelineDone
        ? `Mẫu ${metadata.labcode} đã ở trạng thái hoàn thành phân tích (pipeline).\n\nBấm xác nhận để chốt: khi mọi mẫu của phiếu đều xong, phiếu và đơn chuyển «Chờ duyệt kết quả» và gửi thông báo tới bác sĩ (giống web).`
        : `Xác nhận mẫu ${metadata.labcode} đã hoàn thành phân tích?\n\nKhi tất cả mẫu của cùng một phiếu đều hoàn thành, phiếu và đơn hàng chuyển sang «Chờ duyệt kết quả» và hệ thống gửi thông báo tới bác sĩ (giống web).`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận duyệt",
          style: "default",
          onPress: async () => {
            try {
              if (!alreadyPipelineDone) {
                const resp = await patientMetadataService.updateStatus(
                  metadata.labcode,
                  "sample_completed",
                );
                if (!resp.success) {
                  Alert.alert("Lỗi", resp.error || "Không thể cập nhật trạng thái mẫu.");
                  return;
                }
              }
              const sid = String(metadata.specifyId || "").trim();
              if (sid) {
                const synced = await syncSpecifyAndOrderWhenAllSamplesCompleted(sid, metadata.labcode, {
                  id: user?.id || "",
                  name: user?.name || "",
                  role: user?.role,
                });
                // Đồng bộ cache để màn "Trả kết quả xét nghiệm" thấy ngay trạng thái mới.
                queryClient.invalidateQueries({ queryKey: ["admin-test-results-orders"] });
                queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
                queryClient.invalidateQueries({ queryKey: ["orders"] });

                // Với role admin: nếu đã đủ điều kiện chuyển sang giai đoạn trả KQ thì điều hướng luôn.
                if (user?.role === ROLE_ADMIN && synced.transitioned) {
                  router.push({
                    pathname: "/admin/test-results",
                    params: { q: synced.orderId || "" },
                  } as any);
                }
              }
              Alert.alert(
                "Thành công",
                alreadyPipelineDone
                  ? `Đã ghi nhận chốt mẫu ${metadata.labcode}. Nếu mọi mẫu trên phiếu đã xong, phiếu/đơn đã được cập nhật.`
                  : `Đã duyệt kết quả đầu ra cho mẫu ${metadata.labcode}.`,
              );
              refetch();
            } catch (error: unknown) {
              console.error("Approve error:", error);
              const msg =
                error instanceof Error ? error.message : "Không duyệt được. Vui lòng thử lại.";
              Alert.alert("Lỗi", msg);
            }
          },
        },
      ],
    );
  };

  const handleDownloadAnalysisZip = async (metadata: PatientMetadataResponse) => {
    const sid = String(metadata.specifyId || "").trim();
    const lc = String(metadata.labcode || "").trim();
    if (!sid || !lc) {
      Alert.alert("Thiếu thông tin", "Cần labcode và phiếu chỉ định để tải kết quả phân tích.");
      return;
    }
    if (downloadingZipLabcode) {
      Alert.alert("Đang tải", "Vui lòng chờ tải xong.");
      return;
    }
    setDownloadingZipLabcode(lc);
    try {
      const res = await specifyVoteTestService.getById(sid);
      const hospitalName = String(
        res.success && res.data?.hospital?.hospitalName ? res.data.hospital.hospitalName : "",
      ).trim();
      if (!hospitalName) {
        Alert.alert("Thiếu thông tin", "Không lấy được tên bệnh viện từ phiếu chỉ định.");
        return;
      }
      await downloadAndShareAnalysisResultsZip(hospitalName, lc);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Không tải được kết quả.";
      Alert.alert("Lỗi", msg);
    } finally {
      setDownloadingZipLabcode(null);
    }
  };

  const handleReportError = async (metadata: PatientMetadataResponse) => {
    const status = (metadata.status || "").toLowerCase();
    if (status === "sample_error") {
      Alert.alert("Thông báo", "Mẫu này đã ở trạng thái lỗi.");
      return;
    }
    Alert.alert(
      "Báo cáo mẫu lỗi",
      `Bạn có chắc chắn muốn đánh dấu mẫu ${metadata.labcode} là lỗi?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đồng ý",
          style: "destructive",
          onPress: async () => {
            try {
              const resp = await patientMetadataService.updateStatus(
                metadata.labcode,
                "sample_error",
              );
              if (!resp.success) {
                Alert.alert("Lỗi", resp.error || "Không thể báo lỗi mẫu.");
                return;
              }
              Alert.alert("Thành công", "Đã báo lỗi cho mẫu.");
              refetch();
            } catch (error: any) {
              console.error("Report error:", error);
              Alert.alert("Lỗi", "Không thể báo lỗi mẫu. Vui lòng thử lại.");
            }
          },
        },
      ],
    );
  };

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
      <View className="flex-1 justify-center items-center bg-sky-50 px-4">
        <Text className="text-red-600 text-center font-bold">Có lỗi xảy ra khi tải dữ liệu</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 px-6 py-3 bg-sky-600 rounded-xl"
        >
          <Text className="text-white font-bold">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <StatusBar barStyle="dark-content" />

      {/* Header */}
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
            <Text className="text-slate-900 text-lg font-extrabold">
              Quản lý dữ liệu bệnh nhân
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {filtered.length} mẫu
            </Text>
          </View>
        </View>

        {/* Search */}
        <View className={`mt-3 h-12 rounded-2xl flex-row items-center px-4 border ${
          focusSearch ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-slate-50"
        }`}>
          <Search size={18} color={focusSearch ? "#0284C7" : "#64748B"} />
          <TextInput
            className="flex-1 ml-3 text-[15px] text-slate-900 font-semibold"
            placeholder="Tìm kiếm theo mã lab, tên mẫu..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter - sync with web statuses */}
        <View className="mt-3 flex-row flex-wrap gap-2">
          {[
            { value: "all", label: "Tất cả" },
            { value: "sample_run", label: "Mẫu khởi chạy" },
            { value: "sample_waiting_analyze", label: "Mẫu chờ phân tích" },
            { value: "sample_in_analyze", label: "Mẫu đang phân tích" },
            { value: "sample_completed", label: "Mẫu hoàn thành" },
            { value: "sample_error", label: "Mẫu lỗi" },
            { value: "sample_added", label: "Mẫu bổ sung" },
            { value: "sample_rerun", label: "Mẫu chạy lại" },
          ].map((status) => (
            <TouchableOpacity
              key={status.value}
              onPress={() => setStatusFilter(status.value)}
              className={`px-3 py-1.5 rounded-xl border ${
                statusFilter === status.value
                  ? "bg-sky-600 border-sky-600"
                  : "bg-white border-slate-200"
              }`}
              activeOpacity={0.8}
            >
              <Text
                className={`text-xs font-extrabold ${
                  statusFilter === status.value ? "text-white" : "text-slate-700"
                }`}
              >
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Metadata List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#0284C7" />
        }
      >
        {filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <FileText size={48} color="#94A3B8" />
            <Text className="mt-4 text-slate-500 text-base font-semibold">
              {searchQuery || statusFilter !== "all"
                ? "Không tìm thấy mẫu xét nghiệm"
                : "Chưa có mẫu xét nghiệm"}
            </Text>
          </View>
        ) : (
          filtered.map((metadata) => {
            const statusClass = getStatusPillClass(metadata.status);
            return (
              <View
                key={metadata.labcode}
                className="bg-white rounded-2xl border border-sky-100 p-4 mb-3"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <Text className="text-slate-900 text-base font-extrabold" numberOfLines={2}>
                      {metadata.sampleName?.trim() || "-"}
                    </Text>
                    <Text className="mt-1 text-xs text-slate-500 font-semibold">
                      Labcode: {metadata.labcode}
                    </Text>
                  </View>
                  <View
                    className={`px-3 py-1 rounded-xl border ${statusClass.bg} ${statusClass.border}`}
                  >
                    <Text className={`text-xs font-extrabold ${statusClass.text}`}>
                      {getStatusLabel(metadata.status)}
                    </Text>
                  </View>
                </View>

                {metadata.patientId && (
                <View className="flex-row items-center mt-2">
                  <Text className="text-xs text-slate-500 font-semibold">
                    Bệnh nhân:{" "}
                    {metadata.patientName
                      ? `${metadata.patientName} (${metadata.patientId || "-"})`
                      : metadata.patientId || "-"}
                  </Text>
                </View>
                )}

                {metadata.specifyId && (
                  <View className="flex-row items-center mt-1">
                    <Text className="text-xs text-slate-500 font-semibold" numberOfLines={1}>
                      Phiếu chỉ định: {metadata.specifyId}
                    </Text>
                  </View>
                )}

                {/* Action buttons: FASTQ 1/2, Duyệt kết quả, Báo lỗi */}
                <View className="flex-row flex-wrap gap-2 mt-3 pt-2 border-t border-sky-100">
                  {canUploadFastqWhileWaiting(metadata) && (
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-200 flex-row items-center gap-1"
                      activeOpacity={0.8}
                      disabled={!!fastqUpload || fastqModalPreparing}
                      onPress={() => void handleUploadFastq(metadata)}
                    >
                      <CloudUpload size={14} color="#6d28d9" />
                      <Text className="text-xs font-extrabold text-violet-800">
                        Upload FASTQ
                      </Text>
                    </TouchableOpacity>
                  )}

                  {canShowGenAnalysis(metadata) && (
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 flex-row items-center gap-1"
                      activeOpacity={0.8}
                      onPress={() => void prepareAndOpenGenAnalysis(metadata)}
                    >
                      <Text className="text-xs font-extrabold text-indigo-800">Phân tích Gen</Text>
                    </TouchableOpacity>
                  )}

                  {canShowFastqActions(metadata) && (
                    <>
                      <TouchableOpacity
                        className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200"
                        activeOpacity={0.8}
                        onPress={() => void handleViewFastq(metadata, 1)}
                      >
                        <Text className="text-xs font-extrabold text-sky-700">
                          Xem FASTQ1
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200"
                        activeOpacity={0.8}
                        onPress={() => void handleViewFastq(metadata, 2)}
                      >
                        <Text className="text-xs font-extrabold text-sky-700">
                          Xem FASTQ2
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200"
                        activeOpacity={0.8}
                        onPress={() => void handleViewFastqReport(metadata, 1)}
                      >
                        <Text className="text-xs font-extrabold text-indigo-700">
                          Xem report FASTQ1
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200"
                        activeOpacity={0.8}
                        onPress={() => void handleViewFastqReport(metadata, 2)}
                      >
                        <Text className="text-xs font-extrabold text-indigo-700">
                          Xem report FASTQ2
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {canDownloadAnalysisZip(metadata.status) && !!metadata.specifyId && (
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 flex-row items-center gap-1"
                      activeOpacity={0.8}
                      disabled={downloadingZipLabcode === metadata.labcode}
                      onPress={() => void handleDownloadAnalysisZip(metadata)}
                    >
                      {downloadingZipLabcode === metadata.labcode ? (
                        <ActivityIndicator size="small" color="#0f766e" />
                      ) : (
                        <Download size={14} color="#0f766e" />
                      )}
                      <Text className="text-xs font-extrabold text-teal-800">
                        Tải kết quả (ZIP)
                      </Text>
                    </TouchableOpacity>
                  )}

                  {canApproveOutputSample(metadata.status) && canApproveResultsRole(user?.role) && (
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200"
                      activeOpacity={0.8}
                      onPress={() => void handleApprove(metadata)}
                    >
                      <Text className="text-xs font-extrabold text-emerald-700">
                        Duyệt kết quả đầu ra
                      </Text>
                    </TouchableOpacity>
                  )}

                  {(metadata.status || "").toLowerCase() !== "sample_error" && (
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200"
                      activeOpacity={0.8}
                      onPress={() => handleReportError(metadata)}
                    >
                      <Text className="text-xs font-extrabold text-red-700">
                        Báo mẫu lỗi
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
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

      <GenAnalysisModal
        visible={genModalOpen}
        onClose={() => {
          setGenModalOpen(false);
          setGenPatients([]);
        }}
        patients={genPatients}
        onSuccess={() => void refetch()}
      />

      {/* Giống web `fastq-upload-modal.tsx`: 2 ô chọn R1/R2 riêng, Kiểm tra nhanh, Bắt đầu Upload */}
      <Modal
        visible={fastqModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeFastqPickModal}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl border-t border-slate-200 max-h-[92%]">
            <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-slate-100">
              <View className="flex-row items-center gap-2 flex-1">
                <ArrowUp size={22} color="#0284c7" />
                <View className="flex-1">
                  <Text className="text-slate-900 font-extrabold text-base">Upload FASTQ</Text>
                  {fastqModalContext && (
                    <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={2}>
                      2 file cho labcode {fastqModalContext.htMeta.labcode} (giống web)
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={closeFastqPickModal} hitSlop={12}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="px-4 pt-3"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {fastqModalContext && (
                <>
                  <View className="bg-slate-50 rounded-xl p-3 mb-3">
                    <Text className="text-xs text-slate-500 font-bold mb-2">Thông tin mẫu</Text>
                    <View className="gap-1">
                      <Text className="text-xs text-slate-700">
                        <Text className="text-slate-500">BN: </Text>
                        {fastqModalContext.htMeta.patientName} ({fastqModalContext.htMeta.patientId})
                      </Text>
                      <Text className="text-xs text-slate-700">
                        <Text className="text-slate-500">SĐT: </Text>
                        {fastqModalContext.htMeta.phoneNumber}
                      </Text>
                      <Text className="text-xs text-slate-700" numberOfLines={2}>
                        <Text className="text-slate-500">BV: </Text>
                        {fastqModalContext.htMeta.hospitalName}
                      </Text>
                      <Text className="text-xs text-slate-700">
                        <Text className="text-slate-500">Labcode: </Text>
                        {fastqModalContext.htMeta.labcode}
                      </Text>
                    </View>
                  </View>

                  <View className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3">
                    <Text className="text-xs text-sky-900 leading-5">
                      <Text className="font-extrabold">Lưu ý: </Text>
                      Chọn từng file (R1 rồi R2). Nên bấm «Kiểm tra nhanh» trước khi upload. Upload chạy
                      ngầm sau khi bấm «Bắt đầu Upload». Trên app, file gửi lên MinIO phải là{" "}
                      <Text className="font-extrabold">*.fastq.gz</Text> (merge gzip trên Htgen).
                    </Text>
                  </View>

                  <Text className="text-sm font-bold text-slate-800 mb-1">
                    FASTQ 1 (R1) <Text className="text-red-500">*</Text>
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => void pickFastqForModal(1)}
                    className={`border-2 border-dashed rounded-xl p-4 mb-3 ${
                      fastqModalSlot1 ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white"
                    }`}
                  >
                    {fastqModalSlot1 ? (
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-2">
                          <Text className="text-sm font-semibold text-slate-800" numberOfLines={2}>
                            {fastqModalSlot1.originalName}
                          </Text>
                          <Text className="text-xs text-slate-500 mt-1">
                            {(fastqModalSlot1.file.size / (1024 * 1024)).toFixed(1)} MB
                            {fastqModalValidation?.fastq1Result?.readType ? (
                              <Text>
                                {" "}
                                · {fastqModalValidation.fastq1Result.readType}
                              </Text>
                            ) : null}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setFastqModalSlot1(null);
                          }}
                          hitSlop={8}
                        >
                          <X size={18} color="#64748b" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View className="items-center py-2">
                        <ArrowUp size={28} color="#94a3b8" />
                        <Text className="text-sm text-slate-600 mt-2 text-center">
                          Chạm để chọn FASTQ 1 (R1)
                        </Text>
                        <Text className="text-xs text-slate-400 mt-1 text-center">
                          .fastq / .fq / .gz — upload cần .fastq.gz
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <Text className="text-sm font-bold text-slate-800 mb-1">
                    FASTQ 2 (R2) <Text className="text-red-500">*</Text>
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => void pickFastqForModal(2)}
                    className={`border-2 border-dashed rounded-xl p-4 mb-3 ${
                      fastqModalSlot2 ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white"
                    }`}
                  >
                    {fastqModalSlot2 ? (
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-2">
                          <Text className="text-sm font-semibold text-slate-800" numberOfLines={2}>
                            {fastqModalSlot2.originalName}
                          </Text>
                          <Text className="text-xs text-slate-500 mt-1">
                            {(fastqModalSlot2.file.size / (1024 * 1024)).toFixed(1)} MB
                            {fastqModalValidation?.fastq2Result?.readType ? (
                              <Text>
                                {" "}
                                · {fastqModalValidation.fastq2Result.readType}
                              </Text>
                            ) : null}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setFastqModalSlot2(null);
                          }}
                          hitSlop={8}
                        >
                          <X size={18} color="#64748b" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View className="items-center py-2">
                        <ArrowUp size={28} color="#94a3b8" />
                        <Text className="text-sm text-slate-600 mt-2 text-center">
                          Chạm để chọn FASTQ 2 (R2)
                        </Text>
                        <Text className="text-xs text-slate-400 mt-1 text-center">
                          .fastq / .fq / .gz — upload cần .fastq.gz
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {fastqModalValidation && (
                    <View
                      className={`rounded-xl p-3 mb-3 border ${
                        fastqModalValidation.valid
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${
                          fastqModalValidation.valid ? "text-emerald-900" : "text-red-900"
                        }`}
                      >
                        {fastqModalValidation.message}
                      </Text>
                      {fastqModalValidation.pairValidationMessage ? (
                        <Text className="text-xs text-slate-700 mt-1">
                          {fastqModalValidation.pairValidationMessage}
                        </Text>
                      ) : null}
                      {fastqModalValidation.errors?.map((err, i) => (
                        <Text key={`e-${i}`} className="text-xs text-red-800 mt-1">
                          • {err}
                        </Text>
                      ))}
                      {fastqModalValidation.warnings?.map((w, i) => (
                        <Text key={`w-${i}`} className="text-xs text-amber-800 mt-1">
                          • {w}
                        </Text>
                      ))}
                    </View>
                  )}
                </>
              )}
              <View className="h-4" />
            </ScrollView>

            <View className="px-4 pb-6 pt-2 border-t border-slate-100 gap-2">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleFastqModalValidate}
                disabled={!fastqModalSlot1 || !fastqModalSlot2}
                className={`flex-row items-center justify-center gap-2 py-3 rounded-xl border ${
                  fastqModalSlot1 && fastqModalSlot2
                    ? "bg-white border-slate-300"
                    : "bg-slate-100 border-slate-200 opacity-60"
                }`}
              >
                <ShieldCheck size={18} color="#475569" />
                <Text className="text-slate-800 font-extrabold text-sm">Kiểm tra nhanh</Text>
              </TouchableOpacity>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl border border-slate-300 items-center"
                  onPress={closeFastqPickModal}
                >
                  <Text className="text-slate-700 font-extrabold">Đóng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 rounded-xl bg-sky-600 items-center"
                  onPress={() => void handleFastqModalStartUpload()}
                  disabled={!fastqModalSlot1 || !fastqModalSlot2}
                  style={{
                    opacity: fastqModalSlot1 && fastqModalSlot2 ? 1 : 0.5,
                  }}
                >
                  <Text className="text-white font-extrabold">Bắt đầu Upload</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!fastqUpload && !fastqUploadMinimized} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm">
            <Text className="text-slate-900 font-extrabold text-base text-center">
              Upload FASTQ
            </Text>
            {fastqUpload && (
              <>
                <Text className="text-slate-600 text-sm mt-2 text-center" numberOfLines={3}>
                  {fastqUpload.labcode}: {fastqUpload.message}
                </Text>
                <View className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <View
                    className="h-full bg-violet-600 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, fastqUpload.percent))}%` }}
                  />
                </View>
                <Text className="text-center text-xs text-slate-500 mt-2 font-bold">
                  {fastqUpload.percent}%
                </Text>
              </>
            )}
            <ActivityIndicator className="mt-4" size="small" color="#7c3aed" />
            <TouchableOpacity
              className="mt-4 self-center px-4 py-2 rounded-xl border border-slate-300"
              activeOpacity={0.8}
              onPress={() => setFastqUploadMinimized(true)}
            >
              <Text className="text-slate-700 font-extrabold text-xs">Thu nhỏ (chạy ngầm)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {fastqUpload && fastqUploadMinimized && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setFastqUploadMinimized(false)}
          className="absolute bottom-4 left-4 right-4 bg-white border border-violet-200 rounded-2xl px-4 py-3"
          style={{ elevation: 6 }}
        >
          <Text className="text-violet-900 font-extrabold text-sm">
            FASTQ {fastqUpload.labcode} đang upload ({fastqUpload.percent}%)
          </Text>
          <Text className="text-slate-600 text-xs mt-0.5" numberOfLines={1}>
            {fastqUpload.message}
          </Text>
          <View className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <View
              className="h-full bg-violet-600 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, fastqUpload.percent))}%` }}
            />
          </View>
          <Text className="text-[11px] text-violet-700 font-bold mt-1">
            Chạm để mở lại tiến trình
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
