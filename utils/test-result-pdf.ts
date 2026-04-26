import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";

import type { OrderResponse } from "@/services/orderService";
import type { PatientMetadataResponse } from "@/services/patientMetadataService";
import { specifyVoteTestService } from "@/services/specifyVoteTestService";

/** Giống web `use-result-actions.ts` — MinIO analysis API */
export const MINIO_API_BASE = "https://api.htgen.io.vn/api/minio";

export type MinioDownloadContext = {
  hospitalName?: string;
  patientName?: string;
  phoneNumber?: string;
};

export function isHttpUrl(s: string): boolean {
  const t = String(s || "").trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://");
}

export function isMinioStoredMarker(s: string): boolean {
  return String(s || "").trim().toLowerCase() === "minio";
}

/** Query giống web `fetchPdfFromMinio` */
export function buildMinioDownloadReportUrl(
  meta: Pick<PatientMetadataResponse, "labcode" | "patientName">,
  ctx: MinioDownloadContext
): string | null {
  const hospitalName = String(ctx?.hospitalName || "").trim();
  const patientName = String(ctx?.patientName || meta.patientName || "").trim();
  const phoneNumber = String(ctx?.phoneNumber || "").trim();
  const labcode = String(meta.labcode || "").trim();
  if (!hospitalName || !patientName || !phoneNumber || !labcode) return null;
  return (
    `${MINIO_API_BASE}/download-report?` +
    `hospitalName=${encodeURIComponent(hospitalName)}` +
    `&patientName=${encodeURIComponent(patientName)}` +
    `&phoneNumber=${encodeURIComponent(phoneNumber)}` +
    `&labcode=${encodeURIComponent(labcode)}`
  );
}

export function minioContextFromOrder(order: OrderResponse | null): MinioDownloadContext {
  if (!order?.specifyId) return {};
  const s = order.specifyId;
  return {
    hospitalName: s.hospital?.hospitalName,
    patientName: s.patient?.patientName,
    phoneNumber: s.patient?.patientPhone,
  };
}

/** Danh sách metadata bệnh nhân: marker `minio` → lấy BV/BN/SĐT từ phiếu (`specifyId`). */
export async function loadMinioContextForPatientMetadata(
  m: Pick<PatientMetadataResponse, "testResultPath" | "specifyId" | "patientName">
): Promise<MinioDownloadContext> {
  const path = String(m.testResultPath || "").trim();
  if (!isMinioStoredMarker(path)) return {};
  const sid = String(m.specifyId || "").trim();
  if (!sid) return {};
  const res = await specifyVoteTestService.getById(sid);
  if (!res.success || !res.data) return {};
  const d = res.data;
  return {
    hospitalName: d.hospital?.hospitalName || "",
    patientName: d.patient?.patientName || m.patientName || "",
    phoneNumber: d.patient?.patientPhone || "",
  };
}

type ResolveResult = { url: string } | { error: string };

export function resolveTestResultPdfUrl(
  testResultPath: string,
  meta: Pick<PatientMetadataResponse, "labcode" | "patientName">,
  ctx: MinioDownloadContext
): ResolveResult {
  const raw = String(testResultPath || "").trim();
  if (!raw) return { error: "Chưa có kết quả xét nghiệm." };
  if (isHttpUrl(raw)) return { url: raw };
  if (isMinioStoredMarker(raw)) {
    const u = buildMinioDownloadReportUrl(meta, ctx);
    if (!u) {
      return {
        error:
          "Kết quả lưu trên MinIO nhưng thiếu BV / bệnh nhân / SĐT để tải PDF (cần đủ như trên web).",
      };
    }
    return { url: u };
  }
  return { error: "Định dạng kết quả không hỗ trợ mở trên điện thoại." };
}

export async function viewTestResultPdfInBrowser(
  testResultPath: string,
  meta: Pick<PatientMetadataResponse, "labcode" | "patientName">,
  ctx: MinioDownloadContext
): Promise<void> {
  const r = resolveTestResultPdfUrl(testResultPath, meta, ctx);
  if ("error" in r) {
    Alert.alert("Không xem được", r.error);
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(r.url);
  } catch (e: any) {
    Alert.alert("Lỗi", e?.message || "Không mở được kết quả.");
  }
}

export async function downloadAndShareTestResultPdf(
  testResultPath: string,
  meta: Pick<PatientMetadataResponse, "labcode" | "patientName">,
  ctx: MinioDownloadContext
): Promise<void> {
  const r = resolveTestResultPdfUrl(testResultPath, meta, ctx);
  if ("error" in r) {
    Alert.alert("Không tải được", r.error);
    return;
  }
  const safeLc = String(meta.labcode || "ket-qua").replace(/[^\w-]/g, "_");
  try {
    const dest = new File(Paths.cache, `ket-qua-${safeLc}.pdf`);
    const downloaded = await File.downloadFileAsync(r.url, dest, { idempotent: true });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloaded.uri, {
        mimeType: "application/pdf",
        dialogTitle: `ket-qua-${safeLc}.pdf`,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert("Đã tải", `File: ${downloaded.uri}`);
    }
  } catch (e: any) {
    Alert.alert("Lỗi", e?.message || "Không tải được PDF.");
  }
}
