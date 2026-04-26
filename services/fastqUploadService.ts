import {
  cacheDirectory,
  deleteAsync,
  EncodingType,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

import { FASTQC_API_BASE_URL, MINIO_API_BASE_URL } from '@/config/api';

function appendChunkFile(formData: FormData, uri: string): void {
  formData.append('chunk', {
    uri,
    name: 'chunk.bin',
    type: 'application/octet-stream',
  } as unknown as Blob);
}

const API_URL = MINIO_API_BASE_URL;
const FASTQC_API_URL = FASTQC_API_BASE_URL;

const MAX_CHUNK_SIZE = 20 * 1024 * 1024;
const MIN_CHUNKS = 10;
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 2000;
const TIMEOUT_PER_MB = 15000;

export interface MinioFastqFileInfo {
  name: string;
  size?: number;
  url?: string;
}

function trimHospitalNameForMinio(name: string): string {
  return (name || '').trim().replace(/\s+/g, ' ');
}

export function normalizeHospitalNameForMinio(name: string): string {
  const s = trimHospitalNameForMinio(name);
  if (!s) return '';
  const noD = s.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  const ascii = noD.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ascii.replace(/\s+/g, ' ').trim();
}

function hospitalNameVariantsForMinioQuery(name: string): string[] {
  const primary = trimHospitalNameForMinio(name);
  if (!primary) return [];
  const ascii = normalizeHospitalNameForMinio(primary);
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (s: string) => {
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  add(primary);
  if (ascii && ascii !== primary) add(ascii);
  if (primary.toLowerCase() !== 'customer') add('Customer');
  return out;
}

function basenameFromPath(path: string): string {
  const p = path.replace(/\\/g, '/').trim();
  if (!p) return '';
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}

function normalizeMinioFileInfos(raw: unknown[]): MinioFastqFileInfo[] {
  const out: MinioFastqFileInfo[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue;
    const x = item as Record<string, unknown>;
    let name = '';
    if (typeof x.name === 'string' && x.name.trim()) name = x.name.trim();
    else if (typeof x.fileName === 'string' && x.fileName.trim()) name = x.fileName.trim();
    else if (typeof x.path === 'string' && x.path.trim()) name = basenameFromPath(x.path);
    if (!name) continue;
    const size = typeof x.size === 'number' ? x.size : undefined;
    const url = typeof x.url === 'string' ? x.url : undefined;
    out.push({ name, size, url });
  }
  return out;
}
function extractMinioFastqFilesFromResponse(raw: unknown): MinioFastqFileInfo[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return normalizeMinioFileInfos(raw);
  if (typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.files)) return normalizeMinioFileInfos(o.files);

  const data = o.data;
  if (data != null && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.files)) return normalizeMinioFileInfos(d.files);
    if (Array.isArray(d.fileList)) return normalizeMinioFileInfos(d.fileList);
  }

  if (Array.isArray(data)) return normalizeMinioFileInfos(data);

  return [];
}

