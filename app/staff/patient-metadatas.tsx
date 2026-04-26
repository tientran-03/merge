import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  FileText,
  Hash,
  Search,
  SlidersHorizontal,
  Upload,
  UserRound,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalyzeModal, ApproveResultsModal, FastqUploadModal } from '@/components/modals';
import type { AnalyzePatientData } from '@/components/modals/AnalyzeModal';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { ensurePaidOrderPatientMetadataLikeWeb } from '@/lib/ensurePaidOrderPatientMetadataWebStyle';
import { presentFeedbackError } from '@/lib/feedbackModal';
import {
  getFastqPipelinePillClass,
  getFastqPipelineStatusLabel,
  getFastqPresenceLabel,
  getFastqPresencePillClass,
} from '@/lib/patient-metadata-status';
import {
  waitForFastqPairOnMinio,
  type UploadMetadata,
} from '@/services/fastqUploadService';
import { hospitalService } from '@/services/hospitalService';
import { orderService } from '@/services/orderService';
import { PatientMetadataResponse, patientMetadataService } from '@/services/patientMetadataService';
import { patientService } from '@/services/patientService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';

function minioHospitalForRow(
  m: PatientMetadataResponse,
  specifyHospitalMap: Record<string, string> | undefined,
  fallbackResolved: string | undefined
): string {
  if (m.specifyId) {
    const fromSpecify = specifyHospitalMap?.[m.specifyId];
    if (fromSpecify?.trim()) return fromSpecify.trim();
  }
  return (fallbackResolved || '').trim();
}

async function resolveMinioHospitalNameForMetadata(
  metadata: PatientMetadataResponse,
  specifyHospitalMap: Record<string, string> | undefined,
  fallbackResolved: string | undefined
): Promise<string> {
  if (metadata.specifyId) {
    const fromMap = specifyHospitalMap?.[metadata.specifyId];
    if (fromMap?.trim()) return fromMap.trim();
    try {
      const res = await specifyVoteTestService.getById(metadata.specifyId);
      if (res.success && res.data?.hospital?.hospitalName?.trim()) {
        return res.data.hospital.hospitalName.trim();
      }
    } catch {
      // ignore
    }
  }
  return (fallbackResolved || '').trim();
}

const SAMPLE_IN_ANALYZE = 'sample_in_analyze';
const SAMPLE_RERUN = 'sample_rerun';
const SAMPLE_COMPLETED = 'sample_completed';
const SAMPLE_WAITING_ANALYZE = 'sample_waiting_analyze';
const SAMPLE_ERROR = 'sample_error';

