import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown, Clock, X } from 'lucide-react-native';

import { orderService } from '@/services/orderService';
import { patientMetadataService } from '@/services/patientMetadataService';
import { pipelineService, type PipelineInfo } from '@/services/pipelineService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';

const SAMPLE_IN_ANALYZE = 'sample_in_analyze';
const ANALYZE_IN_PROGRESS = 'analyze_in_progress';
const IN_PROGRESS = 'in_progress';

function normalizeStatus(v: unknown): string {
  return String(v || '').trim().toLowerCase();
}

const PIPELINE_ESTIMATE_MINUTES: Record<string, number> = {
  deepvariant: 15,
  gpu: 10,
  'advanced-germline': 12,
  genebe: 5,
  pgx: 8,
  str: 6,
  svcnv: 10,
};

export interface AnalyzePatientData {
  labcode: string;
  patientId?: string;
  patientName?: string;
  sampleName?: string;
  hospitalName?: string;
  specifyId?: string;
  status?: string;
}

interface AnalyzeModalProps {
  visible: boolean;
  onClose: () => void;
  patients: AnalyzePatientData[];
  onSuccess?: () => void;
}

const formatEstimatedDate = (date: Date): string => {
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AnalyzeModal: React.FC<AnalyzeModalProps> = ({
  visible,
  onClose,
  patients,
  onSuccess,
}) => {
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [showPipelinePicker, setShowPipelinePicker] = useState(false);
  const [queueStats, setQueueStats] = useState<{ waiting: number; active: number } | null>(null);
  const [loadingQueueStats, setLoadingQueueStats] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const fetchPipelines = async () => {
      setLoadingPipelines(true);
      try {
        const list = await pipelineService.listPipelines();
        setPipelines(list);
        if (list.length > 0 && !selectedPipeline) {
          setSelectedPipeline(list[0].name);
        }
      } catch {
        setPipelines([]);
      } finally {
        setLoadingPipelines(false);
      }
    };
    fetchPipelines();
  }, [visible]);

  const batchCount = patients.length;

  useEffect(() => {
    if (!selectedPipeline || !visible) {
      setQueueStats(null);
      return;
    }
    const fetchStats = async () => {
      setLoadingQueueStats(true);
      try {
        const stats = await pipelineService.getQueueStats(selectedPipeline);
        if (stats) setQueueStats({ waiting: stats.waiting, active: stats.active });
        else setQueueStats(null);
      } catch {
        setQueueStats(null);
      } finally {
        setLoadingQueueStats(false);
      }
    };
    fetchStats();
  }, [selectedPipeline, visible]);

  const estimateMinutes = PIPELINE_ESTIMATE_MINUTES[selectedPipeline] || 10;
  const estimatedResultDate =
    queueStats && batchCount > 0
      ? new Date(
          Date.now() +
            (queueStats.waiting + queueStats.active + batchCount) * estimateMinutes * 60 * 1000
        )
      : null;

  const handleStartAnalysis = async () => {
    if (!selectedPipeline) {
      Alert.alert('Lỗi', 'Vui lòng chọn pipeline.');
      return;
    }
    if (batchCount === 0) {
      Alert.alert('Lỗi', 'Không có mẫu để phân tích.');
      return;
    }
    setIsSubmitting(true);
    try {
      let processed = 0;
      for (let i = 0; i < patients.length; i++) {
        const patient = patients[i];
        const body = {
          patientId: patient.patientId || patient.labcode,
          patientName: patient.patientName || patient.sampleName || 'Unknown',
          sampleName: patient.sampleName || patient.labcode,
          hospitalName: patient.hospitalName || 'Customer',
          labcode: patient.labcode,
          priority: 2,
          hpoIds: [] as string[],
        };
        const result = await pipelineService.analyze(selectedPipeline, body);

        if (result.error) {
          Alert.alert(
            'Lỗi',
            result.error + (patients.length > 1 ? `\n(Dừng tại mẫu ${patient.labcode})` : '')
          );
          return;
        }

        await patientMetadataService.updateStatus(patient.labcode, SAMPLE_IN_ANALYZE);

        if (patient.specifyId) {
          await specifyVoteTestService.updateStatus(patient.specifyId, ANALYZE_IN_PROGRESS);
          const expectedDate = queueStats
            ? new Date(
                Date.now() +
                  (queueStats.waiting + queueStats.active + i + 1) * estimateMinutes * 60 * 1000
              )
            : estimatedResultDate;
          if (expectedDate) {
            await specifyVoteTestService.updateExpectedResultDate(
              patient.specifyId,
              expectedDate.toISOString()
            );
          }
          const orderRes = await orderService.getBySpecifyId(patient.specifyId);
          const orders = orderRes.success && orderRes.data ? (orderRes.data as any[]) : [];
          if (orders.length > 0) {
            const order = orders[0];
            const orderId = order.orderId;
            const metadataRes = await patientMetadataService.getBySpecifyId(patient.specifyId);
            const metadataRows =
              metadataRes.success && Array.isArray(metadataRes.data) ? metadataRes.data : [];
            const allSamplesStartedAnalyze =
              metadataRows.length > 0 &&
              metadataRows.every(pm => normalizeStatus(pm.status) === SAMPLE_IN_ANALYZE);

            // Do not move order status when only part of multi-lab orders started analysis.
            if (orderId && allSamplesStartedAnalyze) {
              await orderService.updateStatus(orderId, IN_PROGRESS);
            }
          }
        }

        processed += 1;
      }

      onClose();
      onSuccess?.();
      Alert.alert(
        'Thành công',
        processed === 1
          ? `Đã gửi yêu cầu phân tích cho mẫu ${patients[0].labcode}. Quá trình phân tích sẽ chạy trên server.`
          : `Đã gửi yêu cầu phân tích cho ${processed} mẫu. Quá trình phân tích sẽ chạy trên server.`
      );
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể gửi yêu cầu phân tích.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedPipeline('');
      setShowPipelinePicker(false);
      onClose();
    }
  };

  const primary = patients[0];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-4">
        <View className="bg-white rounded-2xl w-full max-w-md max-h-[90%]">
          <View className="flex-row items-center justify-between p-4 border-b border-slate-200">
            <Text className="text-lg font-extrabold text-slate-900 flex-1 pr-2">
              {batchCount > 1 ? `Phân tích ${batchCount} mẫu` : 'Phân tích Gen'}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              className="w-8 h-8 items-center justify-center"
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-4 py-4" showsVerticalScrollIndicator={false}>
            {batchCount === 1 && primary ? (
              <View className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-4">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-600 text-sm">Labcode:</Text>
                  <Text className="font-semibold text-slate-800">{primary.labcode}</Text>
                </View>
                {primary.patientName ? (
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-slate-600 text-sm">Bệnh nhân:</Text>
                    <Text className="font-semibold text-slate-800">{primary.patientName}</Text>
                  </View>
                ) : null}
                {primary.specifyId ? (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-600 text-sm">Phiếu XN:</Text>
                    <Text className="font-semibold text-slate-800">{primary.specifyId}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-4 max-h-44">
                <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
                  Danh sách mẫu ({batchCount})
                </Text>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                  {patients.map((p) => (
                    <View
                      key={p.labcode}
                      className="py-2 border-b border-sky-100 last:border-b-0"
                    >
                      <Text className="font-semibold text-slate-800 text-sm">{p.labcode}</Text>
                      {p.patientName ? (
                        <Text className="text-slate-600 text-xs mt-0.5">{p.patientName}</Text>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
              Pipeline phân tích
            </Text>
            {loadingPipelines ? (
              <View className="flex-row items-center gap-2 py-3">
                <ActivityIndicator size="small" color="#0284C7" />
                <Text className="text-slate-500 text-sm">Đang tải...</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowPipelinePicker(!showPipelinePicker)}
                className="bg-white rounded-2xl border border-slate-200 px-4 py-3.5 flex-row items-center justify-between mb-4"
              >
                <Text className="text-[14px] font-semibold text-slate-900">
                  {pipelines.find((p) => p.name === selectedPipeline)?.label || 'Chọn pipeline...'}
                </Text>
                <ChevronDown size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {showPipelinePicker && pipelines.length > 0 && (
              <View className="bg-slate-50 rounded-xl border border-slate-200 mb-4 max-h-40">
                <ScrollView>
                  {pipelines.map((p) => (
                    <TouchableOpacity
                      key={p.name}
                      onPress={() => {
                        setSelectedPipeline(p.name);
                        setShowPipelinePicker(false);
                      }}
                      className={`px-4 py-3 border-b border-slate-100 last:border-b-0 ${
                        selectedPipeline === p.name ? 'bg-sky-50' : ''
                      }`}
                    >
                      <Text
                        className={`text-[14px] font-medium ${
                          selectedPipeline === p.name ? 'text-sky-700' : 'text-slate-900'
                        }`}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {selectedPipeline && queueStats !== null && (
              <View className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Clock size={16} color="#64748B" />
                  <Text className="text-xs font-extrabold text-slate-600 uppercase">
                    Thời gian dự kiến
                  </Text>
                </View>
                {loadingQueueStats ? (
                  <Text className="text-slate-500 text-sm">Đang tải...</Text>
                ) : estimatedResultDate ? (
                  <>
                    <Text className="text-base font-bold text-sky-700">
                      {formatEstimatedDate(estimatedResultDate)}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-1">
                      Ước tính: ({queueStats.waiting} chờ + {queueStats.active} đang chạy + {batchCount}{' '}
                      mới) × {estimateMinutes} phút
                    </Text>
                  </>
                ) : null}
              </View>
            )}

            <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <Text className="font-semibold text-amber-800 text-sm mb-1">Lưu ý:</Text>
              <Text className="text-amber-700 text-xs">
                • Đảm bảo đã upload file FASTQ cho {batchCount > 1 ? 'các mẫu' : 'mẫu'}
                {'\n'}• Quá trình phân tích có thể mất từ 30 phút đến vài giờ
              </Text>
            </View>
          </ScrollView>

          <View className="flex-row gap-3 p-4 border-t border-slate-200">
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl py-3 bg-slate-100 items-center"
            >
              <Text className="text-slate-700 font-bold">Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleStartAnalysis}
              disabled={isSubmitting || !selectedPipeline}
              className={`flex-1 rounded-xl py-3 flex-row items-center justify-center gap-2 ${
                isSubmitting || !selectedPipeline ? 'bg-slate-300' : 'bg-sky-600'
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-bold">
                  {batchCount > 1 ? `Bắt đầu (${batchCount} mẫu)` : 'Bắt đầu phân tích'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