async function fetchFastqFilesFromMinioOnce(
  hospitalNameForQuery: string,
  labcode: string
): Promise<{ ok: boolean; files: MinioFastqFileInfo[] }> {
  const hn = hospitalNameForQuery;
  const url = `${API_URL}/fastq?hospitalName=${encodeURIComponent(hn)}&labcode=${encodeURIComponent(labcode)}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    let raw: unknown;
    try {
      raw = text ? JSON.parse(text) : null;
    } catch {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[MinIO fastq] Không parse được JSON:', url, text.slice(0, 400));
      }
      return { ok: false, files: [] };
    }

    if (!res.ok) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[MinIO fastq] HTTP', res.status, url, text.slice(0, 500));
      }
      return { ok: false, files: [] };
    }

    const files = extractMinioFastqFilesFromResponse(raw);
    if (
      typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      files.length === 0 &&
      raw &&
      typeof raw === 'object'
    ) {
      console.warn(
        '[MinIO fastq] 200 nhưng không có mảng files — keys gốc:',
        Object.keys(raw as object)
      );
    }
    return { ok: true, files };
  } catch (e) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[MinIO fastq] Lỗi fetch:', url, e);
    }
    return { ok: false, files: [] };
  }
}

export async function fetchFastqFilesFromMinio(
  hospitalName: string,
  labcode: string
): Promise<{ ok: boolean; files: MinioFastqFileInfo[] }> {
  const variants = hospitalNameVariantsForMinioQuery(hospitalName);
  let last: { ok: boolean; files: MinioFastqFileInfo[] } = { ok: false, files: [] };
  for (const hn of variants) {
    const r = await fetchFastqFilesFromMinioOnce(hn, labcode);
    last = r;
    if (r.ok && r.files.length > 0) return r;
  }
  return last;
}

export function filterFastqFilesForLabcode(
  files: MinioFastqFileInfo[],
  labcode: string
): MinioFastqFileInfo[] {
  const lc = labcode.trim();
  if (!lc) return files;
  const escaped = lc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^0-9a-z])${escaped}([^0-9a-z]|$)`, 'i');
  return files.filter(f => re.test(f.name));
}

export function isR1FastqFileName(name: string): boolean {
  const n = name;
  if (
    n.includes('_1.fastq') ||
    n.includes('_1.fq') ||
    n.includes('-1.fastq') ||
    n.includes('-1.fq')
  ) {
    return true;
  }
  return /_r1(?![0-9])/i.test(n) || /-r1(?![0-9])/i.test(n);
}

export function isR2FastqFileName(name: string): boolean {
  const n = name;
  if (
    n.includes('_2.fastq') ||
    n.includes('_2.fq') ||
    n.includes('-2.fastq') ||
    n.includes('-2.fq')
  ) {
    return true;
  }
  return /_r2(?![0-9])/i.test(n) || /-r2(?![0-9])/i.test(n);
}

const MAX_FILES_TRUST_SERVER_SCOPED = 12;

function hasR1R2PairInList(list: MinioFastqFileInfo[]): boolean {
  if (!list.length) return false;
  const r1 = list.find(f => isR1FastqFileName(f.name));
  const r2 = list.find(f => isR2FastqFileName(f.name));
  return !!r1 && !!r2;
}

export function hasFastqPairOnMinio(files: MinioFastqFileInfo[], labcode?: string): boolean {
  if (!files.length) return false;
  const lc = labcode?.trim();

  if (!lc) {
    return files.length <= MAX_FILES_TRUST_SERVER_SCOPED && hasR1R2PairInList(files);
  }

  const scoped = filterFastqFilesForLabcode(files, lc);
  if (hasR1R2PairInList(scoped)) return true;

  if (files.length > MAX_FILES_TRUST_SERVER_SCOPED) return false;

  if (scoped.length === 0 && hasR1R2PairInList(files)) return true;

  if (scoped.length > 0 && !hasR1R2PairInList(scoped) && hasR1R2PairInList(files)) {
    return true;
  }

  return false;
}

export interface UploadMetadata {
  patientId: string;
  patientName: string;
  phoneNumber: string;
  sampleName: string;
  hospitalName: string;
  labcode: string;
}

function buildUploadMetadataForMinioApi(raw: UploadMetadata): UploadMetadata {
  const hospitalName = trimHospitalNameForMinio(raw.hospitalName);
  const labcode = (raw.labcode || '').trim();
  const patientName = (raw.patientName || '').trim();
  const phoneNumber = (raw.phoneNumber || '').trim();
  const sampleName = (raw.sampleName || '').trim();
  const patientId = (raw.patientId || '').trim();

  if (!hospitalName) {
    throw new Error('Thiếu tên bệnh viện (MinIO cần để tạo đường dẫn).');
  }
  if (!labcode) {
    throw new Error('Thiếu labcode.');
  }
  if (!patientName) {
    throw new Error('Thiếu tên bệnh nhân — server MinIO bắt buộc.');
  }
  if (!phoneNumber) {
    throw new Error(
      'Thiếu số điện thoại bệnh nhân — server MinIO bắt buộc (SDT). Vui lòng cập nhật hồ sơ BN hoặc đảm bảo BN có SĐT trước khi upload.'
    );
  }
  const sampleOk = sampleName || labcode;
  return {
    patientId: patientId || 'unknown',
    patientName,
    phoneNumber,
    sampleName: sampleOk,
    hospitalName,
    labcode,
  };
}

