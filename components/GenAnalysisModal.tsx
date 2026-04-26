import { Beaker, Clock, FlaskConical, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";

import { pipelineService, type PipelineInfo, type QueueStats } from "@/services/pipelineService";
import { orderService } from "@/services/orderService";
import { patientMetadataService } from "@/services/patientMetadataService";
import { specifyVoteTestService } from "@/services/specifyVoteTestService";
import { searchHpoTerms, type HpoTerm } from "@/services/hpoService";

const PIPELINE_ESTIMATE_MINUTES: Record<string, number> = {
  deepvariant: 15,
  gpu: 10,
  "advanced-germline": 12,
  genebe: 5,
  pgx: 8,
  str: 6,
  svcnv: 10,
};

export type GenAnalysisPatient = {
  labcode: string;
  patientId?: string;
  patientName?: string;
  sampleName?: string;
  status?: string;
  specifyId?: string;
  hospitalName: string;
};

export type GenAnalysisModalProps = {
  visible: boolean;
  onClose: () => void;
  patients: GenAnalysisPatient[];
  onSuccess?: () => void;
};

function formatEstimatedDateVi(date: Date): string {
  try {
    return date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date.toISOString();
  }
}

export function GenAnalysisModal({ visible, onClose, patients, onSuccess }: GenAnalysisModalProps) {
  const [priority, setPriority] = useState<"high" | "normal" | "low">("normal");
  const [selectedHpoTerms, setSelectedHpoTerms] = useState<HpoTerm[]>([]);
  const [hpoSearchQuery, setHpoSearchQuery] = useState("");
  const [hpoSuggestions, setHpoSuggestions] = useState<HpoTerm[]>([]);
  const [hpoSearching, setHpoSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");

  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loadingQueueStats, setLoadingQueueStats] = useState(false);

  const hasCompletedSamples = patients.some(
    (p) => p.status === "sample_completed" || p.status === "sample_rerun",
  );
  const allCompletedSamples =
    patients.length > 0 &&
    patients.every((p) => p.status === "sample_completed" || p.status === "sample_rerun");
  const isRerunMode = allCompletedSamples;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoadingPipelines(true);
      try {
        const list = await pipelineService.listPipelines();
        if (!cancelled) setPipelines(list);
      } finally {
        if (!cancelled) setLoadingPipelines(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !selectedPipeline) {
      setQueueStats(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingQueueStats(true);
      try {
        const s = await pipelineService.getQueueStats(selectedPipeline);
        if (!cancelled) setQueueStats(s);
      } finally {
        if (!cancelled) setLoadingQueueStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, selectedPipeline]);

  const estimateMinutes = PIPELINE_ESTIMATE_MINUTES[selectedPipeline] || 10;
  const estimatedResultDate = useMemo(() => {
    if (!queueStats || patients.length === 0) return null;
    return new Date(
      Date.now() +
        (queueStats.waiting + queueStats.active + patients.length) * estimateMinutes * 60 * 1000,
    );
  }, [queueStats, patients.length, estimateMinutes]);

  useEffect(() => {
    if (!visible) {
      setSelectedHpoTerms([]);
      setHpoSearchQuery("");
      setHpoSuggestions([]);
      setSelectedPipeline("");
      setQueueStats(null);
      setPriority("normal");
      return;
    }
  }, [visible]);

  useEffect(() => {
    const q = hpoSearchQuery.trim();
    if (q.length < 2) {
      setHpoSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setHpoSearching(true);
      try {
        const res = await searchHpoTerms(q, 20);
        setHpoSuggestions(
          res.results.filter((r) => !selectedHpoTerms.some((s) => s.id === r.id)),
        );
      } catch {
        setHpoSuggestions([]);
      } finally {
        setHpoSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [hpoSearchQuery, selectedHpoTerms]);

  const parsedHpoIds = useMemo(() => selectedHpoTerms.map((t) => t.id), [selectedHpoTerms]);

  const addHpoTerm = useCallback((term: HpoTerm) => {
    setSelectedHpoTerms((prev) => {
      if (prev.some((x) => x.id === term.id)) return prev;
      return [...prev, term];
    });
    setHpoSearchQuery("");
    setHpoSuggestions([]);
  }, []);

  const removeHpoTerm = useCallback((id: string) => {
    setSelectedHpoTerms((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const priorityNumber = priority === "high" ? 1 : priority === "low" ? 3 : 2;

  const updatePatientStatusAfterJob = async (patient: GenAnalysisPatient) => {
    const st = (patient.status || "").toLowerCase();
    try {
      if (st === "sample_completed" || st === "sample_rerun") {
        await patientMetadataService.updateStatus(patient.labcode, "sample_rerun");
      } else if (st === "sample_waiting_analyze" || st === "sample_added") {
        await patientMetadataService.updateStatus(patient.labcode, "sample_in_analyze");
      } else if (st === "sample_in_analyze") {
        // giữ nguyên hoặc backend đã đúng — web không đổi; có thể bỏ qua
      }
    } catch (e) {
      console.warn("[GenAnalysisModal] updatePatientMetadataStatus", e);
    }

    const sid = String(patient.specifyId || "").trim();
    if (!sid) return;

    try {
      const ordersRes = await orderService.getBySpecifyId(sid);
      const orders = ordersRes.success && Array.isArray(ordersRes.data) ? ordersRes.data : [];
      for (const ord of orders) {
        const os = String(ord.orderStatus || "").toLowerCase();
        if (os === "accepted" || os === "forward_analysis") {
          await orderService.updateStatus(ord.orderId, "in_progress");
        }
      }
    } catch (e) {
      console.warn("[GenAnalysisModal] order cascade", e);
    }

    try {
      const specRes = await specifyVoteTestService.getById(sid);
      if (!specRes.success || !specRes.data) return;
      const ss = String(specRes.data.specifyStatus || "").toLowerCase();
      if (ss === "accepted" || ss === "forward_analysis") {
        await specifyVoteTestService.updateStatus(sid, "analyze_in_progress");
      }
    } catch (e) {
      console.warn("[GenAnalysisModal] specify cascade", e);
    }
  };

  const updateExpectedDate = async (patient: GenAnalysisPatient, expected: Date) => {
    const sid = String(patient.specifyId || "").trim();
    if (!sid) return;
    try {
      await specifyVoteTestService.updateExpectedResultDate(sid, expected.toISOString());
    } catch (e) {
      console.warn("[GenAnalysisModal] expectedResultDate", e);
    }
  };

  const handleStartAnalysis = async () => {
    if (patients.length === 0) {
      Alert.alert("Thiếu dữ liệu", "Chưa có bệnh nhân được chọn.");
      return;
    }
    if (!selectedPipeline) {
      Alert.alert("Pipeline", "Vui lòng chọn pipeline để phân tích.");
      return;
    }
    const invalid = patients.filter((p) => !p.hospitalName?.trim() || !p.labcode?.trim());
    if (invalid.length > 0) {
      Alert.alert("Thiếu thông tin", "Cần đủ tên bệnh viện và labcode.");
      return;
    }

    setIsSubmitting(true);
    try {
      const results: { labcode: string; ok: boolean; jobId?: string; error?: string }[] = [];
      for (const patient of patients) {
        const body = {
          patientId: patient.patientId || patient.labcode,
          patientName: patient.patientName || "Unknown",
          sampleName: patient.sampleName || patient.labcode,
          hospitalName: patient.hospitalName || "Unknown",
          labcode: patient.labcode,
          priority: priorityNumber,
          ...(parsedHpoIds.length > 0 ? { hpoIds: parsedHpoIds } : {}),
        };
        const r = await pipelineService.submitAnalyze(selectedPipeline, body);
        if (r.ok) {
          results.push({ labcode: patient.labcode, ok: true, jobId: r.jobId });
          await updatePatientStatusAfterJob(patient);
          if (estimatedResultDate) {
            await updateExpectedDate(patient, estimatedResultDate);
          }
        } else {
          results.push({ labcode: patient.labcode, ok: false, error: r.error });
        }
      }

      const okCount = results.filter((x) => x.ok).length;
      const failCount = results.length - okCount;
      if (okCount > 0) {
        onSuccess?.();
        if (failCount === 0) {
          Alert.alert(
            "Đã gửi",
            isRerunMode
              ? `Đã gửi ${okCount} yêu cầu chạy lại phân tích.`
              : `Đã gửi ${okCount} yêu cầu phân tích gen (job chạy ngầm).`,
          );
        } else {
          Alert.alert(
            "Một phần thành công",
            `${okCount} thành công, ${failCount} lỗi. Kiểm tra lại log hoặc thử lại.`,
          );
        }
        onClose();
      } else {
        const firstErr = results.find((x) => !x.ok)?.error || "Không gửi được job.";
        Alert.alert("Lỗi", firstErr);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Có lỗi khi gửi yêu cầu.";
      Alert.alert("Lỗi", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openHpoBrowse = () => {
    void WebBrowser.openBrowserAsync("https://hpo.jax.org/app/browse/term/HP:0000001");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[92%] border-t border-slate-200">
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-slate-100">
            <View className="flex-row items-center gap-2 flex-1">
              {isRerunMode ? (
                <FlaskConical size={22} color="#d97706" />
              ) : (
                <Beaker size={22} color="#0284c7" />
              )}
              <Text className="text-slate-900 font-extrabold text-lg flex-1" numberOfLines={2}>
                {isRerunMode ? "Chạy lại phân tích Gen" : "Phân tích Gen"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2" hitSlop={12}>
              <X size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <Text className="text-slate-600 text-sm px-4 pt-2 pb-1">
            {isRerunMode
              ? "Gửi yêu cầu chạy lại phân tích gen. Quá trình chạy ngầm trên server."
              : "Chọn pipeline và gửi yêu cầu phân tích gen. Quá trình phân tích sẽ chạy ngầm trên server."}
          </Text>

          {hasCompletedSamples && !isRerunMode && (
            <View className="mx-4 mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Text className="text-amber-900 text-xs font-semibold">
                Lưu ý: Có mẫu đã hoàn thành trong lựa chọn — mẫu đó sẽ được xử lý như chạy lại khi gửi thành công.
              </Text>
            </View>
          )}

          <ScrollView
            className="px-4 pt-3"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <View className="bg-slate-50 rounded-2xl p-3 mb-3 border border-slate-100">
              <Text className="text-slate-800 font-extrabold text-sm mb-2">
                Bệnh nhân đã chọn ({patients.length})
              </Text>
              {patients.map((patient, idx) => (
                <View key={patient.labcode} className="flex-row flex-wrap gap-1 mb-1">
                  <Text className="text-slate-500 text-sm">{idx + 1}.</Text>
                  <Text className="text-slate-900 font-bold text-sm">{patient.labcode}</Text>
                  <Text className="text-slate-400 text-sm">-</Text>
                  <Text className="text-slate-700 text-sm">{patient.patientName || "—"}</Text>
                </View>
              ))}
            </View>

            <Text className="text-slate-800 font-extrabold text-sm mb-2">Pipeline phân tích</Text>
            {loadingPipelines ? (
              <View className="flex-row items-center gap-2 py-3">
                <ActivityIndicator color="#0284c7" />
                <Text className="text-slate-500 text-sm">Đang tải danh sách pipeline...</Text>
              </View>
            ) : (
              <View className="gap-2 mb-3">
                {pipelines.map((p) => {
                  const active = selectedPipeline === p.name;
                  return (
                    <TouchableOpacity
                      key={p.name}
                      onPress={() => setSelectedPipeline(p.name)}
                      className={`rounded-xl border px-3 py-2.5 ${
                        active ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <Text className={`font-extrabold text-sm ${active ? "text-sky-800" : "text-slate-800"}`}>
                        {p.label}
                      </Text>
                      {!!p.description && (
                        <Text className="text-xs text-slate-500 mt-0.5">{p.description}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {!!selectedPipeline && (
              <View className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-3">
                <Text className="text-xs font-extrabold text-slate-600 uppercase mb-2">Trạng thái Queue</Text>
                {loadingQueueStats ? (
                  <ActivityIndicator color="#64748b" />
                ) : queueStats ? (
                  <View>
                    <Text className="text-sm text-slate-700">
                      Chờ: <Text className="font-bold text-amber-600">{queueStats.waiting}</Text> · Đang chạy:{" "}
                      <Text className="font-bold text-sky-600">{queueStats.active}</Text> · Hoàn thành:{" "}
                      <Text className="font-bold text-emerald-600">{queueStats.completed}</Text> · Lỗi:{" "}
                      <Text className="font-bold text-red-600">{queueStats.failed}</Text>
                    </Text>
                    {estimatedResultDate && (
                      <View className="mt-3 bg-sky-50 border border-sky-200 rounded-lg p-3 flex-row gap-2">
                        <Clock size={18} color="#0369a1" />
                        <View className="flex-1">
                          <Text className="text-xs font-extrabold text-sky-900">Thời gian dự kiến trả kết quả</Text>
                          <Text className="text-base font-extrabold text-sky-800 mt-0.5">
                            {formatEstimatedDateVi(estimatedResultDate)}
                          </Text>
                          <Text className="text-[11px] text-sky-700/80 mt-1">
                            Ước tính: ({queueStats.waiting} chờ + {queueStats.active} đang + {patients.length} mới) ×{" "}
                            {estimateMinutes} phút/mẫu
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text className="text-sm text-slate-500">Không tải được trạng thái queue.</Text>
                )}
              </View>
            )}

            <Text className="text-slate-800 font-extrabold text-sm mb-2">Độ ưu tiên</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(
                [
                  { k: "high" as const, label: "Cao" },
                  { k: "normal" as const, label: "Bình thường" },
                  { k: "low" as const, label: "Thấp" },
                ] as const
              ).map(({ k, label }) => {
                const on = priority === k;
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setPriority(k)}
                    className={`px-4 py-2 rounded-xl border ${
                      on ? "bg-violet-600 border-violet-600" : "bg-white border-slate-200"
                    }`}
                  >
                    <Text className={`text-sm font-extrabold ${on ? "text-white" : "text-slate-700"}`}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-slate-800 font-extrabold text-sm">HPO IDs (tùy chọn - cho Exomiser)</Text>
              <TouchableOpacity onPress={openHpoBrowse}>
                <Text className="text-sky-600 text-xs font-bold">Xem mã HPO</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 bg-white text-sm"
              placeholder="Tìm HPO: nhập tên hoặc mã (VD: seizure, HP:0001250)"
              placeholderTextColor="#94a3b8"
              value={hpoSearchQuery}
              onChangeText={setHpoSearchQuery}
            />
            {hpoSearching && (
              <Text className="text-xs text-slate-400 mt-1">Đang tìm...</Text>
            )}
            {hpoSearchQuery.trim().length >= 2 && !hpoSearching && hpoSuggestions.length > 0 && (
              <View className="border border-slate-200 rounded-xl mt-1 max-h-40 bg-white overflow-hidden">
                {hpoSuggestions.map((term) => (
                  <TouchableOpacity
                    key={term.id}
                    onPress={() => addHpoTerm(term)}
                    className="px-3 py-2 border-b border-slate-100"
                  >
                    <Text className="text-xs font-mono text-sky-700">{term.id}</Text>
                    <Text className="text-sm text-slate-800">{term.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text className="text-xs text-slate-500 mt-1 mb-2">
              Tìm kiếm và chọn mã HPO. Dùng cho phân tích Exomiser ưu tiên theo kiểu hình.
            </Text>
            {selectedHpoTerms.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mb-4">
                {selectedHpoTerms.map((term) => (
                  <View
                    key={term.id}
                    className="flex-row items-center gap-1 bg-sky-100 px-2 py-1 rounded-full border border-sky-200"
                  >
                    <Text className="text-xs font-mono text-sky-800">{term.id}</Text>
                    <TouchableOpacity onPress={() => removeHpoTerm(term.id)} hitSlop={8}>
                      <X size={14} color="#0369a1" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <Text className="text-amber-900 text-sm font-extrabold mb-1">Lưu ý:</Text>
              <Text className="text-amber-900 text-xs leading-5">
                • Đảm bảo đã upload file FASTQ cho các bệnh nhân đã chọn{"\n"}• Quá trình phân tích có thể mất từ 30 phút
                đến vài giờ{"\n"}• Kết quả sẽ được lưu tự động và có thể xem trong OpenCRAVAT
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => void handleStartAnalysis()}
              disabled={isSubmitting || patients.length === 0 || !selectedPipeline}
              className={`rounded-2xl py-3.5 items-center mb-4 ${
                isSubmitting || patients.length === 0 || !selectedPipeline ? "bg-slate-300" : isRerunMode ? "bg-amber-600" : "bg-sky-600"
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-extrabold text-base">
                  {isRerunMode ? "Chạy lại phân tích" : "Bắt đầu phân tích"}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
