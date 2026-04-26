import type * as DocumentPicker from "expo-document-picker";

/**
 * Tên hiển thị / validate — luôn ưu tiên `asset.name` từ DocumentPicker.
 * `File` (expo-file-system) đôi khi gán `name` theo file cache (hash như `0416f46...`) nên
 * «Kiểm tra nhanh» và kiểm tra đuôi .fastq.gz bị sai nếu chỉ đọc `file.name`.
 */
export function resolvePickerOriginalFileName(
  asset: DocumentPicker.DocumentPickerAsset,
): string {
  const fromName = String(asset.name ?? "").trim();
  if (fromName) return fromName;

  const uri = String(asset.uri ?? "");
  try {
    const path = uri.replace(/^file:\/\//, "");
    const seg = decodeURIComponent(path.split(/[/\\]/).pop()?.split("?")[0] ?? "");
    if (seg) return seg;
  } catch {
    /* ignore */
  }
  return "unknown";
}
