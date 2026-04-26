import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import {
  cacheDirectory,
  documentDirectory,
  EncodingType,
  readAsStringAsync,
} from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { presentFeedbackError, presentFeedbackSuccess } from "@/lib/feedbackModal";
import {
  buildAndWriteTemplateXlsx,
  parseExcelBase64,
  resolveServiceIdForGroup,
  runSpecifyExcelImport,
  SERVICE_GROUP_LABELS,
  validateSpecifyExcelRows,
  type ServiceGroup,
  type SpecifyExcelRowResult,
} from "@/lib/specify/specify-excel-import";
import { getApiResponseData, getApiResponseSingle } from "@/lib/types/api-types";
import { doctorService, type DoctorResponse } from "@/services/doctorService";
import { genomeTestService, type GenomeTestResponse } from "@/services/genomeTestService";
import { serviceEntityService, type ServiceEntityResponse } from "@/services/serviceEntityService";

export interface ImportSpecifyExcelModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
function normalizeExcelPickerBase64(raw: string): string {
  const s = raw.trim();
  const idx = s.indexOf("base64,");
  if (idx >= 0) return s.slice(idx + "base64,".length);
  return s;
}

async function readExcelFileAsBase64(uri: string): Promise<string> {
  const data = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  if (!data || typeof data !== "string") {
    throw new Error("Không đọc được nội dung file (base64 rỗng).");
  }
  return data;
}

