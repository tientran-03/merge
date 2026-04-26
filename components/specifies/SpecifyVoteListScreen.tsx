import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  FlaskConical,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { ConfirmModal } from '@/components/modals';
import { ForwardTestModal } from '@/components/modals/ForwardTestModal';
import { ImportSpecifyExcelModal } from '@/components/specifies/ImportSpecifyExcelModal';
import { SpecifyStatusPicker } from '@/components/specifies/SpecifyStatusPicker';
import { ROLE_ADMIN, ROLE_LAB_TECHNICIAN } from '@/constants/roles';
import { useAuth } from '@/contexts/AuthContext';
import { approvePatientMetadataResultsOutput } from '@/lib/approveResultsOutput';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import {
  canCancelSpecifyAtInitiation,
  getSpecifyStatusPresentation,
  normalizeSpecifyStatusKey,
  specifyMatchesStatusFilter,
} from '@/lib/specify-status';
import { downloadSpecifyPdf } from '@/lib/specifyPdf';
import { MEDICAL } from '@/lib/theme/medical';
import { getApiResponseData } from '@/lib/types/api-types';
import {
  type OrderResponse,
  orderService,
  pickLatestOrderResultDate,
} from '@/services/orderService';
import { type PatientMetadataResponse, patientMetadataService } from '@/services/patientMetadataService';
import { SpecifyVoteTestResponse, specifyVoteTestService } from '@/services/specifyVoteTestService';

const SAMPLE_IN_ANALYZE = 'sample_in_analyze';
const SAMPLE_RERUN = 'sample_rerun';

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('vi-VN');
  } catch {
    return dateString;
  }
};

interface SpecifyData {
  specifyVoteID: string;
  fullSpecifyData?: SpecifyVoteTestResponse;
}

export type SpecifyVoteListAudience = 'customer' | 'staff' | 'lab';

export interface SpecifyVoteListScreenProps {
  audience: SpecifyVoteListAudience;
}

