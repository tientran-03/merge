/**
 * Upload FASTQ lên Htgen MinIO (chunk + merge) — cùng contract với web `fastqUploadApi`.
 * Tránh gửi file qua backend Java (giới hạn Cloudflare).
 *
 * Trên iOS/Android (Hermes), multipart với `Blob` từ `File.slice()` hay lỗi
 * «Creating blobs from ArrayBuffer…». Cách ổn định: đọc đoạn byte qua
 * `expo-file-system/legacy` (base64 + position + length) → ghi file tạm →
 * FormData.append('chunk', { uri, name, type }) như chuẩn React Native.
 * Web: vẫn dùng Blob + `expo/fetch`.
 */
import { fetch as expoFetch } from "expo/fetch";
import * as FileSystem from "expo-file-system/legacy";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { MINIO_API_BASE } from "@/utils/test-result-pdf";

const HTGEN_API = MINIO_API_BASE;
const CHUNK_SIZE = 20 * 1024 * 1024;
const MAX_RETRIES = 5;
const CHUNK_TIMEOUT_MS = 120_000;

export type HtgenUploadMetadata = {
  patientId: string;
  patientName: string;
  phoneNumber: string;
  sampleName: string;
  hospitalName: string;
  labcode: string;
};

export type FastqUploadCallbacks = {
  onProgress?: (percent: number) => void;
  onLog?: (message: string) => void;
  signal?: AbortSignal;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  return Math.min(2000 * Math.pow(2, attempt), 32000);
}

class HttpStatusError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string; status?: number };
  if (e.name === "AbortError") return false;
  if (typeof e.status === "number" && e.status >= 400 && e.status < 500) return false;
  return true;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = (data as { error?: string }).error;
    throw new Error(typeof err === "string" ? err : `HTTP ${res.status}`);
  }
  return data as T;
}

export async function checkMergedFastqFiles(
  hospitalName: string,
  labcode: string
): Promise<{ file1Exists: boolean; file2Exists: boolean }> {
  try {
    const u = `${HTGEN_API}/fastq?${new URLSearchParams({ hospitalName, labcode }).toString()}`;
    const data = await fetchJson<{ files?: { name: string }[] }>(u);
    const files = Array.isArray(data.files) ? data.files : [];
    const file1Exists = files.some((f) => /_1\.fastq|_R1/i.test(f.name));
    const file2Exists = files.some((f) => /_2\.fastq|_R2/i.test(f.name));
    return { file1Exists, file2Exists };
  } catch {
    return { file1Exists: false, file2Exists: false };
  }
}

type UploadProgressResponse = {
  found: boolean;
  freshStart?: boolean;
  resumeSession?: {
    files: Record<
      string,
      {
        totalChunks: number;
        uploadedChunks: number[];
        missingChunks: number[];
        progress: number;
        isComplete: boolean;
      }
    >;
  };
};

