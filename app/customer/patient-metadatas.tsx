import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FastqUploadModal } from '@/components/modals';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { presentFeedbackError } from '@/lib/feedbackModal';
import {
  getFastqPipelineStatusLabel,
  getFastqPresenceLabel,
  getFastqPresencePillClass,
} from '@/lib/patient-metadata-status';
import { MEDICAL } from '@/lib/theme/medical';
import { getApiResponseData } from '@/lib/types/api-types';
import {
  fetchFastqFilesFromMinio,
  hasFastqPairOnMinio,
  waitForFastqPairOnMinio,
  type UploadMetadata,
} from '@/services/fastqUploadService';
import { hospitalService } from '@/services/hospitalService';
import { orderService, type OrderResponse } from '@/services/orderService';
import { PatientMetadataResponse, patientMetadataService } from '@/services/patientMetadataService';
import { patientService } from '@/services/patientService';
import type { SpecifyVoteTestResponse } from '@/services/specifyVoteTestService';

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('vi-VN');
  } catch {
    return dateString;
  }
};

type TimeFilter = 'today' | 'week' | 'month' | 'all';

const CUSTOMER_METADATA_STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tất cả trạng thái' },
  { key: 'sample_run', label: getFastqPipelineStatusLabel('sample_run') },
  { key: 'sample_added', label: getFastqPipelineStatusLabel('sample_added') },
  { key: 'sample_waiting_analyze', label: getFastqPipelineStatusLabel('sample_waiting_analyze') },
  { key: 'sample_in_analyze', label: getFastqPipelineStatusLabel('sample_in_analyze') },
  { key: 'sample_completed', label: getFastqPipelineStatusLabel('sample_completed') },
  { key: 'sample_error', label: getFastqPipelineStatusLabel('sample_error') },
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