export interface UploadProgress {
  fastq1: number;
  fastq2: number;
}

export interface PickedFile {
  uri: string;
  name: string;
  size: number;
  mimeType?: string | null;
}

interface ChunkRange {
  start: number;
  length: number;
}

function splitFileIntoChunks(fileSize: number): ChunkRange[] {
  if (fileSize <= 0) return [];
  const minChunksNeeded = Math.ceil(fileSize / MAX_CHUNK_SIZE);
  const chunkCount = Math.max(MIN_CHUNKS, minChunksNeeded);
  const chunkSize = Math.ceil(fileSize / chunkCount);
  const chunks: ChunkRange[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const length = Math.min(chunkSize, fileSize - start);
    if (length > 0) chunks.push({ start, length });
  }
  return chunks;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForFastqPairOnMinio(
  hospitalName: string,
  labcode: string,
  opts?: { maxAttempts?: number; delayMs?: number }
): Promise<boolean> {
  const maxAttempts = opts?.maxAttempts ?? 15;
  const delayMs = opts?.delayMs ?? 800;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { ok, files } = await fetchFastqFilesFromMinio(hospitalName, labcode);
    if (ok && hasFastqPairOnMinio(files, labcode)) return true;
    await delay(delayMs);
  }
  return false;
}

function getCacheDir(): string {
  const d = cacheDirectory;
  if (!d) throw new Error('Không có thư mục cache để upload FASTQ.');
  return d.endsWith('/') ? d : `${d}/`;
}

async function mergeChunks(
  hospitalName: string,
  labcode: string,
  fileNumber: string
): Promise<{ basePath?: string; fileName?: string; location?: string }> {
  const hn = trimHospitalNameForMinio(hospitalName);
  const response = await fetch(`${API_URL}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hospitalName: hn,
      labcode,
      fileName: fileNumber,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error((errData as { error?: string }).error || `Merge failed: ${response.status}`);
  }

  return response.json();
}

async function runFastqc(metadata: UploadMetadata): Promise<void> {
  try {
    const hn = trimHospitalNameForMinio(metadata.hospitalName);
    const res = await fetch(`${FASTQC_API_URL}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hospitalName: hn,
        labcode: metadata.labcode,
        sampleName: metadata.sampleName,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[FastqUpload] FastQC:', (err as { error?: string }).error || res.status);
    }
  } catch (e) {
    console.warn('[FastqUpload] FastQC request failed:', e);
  }
}
async function uploadSingleChunk(
  metadata: UploadMetadata,
  tempChunkUri: string,
  fileNumber: '1' | '2',
  chunkIndex: number,
  totalChunks: number,
  chunkByteLength: number,
  retryCount = 0
): Promise<{ basePath?: string; progress?: number }> {
  const chunkSizeMB = Math.max(chunkByteLength / (1024 * 1024), 0.01);
  const dynamicTimeout = Math.min(Math.max(chunkSizeMB * TIMEOUT_PER_MB, 60000), 600000);

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    timeoutId = setTimeout(() => controller.abort(), dynamicTimeout);

    const hn = trimHospitalNameForMinio(metadata.hospitalName);
    const formData = new FormData();
    formData.append('patientId', metadata.patientId);
    formData.append('patientName', metadata.patientName);
    formData.append('phoneNumber', metadata.phoneNumber);
    formData.append('sampleName', metadata.sampleName);
    formData.append('hospitalName', hn);
    formData.append('labcode', metadata.labcode);
    formData.append('fileName', fileNumber);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('totalChunks', String(totalChunks));
    appendChunkFile(formData, tempChunkUri);

    const response = await fetch(`${API_URL}/upload-chunk`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    const text = await response.text();
    if (!response.ok) {
      let errMsg = `Upload failed: ${response.status}`;
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed?.error) errMsg = parsed.error;
      } catch {
        if (text) errMsg = `${errMsg} — ${text.slice(0, 200)}`;
      }
      throw new Error(errMsg);
    }

    try {
      return JSON.parse(text) as { basePath?: string; progress?: number };
    } catch {
      throw new Error('Phản hồi upload không phải JSON hợp lệ.');
    }
  } catch (e: unknown) {
    if (timeoutId) clearTimeout(timeoutId);
    const err = e as { name?: string; message?: string };
    const msg = err?.message || String(e);
    const isAbort = err?.name === 'AbortError';
    const retryable =
      isAbort ||
      /timeout|network|fetch|aborted|không|failed/i.test(msg) ||
      msg.includes('Timeout upload chunk');

    if (retryable && retryCount < MAX_RETRIES) {
      const wait = RETRY_DELAY_BASE * Math.pow(2, retryCount);
      await delay(wait);
      return uploadSingleChunk(
        metadata,
        tempChunkUri,
        fileNumber,
        chunkIndex,
        totalChunks,
        chunkByteLength,
        retryCount + 1
      );
    }
    if (isAbort) {
      throw new Error(
        `Timeout sau ${Math.round(dynamicTimeout / 1000)}s — mạng quá chậm hoặc server không phản hồi.`
      );
    }
    throw e instanceof Error ? e : new Error(msg);
  }
}