export function SpecifyVoteListScreen({ audience }: SpecifyVoteListScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, canCreatePrescriptionSlip } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [focusSearch, setFocusSearch] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardingSpecifyList, setForwardingSpecifyList] = useState<SpecifyData[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [importExcelOpen, setImportExcelOpen] = useState(false);
  const [labBulkConfirmOpen, setLabBulkConfirmOpen] = useState(false);

  const isStaffAudience = audience === 'staff';
  const isLabAudience = audience === 'lab';
  const isCustomerAudience = audience === 'customer';
  const useStaffListQuery = isStaffAudience || isLabAudience;
  const canStaffCreate = isStaffAudience && canCreatePrescriptionSlip();
  const showCancelSlipAction = isStaffAudience || isCustomerAudience;
  const showSlipResultDateRow = useStaffListQuery || isCustomerAudience;
  const showImportExcel = canCreatePrescriptionSlip() && (isStaffAudience || isCustomerAudience);

  const hospitalId = user?.hospitalId != null ? String(user.hospitalId) : '';

  const canLabBulkApprove =
    isLabAudience &&
    (user?.role === ROLE_LAB_TECHNICIAN || user?.role === ROLE_ADMIN);

  const { data: labMetadataResponse } = useQuery({
    queryKey: ['patient-metadatas'],
    queryFn: () => patientMetadataService.getAll(),
    enabled: canLabBulkApprove,
    retry: false,
  });

  const labMetadataList = useMemo((): PatientMetadataResponse[] => {
    if (!labMetadataResponse?.success || !labMetadataResponse.data) return [];
    return labMetadataResponse.data as PatientMetadataResponse[];
  }, [labMetadataResponse]);

  const approveEligibleBySpecifyId = useMemo(() => {
    const map = new Map<string, { labcode: string; label?: string }[]>();
    for (const m of labMetadataList) {
      const sid = String(m.specifyId || '').trim();
      if (!sid) continue;
      const st = String(m.status || '').toLowerCase();
      if (st !== SAMPLE_IN_ANALYZE && st !== SAMPLE_RERUN) continue;
      const labcode = String(m.labcode || '').trim();
      if (!labcode) continue;
      const label = String(m.sampleName || m.patientName || '').trim() || undefined;
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push({ labcode, label });
    }
    return map;
  }, [labMetadataList]);

  const {
    data: specifiesResponse,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: useStaffListQuery
      ? ['specify-vote-tests', 'staff-managed']
      : ['customer-specifies', hospitalId, user?.id],
    queryFn: async () => {
      if (useStaffListQuery) {
        const res = await specifyVoteTestService.getAllAggregatedForStaff();
        if (!res.success) {
          throw new Error(res.error || 'Không thể tải danh sách phiếu xét nghiệm');
        }
        return res;
      }
      if (hospitalId) {
        return specifyVoteTestService.getByHospitalId(hospitalId);
      }
      if (!user?.id) return { success: false, data: [] };
      const ordersRes = await orderService.getByCustomerId(user.id, {});
      const orders = getApiResponseData(ordersRes) || [];
      const seen = new Set<string>();
      const fromOrders: SpecifyVoteTestResponse[] = [];
      for (const order of orders as any[]) {
        const spec = order.specifyId;
        if (spec?.specifyVoteID && !seen.has(spec.specifyVoteID)) {
          seen.add(spec.specifyVoteID);
          fromOrders.push(spec);
        }
      }
      return { success: true, data: fromOrders };
    },
    enabled: useStaffListQuery ? true : !!user?.id,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => specifyVoteTestService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specify-vote-tests'] });
      queryClient.invalidateQueries({ queryKey: ['customer-specifies'] });
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      presentFeedbackSuccess({ title: 'Thành công', message: 'Đã hủy phiếu chỉ định.' });
      refetch();
    },
    onError: (err: any) => {
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      presentFeedbackError({
        title: 'Lỗi',
        message: err?.message || 'Không thể hủy phiếu. Vui lòng thử lại.',
      });
    },
  });

  const labBulkApproveMutation = useMutation({
    mutationFn: async (jobs: { labcode: string; specifyId: string }[]) => {
      for (const j of jobs) {
        await approvePatientMetadataResultsOutput(j);
      }
    },
    onSuccess: (_data, jobs) => {
      presentFeedbackSuccess({
        title: 'Đã duyệt',
        message: `Đã duyệt kết quả đầu ra cho ${jobs.length} mẫu.`,
      });
      queryClient.invalidateQueries({ queryKey: ['specify-vote-tests'] });
      queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setSelectedRows(new Set());
      refetch();
    },
    onError: (err: any) => {
      presentFeedbackError({
        title: 'Lỗi duyệt hàng loạt',
        message: err?.message || 'Một hoặc nhiều mẫu không duyệt được. Vui lòng thử lại.',
      });
    },
  });

  const specifies = useMemo(() => {
    return getApiResponseData<SpecifyVoteTestResponse>(specifiesResponse) || [];
  }, [specifiesResponse]);

  const sortedSpecifies = useMemo(() => {
    return [...specifies].sort((a, b) => {
      const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [specifies]);

  const doctors = useMemo(() => {
    const set = new Set<string>();
    specifies.forEach(s => {
      const name = s.doctor?.doctorName;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [specifies]);

  const advancedFilterCount = useMemo(() => {
    let n = 0;
    if (doctorFilter !== 'all') n += 1;
    if (dateFrom.trim()) n += 1;
    if (dateTo.trim()) n += 1;
    return n;
  }, [doctorFilter, dateFrom, dateTo]);

  const resetAdvancedFilters = () => {
    setDoctorFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const toggleRowSelection = useCallback((specifyVoteID: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(specifyVoteID)) next.delete(specifyVoteID);
      else next.add(specifyVoteID);
      return next;
    });
  }, []);

  const filteredSpecifies = useMemo(() => {
    return sortedSpecifies.filter(specify => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(specify.specifyVoteID || '')
          .toLowerCase()
          .includes(q) ||
        String(specify.patient?.patientName || '')
          .toLowerCase()
          .includes(q) ||
        String(specify.patient?.patientPhone || '')
          .toLowerCase()
          .includes(q) ||
        String(specify.doctor?.doctorName || '')
          .toLowerCase()
          .includes(q) ||
        String(specify.genomeTest?.testName || '')
          .toLowerCase()
          .includes(q) ||
        String(specify.hospital?.hospitalName || '')
          .toLowerCase()
          .includes(q);

      const matchesStatus = specifyMatchesStatusFilter(specify.specifyStatus, statusFilter);

      const matchesDoctor = doctorFilter === 'all' || specify.doctor?.doctorName === doctorFilter;

      const createdAt = specify.createdAt ? new Date(specify.createdAt) : null;
      const matchesDateFrom = !dateFrom || (createdAt && createdAt >= new Date(dateFrom + 'T00:00:00'));
      const matchesDateTo = !dateTo || (createdAt && createdAt <= new Date(dateTo + 'T23:59:59'));

      return matchesSearch && matchesStatus && matchesDoctor && matchesDateFrom && matchesDateTo;
    });
  }, [sortedSpecifies, searchQuery, statusFilter, doctorFilter, dateFrom, dateTo]);

  const filteredSpecifyIdsKey = useMemo(
    () => filteredSpecifies.map(s => s.specifyVoteID).join('\u0001'),
    [filteredSpecifies]
  );

  useEffect(() => {
    if (!canLabBulkApprove) return;
    const allowed = new Set(filteredSpecifies.map(s => s.specifyVoteID));
    setSelectedRows(prev => {
      const next = new Set<string>();
      prev.forEach(id => {
        if (!allowed.has(id)) return;
        if ((approveEligibleBySpecifyId.get(id)?.length ?? 0) > 0) next.add(id);
      });
      if (next.size === prev.size && [...prev].every(id => next.has(id))) return prev;
      return next;
    });
  }, [filteredSpecifyIdsKey, canLabBulkApprove, filteredSpecifies, approveEligibleBySpecifyId]);

  const selectedApproveJobs = useMemo(() => {
    if (!canLabBulkApprove || selectedRows.size === 0) return [];
    const jobs: { labcode: string; specifyId: string }[] = [];
    selectedRows.forEach(specifyId => {
      const rows = approveEligibleBySpecifyId.get(specifyId);
      if (!rows?.length) return;
      rows.forEach(r => jobs.push({ labcode: r.labcode, specifyId }));
    });
    return jobs;
  }, [canLabBulkApprove, selectedRows, approveEligibleBySpecifyId]);

  const resultDateIdsKey = useMemo(
    () => filteredSpecifies.map(s => s.specifyVoteID).join('\u0001'),
    [filteredSpecifies]
  );

  const { data: resultDateBySpecifyId, isFetching: loadingResultDates } = useQuery({
    queryKey: ['specify-list-result-dates', resultDateIdsKey] as const,
    queryFn: async () => {
      const map: Record<string, string | null> = {};
      const list = filteredSpecifies;
      const batchSize = 6;
      for (let i = 0; i < list.length; i += batchSize) {
        const chunk = list.slice(i, i + batchSize);
        await Promise.all(
          chunk.map(async specify => {
            try {
              const res = await orderService.getBySpecifyId(specify.specifyVoteID);
              const orders = getApiResponseData<OrderResponse>(res) || [];
              map[specify.specifyVoteID] = pickLatestOrderResultDate(orders) ?? null;
            } catch {
              map[specify.specifyVoteID] = null;
            }
          })
        );
      }
      return map;
    },
    enabled: showSlipResultDateRow && filteredSpecifies.length > 0,
    staleTime: 60 * 1000,
  });

  const openDetail = (specifyVoteID: string) => {
    queryClient.prefetchQuery({
      queryKey: ['specify', specifyVoteID],
      queryFn: () => specifyVoteTestService.getById(specifyVoteID),
      staleTime: 60 * 1000,
    });
    if (useStaffListQuery) {
      router.push({
        pathname: '/staff/prescription-slip-detail',
        params: {
          specifyVoteID,
          ...(isLabAudience ? { readOnly: '1' } : {}),
        },
      });
    } else {
      router.push({
        pathname: '/customer/specify-detail',
        params: { specifyId: specifyVoteID },
      });
    }
  };

  const handleDownloadPdf = useCallback(
    async (specifyVoteID: string) => {
      try {
        const response = await specifyVoteTestService.getById(specifyVoteID);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Không tải được dữ liệu phiếu.');
        }
        await downloadSpecifyPdf(response.data as SpecifyVoteTestResponse);
      } catch (err: any) {
        presentFeedbackError({
          title: 'Không thể tải PDF',
          message: err?.message || 'Đã xảy ra lỗi khi tạo PDF phiếu chỉ định.',
        });
      }
    },
    []
  );

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={MEDICAL.primary} />
        <Text className="mt-3 text-sky-700 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-sky-950 text-center mb-2">Không tải được dữ liệu</Text>
          <Text className="text-xs text-sky-800/80 text-center mb-4">
            Vui lòng kiểm tra kết nối mạng và thử lại.
          </Text>
          <TouchableOpacity
            className="bg-sky-600 py-3 rounded-2xl items-center shadow-sm"
            onPress={() => refetch()}
            activeOpacity={0.85}
          >
            <Text className="text-white text-sm font-extrabold">Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const title = useStaffListQuery ? 'Quản lý phiếu xét nghiệm' : 'Phiếu xét nghiệm';
  const listSummary = `${filteredSpecifies.length}/${specifies.length} phiếu`;

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <View className="pb-3 px-4 bg-white border-b border-sky-100 shadow-sm shadow-sky-900/5">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color={MEDICAL.primary} />
          </TouchableOpacity>
          <View className="flex-1 min-w-0">
            <Text className="text-sky-950 text-lg font-extrabold tracking-tight" numberOfLines={2}>
              {title}
            </Text>
            <View className="flex-row items-center gap-2 mt-1 flex-wrap">
              <View className="px-2 py-0.5 rounded-md bg-sky-100 border border-sky-100">
                <Text className="text-[11px] font-extrabold text-sky-800">{listSummary}</Text>
              </View>
              {advancedFilterCount > 0 ? (
                <View className="px-2 py-0.5 rounded-md bg-cyan-100 border border-cyan-200">
                  <Text className="text-[11px] font-extrabold text-cyan-800">+{advancedFilterCount} lọc nâng cao</Text>
                </View>
              ) : null}
            </View>
          </View>
          {!useStaffListQuery || (isStaffAudience && canStaffCreate) ? (
            <View className="flex-row items-center gap-2">
              {showImportExcel ? (
                <TouchableOpacity
                  onPress={() => setImportExcelOpen(true)}
                  className="w-11 h-11 rounded-2xl bg-white items-center justify-center border border-sky-200 shadow-sm"
                  activeOpacity={0.85}
                  accessibilityLabel="Import phiếu từ Excel"
                >
                  <Upload size={20} color={MEDICAL.primary} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() =>
                  isStaffAudience
                    ? router.push('/staff/create-prescription-slip')
                    : router.push('/customer/create-specify')
                }
                className="w-11 h-11 rounded-2xl bg-sky-600 items-center justify-center border border-sky-700 shadow-sm"
                activeOpacity={0.85}
                accessibilityLabel="Thêm phiếu xét nghiệm"
              >
                <Plus size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View
          className={`mt-3 flex-row items-center rounded-2xl px-3.5 border ${focusSearch ? 'border-sky-400 bg-white' : 'border-sky-100 bg-sky-50/90'
            }`}
          style={{ ...(Platform.OS === 'android' ? { elevation: 0 } : {}) }}
        >
          <Search size={18} color={MEDICAL.primaryDark} />
          <TextInput
            className="flex-1 h-12 ml-2 text-[14px] text-sky-950 font-semibold"
            placeholder="Tìm mã phiếu, BN, SĐT, BS, xét nghiệm, BV…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
            returnKeyType="search"
          />
          {searchQuery.trim() ? (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center bg-white border border-sky-200"
              onPress={() => setSearchQuery('')}
              activeOpacity={0.75}
            >
              <X size={16} color={MEDICAL.primaryDark} />
            </TouchableOpacity>
          ) : null}
        </View>

        <SpecifyStatusPicker value={statusFilter} onChange={setStatusFilter} />

        <TouchableOpacity
          onPress={() => setFiltersExpanded(v => !v)}
          className="mt-3 flex-row items-center justify-between rounded-2xl border border-sky-100 bg-sky-50/80 px-3.5 py-3"
          activeOpacity={0.85}
        >
          <View className="flex-row items-center gap-2.5 flex-1 min-w-0">
            <View className="w-9 h-9 rounded-xl bg-white border border-sky-200 items-center justify-center">
              <SlidersHorizontal size={18} color={MEDICAL.primary} />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-extrabold text-sky-950">Lọc nâng cao</Text>
              <Text className="text-[11px] font-semibold text-sky-700/80 mt-0.5" numberOfLines={1}>
                Bác sĩ, khoảng ngày tạo phiếu
              </Text>
            </View>
            {advancedFilterCount > 0 ? (
              <View className="min-w-[22px] h-[22px] rounded-full bg-sky-600 items-center justify-center px-1.5">
                <Text className="text-[11px] font-extrabold text-white">{advancedFilterCount}</Text>
              </View>
            ) : null}
          </View>
          {filtersExpanded ? <ChevronUp size={20} color={MEDICAL.primaryDark} /> : <ChevronDown size={20} color={MEDICAL.primaryDark} />}
        </TouchableOpacity>

        {filtersExpanded ? (
          <View className="mt-2 rounded-2xl border border-sky-100 bg-white overflow-hidden shadow-sm shadow-sky-900/5">
            {doctors.length > 0 ? (
              <View className="px-3 pt-3 pb-2 border-b border-sky-50">
                <Text className="text-[11px] font-extrabold text-sky-700 uppercase tracking-wide mb-2">
                  Bác sĩ phụ trách
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2 pb-1">
                    <TouchableOpacity
                      onPress={() => setDoctorFilter('all')}
                      className={`px-3 py-2 rounded-xl border ${doctorFilter === 'all' ? 'bg-sky-700 border-sky-700' : 'bg-sky-50/80 border-sky-100'
                        }`}
                      activeOpacity={0.85}
                    >
                      <Text
                        className={`text-xs font-extrabold ${doctorFilter === 'all' ? 'text-white' : 'text-sky-900'}`}
                      >
                        Tất cả
                      </Text>
                    </TouchableOpacity>
                    {doctors.map(d => (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setDoctorFilter(d)}
                        className={`px-3 py-2 rounded-xl border max-w-[220px] ${doctorFilter === d ? 'bg-sky-600 border-sky-600' : 'bg-sky-50/80 border-sky-100'
                          }`}
                        activeOpacity={0.85}
                      >
                        <Text
                          className={`text-xs font-extrabold ${doctorFilter === d ? 'text-white' : 'text-sky-900'}`}
                          numberOfLines={1}
                        >
                          BS. {d}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            <View className="px-3 py-3">
              <View className="flex-row items-center gap-2 mb-2">
                <Calendar size={14} color={MEDICAL.primary} />
                <Text className="text-[11px] font-extrabold text-sky-700 uppercase tracking-wide">Ngày tạo phiếu</Text>
              </View>
              <View className="flex-row items-end gap-2">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-sky-600/90 mb-1">Từ</Text>
                  <TextInput
                    className="h-10 rounded-xl border border-sky-100 bg-sky-50/50 px-3 text-xs font-semibold text-sky-950"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={dateFrom}
                    onChangeText={setDateFrom}
                  />
                </View>
                <Text className="text-sky-200 font-bold pb-2.5">—</Text>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-sky-600/90 mb-1">Đến</Text>
                  <TextInput
                    className="h-10 rounded-xl border border-sky-100 bg-sky-50/50 px-3 text-xs font-semibold text-sky-950"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={dateTo}
                    onChangeText={setDateTo}
                  />
                </View>
              </View>
              <Text className="text-[10px] text-sky-700/70 mt-2 leading-4">
                Để trống nếu không lọc theo ngày. Định dạng năm-tháng-ngày (ví dụ 2025-03-01).
              </Text>
            </View>

            {advancedFilterCount > 0 ? (
              <TouchableOpacity
                onPress={resetAdvancedFilters}
                className="flex-row items-center justify-center gap-2 py-3 border-t border-sky-50 bg-sky-50/90"
                activeOpacity={0.85}
              >
                <RotateCcw size={16} color={MEDICAL.primaryDark} />
                <Text className="text-xs font-extrabold text-sky-900">Xóa lọc nâng cao</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      <ScrollView
        className="flex-1 bg-sky-50"
        contentContainerStyle={{
          padding: 16,
          paddingBottom:
            40 +
            ((audience === 'customer' && selectedRows.size > 0) ||
              (canLabBulkApprove && selectedRows.size > 0)
              ? Math.max(72, 72 + insets.bottom)
              : 0),
        }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={MEDICAL.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredSpecifies.length === 0 ? (
          <View className="bg-white rounded-3xl p-10 items-center border border-sky-100 shadow-sm shadow-sky-900/5">
            <View className="w-16 h-16 rounded-2xl bg-sky-100 border border-sky-200 items-center justify-center mb-4">
              <FileText size={32} color={MEDICAL.primary} />
            </View>
            <Text className="text-base font-extrabold text-sky-950 text-center">Chưa có phiếu phù hợp</Text>
            <Text className="text-xs font-semibold text-sky-800/90 mt-2 text-center leading-5">
              Thử đổi từ khóa tìm kiếm, trạng thái hoặc bộ lọc nâng cao.
            </Text>
          </View>
        ) : (
          filteredSpecifies.map(specify => {
            const statusBadge = getSpecifyStatusPresentation(specify.specifyStatus || '');
            const accent = statusBadge.accent ?? 'border-l-sky-400';
            const showForward =
              audience === 'customer' && normalizeSpecifyStatusKey(specify.specifyStatus) === 'initation';
            const eligibleApproveRows = approveEligibleBySpecifyId.get(specify.specifyVoteID) ?? [];
            const labApproveEligible = canLabBulkApprove && eligibleApproveRows.length > 0;
            const isSelected =
              (showForward && selectedRows.has(specify.specifyVoteID)) ||
              (labApproveEligible && selectedRows.has(specify.specifyVoteID));
            const rawResultDate = resultDateBySpecifyId?.[specify.specifyVoteID];
            const resultReturnDateFormatted =
              rawResultDate != null && rawResultDate !== ''
                ? formatDate(rawResultDate)
                : null;

            const cardMain = (
              <TouchableOpacity
                onPress={() =>
                  showForward
                    ? toggleRowSelection(specify.specifyVoteID)
                    : labApproveEligible
                      ? toggleRowSelection(specify.specifyVoteID)
                      : openDetail(specify.specifyVoteID)
                }
                className={`flex-1 p-4 min-w-0 ${showForward || labApproveEligible ? 'active:opacity-95' : 'active:bg-sky-50/90'}`}
                activeOpacity={showForward || labApproveEligible ? 0.92 : 0.9}
              >
                <View className="flex-1 min-w-0 pr-1">
                  <Text className="text-base font-extrabold text-sky-950" numberOfLines={2}>
                    {specify.patient?.patientName || '—'}
                  </Text>
                  <Text className="text-[11px] font-bold text-sky-700/80 mt-1.5 font-mono" numberOfLines={1}>
                    {specify.specifyVoteID}
                  </Text>
                  {labApproveEligible ? (
                    <View className="mt-2 self-start px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
                      <Text className="text-[10px] font-extrabold text-emerald-800">
                        {eligibleApproveRows.length} mẫu chờ duyệt KQ · chạm thẻ để chọn
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View className="mt-4 gap-3">
                  <View className="flex-row items-start gap-2.5">
                    <View className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 items-center justify-center mt-0.5">
                      <FlaskConical size={15} color={MEDICAL.primary} />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-[10px] font-extrabold text-sky-600/90 uppercase tracking-wide">
                        Xét nghiệm
                      </Text>
                      <Text className="text-[13px] font-bold text-sky-950 mt-0.5" numberOfLines={2}>
                        {specify.genomeTest?.testName || '—'}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-start gap-2.5">
                    <View className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 items-center justify-center mt-0.5">
                      <Building2 size={15} color={MEDICAL.primaryDark} />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-[10px] font-extrabold text-sky-600/90 uppercase tracking-wide">
                        Bệnh viện
                      </Text>
                      <Text className="text-[13px] font-bold text-sky-950 mt-0.5" numberOfLines={2}>
                        {specify.hospital?.hospitalName || '—'}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 items-center justify-center">
                      <Calendar size={15} color={MEDICAL.mutedIcon} />
                    </View>
                    <View>
                      <Text className="text-[10px] font-extrabold text-sky-600/90 uppercase tracking-wide">
                        Ngày tạo
                      </Text>
                      <Text className="text-[13px] font-bold text-sky-950 mt-0.5">
                        {formatDate(specify.createdAt) || '—'}
                      </Text>
                    </View>
                  </View>
                  {showSlipResultDateRow ? (
                    <View className="flex-row items-center gap-2.5">
                      <View className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 items-center justify-center">
                        <Calendar size={15} color="#059669" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-[10px] font-extrabold text-emerald-700/90 uppercase tracking-wide">
                          Ngày trả kết quả
                        </Text>
                        <Text className="text-[13px] font-bold text-sky-950 mt-0.5" numberOfLines={2}>
                          {loadingResultDates
                            ? 'Đang tải…'
                            : resultReturnDateFormatted || 'N/A'}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
            const cardRail = (
              <View className="pr-2.5 pt-4 pb-4 items-end justify-between shrink-0 self-stretch">
                <View className={`px-2.5 py-1 rounded-lg border max-w-[120px] ${statusBadge.bg} ${statusBadge.bd}`}>
                  <Text className={`text-[10px] font-extrabold ${statusBadge.fg}`} numberOfLines={2}>
                    {statusBadge.label}
                  </Text>
                </View>
                <View className="flex-row items-center gap-0.5 mt-auto pt-2">
                  <TouchableOpacity
                    onPress={() => void handleDownloadPdf(specify.specifyVoteID)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="w-8 h-8 rounded-lg items-center justify-center border bg-sky-50 border-sky-100"
                    accessibilityLabel="Tải PDF phiếu"
                    activeOpacity={0.75}
                  >
                    <Download size={14} color={MEDICAL.primaryDark} />
                  </TouchableOpacity>
                  {showCancelSlipAction && canCancelSpecifyAtInitiation(specify.specifyStatus) ? (
                    <TouchableOpacity
                      onPress={() => {
                        setDeleteTargetId(specify.specifyVoteID);
                        setShowDeleteConfirm(true);
                      }}
                      disabled={deleteMutation.isPending}
                      hitSlop={{ top: 10, bottom: 10, left: 8, right: 4 }}
                      className={`w-8 h-8 rounded-lg items-center justify-center border ${deleteMutation.isPending
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-red-50/90 border-red-100'
                        }`}
                      accessibilityLabel="Hủy phiếu"
                    >
                      <Trash2
                        size={14}
                        color={deleteMutation.isPending ? '#94a3b8' : '#dc2626'}
                        strokeWidth={2.2}
                      />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => openDetail(specify.specifyVoteID)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="w-7 h-8 items-center justify-center"
                    accessibilityLabel={showForward || labApproveEligible ? 'Xem chi tiết phiếu' : undefined}
                    activeOpacity={0.75}
                  >
                    <ChevronRight size={18} color={isSelected ? '#64748b' : '#7dd3fc'} />
                  </TouchableOpacity>
                </View>
              </View>
            );

            return (
              <View
                key={specify.specifyVoteID}
                className={`rounded-2xl mb-3 border overflow-hidden border-l-4 shadow-sm shadow-sky-900/5 ${isSelected
                  ? 'bg-slate-200 border-slate-300/90 border-l-slate-500'
                  : `bg-white border-sky-100 ${accent}`
                  }`}
              >
                <View className="flex-row items-stretch">
                  <View className="flex-1 flex-row min-w-0">
                    {cardMain}
                    {cardRail}
                  </View>
                </View>

                {showForward ? (
                  <View
                    className={`border-t px-4 py-3 ${isSelected ? 'border-slate-300/80 bg-slate-300/50' : 'border-sky-100 bg-sky-50/90'
                      }`}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setForwardingSpecifyList([
                          { specifyVoteID: specify.specifyVoteID, fullSpecifyData: specify },
                        ]);
                        setForwardModalOpen(true);
                      }}
                      className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 border border-sky-700 active:bg-sky-700"
                      activeOpacity={0.88}
                    >
                      <ArrowRight size={16} color="#fff" />
                      <Text className="text-xs font-extrabold text-white">Chuyển tiếp phiếu</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {audience === 'customer' ? (
        <ForwardTestModal
          visible={forwardModalOpen}
          onClose={() => {
            setForwardModalOpen(false);
            setForwardingSpecifyList([]);
            setSelectedRows(new Set());
          }}
          specifyDataList={forwardingSpecifyList}
          onSuccess={() => refetch()}
          onNavigateToPayment={params => {
            setForwardModalOpen(false);
            setForwardingSpecifyList([]);
            setSelectedRows(new Set());
            refetch();
            router.push({
              pathname: '/customer/payment',
              params: {
                orderId: params.orderId,
                orderName: params.orderName,
                amount: String(params.amount),
                specifyId: params.specifyId,
                hasFastq: params.hasFastq ? 'true' : 'false',
                returnPath: params.hasFastq ? '/customer/patient-metadatas' : '/customer/orders',
                cancelPath: '/customer/specifies',
                ...(params.allOrderIds && { allOrderIds: params.allOrderIds }),
                ...(params.allSpecifyIds && { allSpecifyIds: params.allSpecifyIds }),
              },
            });
          }}
          onNavigateToOrders={() => router.replace('/customer/orders')}
          onNavigateToPatientMetadatas={() => router.replace('/customer/patient-metadatas')}
        />
      ) : null}

      {audience === 'customer' && selectedRows.size > 0 ? (
        <View
          className="border-t border-sky-200 bg-white px-4 pt-3 flex-row items-center gap-2 shadow-lg shadow-sky-900/10"
          style={{ paddingBottom: 12 + insets.bottom }}
        >
          <TouchableOpacity
            onPress={() => setSelectedRows(new Set())}
            className="px-3 py-2.5 rounded-xl border border-sky-200 bg-white active:bg-sky-50"
            activeOpacity={0.85}
          >
            <Text className="text-xs font-extrabold text-sky-900">Bỏ chọn</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const selected = filteredSpecifies.filter(s => selectedRows.has(s.specifyVoteID));
              if (selected.length === 0) return;
              setForwardingSpecifyList(
                selected.map(s => ({ specifyVoteID: s.specifyVoteID, fullSpecifyData: s }))
              );
              setForwardModalOpen(true);
            }}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 border border-sky-700 active:bg-sky-700"
            activeOpacity={0.88}
          >
            <ArrowRight size={16} color="#fff" />
            <Text className="text-xs font-extrabold text-white">Chuyển tiếp ({selectedRows.size})</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canLabBulkApprove && selectedRows.size > 0 ? (
        <View
          className="border-t border-sky-200 bg-white px-4 pt-3 flex-row items-center gap-2 shadow-lg shadow-sky-900/10"
          style={{ paddingBottom: 12 + insets.bottom }}
        >
          <TouchableOpacity
            onPress={() => setSelectedRows(new Set())}
            disabled={labBulkApproveMutation.isPending}
            className="px-3 py-2.5 rounded-xl border border-sky-200 bg-white active:bg-sky-50"
            activeOpacity={0.85}
          >
            <Text className="text-xs font-extrabold text-sky-900">Bỏ chọn</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (selectedApproveJobs.length === 0) return;
              setLabBulkConfirmOpen(true);
            }}
            disabled={labBulkApproveMutation.isPending || selectedApproveJobs.length === 0}
            className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 border border-emerald-700 active:bg-emerald-700"
            activeOpacity={0.88}
          >
            {labBulkApproveMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <CheckCircle2 size={16} color="#fff" />
            )}
            <Text className="text-xs font-extrabold text-white">
              Duyệt KQ ({selectedApproveJobs.length} mẫu · {selectedRows.size} phiếu)
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showImportExcel ? (
        <ImportSpecifyExcelModal
          visible={importExcelOpen}
          onClose={() => setImportExcelOpen(false)}
          onSuccess={() => setImportExcelOpen(false)}
        />
      ) : null}

      {canLabBulkApprove ? (
        <ConfirmModal
          visible={labBulkConfirmOpen}
          title="Duyệt kết quả đầu ra"
          message={`Xác nhận duyệt ${selectedApproveJobs.length} mẫu trên ${selectedRows.size} phiếu đã chọn? Trạng thái mẫu → hoàn tất; phiếu và đơn → chờ duyệt kết quả (cùng luồng với “Duyệt KQ” ở quản lý mẫu).`}
          confirmText="Duyệt"
          cancelText="Hủy"
          onCancel={() => setLabBulkConfirmOpen(false)}
          onConfirm={() => {
            const jobs = selectedApproveJobs;
            setLabBulkConfirmOpen(false);
            if (jobs.length === 0) return;
            labBulkApproveMutation.mutate(jobs);
          }}
        />
      ) : null}

      {showCancelSlipAction ? (
        <ConfirmModal
          visible={showDeleteConfirm}
          title="Hủy phiếu chỉ định"
          message="Chỉ có thể hủy phiếu ở trạng thái Khởi tạo. Bạn có chắc muốn hủy phiếu này? Thao tác không thể hoàn tác."
          confirmText="Hủy phiếu"
          cancelText="Đóng"
          destructive
          onConfirm={() => {
            if (deleteTargetId) deleteMutation.mutate(deleteTargetId);
          }}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setDeleteTargetId(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
