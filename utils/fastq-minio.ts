import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";

import { MINIO_API_BASE } from "@/utils/test-result-pdf";

export type MinioFastqFile = { name: string; url: string; size?: number };
type MinioFastqcResponse = {
  fastqc?: {
    file1?: { html?: { name?: string; url?: string } };
    file2?: { html?: { name?: string; url?: string } };
  };
  error?: string;
};


export function buildMinioFastqListUrl(hospitalName: string, labcode: string): string {
  return (
    `${MINIO_API_BASE}/fastq?` +
    `hospitalName=${encodeURIComponent(hospitalName.trim())}` +
    `&labcode=${encodeURIComponent(labcode.trim())}`
  );
}

export function pickFastq1File(files: MinioFastqFile[]): MinioFastqFile | undefined {
  return files.find((f) => /_1\.fastq|_R1/i.test(f.name));
}

export function pickFastq2File(files: MinioFastqFile[]): MinioFastqFile | undefined {
  return files.find((f) => /_2\.fastq|_R2/i.test(f.name));
}

export async function fetchMinioFastqFiles(
  hospitalName: string,
  labcode: string
): Promise<{ ok: true; files: MinioFastqFile[] } | { ok: false; message: string }> {
  try {
    const r = await fetch(buildMinioFastqListUrl(hospitalName, labcode));
    let body: Record<string, unknown> = {};
    try {
      body = (await r.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    if (!r.ok) {
      const err = body.error;
      const msg =
        typeof err === "string" ? err : `Lỗi HTTP ${r.status}`;
      return { ok: false, message: msg };
    }
    const raw = body.files;
    const files = Array.isArray(raw) ? (raw as MinioFastqFile[]) : [];
    return { ok: true, files };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lỗi mạng khi gọi MinIO FASTQ";
    return { ok: false, message: msg };
  }
}

/** Mở presigned URL FASTQ trong trình duyệt (giống web tải / mở tab). */
export async function openMinioFastqInBrowser(
  hospitalName: string,
  labcode: string,
  which: 1 | 2
): Promise<void> {
  const listed = await fetchMinioFastqFiles(hospitalName, labcode);
  if (!listed.ok) {
    Alert.alert("Không mở được FASTQ", listed.message);
    return;
  }
  const file =
    which === 1 ? pickFastq1File(listed.files) : pickFastq2File(listed.files);
  if (!file?.url) {
    Alert.alert(
      "Không tìm thấy",
      `Không có file FASTQ${which} trên MinIO cho labcode này (định dạng *_1.fastq.gz / *_2.fastq.gz).`
    );
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(file.url);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Không mở được liên kết FASTQ.";
    Alert.alert("Lỗi", msg);
  }
}

/** Mở FastQC report HTML (report FASTQ1/FASTQ2) giống web patient-metadata-list. */
export async function openMinioFastqcReportInBrowser(
  hospitalName: string,
  labcode: string,
  which: 1 | 2
): Promise<void> {
  const hn = String(hospitalName || "").trim();
  const lc = String(labcode || "").trim();
  if (!hn || !lc) {
    Alert.alert("Thiếu thông tin", "Thiếu bệnh viện hoặc labcode để mở FastQC report.");
    return;
  }

  try {
    const url =
      `${MINIO_API_BASE}/fastqc?` +
      `hospitalName=${encodeURIComponent(hn)}&labcode=${encodeURIComponent(lc)}`;
    const r = await fetch(url);
    let body: MinioFastqcResponse = {};
    try {
      body = (await r.json()) as MinioFastqcResponse;
    } catch {
      body = {};
    }
    if (!r.ok) {
      Alert.alert("Không tìm thấy report", body.error || `Lỗi HTTP ${r.status}`);
      return;
    }

    const report =
      which === 1 ? body.fastqc?.file1?.html : body.fastqc?.file2?.html;
    const reportUrl = String(report?.url || "").trim();
    if (!reportUrl) {
      Alert.alert("Không tìm thấy", `Không có FastQC report ${which} cho labcode này.`);
      return;
    }

    await WebBrowser.openBrowserAsync(reportUrl);
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : `Không thể mở FastQC report ${which}.`;
    Alert.alert("Lỗi", msg);
  }
}
