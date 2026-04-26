/**
 * Tải ZIP kết quả phân tích thô từ Htgen — cùng endpoint web `handleDownloadResults`.
 */
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";

import { MINIO_API_BASE } from "@/utils/test-result-pdf";

export async function downloadAndShareAnalysisResultsZip(
  hospitalName: string,
  labcode: string,
): Promise<void> {
  const hn = String(hospitalName || "").trim();
  const lc = String(labcode || "").trim();
  if (!hn || !lc) {
    Alert.alert("Thiếu thông tin", "Không xác định được bệnh viện hoặc labcode.");
    return;
  }
  const url =
    `${MINIO_API_BASE}/download-results?` +
    `hospitalName=${encodeURIComponent(hn)}&labcode=${encodeURIComponent(lc)}`;
  const safe = lc.replace(/[^\w-]/g, "_");
  const openInBrowser = async () => {
    await WebBrowser.openBrowserAsync(url);
  };
  try {
    const dest = new File(Paths.cache, `ket-qua-phan-tich-${safe}.zip`);
    const downloaded = await File.downloadFileAsync(url, dest, { idempotent: true });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloaded.uri, {
        mimeType: "application/zip",
        dialogTitle: `${lc}_results.zip`,
      });
    } else {
      await openInBrowser();
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Không tải được kết quả phân tích trong ứng dụng.";
    try {
      await openInBrowser();
      Alert.alert(
        "Đã chuyển sang trình duyệt",
        `Ứng dụng không tải trực tiếp được file ZIP. Đã mở liên kết tải trên trình duyệt.\n\nChi tiết: ${msg}`,
      );
    } catch {
      Alert.alert("Lỗi", msg);
    }
  }
}