async function getUploadProgress(meta: HtgenUploadMetadata): Promise<UploadProgressResponse> {
  const params = new URLSearchParams({
    hospitalName: meta.hospitalName,
    labcode: meta.labcode,
    patientName: meta.patientName,
    phoneNumber: meta.phoneNumber,
  });
  return fetchJson<UploadProgressResponse>(`${HTGEN_API}/upload-progress?${params.toString()}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Ghi đoạn [startByte, endByte) ra file tạm — ưu tiên `slice().arrayBuffer()` + `File.write` (byte khớp 100%),
 * fallback base64 legacy nếu thiết bị lỗi Blob/arrayBuffer (tránh gzip sai magic sau merge).
 */
async function materializeChunkFileForNativeUpload(
  source: File,
  startByte: number,
  endByte: number,
  suffix: string,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const byteLength = endByte - startByte;
  let path: string;
  let outFile: File | null = null;

  try {
    const sliceBlob = source.slice(startByte, endByte);
    const ab = await sliceBlob.arrayBuffer();
    const u8 = new Uint8Array(ab);
    if (u8.length !== byteLength) {
      throw new Error(`Chunk size mismatch: expected ${byteLength}, got ${u8.length}`);
    }
    const name = `fq-chunk-${suffix}-${Date.now()}.bin`;
    outFile = new File(Paths.cache, name);
    outFile.create({ overwrite: true });
    outFile.write(u8);
    path = outFile.uri;
  } catch (primary) {
    const uri = source.uri;
    if (!uri) throw primary;
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) throw primary;
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: startByte,
      length: byteLength,
    });
    path = `${cacheDir}fq-chunk-${suffix}-${Date.now()}.bin`;
    await FileSystem.writeAsStringAsync(path, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    outFile = null;
  }

  const cleanup = async () => {
    try {
      outFile?.delete();
    } catch {
      /* ignore */
    }
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
    } catch {
      /* ignore */
    }
  };
  return { path, cleanup };
}

/** Xóa mọi chunk đang dở trên MinIO cho labcode này (tránh resume từ chunk hỏng — lúc được lúc không). */
export async function deleteChunkUploadSessionForLab(meta: HtgenUploadMetadata): Promise<void> {
  const patientFolder = `${meta.patientName.trim()}_${meta.phoneNumber.trim()}`;
  const u = `${HTGEN_API}/upload-session?${new URLSearchParams({
    hospitalName: meta.hospitalName.trim(),
    labcode: meta.labcode.trim(),
    patientFolder,
  })}`;
  try {
    await fetch(u, { method: "DELETE" });
  } catch {
    /* ignore — session có thể không tồn tại */
  }
}

/** Native: RN `fetch` + FormData {uri}; Web: `expo/fetch` + Blob (slice). */
function getUploadChunkImpl(): typeof fetch {
  return Platform.OS === "web" ? expoFetch : fetch;
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  if (typeof atob !== "function") return new Uint8Array();
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
  return out;
}

/**
 * Htgen `mergeChunks` yêu cầu file ghép bắt đầu bằng magic gzip `1f 8b` — chỉ `.fastq.gz` / `.fq.gz` hợp lệ.
 * File `.fastq` thuần (không gzip) sẽ merge lỗi «not in gzip format».
 */
export async function verifyExpoFileStartsWithGzip(source: File): Promise<boolean> {
  if (!source.size) return false;
  if (Platform.OS === "web") {
    try {
      const ab = await source.slice(0, 2).arrayBuffer();
      const u = new Uint8Array(ab);
      return u.length >= 2 && u[0] === 0x1f && u[1] === 0x8b;
    } catch {
      return false;
    }
  }
  try {
    const ab = await source.slice(0, 2).arrayBuffer();
    const u = new Uint8Array(ab);
    return u.length >= 2 && u[0] === 0x1f && u[1] === 0x8b;
  } catch {
    /* fallback */
  }
  const uri = source.uri;
  if (!uri) return false;
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 2,
    });
    const bytes = decodeBase64ToBytes(b64);
    return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  } catch {
    return false;
  }
}

/**
 * Upload một file FASTQ (1 hoặc 2), chunk 20MB, có resume theo server.
 */
export async function uploadOneFastqFile(
  metadata: HtgenUploadMetadata,
  fileNo: "1" | "2",
  source: File,
  callbacks?: FastqUploadCallbacks
): Promise<void> {
  const size = source.size;
  if (!size) throw new Error("File rỗng hoặc không đọc được kích thước.");

  const gzipOk = await verifyExpoFileStartsWithGzip(source);
  if (!gzipOk) {
    throw new Error(
      "File phải là FASTQ đã nén GZIP (.fastq.gz / .fq.gz). Pipeline kiểm tra byte đầu 1f 8b — " +
        "file .fastq chưa nén hoặc bị đổi tên sẽ không merge được. Hãy gzip file rồi chọn lại."
    );
  }

  const totalChunks = Math.ceil(size / CHUNK_SIZE);
  callbacks?.onLog?.(`File ${fileNo}: ${formatBytes(size)}, ${totalChunks} chunk`);

  const merged = await checkMergedFastqFiles(metadata.hospitalName, metadata.labcode);
  const already = fileNo === "1" ? merged.file1Exists : merged.file2Exists;
  if (already) {
    callbacks?.onLog?.(`File ${fileNo} đã có trên MinIO, bỏ qua upload`);
    callbacks?.onProgress?.(100);
    return;
  }

  let uploadedSet = new Set<number>();
  let allChunksDone = false;
  try {
    const progress = await getUploadProgress(metadata);
    if (progress.found && progress.resumeSession?.files?.[fileNo]) {
      const fp = progress.resumeSession.files[fileNo];
      if (fp.isComplete) {
        allChunksDone = true;
        callbacks?.onLog?.(`File ${fileNo}: chunk đã đủ, chỉ merge`);
      } else {
        uploadedSet = new Set(fp.uploadedChunks);
        callbacks?.onLog?.(`File ${fileNo}: resume ${uploadedSet.size}/${totalChunks} chunk`);
      }
    }
  } catch {
    callbacks?.onLog?.("Không đọc được tiến độ cũ — upload mới");
  }

  if (!allChunksDone) {
    for (let i = 0; i < totalChunks; i++) {
      if (callbacks?.signal?.aborted) throw new Error("Đã hủy upload");

      if (uploadedSet.has(i)) {
        callbacks?.onProgress?.(Math.round(((i + 1) / totalChunks) * 90));
        continue;
      }

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, size);
      const byteLen = end - start;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (callbacks?.signal?.aborted) throw new Error("Đã hủy upload");
        let cleanupChunk: (() => Promise<void>) | undefined;
        try {
          const formData = new FormData();
          formData.append("patientId", metadata.patientId);
          formData.append("patientName", metadata.patientName);
          formData.append("phoneNumber", metadata.phoneNumber);
          formData.append("sampleName", metadata.sampleName);
          formData.append("hospitalName", metadata.hospitalName);
          formData.append("labcode", metadata.labcode);
          formData.append("fileName", fileNo);
          formData.append("chunkIndex", String(i));
          formData.append("totalChunks", String(totalChunks));

          if (Platform.OS === "web") {
            const chunkBlob = source.slice(start, end);
            formData.append("chunk", chunkBlob as unknown as Blob, `chunk_${i}`);
          } else {
            const { path: chunkPath, cleanup } = await materializeChunkFileForNativeUpload(
              source,
              start,
              end,
              `${fileNo}-${i}`,
            );
            cleanupChunk = cleanup;
            formData.append(
              "chunk",
              {
                uri: chunkPath,
                name: `chunk_${i}.bin`,
                type: "application/octet-stream",
              } as unknown as Blob,
            );
          }

          const ac = new AbortController();
          const onUserAbort = () => ac.abort();
          callbacks?.signal?.addEventListener("abort", onUserAbort);
          const tid = setTimeout(() => ac.abort(), CHUNK_TIMEOUT_MS);
          try {
            const uploadFetch = getUploadChunkImpl();
            const res = await uploadFetch(`${HTGEN_API}/upload-chunk`, {
              method: "POST",
              body: formData,
              signal: ac.signal,
            });
            if (!res.ok) {
              const t = await res.text();
              let msg = `HTTP ${res.status}`;
              try {
                const j = JSON.parse(t) as { error?: string };
                if (j.error) msg = j.error;
              } catch {
                if (t) msg = t;
              }
              throw new HttpStatusError(msg, res.status);
            }
          } finally {
            clearTimeout(tid);
            callbacks?.signal?.removeEventListener("abort", onUserAbort);
            await cleanupChunk?.();
          }
          callbacks?.onLog?.(`Chunk ${i + 1}/${totalChunks} (${formatBytes(byteLen)})`);
          break;
        } catch (err) {
          await cleanupChunk?.();
          if (callbacks?.signal?.aborted) throw new Error("Đã hủy upload");
          if (attempt < MAX_RETRIES && isRetryableError(err)) {
            const delay = backoffDelay(attempt);
            callbacks?.onLog?.(`Chunk ${i + 1} lỗi, thử lại sau ${delay / 1000}s...`);
            await sleep(delay);
            continue;
          }
          throw err;
        }
      }

      callbacks?.onProgress?.(Math.round(((i + 1) / totalChunks) * 90));
    }
  }

  callbacks?.onLog?.(`Merge file ${fileNo}...`);
  if (callbacks?.signal?.aborted) throw new Error("Đã hủy upload");
  const mergeBody = JSON.stringify({
    hospitalName: metadata.hospitalName,
    labcode: metadata.labcode,
    fileName: fileNo,
  });
  const ac = new AbortController();
  const onUserAbort = () => ac.abort();
  callbacks?.signal?.addEventListener("abort", onUserAbort);
  const mergeTid = setTimeout(() => ac.abort(), 600_000);
  try {
    await expoFetch(`${HTGEN_API}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: mergeBody,
      signal: ac.signal,
    }).then(async (res) => {
      const text = await res.text();
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          if (text) msg = text;
        }
        throw new HttpStatusError(msg, res.status);
      }
    });
  } finally {
    clearTimeout(mergeTid);
    callbacks?.signal?.removeEventListener("abort", onUserAbort);
  }
  callbacks?.onProgress?.(100);
}