const SPECIFY_STATUS_INITIATION = 'initation';
function logStaffFastq(tag: string, data: Record<string, unknown>) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[Staff FASTQ] ${tag}`, data);
  }
}

function markHasFastqInPatientMetadataCache(
  queryClient: ReturnType<typeof useQueryClient>,
  labcode: string
) {
  queryClient.setQueryData(['patient-metadatas'], (prev: unknown) => {
    if (!prev || typeof prev !== 'object') return prev;
    const payload = prev as { data?: unknown };
    if (!Array.isArray(payload.data)) return prev;
    return {
      ...payload,
      data: payload.data.map(item => {
        if (!item || typeof item !== 'object') return item;
        const row = item as { labcode?: string };
        if (row.labcode !== labcode) return item;
        return { ...item, has_fastq: true, hasFastq: true };
      }),
    };
  });
}

function hasFastqInDb(metadata: PatientMetadataResponse): boolean {
  return Boolean(metadata.hasFastq ?? metadata.has_fastq);
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('vi-VN');
  } catch {
    return dateString;
  }
};

type TimeFilter = 'today' | 'week' | 'month' | 'all';
const STAFF_METADATA_STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tất cả trạng thái' },
  { key: 'sample_run', label: getFastqPipelineStatusLabel('sample_run') },
  { key: 'sample_waiting_analyze', label: getFastqPipelineStatusLabel('sample_waiting_analyze') },
  { key: 'sample_in_analyze', label: getFastqPipelineStatusLabel('sample_in_analyze') },
  { key: 'sample_completed', label: getFastqPipelineStatusLabel('sample_completed') },
  { key: 'sample_error', label: getFastqPipelineStatusLabel('sample_error') },
  { key: 'sample_added', label: getFastqPipelineStatusLabel('sample_added') },
  { key: 'sample_rerun', label: getFastqPipelineStatusLabel('sample_rerun') },
  { key: 'pending', label: getFastqPipelineStatusLabel('pending') },
  { key: 'processing', label: getFastqPipelineStatusLabel('processing') },
  { key: 'completed', label: getFastqPipelineStatusLabel('completed') },
  { key: 'error', label: getFastqPipelineStatusLabel('error') },
];

const timeFilters: { key: TimeFilter; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'all', label: 'Tất cả' },
];

const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
  },
  android: { elevation: 5 },
  default: {},
});

export default function PatientMetadatasScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [approveModal, setApproveModal] = useState<{
    labcode: string;
    specifyId?: string;
    patientName?: string;
  } | null>(null);
  const [analyzePatients, setAnalyzePatients] = useState<AnalyzePatientData[] | null>(null);
  const [selectedAnalyzeLabcodes, setSelectedAnalyzeLabcodes] = useState<string[]>([]);
  const [isReportingError, setIsReportingError] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedMetadata, setSelectedMetadata] = useState<PatientMetadataResponse | null>(null);
  const [uploadMetadata, setUploadMetadata] = useState<UploadMetadata | null>(null);
  const canLabAnalysis =
    user?.role === 'ROLE_LAB_TECHNICIAN' || user?.role === 'ROLE_ADMIN';
  const canUploadFastq = user?.role === 'ROLE_STAFF' || user?.role === 'ROLE_ADMIN';

  const canReportSampleError =
    user?.role === 'ROLE_LAB_TECHNICIAN' || user?.role === 'ROLE_STAFF' || user?.role === 'ROLE_ADMIN';

  const hospitalId =
    user?.hospitalId != null && user.hospitalId !== ''
      ? String(user.hospitalId)
      : null;

  useFocusEffect(
    useCallback(() => {
      if (!user || !hospitalId) return;
      const role = String(user.role || '').toUpperCase();
      if (role !== 'ROLE_STAFF') return;
      let cancelled = false;
      void (async () => {
        try {
          const r = await ensurePaidOrderPatientMetadataLikeWeb(hospitalId);
          if (cancelled) return;
          if (r.createdLabRows > 0) {
            void queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
            void queryClient.invalidateQueries({ queryKey: ['orders'] });
          }
        } catch {
          // silent
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id, user?.role, hospitalId, queryClient])
  );

  const { data: resolvedHospitalName } = useQuery({
    queryKey: ['staff-hospital-name', user?.hospitalId, (user as { hospitalName?: string })?.hospitalName],
    queryFn: async () => {
      const fetchHospitalName = async (hid: string | number | null | undefined): Promise<string> => {
        if (hid == null || hid === '') return '';
        try {
          const h = await hospitalService.getById(String(hid));
          return (h?.hospitalName || '').trim();
        } catch {
          return '';
        }
      };
      let hospitalName = await fetchHospitalName(user?.hospitalId);
      const rawFromUser = ((user as { hospitalName?: string })?.hospitalName || '').trim();
      if (
        !hospitalName &&
        rawFromUser &&
        !/^trống$/i.test(rawFromUser) &&
        rawFromUser.toLowerCase() !== 'customer'
      ) {
        hospitalName = rawFromUser;
      }
      if (!hospitalName) hospitalName = 'Customer';
      return hospitalName;
    },
    enabled: !!user && !!hospitalId,
    staleTime: 5 * 60 * 1000,
  });

  const toAnalyzePatient = useCallback(
    (m: PatientMetadataResponse): AnalyzePatientData => ({
      labcode: m.labcode,
      patientId: m.patientId,
      patientName: m.patientName || m.sampleName,
      sampleName: m.sampleName,
      hospitalName: resolvedHospitalName,
    }),
    [resolvedHospitalName]
  );

  const handleReportSampleError = (metadata: PatientMetadataResponse) => {
    if (!metadata.specifyId) return;
    Alert.alert(
      'Báo lỗi mẫu',
      `Xác nhận báo lỗi mẫu cho ${metadata.labcode}? Staff và khách hàng sẽ nhận thông báo.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Báo lỗi',
          style: 'destructive',
          onPress: () => confirmReportSampleError({ labcode: metadata.labcode, specifyId: metadata.specifyId! }),
        },
      ]
    );
  };

  const confirmReportSampleError = async (target: { labcode: string; specifyId: string }) => {
    if (!target?.specifyId) return;
    setIsReportingError(true);
    try {
      await patientMetadataService.updateStatus(target.labcode, SAMPLE_ERROR);
      await specifyVoteTestService.updateStatus(target.specifyId, 'sample_error');
      const orderRes = await orderService.getBySpecifyId(target.specifyId);
      const orders = orderRes.success && orderRes.data ? (orderRes.data as any[]) : [];
      if (orders.length > 0) {
        const order = orders[0];
        await orderService.updateStatus(order.orderId, 'sample_error');
        const patientMetadata = order.patientMetadata || [];
        for (const pm of patientMetadata) {
          if (pm.labcode && pm.labcode !== target.labcode) {
            await patientMetadataService.updateStatus(pm.labcode, SAMPLE_ERROR).catch(() => { });
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể báo lỗi mẫu');
    } finally {
      setIsReportingError(false);
    }
  };

  const {
    data: metadataResponse,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['patient-metadatas'],
    queryFn: () => patientMetadataService.getAll(),
    retry: false,
  });

  const metadataList = useMemo(() => {
    if (!metadataResponse?.success || !metadataResponse.data) return [];
    return metadataResponse.data as PatientMetadataResponse[];
  }, [metadataResponse]);

  const specifyIdsKey = useMemo(() => {
    const ids = [...new Set(metadataList.map(m => m.specifyId).filter(Boolean))] as string[];
    ids.sort();
    return ids.join(',');
  }, [metadataList]);

  const { data: specifyLookup } = useQuery({
    queryKey: ['staff-specify-lookup', specifyIdsKey],
    queryFn: async () => {
      const ids = specifyIdsKey ? specifyIdsKey.split(',').filter(Boolean) : [];
      const hospitalBySpecifyId: Record<string, string> = {};
      const specifyStatusBySpecifyId: Record<string, string> = {};
      await Promise.all(
        ids.map(async id => {
          try {
            const res = await specifyVoteTestService.getById(id);
            if (res.success && res.data) {
              const hn = res.data.hospital?.hospitalName?.trim();
              if (hn) hospitalBySpecifyId[id] = hn;
              const st = res.data.specifyStatus;
              if (st != null && String(st).length > 0) {
                specifyStatusBySpecifyId[id] = String(st);
              }
            }
          } catch {
          }
        })
      );
      return { hospitalBySpecifyId, specifyStatusBySpecifyId };
    },
    enabled: metadataList.length > 0 && specifyIdsKey.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!specifyLookup) return;
    logStaffFastq('specifyLookup (phiếu → BV + trạng thái)', {
      hospitalCount: Object.keys(specifyLookup.hospitalBySpecifyId).length,
      statusCount: Object.keys(specifyLookup.specifyStatusBySpecifyId).length,
    });
  }, [specifyLookup]);
  const visibleMetadataList = useMemo(() => {
    const statusMap = specifyLookup?.specifyStatusBySpecifyId;
    if (!statusMap) return metadataList;
    return metadataList.filter(m => {
      if (!m.specifyId) return true;
      const st = statusMap[m.specifyId];
      if (st === undefined || st === '') return true;
      return st.toLowerCase() !== SPECIFY_STATUS_INITIATION;
    });
  }, [metadataList, specifyLookup]);

  const openUploadModal = useCallback(
    async (metadata: PatientMetadataResponse) => {
      if (!canUploadFastq) {
        presentFeedbackError({
          title: 'Không thể upload',
          message: 'Tài khoản hiện tại không có quyền upload FASTQ trên ứng dụng.',
        });
        return;
      }
      if (!metadata.labcode) {
        presentFeedbackError({
          title: 'Không thể upload',
          message: 'Chưa có mã lab.',
        });
        return;
      }
      try {
        const hn = await resolveMinioHospitalNameForMetadata(
          metadata,
          specifyLookup?.hospitalBySpecifyId,
          resolvedHospitalName ?? undefined
        );
        if (!hn) {
          presentFeedbackError({
            title: 'Không thể upload',
            message: 'Chưa xác định bệnh viện (phiếu chỉ định).',
          });
          return;
        }
        setSelectedMetadata(metadata);
        let phoneNumber = '';
        if (metadata.patientId) {
          try {
            const patientRes = await patientService.getById(metadata.patientId);
            if (patientRes.success && patientRes.data) {
              const p = patientRes.data as { patientPhone?: string };
              phoneNumber = p.patientPhone || '';
            }
          } catch {
          }
        }
        setUploadMetadata({
          patientId: metadata.patientId || '',
          patientName: metadata.patientName || metadata.sampleName || '',
          phoneNumber,
          sampleName: metadata.sampleName || '',
          hospitalName: hn,
          labcode: metadata.labcode,
        });
        logStaffFastq('mở FastqUploadModal', {
          labcode: metadata.labcode,
          specifyId: metadata.specifyId ?? '',
          hospitalName: hn,
        });
        setUploadModalVisible(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Không thể mở màn hình upload';
        presentFeedbackError({ title: 'Lỗi', message: msg });
      }
    },
    [resolvedHospitalName, specifyLookup, canUploadFastq]
  );

  const filtered = useMemo(() => {
    let data = [...visibleMetadataList];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      data = data.filter(m => {
        return (
          (m.labcode || '').toLowerCase().includes(q) ||
          (m.sampleName || '').toLowerCase().includes(q) ||
          (m.patientId || '').toLowerCase().includes(q) ||
          (m.specifyId || '').toLowerCase().includes(q)
        );
      });
    }
    if (statusFilter !== 'all') {
      data = data.filter(m => (m.status || '').toLowerCase() === statusFilter.toLowerCase());
    }
    if (timeFilter !== 'all') {
      const now = new Date();
      data = data.filter(m => {
        const createdAt = m.createdAt ? new Date(m.createdAt) : null;
        if (!createdAt) return false;
        if (timeFilter === 'today') {
          return createdAt.toDateString() === now.toDateString();
        }
        if (timeFilter === 'week') {
          return createdAt >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        if (timeFilter === 'month') {
          return createdAt >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        return true;
      });
    }

    return data.sort((a, b) => {
      return (b.labcode || '').localeCompare(a.labcode || '');
    });
  }, [visibleMetadataList, searchQuery, statusFilter, timeFilter]);

  const eligibleForAnalyze = useMemo(() => {
    return filtered.filter(m => {
      const s = (m.status || '').toLowerCase();
      return s === SAMPLE_WAITING_ANALYZE || s === SAMPLE_RERUN;
    });
  }, [filtered]);

  const eligibleLabcodeSet = useMemo(
    () => new Set(eligibleForAnalyze.map(m => m.labcode)),
    [eligibleForAnalyze]
  );

  useEffect(() => {
    setSelectedAnalyzeLabcodes(prev => prev.filter(lc => eligibleLabcodeSet.has(lc)));
  }, [eligibleLabcodeSet]);

  const allEligibleSelected =
    eligibleForAnalyze.length > 0 &&
    eligibleForAnalyze.every(m => selectedAnalyzeLabcodes.includes(m.labcode));

  const toggleSelectAllAnalyze = () => {
    if (eligibleForAnalyze.length === 0) return;
    if (allEligibleSelected) {
      setSelectedAnalyzeLabcodes([]);
    } else {
      setSelectedAnalyzeLabcodes(eligibleForAnalyze.map(m => m.labcode));
    }
  };

  const toggleAnalyzeSelect = (labcode: string) => {
    setSelectedAnalyzeLabcodes(prev =>
      prev.includes(labcode) ? prev.filter(x => x !== labcode) : [...prev, labcode]
    );
  };

  const currentStatusLabel =
    STAFF_METADATA_STATUS_OPTIONS.find(opt => opt.key === statusFilter)?.label || 'Tất cả trạng thái';

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 px-4">
        <Text className="text-red-600 text-center font-bold">Có lỗi xảy ra khi tải dữ liệu</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 px-6 py-3 bg-sky-600 rounded-xl"
        >
          <Text className="text-white font-bold">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg }} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <StatusBar barStyle="dark-content" />

      <LinearGradient
        colors={[COLORS.primarySoftBlue, COLORS.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border }}
      >
        <View className="px-4 pt-2 pb-3">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              className="w-11 h-11 rounded-2xl items-center justify-center mr-3 border"
              style={{ backgroundColor: COLORS.card, borderColor: COLORS.border2 }}
            >
              <ArrowLeft size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-2">
                <View className="flex-1 min-w-0">
                  <Text className="text-[18px] font-extrabold" style={{ color: COLORS.text }} numberOfLines={1}>
                    Quản lý mẫu xét nghiệm
                  </Text>

                </View>
              </View>
            </View>
            <View
              className="items-center justify-center rounded-2xl border px-3 py-2 min-w-[52px]"
              style={{ backgroundColor: COLORS.card, borderColor: COLORS.border2 }}
            >
              <Text className="text-lg font-black leading-none" style={{ color: COLORS.primary }}>
                {filtered.length}
              </Text>
              <Text className="mt-1 text-[9px] font-extrabold uppercase" style={{ color: COLORS.muted }}>
                mẫu
              </Text>
            </View>
          </View>

          <View
            className="mt-3 h-12 rounded-2xl px-3 flex-row items-center border"
            style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}
          >
            <Search size={18} color={COLORS.primary} />
            <TextInput
              className="flex-1 ml-2 text-sm font-bold"
              style={{ color: COLORS.text }}
              placeholder="Mã lab, tên mẫu, mã BN, phiếu chỉ định…"
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} className="p-1">
                <X size={18} color={COLORS.sub} />
              </TouchableOpacity>
            )}
          </View>

          <Text className="mt-2.5 mb-1 text-[11px] font-extrabold" style={{ color: COLORS.muted }}>
            Thời gian tạo
          </Text>
          <View className="flex-row gap-2">
            {timeFilters.map(f => {
              const active = timeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setTimeFilter(f.key)}
                  activeOpacity={0.85}
                  className="flex-1 py-2.5 rounded-xl items-center border"
                  style={{
                    backgroundColor: active ? COLORS.primary : COLORS.card,
                    borderColor: active ? COLORS.primary : COLORS.border,
                  }}
                >
                  <Text
                    className="text-[11px] font-extrabold"
                    style={{ color: active ? '#FFFFFF' : COLORS.sub }}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="mt-2.5 flex-row gap-2">
            <TouchableOpacity
              className="flex-1 min-h-[44px] rounded-2xl px-3 flex-row items-center justify-between border gap-2"
              style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}
              onPress={() => setShowStatusDropdown(v => !v)}
              activeOpacity={0.85}
            >
              <SlidersHorizontal size={17} color={COLORS.primary} />
              <Text
                className="text-xs font-extrabold flex-1"
                style={{ color: COLORS.text }}
                numberOfLines={1}
              >
                {currentStatusLabel}
              </Text>
              <ChevronDown size={17} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          {showStatusDropdown && (
            <View
              className="mt-2 rounded-2xl border overflow-hidden"
              style={{ backgroundColor: COLORS.card, borderColor: COLORS.border, ...CARD_SHADOW }}
            >
              {STAFF_METADATA_STATUS_OPTIONS.map((opt, idx) => {
                const active = opt.key === statusFilter;
                const isLast = idx === STAFF_METADATA_STATUS_OPTIONS.length - 1;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => {
                      setStatusFilter(opt.key);
                      setShowStatusDropdown(false);
                    }}
                    activeOpacity={0.85}
                    className="px-3 py-3.5 flex-row items-center"
                    style={{
                      backgroundColor: active ? COLORS.primarySoft : COLORS.card,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: COLORS.divider,
                    }}
                  >
                    <View
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: active ? COLORS.primary : COLORS.border }}
                    />
                    <Text
                      className="text-[13px] font-extrabold flex-1"
                      style={{ color: active ? COLORS.primaryDark : COLORS.text }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {canLabAnalysis && eligibleForAnalyze.length > 0 ? (
            <TouchableOpacity
              onPress={toggleSelectAllAnalyze}
              activeOpacity={0.85}
              className="mt-2.5 min-h-[44px] rounded-2xl border px-3 flex-row items-center justify-center"
              style={{ borderColor: COLORS.borderBlue2, backgroundColor: COLORS.card }}
            >
              <Text className="text-[12px] font-extrabold text-center" style={{ color: COLORS.primaryDark }}>
                {allEligibleSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'} · {eligibleForAnalyze.length} mẫu chờ phân
                tích
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>


      <ScrollView
        className="flex-1"
        style={{ backgroundColor: COLORS.bg }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom:
            canLabAnalysis && selectedAnalyzeLabcodes.length > 0
              ? 24 + 56 + Math.max(insets.bottom, 12)
              : 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => {
              void queryClient.invalidateQueries({ queryKey: ['staff-specify-lookup'] });
              refetch();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {filtered.length === 0 ? (
          <View
            className="items-center justify-center py-16 px-5 rounded-3xl border mx-0.5"
            style={{ backgroundColor: COLORS.card, borderColor: COLORS.border, ...CARD_SHADOW }}
          >
            <LinearGradient
              colors={[COLORS.primarySoft, 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{
                width: 88,
                height: 88,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <FileText size={44} color={COLORS.primary} strokeWidth={1.5} />
            </LinearGradient>
            <Text className="text-[17px] font-extrabold text-center" style={{ color: COLORS.text }}>
              {searchQuery || statusFilter !== 'all' || timeFilter !== 'all'
                ? 'Không tìm thấy mẫu phù hợp'
                : 'Chưa có mẫu xét nghiệm'}
            </Text>
            <Text className="mt-2 text-[13px] font-bold text-center leading-5" style={{ color: COLORS.sub }}>
              Điều chỉnh bộ lọc thời gian, trạng thái hoặc từ khóa để xem danh sách.
            </Text>
          </View>
        ) : (
          filtered.map(metadata => {
            const hasPair = hasFastqInDb(metadata);
            const minioHnRow = minioHospitalForRow(
              metadata,
              specifyLookup?.hospitalBySpecifyId,
              resolvedHospitalName ?? undefined
            );
            const canCheckFastq = !!minioHnRow && !!metadata.labcode;
            const presencePill = canCheckFastq
              ? getFastqPresencePillClass(false, hasPair)
              : { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-200' };
            const presenceLabel = canCheckFastq
              ? getFastqPresenceLabel(false, hasPair)
              : 'Không xác định BV';
            const statusClass = getFastqPipelinePillClass(metadata.status);
            const statusLower = (metadata.status || '').toLowerCase();
            const showApprove =
              canLabAnalysis &&
              (statusLower === SAMPLE_IN_ANALYZE || statusLower === SAMPLE_RERUN);
            const showAnalyze =
              canLabAnalysis &&
              (statusLower === SAMPLE_WAITING_ANALYZE || statusLower === SAMPLE_RERUN);
            const showReportError =
              canReportSampleError &&
              (statusLower === SAMPLE_IN_ANALYZE || statusLower === SAMPLE_RERUN);
            const patientLine = metadata.patientName?.trim() || '';
            const sampleTrim = metadata.sampleName?.trim() || '';
            const titleLine = patientLine || sampleTrim || metadata.labcode;
            let subLine: string | null = null;
            if (patientLine) {
              if (sampleTrim && sampleTrim !== patientLine) subLine = `${sampleTrim} · ${metadata.labcode}`;
              else subLine = `Lab · ${metadata.labcode}`;
            } else if (sampleTrim && titleLine === sampleTrim) {
              subLine = `Lab · ${metadata.labcode}`;
            }
            const isAnalyzeSelected = selectedAnalyzeLabcodes.includes(metadata.labcode);
            return (
              <View
                key={metadata.labcode}
                className="rounded-2xl mb-3 overflow-hidden border"
                style={{
                  borderWidth: isAnalyzeSelected ? 2 : 1,
                  borderColor: isAnalyzeSelected ? COLORS.primary : COLORS.borderBlue,
                  borderLeftWidth: isAnalyzeSelected ? 4 : 4,
                  borderLeftColor: COLORS.primary,
                  backgroundColor: isAnalyzeSelected ? COLORS.primarySoftBlue : COLORS.card,
                  ...CARD_SHADOW,
                }}
              >
                <View className="p-4">
                  <TouchableOpacity
                    activeOpacity={showAnalyze ? 0.92 : 1}
                    disabled={!showAnalyze}
                    onPress={showAnalyze ? () => toggleAnalyzeSelect(metadata.labcode) : undefined}
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center gap-2 flex-wrap">
                          <Text
                            className="text-[16px] font-extrabold flex-1 min-w-[60%]"
                            style={{ color: COLORS.text }}
                            numberOfLines={2}
                          >
                            {titleLine}
                          </Text>
                          {showAnalyze && isAnalyzeSelected ? (
                            <View
                              className="px-2 py-0.5 rounded-lg"
                              style={{ backgroundColor: 'rgba(8,145,178,0.2)' }}
                            >
                              <Text className="text-[10px] font-extrabold" style={{ color: COLORS.primaryDark }}>
                                Đã chọn
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {subLine ? (
                          <View className="flex-row items-center gap-1.5 mt-1.5 flex-wrap">
                            <Hash size={13} color={COLORS.muted} />
                            <Text className="text-[12px] font-bold" style={{ color: COLORS.sub }} numberOfLines={2}>
                              {subLine}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View className="items-end gap-1.5 max-w-[50%]">
                        <View className="items-end">
                          <Text
                            className="text-[9px] font-extrabold uppercase tracking-wide mb-0.5"
                            style={{ color: COLORS.muted }}
                          >
                            FASTQ (MinIO)
                          </Text>
                          <View
                            className={`px-2.5 py-1 rounded-xl border ${presencePill.bg} ${presencePill.border}`}
                          >
                            <Text
                              className={`text-[10px] font-extrabold text-right ${presencePill.text}`}
                              numberOfLines={2}
                            >
                              {presenceLabel}
                            </Text>
                          </View>
                        </View>
                        <View
                          className={`px-3 py-1.5 rounded-xl border ${statusClass.bg} ${statusClass.border}`}
                        >
                          <Text className={`text-[11px] font-extrabold text-right ${statusClass.text}`} numberOfLines={2}>
                            {getFastqPipelineStatusLabel(metadata.status)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="mt-3 gap-2 pl-0.5">
                      {metadata.patientId ? (
                        <View className="flex-row items-center gap-2">
                          <UserRound size={14} color={COLORS.muted} />
                          <Text className="text-[12px] font-bold flex-1" style={{ color: COLORS.sub }} numberOfLines={1}>
                            BN: {metadata.patientId}
                          </Text>
                        </View>
                      ) : null}
                      {metadata.specifyId ? (
                        <View className="flex-row items-center gap-2">
                          <FileText size={14} color={COLORS.muted} />
                          <Text className="text-[12px] font-bold flex-1" style={{ color: COLORS.sub }} numberOfLines={1}>
                            Phiếu: {metadata.specifyId}
                          </Text>
                        </View>
                      ) : null}
                      {metadata.createdAt ? (
                        <View className="flex-row items-center gap-2">
                          <Calendar size={14} color={COLORS.muted} />
                          <Text className="text-[12px] font-bold" style={{ color: COLORS.muted }}>
                            Tạo: {formatDate(metadata.createdAt)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {canCheckFastq && canUploadFastq ? (
                    <TouchableOpacity
                      onPress={() => void openUploadModal(metadata)}
                      activeOpacity={0.88}
                      className="mt-3 flex-row items-center justify-center gap-2 py-2.5 rounded-xl border"
                      style={{ backgroundColor: COLORS.primarySoftBlue, borderColor: COLORS.borderBlue2 }}
                    >
                      <Upload size={17} color={COLORS.primary} />
                      <Text className="text-[12px] font-extrabold" style={{ color: COLORS.primaryDark }}>
                        Upload FASTQ
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {showReportError || showApprove ? (
                    <View className="flex-row flex-wrap gap-2 mt-3.5 pt-3 border-t" style={{ borderTopColor: COLORS.divider }}>
                      {showReportError ? (
                        <TouchableOpacity
                          onPress={() => handleReportSampleError(metadata)}
                          disabled={isReportingError}
                          activeOpacity={0.88}
                          className="flex-1 min-w-[46%] py-2.5 px-3 rounded-xl border items-center justify-center border-amber-200"
                          style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)' }}
                        >
                          {isReportingError ? (
                            <ActivityIndicator size="small" color="#D97706" />
                          ) : (
                            <Text className="text-[12px] font-extrabold" style={{ color: '#B45309' }}>
                              Báo lỗi mẫu
                            </Text>
                          )}
                        </TouchableOpacity>
                      ) : null}
                      {showApprove ? (
                        <TouchableOpacity
                          onPress={() =>
                            setApproveModal({
                              labcode: metadata.labcode,
                              specifyId: metadata.specifyId,
                              patientName: metadata.sampleName,
                            })
                          }
                          disabled={isReportingError}
                          activeOpacity={0.88}
                          className="flex-1 min-w-[46%] py-2.5 px-3 rounded-xl border items-center justify-center border-emerald-200"
                          style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)' }}
                        >
                          <Text className="text-[12px] font-extrabold" style={{ color: '#047857' }}>
                            Duyệt KQ
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      {canLabAnalysis && selectedAnalyzeLabcodes.length > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: COLORS.card,
            borderTopWidth: 1,
            borderTopColor: COLORS.divider,
            ...(Platform.OS === 'ios' ? CARD_SHADOW : { elevation: 10 }),
          }}
        >
          <TouchableOpacity
            onPress={() => {
              const list = filtered
                .filter(m => selectedAnalyzeLabcodes.includes(m.labcode))
                .map(toAnalyzePatient);
              if (list.length > 0) setAnalyzePatients(list);
            }}
            activeOpacity={0.88}
            className="rounded-xl py-3.5 items-center justify-center"
            style={{ backgroundColor: COLORS.primary }}
          >
            <Text className="text-[15px] font-extrabold" style={{ color: '#FFFFFF' }}>
              Phân tích {selectedAnalyzeLabcodes.length} mẫu
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {approveModal && (
        <ApproveResultsModal
          visible={!!approveModal}
          onClose={() => setApproveModal(null)}
          labcode={approveModal.labcode}
          specifyId={approveModal.specifyId}
          patientName={approveModal.patientName}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          }}
        />
      )}
      {analyzePatients && analyzePatients.length > 0 ? (
        <AnalyzeModal
          visible
          onClose={() => setAnalyzePatients(null)}
          patients={analyzePatients}
          onSuccess={() => {
            setSelectedAnalyzeLabcodes([]);
            queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          }}
        />
      ) : null}
      {uploadMetadata && uploadMetadata.labcode && (
        <FastqUploadModal
          visible={uploadModalVisible}
          onClose={() => {
            setUploadModalVisible(false);
            setUploadMetadata(null);
            setSelectedMetadata(null);
          }}
          metadata={uploadMetadata}
          onSuccess={async () => {
            const meta = selectedMetadata;
            if (!meta?.labcode) {
              refetch();
              return;
            }
            const hn = await resolveMinioHospitalNameForMetadata(
              meta,
              specifyLookup?.hospitalBySpecifyId,
              resolvedHospitalName ?? undefined
            );
            if (!hn) {
              presentFeedbackError({
                title: 'Chưa xác nhận được FASTQ',
                message:
                  'Không xác định được bệnh viện để kiểm tra MinIO. Trạng thái phiếu chưa được cập nhật.',
              });
              refetch();
              throw new Error('Không xác nhận được FASTQ trên server.');
            }
            const verified = await waitForFastqPairOnMinio(hn, meta.labcode, {
              maxAttempts: 18,
              delayMs: 600,
            });
            logStaffFastq('xác nhận MinIO sau upload', {
              labcode: meta.labcode,
              hospitalName: hn,
              verified,
            });
            if (!verified) {
              presentFeedbackError({
                title: 'Chưa thấy FASTQ trên server',
                message:
                  'Upload đã chạy nhưng chưa xác nhận được file trên MinIO. Kiểm tra mạng hoặc thử lại sau. Trạng thái phiếu chưa được cập nhật.',
              });
              refetch();
              throw new Error('Không xác nhận được FASTQ trên server.');
            }
            await patientMetadataService.updateHasFastq(meta.labcode, true);
            markHasFastqInPatientMetadataCache(queryClient, meta.labcode);
            void queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
            void queryClient.invalidateQueries({ queryKey: ['orders'] });
            refetch();
          }}
        />
      )}
    </SafeAreaView>
  );
}