export function ImportSpecifyExcelModal({ visible, onClose, onSuccess }: ImportSpecifyExcelModalProps) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [serviceGroup, setServiceGroup] = useState<ServiceGroup>("reproduction");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SpecifyExcelRowResult[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);

  const hospitalId = user?.hospitalId != null ? String(user.hospitalId) : undefined;

  const { data: servicesRes } = useQuery({
    queryKey: ["services"],
    queryFn: () => serviceEntityService.getAll(),
    enabled: visible,
  });

  const { data: doctorRes } = useQuery({
    queryKey: ["doctor-by-user", user?.id],
    queryFn: () => doctorService.getByUserId(user!.id),
    enabled: visible && !!user?.id,
  });

  const services = useMemo(
    () => getApiResponseData<ServiceEntityResponse>(servicesRes) || [],
    [servicesRes]
  );
  const doctor = getApiResponseSingle<DoctorResponse>(doctorRes);
  const doctorId = doctor?.doctorId;

  const resolvedServiceId = useMemo(
    () => resolveServiceIdForGroup(serviceGroup, services),
    [serviceGroup, services]
  );

  const { data: genomeRes, isLoading: loadingGenome } = useQuery({
    queryKey: ["genome-tests", resolvedServiceId],
    queryFn: () => genomeTestService.getByServiceId(resolvedServiceId!),
    enabled: visible && !!resolvedServiceId,
  });

  const genomeTests = useMemo(
    () => getApiResponseData<GenomeTestResponse>(genomeRes) || [],
    [genomeRes]
  );

  const resetLocal = useCallback(() => {
    setParsedRows([]);
    setParseError(null);
    setFileLabel(null);
    setProgress(0);
    setResults([]);
  }, []);

  const handleClose = useCallback(() => {
    if (importing) return;
    resetLocal();
    onClose();
  }, [importing, onClose, resetLocal]);

  const handleDownloadTemplate = useCallback(async () => {
    setTemplateLoading(true);
    try {
      const name = `template-phieu-xet-nghiem-${serviceGroup}-${new Date().toISOString().split("T")[0]
        }.xlsx`;
      const cacheDir = Platform.OS === "web" ? null : cacheDirectory ?? documentDirectory;
      const { path, base64 } = await buildAndWriteTemplateXlsx(serviceGroup, {
        fileName: name,
        cacheDirectory: cacheDir,
      });

      if (Platform.OS !== "web" && path && !base64) {
        const can = await Sharing.isAvailableAsync();
        if (can) {
          await Sharing.shareAsync(path, {
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: "Lưu / chia sẻ template",
          });
        }
      }

      presentFeedbackSuccess({
        title: "Đã tạo file",
        message:
          Platform.OS === "web"
            ? "Trình duyệt đã tải xuống template."
            : "Chọn nơi lưu hoặc ứng dụng để giữ file template.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Không tải được template";
      presentFeedbackError({ title: "Lỗi template", message: msg });
    } finally {
      setTemplateLoading(false);
    }
  }, [serviceGroup]);

  const handlePickFile = useCallback(async () => {
    setParseError(null);
    setResults([]);
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ],
        copyToCacheDirectory: true,
      });
      if (pick.canceled || !pick.assets?.[0]) {
        return;
      }
      const asset = pick.assets[0];
      if (!asset.uri && Platform.OS !== "web") {
        return;
      }
      setFileLabel(asset.name || "file.xlsx");
      let b64: string;
      if (Platform.OS === "web") {
        const fromPicker = asset.base64;
        if (fromPicker && typeof fromPicker === "string") {
          b64 = normalizeExcelPickerBase64(fromPicker);
        } else if (asset.file) {
          b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Không đọc được file."));
            reader.onload = () => {
              const r = String(reader.result ?? "");
              resolve(normalizeExcelPickerBase64(r));
            };
            reader.readAsDataURL(asset.file);
          });
        } else if (asset.uri) {
          b64 = await readExcelFileAsBase64(asset.uri);
        } else {
          throw new Error("Không lấy được dữ liệu file trên web.");
        }
      } else {
        b64 = await readExcelFileAsBase64(asset.uri);
      }
      const rawRows = parseExcelBase64(b64);
      const v = validateSpecifyExcelRows(rawRows);
      if (!v.ok) {
        setParseError(v.message);
        setParsedRows([]);
        return;
      }
      setParsedRows(rawRows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Không đọc được file";
      setParseError(msg);
      setParsedRows([]);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (parsedRows.length === 0) return;
    if (!resolvedServiceId) {
      presentFeedbackError({
        title: "Thiếu cấu hình",
        message: "Không tìm thấy loại dịch vụ trên hệ thống. Vui lòng thử lại sau.",
      });
      return;
    }
    if (genomeTests.length === 0 && !loadingGenome) {
      presentFeedbackError({
        title: "Chưa có xét nghiệm",
        message: "Chưa tải được danh sách xét nghiệm cho loại dịch vụ đã chọn.",
      });
      return;
    }

    setImporting(true);
    setResults([]);
    setProgress(0);

    try {
      const final = await runSpecifyExcelImport({
        rows: parsedRows,
        selectedServiceGroup: serviceGroup,
        genomeTests,
        serviceId: resolvedServiceId,
        hospitalId,
        doctorId,
        // Chỉ cập nhật % — tránh setState cả mảng kết quả mỗi dòng (gây giật/đứng UI).
        onRowComplete: (_partial, pct) => {
          setProgress(pct);
        },
      });

      setResults(final);
      setProgress(100);

      const ok = final.filter((r) => r.success).length;
      const fail = final.filter((r) => !r.success).length;
      InteractionManager.runAfterInteractions(() => {
        queryClient.invalidateQueries({ queryKey: ["specify-vote-tests"] });
        queryClient.invalidateQueries({ queryKey: ["customer-specifies"] });
      });

      if (fail === 0) {
        presentFeedbackSuccess({
          title: "Import thành công",
          message: `Đã tạo ${ok} phiếu xét nghiệm.`,
        });
        onSuccess();
      } else if (ok > 0) {
        presentFeedbackSuccess({
          title: "Import một phần",
          message: `${ok} phiếu thành công, ${fail} phiếu lỗi. Xem chi tiết bên dưới.`,
        });
      } else {
        presentFeedbackError({
          title: "Import thất bại",
          message: `Không tạo được phiếu nào (${fail} dòng lỗi).`,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi không xác định";
      presentFeedbackError({ title: "Lỗi import", message: msg });
    } finally {
      setImporting(false);
    }
  }, [
    parsedRows,
    resolvedServiceId,
    genomeTests,
    loadingGenome,
    serviceGroup,
    hospitalId,
    doctorId,
    queryClient,
    onSuccess,
  ]);

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const isDone = results.length > 0 && !importing;

  const testNamesPreview = genomeTests.slice(0, 12).map((t) => t.testName).join(", ");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View
          className="bg-white rounded-t-3xl border border-slate-200 max-h-[92%]"
          style={{ paddingBottom: Math.max(16, insets.bottom) }}
        >
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-slate-100">
            <View className="flex-row items-center gap-2 flex-1 min-w-0">
              <FileSpreadsheet size={22} color="#0284C7" />
              <Text className="text-lg font-extrabold text-slate-900 flex-1" numberOfLines={2}>
                Import phiếu từ Excel
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              disabled={importing}
              className="w-10 h-10 items-center justify-center rounded-xl bg-slate-100"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="px-4 pt-3"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-xs text-slate-600 leading-5 mb-3">
              Cùng định dạng file với web admin: tải template theo loại dịch vụ, điền dữ liệu, rồi chọn file
              .xlsx/.xls. Mã bác sĩ và bệnh viện lấy theo tài khoản đang đăng nhập.
            </Text>

            <Text className="text-[11px] font-extrabold text-slate-500 uppercase mb-2">
              Bước 1 · Loại dịch vụ
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(
                Object.entries(SERVICE_GROUP_LABELS) as [ServiceGroup, string][]
              ).map(([key, label]) => {
                const active = serviceGroup === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      setServiceGroup(key);
                      setParsedRows([]);
                      setParseError(null);
                      setFileLabel(null);
                      setResults([]);
                    }}
                    disabled={importing}
                    className={`px-3 py-2 rounded-xl border ${active ? "bg-sky-600 border-sky-600" : "bg-white border-slate-200"
                      }`}
                    activeOpacity={0.85}
                  >
                    <Text
                      className={`text-xs font-extrabold ${active ? "text-white" : "text-slate-700"}`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {testNamesPreview ? (
              <Text className="text-[11px] text-slate-500 mb-3" numberOfLines={4}>
                <Text className="font-bold text-slate-600">Xét nghiệm khả dụng (một phần): </Text>
                {testNamesPreview}
                {genomeTests.length > 12 ? "…" : ""}
              </Text>
            ) : resolvedServiceId && !loadingGenome ? (
              <Text className="text-[11px] text-amber-800 mb-3">
                Chưa có xét nghiệm cho loại dịch vụ này — không thể import.
              </Text>
            ) : null}

            <Text className="text-[11px] font-extrabold text-slate-500 uppercase mb-2">
              Bước 2 · Tải template
            </Text>
            <TouchableOpacity
              onPress={() => void handleDownloadTemplate()}
              disabled={templateLoading || importing}
              className="flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-sky-200 bg-sky-50 mb-4"
              activeOpacity={0.85}
            >
              {templateLoading ? (
                <ActivityIndicator color="#0369a1" />
              ) : (
                <Download size={18} color="#0369a1" />
              )}
              <Text className="text-sm font-extrabold text-sky-900">
                Tải template {SERVICE_GROUP_LABELS[serviceGroup]}
              </Text>
            </TouchableOpacity>

            <Text className="text-[11px] font-extrabold text-slate-500 uppercase mb-2">
              Bước 3 · Chọn file đã điền
            </Text>
            <TouchableOpacity
              onPress={() => void handlePickFile()}
              disabled={importing}
              className="flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-slate-200 bg-white mb-2"
              activeOpacity={0.85}
            >
              <FileSpreadsheet size={18} color="#334155" />
              <Text className="text-sm font-extrabold text-slate-800">Chọn file Excel</Text>
            </TouchableOpacity>
            {fileLabel ? (
              <Text className="text-[11px] text-slate-600 mb-2">
                Đã chọn: <Text className="font-bold">{fileLabel}</Text>
              </Text>
            ) : null}

            {parseError ? (
              <View className="mb-3 p-3 rounded-2xl bg-red-50 border border-red-100">
                <Text className="text-xs text-red-800 whitespace-pre-wrap">{parseError}</Text>
              </View>
            ) : null}

            {parsedRows.length > 0 && results.length === 0 && !importing ? (
              <View className="mb-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex-row gap-2">
                <CheckCircle2 size={18} color="#059669" />
                <Text className="text-xs text-emerald-900 flex-1 font-semibold">
                  Đã đọc {parsedRows.length} dòng. Kiểm tra tên xét nghiệm trùng khớp hệ thống trước khi
                  import.
                </Text>
              </View>
            ) : null}

            {importing ? (
              <View className="mb-4 p-3 rounded-2xl border border-sky-100 bg-sky-50">
                <Text className="text-xs text-sky-900 font-bold mb-2">
                  Đang xử lý {progress}%…
                </Text>
                <View className="h-2 rounded-full bg-sky-100 overflow-hidden">
                  <View className="h-2 bg-sky-600" style={{ width: `${progress}%` }} />
                </View>
              </View>
            ) : null}

            {isDone ? (
              <View className="mb-4 p-3 rounded-2xl border border-slate-200 bg-slate-50">
                <Text className="text-sm font-extrabold text-slate-900 mb-2">Kết quả</Text>
                <View className="flex-row gap-3 mb-2">
                  <View className="px-2 py-1 rounded-lg bg-emerald-100">
                    <Text className="text-[11px] font-extrabold text-emerald-800">
                      Thành công: {successCount}
                    </Text>
                  </View>
                  {failedCount > 0 ? (
                    <View className="px-2 py-1 rounded-lg bg-red-100">
                      <Text className="text-[11px] font-extrabold text-red-800">
                        Lỗi: {failedCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {failedCount > 0 ? (
                  <ScrollView style={{ maxHeight: 160 }} className="mt-1">
                    {results
                      .filter((r) => !r.success)
                      .map((item, idx) => (
                        <View
                          key={`${item.rowIndex}-${idx}`}
                          className="py-2 border-b border-slate-200/80"
                        >
                          <Text className="text-[10px] text-slate-500">
                            Dòng {item.rowIndex + 2} · {item.patientName} · {item.testName}
                          </Text>
                          <Text className="text-[11px] text-red-700 mt-0.5">{item.errorMessage}</Text>
                        </View>
                      ))}
                  </ScrollView>
                ) : null}
              </View>
            ) : null}
            <View className="h-4" />
          </ScrollView>
          <View className="flex-row gap-3 px-4 pt-2 border-t border-slate-100">
            <TouchableOpacity
              onPress={handleClose}
              disabled={importing}
              className="flex-1 py-3.5 rounded-2xl border border-slate-200 bg-white items-center"
              activeOpacity={0.85}
            >
              <Text className="text-sm font-extrabold text-slate-800">
                {isDone ? "Đóng" : "Hủy"}
              </Text>
            </TouchableOpacity>
            {!isDone ? (
              <TouchableOpacity
                onPress={() => void handleImport()}
                disabled={parsedRows.length === 0 || importing || !resolvedServiceId || loadingGenome}
                className={`flex-1 py-3.5 rounded-2xl items-center flex-row justify-center gap-2 ${parsedRows.length === 0 || importing || !resolvedServiceId || loadingGenome
                  ? "bg-sky-300"
                  : "bg-sky-600"
                  }`}
                activeOpacity={0.85}
              >
                {importing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Upload size={18} color="#fff" />
                )}
                <Text className="text-sm font-extrabold text-white">
                  Import{parsedRows.length ? ` (${parsedRows.length})` : ""}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}