export default function PatientMetadatasScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedMetadata, setSelectedMetadata] = useState<PatientMetadataResponse | null>(null);
  const [uploadMetadata, setUploadMetadata] = useState<UploadMetadata | null>(null);

  const {
    data: metadataResponse,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['patient-metadatas', 'customer', user?.id],
    queryFn: async () => {
      if (!user?.id) return { success: true, data: [] as PatientMetadataResponse[] };

      const ordersRes = await orderService.getByCustomerId(user.id, { size: 500 });
      const orders = getApiResponseData<OrderResponse>(ordersRes) || [];

      const specifyIds = new Set<string>();
      const patientIds = new Set<string>();
      for (const o of orders) {
        const spec = o.specifyId;
        const sid =
          spec && typeof spec === 'object' && spec !== null && 'specifyVoteID' in spec
            ? String((spec as SpecifyVoteTestResponse).specifyVoteID || '').trim()
            : typeof spec === 'string'
              ? String(spec).trim()
              : '';
        if (sid) specifyIds.add(sid);
        const pid = String((o as any)?.specifyId?.patient?.patientId || '').trim();
        if (pid) patientIds.add(pid);
      }

      const rowsByLab = new Map<string, PatientMetadataResponse>();
      await Promise.all(
        [...patientIds].map(async pid => {
          const pmRes = await patientMetadataService.getByPatientId(pid);
          if (!pmRes.success || !Array.isArray(pmRes.data)) return;
          for (const row of pmRes.data) {
            const labcode = String(row?.labcode || '').trim();
            const sid = String((row as any)?.specifyId || '').trim();
            if (!labcode) continue;
            if (specifyIds.size > 0 && sid && !specifyIds.has(sid)) continue;
            rowsByLab.set(labcode, row as PatientMetadataResponse);
          }
        })
      );

      return { success: true, data: [...rowsByLab.values()] };
    },
    enabled: !!user?.id,
    retry: false,
  });
  const { data: customerOrdersResponse } = useQuery({
    queryKey: ['customer-orders', 'cash-fastq-guard', user?.id],
    queryFn: () => orderService.getByCustomerId(user!.id, { size: 500 }),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const cashSpecifyIds = useMemo(() => {
    const orders = getApiResponseData<OrderResponse>(customerOrdersResponse) || [];
    const set = new Set<string>();
    for (const o of orders) {
      const pt = String(o.paymentType || '').toUpperCase();
      if (pt !== 'CASH') continue;
      const spec = o.specifyId;
      const sid =
        spec && typeof spec === 'object' && spec !== null && 'specifyVoteID' in spec
          ? String((spec as SpecifyVoteTestResponse).specifyVoteID || '').trim()
          : typeof spec === 'string'
            ? spec
            : '';
      if (sid) set.add(sid);
    }
    return set;
  }, [customerOrdersResponse]);

  const metadataList = useMemo(() => {
    if (!metadataResponse?.success || !metadataResponse.data) return [];
    return metadataResponse.data as PatientMetadataResponse[];
  }, [metadataResponse]);

  const hasFastqInDb = useCallback((metadata: PatientMetadataResponse) => {
    return Boolean(metadata.hasFastq ?? metadata.has_fastq);
  }, []);

  const metadataFingerprint = useMemo(
    () => metadataList.map(m => `${m.labcode}:${m.status || ''}`).join('|'),
    [metadataList]
  );

  const { data: resolvedHospitalName } = useQuery({
    queryKey: ['customer-hospital-name', user?.hospitalId, (user as { hospitalName?: string })?.hospitalName],
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
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    let data = [...metadataList];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      data = data.filter(m => {
        return (
          (m.labcode || '').toLowerCase().includes(q) ||
          (m.patientName || '').toLowerCase().includes(q) ||
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
  }, [metadataList, searchQuery, statusFilter, timeFilter]);

  const currentStatusLabel =
    CUSTOMER_METADATA_STATUS_OPTIONS.find(opt => opt.key === statusFilter)?.label || 'Tất cả trạng thái';

  const openUploadModal = useCallback(
    async (metadata: PatientMetadataResponse) => {
      const sid = (metadata.specifyId || '').trim();
      if (sid && cashSpecifyIds.has(sid)) {
        presentFeedbackError({
          title: 'Không thể upload FASTQ',
          message:
            'Đơn hàng thanh toán tiền mặt không upload FASTQ trên ứng dụng. Vui lòng gửi file qua bệnh viện hoặc nhân viên.',
        });
        return;
      }
      try {
        setSelectedMetadata(metadata);

        let phoneNumber = '';
        let patientHospitalId: string | null = null;

        if (metadata.patientId) {
          try {
            const patientRes = await patientService.getById(metadata.patientId);
            if (patientRes.success && patientRes.data) {
              const p = patientRes.data as any;
              phoneNumber = p.patientPhone || '';
              if (p.hospitalId != null && String(p.hospitalId).trim() !== '') {
                patientHospitalId = String(p.hospitalId);
              }
            }
          } catch {
            // Keep empty
          }
        }

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
        if (!hospitalName && patientHospitalId) {
          hospitalName = await fetchHospitalName(patientHospitalId);
        }
        const rawFromUser = ((user as any)?.hospitalName || '').trim();
        if (
          !hospitalName &&
          rawFromUser &&
          !/^trống$/i.test(rawFromUser) &&
          rawFromUser.toLowerCase() !== 'customer'
        ) {
          hospitalName = rawFromUser;
        }
        if (!hospitalName) hospitalName = 'Customer';

        setUploadMetadata({
          patientId: metadata.patientId || '',
          patientName: metadata.patientName || metadata.sampleName || '',
          phoneNumber,
          sampleName: metadata.sampleName || '',
          hospitalName,
          labcode: metadata.labcode,
        });
        setUploadModalVisible(true);
      } catch (err: any) {
        console.error('[openUploadModal]', err);
        presentFeedbackError({
          title: 'Lỗi',
          message: err?.message || 'Không thể mở màn hình upload',
        });
      }
    },
    [user, cashSpecifyIds]
  );

  const expectedLabcodesForSpecify = useCallback(
    (specifyIdRaw: string): string[] => {
      const sid = (specifyIdRaw || '').trim();
      if (!sid) return [];
      const set = new Set<string>();
      for (const row of metadataList) {
        if (String(row?.specifyId || '').trim() !== sid) continue;
        const lc = String(row?.labcode || '').trim();
        if (lc) set.add(lc);
      }
      return [...set.values()];
    },
    [metadataList]
  );

  const maybeUpdateOrderAfterAllFastq = useCallback(async (specifyIdRaw: string) => {
    const specifyId = (specifyIdRaw || '').trim();
    if (!specifyId) return;

    const uploadedStatuses = new Set(['sample_waiting_analyze', 'sample_in_analyze', 'sample_completed']);

    const pmRes = await patientMetadataService.getBySpecifyId(specifyId);
    const allSamples = getApiResponseData<PatientMetadataResponse>(pmRes) || [];
    if (!Array.isArray(allSamples) || allSamples.length === 0) return;

    // Lấy danh sách labcode cần kiểm tra
    const expected = expectedLabcodesForSpecify(specifyId);
    if (expected.length === 0) return;

    // Map labcode -> sample
    const byLab = new Map<string, PatientMetadataResponse>();
    for (const s of allSamples) {
      const lc = String(s?.labcode || '').trim();
      if (lc) byLab.set(lc, s);
    }

    const allExpectedUploaded = expected.every((lc) => {
      const pm = byLab.get(lc);
      if (!pm) return false;
      const st = String(pm.status || '').toLowerCase();
      return uploadedStatuses.has(st);
    });
    if (!allExpectedUploaded) return;
    const ordersRes = await orderService.getBySpecifyId(specifyId);
    const orders = getApiResponseData<OrderResponse>(ordersRes) || [];
    if (!Array.isArray(orders)) return;

    for (const ord of orders) {
      if (!ord?.orderId) continue;
      const os = String(ord.orderStatus || '').toLowerCase().trim();
      if (os === 'initiation') {
        await orderService.updateStatus(ord.orderId, 'forward_analysis');
      }
    }
  }, []);

  const maybeUpdateCustomerFastq = useCallback(async (specifyIdRaw: string) => {
    const specifyId = (specifyIdRaw || '').trim();
    if (!specifyId) return;

    const pmRes = await patientMetadataService.getBySpecifyId(specifyId);
    const allMetadatas = getApiResponseData<PatientMetadataResponse>(pmRes) || [];
    if (!Array.isArray(allMetadatas) || allMetadatas.length === 0) return;

    const allHaveFastq = allMetadatas.every((m) => Boolean(m.hasFastq ?? m.has_fastq));
    if (!allHaveFastq) return;

    const ordersRes = await orderService.getBySpecifyId(specifyId);
    const orders = getApiResponseData<OrderResponse>(ordersRes) || [];
    if (!Array.isArray(orders)) return;

    for (const ord of orders) {
      if (!ord?.orderId) continue;
      await orderService .updateCustomerFastq(ord.orderId, true);
    }
  }, []);


  useEffect(() => {
    if (!resolvedHospitalName || !metadataFingerprint) return;

    const timer = setTimeout(() => {
      void (async () => {
        let updated = false;
        for (const row of metadataList) {
          const st = (row.status || '').toLowerCase();
          if (st !== 'sample_run' && st !== 'sample_added') continue;

          try {
            const { ok, files } = await fetchFastqFilesFromMinio(resolvedHospitalName, row.labcode);
            if (!ok || !hasFastqPairOnMinio(files, row.labcode)) continue;

            await patientMetadataService.updateHasFastq(row.labcode, true);
            await patientMetadataService.updateStatus(row.labcode, 'sample_waiting_analyze');

            const sid = (row.specifyId || '').trim();
            if (sid) {
              await maybeUpdateCustomerFastq(sid);
              await maybeUpdateOrderAfterAllFastq(sid);
            }
            updated = true;
          } catch (e) {
            console.warn('[patient-metadatas] AutoCheck FASTQ:', row.labcode, e);
          }
        }
        if (updated) {
          void queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
        }
      })();
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    metadataFingerprint,
    metadataList,
    resolvedHospitalName,
    queryClient,
    maybeUpdateOrderAfterAllFastq,
    maybeUpdateCustomerFastq,
  ]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color={MEDICAL.primary} />
        <Text className="mt-3 text-sky-700 text-sm font-bold">Đang tải dữ liệu...</Text>
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
      <View className="px-4 pb-3 border-b" style={{ backgroundColor: COLORS.card, borderBottomColor: COLORS.border }}>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            className="w-10 h-10 rounded-xl items-center justify-center mr-3 border"
            style={{ backgroundColor: COLORS.primarySoft, borderColor: COLORS.border2 }}
          >
            <ArrowLeft size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-[18px] font-extrabold" style={{ color: COLORS.text }}>
              Quản lý dữ liệu gen
            </Text>
            <Text className="mt-0.5 text-xs font-bold" style={{ color: COLORS.sub }}>
              Tra cứu & lọc mẫu / FASTQ
            </Text>
          </View>
          <View
            className="px-3 py-1.5 rounded-2xl border"
            style={{ backgroundColor: COLORS.primarySoft, borderColor: COLORS.border2 }}
          >
            <Text className="text-xs font-black" style={{ color: COLORS.primary }}>
              {filtered.length}
            </Text>
          </View>
        </View>

        <View
          className="mt-2.5 h-11 rounded-2xl px-3 flex-row items-center border"
          style={{ backgroundColor: COLORS.primarySoft, borderColor: COLORS.border }}
        >
          <Search size={18} color={COLORS.sub} />
          <TextInput
            className="flex-1 ml-2 text-sm font-bold"
            style={{ color: COLORS.text }}
            placeholder="Tìm theo mã lab, tên mẫu, mã BN, phiếu…"
            placeholderTextColor={COLORS.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <X size={18} color={COLORS.sub} />
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row gap-2 mt-2.5">
          {timeFilters.map(f => {
            const active = timeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setTimeFilter(f.key)}
                activeOpacity={0.85}
                className="flex-1 py-2 rounded-full items-center border"
                style={{
                  backgroundColor: active ? COLORS.primary : '#FFFFFF',
                  borderColor: active ? COLORS.primary : COLORS.border,
                }}
              >
                <Text
                  className="text-xs font-extrabold"
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
            className="flex-1 h-[42px] rounded-2xl px-2.5 flex-row items-center justify-between border gap-2"
            style={{ backgroundColor: COLORS.primarySoft, borderColor: COLORS.border }}
            onPress={() => setShowStatusDropdown(v => !v)}
            activeOpacity={0.85}
          >
            <SlidersHorizontal size={16} color={COLORS.sub} />
            <Text
              className="text-xs font-extrabold flex-1"
              style={{ color: COLORS.sub }}
              numberOfLines={1}
            >
              {currentStatusLabel}
            </Text>
            <ChevronDown size={16} color={COLORS.sub} />
          </TouchableOpacity>
        </View>

        {showStatusDropdown && (
          <View
            className="mt-2.5 rounded-2xl border overflow-hidden"
            style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}
          >
            {CUSTOMER_METADATA_STATUS_OPTIONS.map(opt => {
              const active = opt.key === statusFilter;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => {
                    setStatusFilter(opt.key);
                    setShowStatusDropdown(false);
                  }}
                  activeOpacity={0.85}
                  className="px-3 py-3 border-b"
                  style={{
                    backgroundColor: active ? COLORS.primarySoft : COLORS.card,
                    borderBottomColor: COLORS.border,
                  }}
                >
                  <Text
                    className="text-[13px] font-extrabold"
                    style={{ color: active ? COLORS.primary : COLORS.text }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
      <ScrollView
        className="flex-1"
        style={{ backgroundColor: COLORS.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => {
              void queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
              refetch();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-4">
            <FileText size={48} color={COLORS.muted} />
            <Text className="mt-4 text-base font-semibold text-center" style={{ color: COLORS.text }}>
              {searchQuery || statusFilter !== 'all' || timeFilter !== 'all'
                ? 'Không tìm thấy mẫu phù hợp'
                : 'Chưa có mẫu xét nghiệm'}
            </Text>
            <Text className="mt-1.5 text-[13px] font-bold text-center" style={{ color: COLORS.sub }}>
              Thử đổi bộ lọc hoặc từ khóa tìm kiếm.
            </Text>
          </View>
        ) : (
          filtered.map(metadata => {
            const hasPair = hasFastqInDb(metadata);
            const presencePill = getFastqPresencePillClass(false, hasPair);
            const presenceLabel = getFastqPresenceLabel(false, hasPair);
            const patientNameTrim = metadata.patientName?.trim() || '';
            const specifyKey = (metadata.specifyId || '').trim();
            const cashBlocksFastqUpload = !!specifyKey && cashSpecifyIds.has(specifyKey);
            return (
              <View
                key={metadata.labcode}
                className="bg-white rounded-2xl border border-sky-100 p-4 mb-3 shadow-sm shadow-sky-900/5"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 min-w-0 pr-2">
                    <Text className="text-sky-950 text-base font-extrabold" numberOfLines={2}>
                      {patientNameTrim || metadata.labcode}
                    </Text>
                    {patientNameTrim ? (
                      <Text className="mt-1 text-xs text-sky-700/80 font-semibold">
                        Lab code: {metadata.labcode}
                      </Text>
                    ) : null}
                    <Text className="mt-1 text-[10px] text-sky-600/90 font-semibold" numberOfLines={2}>
                      Trạng thái mẫu: {getFastqPipelineStatusLabel(metadata.status)}
                    </Text>
                  </View>
                  <View className="items-end max-w-[52%]">
                    <Text className="text-[10px] font-bold text-sky-600/90 uppercase tracking-wide mb-1">
                      FASTQ (MinIO)
                    </Text>
                    <View
                      className={`px-3 py-1.5 rounded-xl border ${presencePill.bg} ${presencePill.border}`}
                    >
                      <Text className={`text-[11px] font-extrabold text-right ${presencePill.text}`}>
                        {presenceLabel}
                      </Text>
                    </View>
                  </View>
                </View>
                {metadata.sampleName?.trim() ? (
                  <View className="mt-1">
                    <Text className="text-xs text-sky-700/80 font-semibold">
                      Tên mẫu:{' '}
                      <Text className="text-sky-900 font-bold">{metadata.sampleName.trim()}</Text>
                    </Text>
                  </View>
                ) : null}

                {metadata.patientId ? (
                  <View className="flex-row items-center mt-2">
                    <Text className="text-xs text-sky-700/80 font-semibold" numberOfLines={1}>
                      Mã bệnh nhân: {metadata.patientId}
                    </Text>
                  </View>
                ) : null}

                {metadata.specifyId ? (
                  <View className="flex-row items-center mt-1">
                    <Text className="text-xs text-sky-700/80 font-semibold" numberOfLines={1}>
                      Phiếu chỉ định: {metadata.specifyId}
                    </Text>
                  </View>
                ) : null}

                {cashBlocksFastqUpload ? (
                  <View className="mt-3 py-2.5 px-3 rounded-xl bg-slate-100 border border-slate-200">
                    <Text className="text-center text-xs font-bold text-slate-600">
                      Đơn thanh toán tiền mặt: không upload FASTQ trên ứng dụng. Vui lòng gửi file qua bệnh viện/staff.
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => openUploadModal(metadata)}
                    className="mt-3 flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-100 border border-sky-200"
                    activeOpacity={0.8}
                  >
                    <Upload size={18} color={MEDICAL.primary} />
                    <Text className="text-sm font-bold text-sky-700">Upload FASTQ</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

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
            if (!meta?.specifyId || !meta?.labcode) {
              refetch();
              return;
            }
            const hn = uploadMetadata?.hospitalName?.trim();
            if (!hn) {
              presentFeedbackError({
                title: 'Chưa xác nhận được FASTQ',
                message:
                  'Không có tên bệnh viện để kiểm tra MinIO. Trạng thái chưa được cập nhật.',
              });
              refetch();
              throw new Error('Không xác nhận được FASTQ trên server.');
            }
            const verified = await waitForFastqPairOnMinio(hn, meta.labcode, {
              maxAttempts: 18,
              delayMs: 600,
            });
            if (!verified) {
              presentFeedbackError({
                title: 'Chưa thấy FASTQ trên server',
                message:
                  'Upload đã chạy nhưng chưa xác nhận được file trên MinIO. Trạng thái chưa được cập nhật.',
              });
              refetch();
              throw new Error('Không xác nhận được FASTQ trên server.');
            }
            try {
              await patientMetadataService.updateHasFastq(meta.labcode, true);
              await patientMetadataService.updateStatus(meta.labcode, 'sample_waiting_analyze');
              await maybeUpdateCustomerFastq(meta.specifyId);
              await maybeUpdateOrderAfterAllFastq(meta.specifyId);
            } catch (e) {
              console.error('[UploadSuccess]', e);
              throw e;
            }
            refetch();
          }}
        />
      )}
    </SafeAreaView>
  );
}
