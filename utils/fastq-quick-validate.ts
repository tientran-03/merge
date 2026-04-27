/**
 * Kiểm tra nhanh cặp FASTQ — cùng logic với web `packages/api/src/fastq/index.ts` (quickValidate).
 * Chỉ dùng tên + kích thước (không đọc nội dung file).
 */

export interface FileValidationResult {
  fileName: string;
  isValidFastq: boolean;
  readType: "R1" | "R2" | "UNKNOWN";
}

export interface FastqValidationResponse {
  valid: boolean;
  message: string;
  fastq1Result?: FileValidationResult;
  fastq2Result?: FileValidationResult;
  isPairedCorrectly: boolean;
  pairValidationMessage?: string;
  errors?: string[];
  warnings?: string[];
}

export type FastqFileLike = { name: string; size: number };

const MIN_FILE_SIZE = 1024;
const MAX_SIZE_RATIO = 2;

function getExtension(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".fastq.gz")) return ".fastq.gz";
  if (lower.endsWith(".fq.gz")) return ".fq.gz";
  if (lower.endsWith(".fastq")) return ".fastq";
  if (lower.endsWith(".fq")) return ".fq";
  return "";
}

function stripExtension(filename: string): string {
  let base = filename;
  if (base.toLowerCase().endsWith(".gz")) base = base.slice(0, -3);
  base = base.replace(/\.(fastq|fq)$/i, "");
  return base;
}

function detectReadType(filename: string): "R1" | "R2" | "UNKNOWN" {
  const stem = stripExtension(filename);
  if (/[_.\-]R1($|[_.\-])/i.test(stem) || /[_.\-]1$/.test(stem)) return "R1";
  if (/[_.\-]R2($|[_.\-])/i.test(stem) || /[_.\-]2$/.test(stem)) return "R2";
  if (/R1/i.test(stem) || /read1/i.test(stem)) return "R1";
  if (/R2/i.test(stem) || /read2/i.test(stem)) return "R2";
  return "UNKNOWN";
}

function getBaseName(filename: string): string {
  let base = stripExtension(filename).toLowerCase();
  base = base
    .replace(/[_.\-]R[12]($|[_.\-])/i, "$1")
    .replace(/[_.\-][12]$/, "");
  return base;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i];
}


export function quickValidateFastqPair(
  fastq1: FastqFileLike,
  fastq2: FastqFileLike,
): FastqValidationResponse {
  const errors: string[] = [];
  const warnings: string[] = [];

  const ext1 = getExtension(fastq1.name);
  const ext2 = getExtension(fastq2.name);

  if (!ext1) {
    errors.push(
      `File 1 "${fastq1.name}" không đúng định dạng FASTQ (.fastq, .fastq.gz, .fq, .fq.gz)`,
    );
  }
  if (!ext2) {
    errors.push(
      `File 2 "${fastq2.name}" không đúng định dạng FASTQ (.fastq, .fastq.gz, .fq, .fq.gz)`,
    );
  }

  if (fastq1.name === fastq2.name) {
    errors.push("Hai file có cùng tên - vui lòng chọn 2 file khác nhau");
  }

  if (fastq1.size < MIN_FILE_SIZE) {
    errors.push(`File 1 quá nhỏ (${formatBytes(fastq1.size)}) - có thể file rỗng hoặc bị lỗi`);
  }
  if (fastq2.size < MIN_FILE_SIZE) {
    errors.push(`File 2 quá nhỏ (${formatBytes(fastq2.size)}) - có thể file rỗng hoặc bị lỗi`);
  }

  if (fastq1.size === fastq2.size && fastq1.size > 0) {
    warnings.push(
      `Hai file có cùng kích thước (${formatBytes(fastq1.size)}) - có thể là cùng một file được chọn 2 lần`,
    );
  }

  if (fastq1.size > MIN_FILE_SIZE && fastq2.size > MIN_FILE_SIZE) {
    const ratio = Math.max(fastq1.size, fastq2.size) / Math.min(fastq1.size, fastq2.size);
    if (ratio > MAX_SIZE_RATIO) {
      warnings.push(
        `Kích thước 2 file lệch nhau nhiều (${formatBytes(fastq1.size)} vs ${formatBytes(fastq2.size)}, tỉ lệ ${ratio.toFixed(1)}x) - có thể không phải cặp R1/R2 của cùng mẫu`,
      );
    }
  }

  const readType1 = detectReadType(fastq1.name);
  const readType2 = detectReadType(fastq2.name);

  const isPaired =
    (readType1 === "R1" && readType2 === "R2") || (readType1 === "R2" && readType2 === "R1");

  let pairMessage = "";
  if (isPaired) {
    pairMessage = `Ghép cặp hợp lệ: ${fastq1.name} (${readType1}) + ${fastq2.name} (${readType2})`;
  } else if (readType1 === readType2 && readType1 !== "UNKNOWN") {
    errors.push(`Cả 2 file đều là ${readType1} - cần 1 file R1 (Forward) và 1 file R2 (Reverse)`);
    pairMessage = `Lỗi: cả 2 file đều là ${readType1}`;
  } else {
    warnings.push(
      "Không nhận diện được cặp R1/R2 từ tên file (thường tên file chỉ khác nhau ở _R1/_R2 hoặc _1/_2)",
    );
    pairMessage = "Không xác định được cặp R1/R2 từ tên file";
  }

  if (ext1 && ext2 && fastq1.name !== fastq2.name) {
    const base1 = getBaseName(fastq1.name);
    const base2 = getBaseName(fastq2.name);
    if (base1 !== base2) {
      warnings.push(
        `Tên gốc của 2 file khác nhau ("${base1}" vs "${base2}") - có thể không phải cặp R1/R2 của cùng mẫu`,
      );
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    message: valid
      ? warnings.length > 0
        ? "File hợp lệ nhưng có cảnh báo"
        : "File FASTQ hợp lệ - sẵn sàng upload"
      : "File FASTQ có vấn đề cần kiểm tra",
    fastq1Result: {
      fileName: fastq1.name,
      isValidFastq: !!ext1,
      readType: readType1,
    },
    fastq2Result: {
      fileName: fastq2.name,
      isValidFastq: !!ext2,
      readType: readType2,
    },
    isPairedCorrectly: isPaired,
    pairValidationMessage: pairMessage,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