/**
 * Upload cả R1 và R2; `onOverallProgress` từ 0–100 (mỗi file ~ một nửa).
 */
export async function uploadFastqPair(
  metadata: HtgenUploadMetadata,
  file1: File,
  file2: File,
  callbacks?: FastqUploadCallbacks & { onOverallProgress?: (pct: number) => void }
): Promise<void> {
  if (Platform.OS !== "web") {
    callbacks?.onLog?.("Xóa session chunk cũ (nếu có) — tránh ghép nhầm với chunk lỗi lần trước.");
    await deleteChunkUploadSessionForLab(metadata);
  }
  await uploadOneFastqFile(metadata, "1", file1, {
    ...callbacks,
    onProgress: (p) => callbacks?.onOverallProgress?.(Math.round(p * 0.45)),
  });
  await uploadOneFastqFile(metadata, "2", file2, {
    ...callbacks,
    onProgress: (p) => callbacks?.onOverallProgress?.(45 + Math.round(p * 0.45)),
  });
  callbacks?.onOverallProgress?.(90);
}

export async function pollFastqcDone(
  hospitalName: string,
  labcode: string,
  options?: { maxAttempts?: number; intervalMs?: number; signal?: AbortSignal; onLog?: (m: string) => void }
): Promise<boolean> {
  const maxAttempts = options?.maxAttempts ?? 60;
  const intervalMs = options?.intervalMs ?? 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options?.signal?.aborted) return false;
    try {
      const u = `${HTGEN_API}/fastqc?${new URLSearchParams({ hospitalName, labcode }).toString()}`;
      const data = await fetchJson<{ fastqc?: { file1?: { html?: string }; file2?: { html?: string } } }>(u);
      const hasFile1 = !!data?.fastqc?.file1?.html;
      const hasFile2 = !!data?.fastqc?.file2?.html;
      if (hasFile1 && hasFile2) {
        options?.onLog?.("FastQC hoàn tất.");
        return true;
      }
    } catch {
      // chưa sẵn sàng
    }
    await sleep(intervalMs);
  }
  options?.onLog?.("Hết thời gian chờ FastQC (có thể server vẫn đang chạy).");
  return false;
}

const FASTQ_NAME_RE = /\.(fastq|fq)(\.gz)?$/i;
/** Chỉ tên file gzip — khớp yêu cầu MinIO merge (magic gzip). */
const GZIP_FASTQ_NAME_RE = /\.(fastq|fq)\.gz$/i;

export function isLikelyFastqFilename(name: string): boolean {
  return FASTQ_NAME_RE.test(String(name || "").trim());
}

export function isGzipFastqFilename(name: string): boolean {
  return GZIP_FASTQ_NAME_RE.test(String(name || "").trim());
}