async function uploadOneFastqFile(
  metadata: UploadMetadata,
  fileUri: string,
  fileNumber: '1' | '2',
  onFileProgress: (pct: number) => void
): Promise<void> {
  const info = await getInfoAsync(fileUri);
  if (!info.exists || !('size' in info) || !info.size) {
    throw new Error('Không đọc được kích thước file FASTQ.');
  }
  const fileSize = info.size;
  const chunks = splitFileIntoChunks(fileSize);
  const totalChunks = chunks.length;
  if (totalChunks === 0) throw new Error('File FASTQ rỗng.');

  const baseDir = getCacheDir();
  let uploadedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const range = chunks[i]!;
    const base64 = await readAsStringAsync(fileUri, {
      encoding: EncodingType.Base64,
      position: range.start,
      length: range.length,
    });
    const tempPath = `${baseDir}fastq_${metadata.labcode}_${fileNumber}_${i}_${Date.now()}.chunk`;
    await writeAsStringAsync(tempPath, base64, { encoding: EncodingType.Base64 });

    try {
      await uploadSingleChunk(metadata, tempPath, fileNumber, i, totalChunks, range.length);
      uploadedCount++;
      onFileProgress(Math.round((uploadedCount / totalChunks) * 80));
    } finally {
      await deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    }
  }

  onFileProgress(90);
  await mergeChunks(metadata.hospitalName, metadata.labcode, fileNumber);
  onFileProgress(100);
}

export async function uploadFastqFiles(
  metadata: UploadMetadata,
  fastq1: PickedFile,
  fastq2: PickedFile,
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  const meta = buildUploadMetadataForMinioApi(metadata);

  const progress: UploadProgress = { fastq1: 0, fastq2: 0 };

  const update = (key: 'fastq1' | 'fastq2', pct: number) => {
    progress[key] = pct;
    onProgress?.({ ...progress });
  };

  await uploadOneFastqFile(meta, fastq1.uri, '1', (pct: number) => update('fastq1', pct));
  await uploadOneFastqFile(meta, fastq2.uri, '2', (pct: number) => update('fastq2', pct));

  await runFastqc(meta);
}
