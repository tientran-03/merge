import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/components/modals';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { canCancelSpecifyAtInitiation } from '@/lib/specify-status';
import { getApiResponseData } from '@/lib/types/api-types';
import { SpecifyVoteTestResponse, specifyVoteTestService } from '@/services/specifyVoteTestService';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

const getStatusLabel = (status?: string): string => {
  if (!status) return 'Khởi tạo';
  const s = status.toLowerCase();
  const statusMap: Record<string, string> = {
    initation: 'Khởi tạo',
    payment_failed: 'Thanh toán thất bại',
    waiting_receive_sample: 'Chờ nhận mẫu',
    forward_analysis: 'Chuyển phân tích',
    sample_collecting: 'Đang thu mẫu',
    sample_retrieved: 'Đã tiếp nhận mẫu',
    analyze_in_progress: 'Đang phân tích',
    rerun_testing: 'Chạy lại',
    awaiting_results_approval: 'Chờ duyệt kết quả',
    results_approved: 'Kết quả đã duyệt',
    canceled: 'Hủy',
    rejected: 'Từ chối',
    sample_addition: 'Thêm mẫu',
    sample_error: 'Mẫu lỗi',
    completed: 'Hoàn thành',
  };
  return statusMap[s] || status;
};

const getStatusMeta = (status?: string) => {
  if (!status) {
    return {
      label: 'Khởi tạo',
      bg: 'rgba(59,130,246,0.12)',
      fg: COLORS.blue,
      bd: 'rgba(59,130,246,0.22)',
    };
  }
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'results_approved') {
    return {
      label: getStatusLabel(status),
      bg: 'rgba(34,197,94,0.12)',
      fg: COLORS.green,
      bd: 'rgba(34,197,94,0.22)',
    };
  }
  if (s === 'canceled' || s === 'rejected' || s === 'payment_failed' || s === 'sample_error') {
    return {
      label: getStatusLabel(status),
      bg: 'rgba(239,68,68,0.12)',
      fg: COLORS.red,
      bd: 'rgba(239,68,68,0.22)',
    };
  }
  if (
    s === 'analyze_in_progress' ||
    s === 'sample_collecting' ||
    s === 'waiting_receive_sample' ||
    s === 'forward_analysis'
  ) {
    return {
      label: getStatusLabel(status),
      bg: 'rgba(249,115,22,0.12)',
      fg: COLORS.orange,
      bd: 'rgba(249,115,22,0.22)',
    };
  }
  return {
    label: getStatusLabel(status),
    bg: 'rgba(59,130,246,0.12)',
    fg: COLORS.blue,
    bd: 'rgba(59,130,246,0.22)',
  };
};

const formatDateShort = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  } catch {
    return dateString;
  }
};

export default function PrescriptionSlipsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, canCreatePrescriptionSlip } = useAuth();

  const canCreate = React.useMemo(() => {
    const result = canCreatePrescriptionSlip();
    console.log('[PrescriptionSlips] Permission check', {
      hasUser: !!user,
      userRole: user?.role,
      canCreate: result,
    });
    return result;
  }, [user, canCreatePrescriptionSlip]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string | 'all'>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState<boolean>(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['specify-vote-tests', statusFilter],
    queryFn: async () => {
      if (statusFilter !== 'all') {
        return await specifyVoteTestService.getByStatus(statusFilter);
      }
      return await specifyVoteTestService.getAll();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => specifyVoteTestService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specify-vote-tests'] });
      queryClient.invalidateQueries({ queryKey: ['customer-specifies'] });
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      presentFeedbackSuccess({
        title: 'Thành công',
        message: 'Đã hủy phiếu chỉ định.',
      });
    },
    onError: (err: any) => {
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      presentFeedbackError({
        title: 'Lỗi',
        message: err?.message || 'Không thể hủy phiếu chỉ định. Vui lòng thử lại.',
      });
    },
  });

  const handleDelete = (slipId: string) => {
    setDeleteTargetId(slipId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId) deleteMutation.mutate(deleteTargetId);
  };

  const slips: SpecifyVoteTestResponse[] = useMemo(() => {
    return getApiResponseData<SpecifyVoteTestResponse>(data) || [];
  }, [data]);

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'week', label: 'Tuần này' },
    { key: 'month', label: 'Tháng này' },
    { key: 'all', label: 'Tất cả' },
  ];

  const statusOptions: { key: string; label: string }[] = [
    { key: 'all', label: 'Tất cả trạng thái' },
    { key: 'completed', label: 'Hoàn thành' },
    { key: 'results_approved', label: 'Kết quả đã duyệt' },
    { key: 'initation', label: 'Khởi tạo' },
    { key: 'canceled', label: 'Hủy' },
    { key: 'rejected', label: 'Từ chối' },
    { key: 'analyze_in_progress', label: 'Đang phân tích' },
    { key: 'sample_collecting', label: 'Đang thu mẫu' },
  ];

  const filteredSlips = useMemo(() => {
    let filtered = slips;

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(slip => {
        const code = slip.specifyVoteID?.toLowerCase() || '';
        const testName = slip.genomeTest?.testName?.toLowerCase() || '';
        const patientName = slip.patient?.patientName?.toLowerCase() || '';
        return code.includes(q) || testName.includes(q) || patientName.includes(q);
      });
    }

    if (timeFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter((slip: any) => {
        const createdAt = slip.createdAt ? new Date(slip.createdAt) : null;
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

    return filtered;
  }, [slips, searchQuery, timeFilter]);

  const groupedSlips = useMemo(() => {
    const groups: { [key: string]: SpecifyVoteTestResponse[] } = {};
    filteredSlips.forEach((slip: any) => {
      const date = slip.createdAt ? formatDateShort(slip.createdAt) : 'Không xác định';
      if (!groups[date]) groups[date] = [];
      groups[date].push(slip);
    });
    return groups;
  }, [filteredSlips]);

  const currentStatusLabel =
    statusOptions.find(opt => opt.key === statusFilter)?.label || 'Tất cả trạng thái';
  if (isLoading) {
    return (
      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: COLORS.bg }}
        edges={['top', 'left', 'right']}
      >
        <StatusBar barStyle="dark-content" />

        <View
          className="px-4 pb-3 border-b"
          style={{ backgroundColor: COLORS.card, borderBottomColor: COLORS.border }}
        >
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
                Phiếu chỉ định
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text className="mt-3" style={{ color: COLORS.sub }}>
            Đang tải dữ liệu...
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  if (error) {
    return (
      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: COLORS.bg }}
        edges={['top', 'left', 'right']}
      >
        <StatusBar barStyle="dark-content" />

        <View
          className="px-4 pb-3 border-b"
          style={{ backgroundColor: COLORS.card, borderBottomColor: COLORS.border }}
        >
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
                Phiếu chỉ định
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-1 items-center justify-center px-5">
          <Text className="text-base font-extrabold mb-2" style={{ color: COLORS.text }}>
            Không tải được dữ liệu
          </Text>

          <TouchableOpacity
            className="mt-3 px-6 py-3 rounded-xl"
            style={{ backgroundColor: COLORS.primary }}
            onPress={() => refetch()}
            activeOpacity={0.85}
          >
            <Text className="font-extrabold" style={{ color: '#fff' }}>
              Thử lại
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: COLORS.bg }}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        className="px-4 pb-3 border-b"
        style={{ backgroundColor: COLORS.card, borderBottomColor: COLORS.border }}
      >
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
              Phiếu chỉ định
            </Text>
            <Text className="mt-0.5 text-xs font-bold" style={{ color: COLORS.sub }}>
              Tra cứu & lọc phiếu chỉ định xét nghiệm
            </Text>
          </View>

          {canCreate && (
            <TouchableOpacity
              onPress={() => router.push('/customer/create-prescription-slip')}
              className="w-10 h-10 rounded-xl items-center justify-center ml-2"
              style={{ backgroundColor: COLORS.primary }}
              activeOpacity={0.85}
            >
              <Plus size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <View
            className="px-3 py-1.5 rounded-2xl ml-2 border"
            style={{ backgroundColor: COLORS.primarySoft, borderColor: COLORS.border2 }}
          >
            <Text className="text-xs font-black" style={{ color: COLORS.primary }}>
              {filteredSlips.length}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View
          className="mt-2.5 h-11 rounded-2xl px-3 flex-row items-center border"
          style={{ backgroundColor: COLORS.primarySoft, borderColor: COLORS.border }}
        >
          <Search size={18} color={COLORS.sub} />
          <TextInput
            className="flex-1 ml-2 text-sm font-bold"
            style={{ color: COLORS.text }}
            placeholder="Tìm theo mã phiếu / xét nghiệm / bệnh nhân…"
            placeholderTextColor={COLORS.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>

        {/* Time pills */}
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

        {/* Filters row */}
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

        {/* Dropdown */}
        {showStatusDropdown && (
          <View
            className="mt-2.5 rounded-2xl border overflow-hidden"
            style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}
          >
            {statusOptions.map(opt => {
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

      {/* List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {Object.keys(groupedSlips).length === 0 ? (
          <View
            className="mt-6 rounded-[18px] p-[18px] items-center border"
            style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}
          >
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center border"
              style={{ backgroundColor: COLORS.primarySoft, borderColor: COLORS.border2 }}
            >
              <FileText size={28} color={COLORS.primary} />
            </View>

            <Text className="mt-3 text-base font-black" style={{ color: COLORS.text }}>
              Không có phiếu chỉ định
            </Text>
            <Text
              className="mt-1.5 text-[13px] font-bold text-center"
              style={{ color: COLORS.sub }}
            >
              Thử đổi bộ lọc hoặc từ khóa tìm kiếm.
            </Text>

            {canCreate && (
              <TouchableOpacity
                className="mt-4 px-5 py-3 rounded-xl"
                style={{ backgroundColor: COLORS.primary }}
                onPress={() => router.push('/customer/create-prescription-slip')}
                activeOpacity={0.85}
              >
                <Text className="font-extrabold" style={{ color: '#fff' }}>
                  Thêm phiếu chỉ định
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          Object.keys(groupedSlips).map(date => (
            <View key={date} className="mb-4">
              <View className="flex-row items-center justify-between mb-2.5 mt-1">
                <Text className="text-sm font-black" style={{ color: COLORS.text }}>
                  {date}
                </Text>
                <View
                  className="min-w-[28px] h-[22px] rounded-full items-center justify-center px-2 border"
                  style={{ backgroundColor: COLORS.primarySoft, borderColor: COLORS.border2 }}
                >
                  <Text className="text-xs font-black" style={{ color: COLORS.primary }}>
                    {groupedSlips[date].length}
                  </Text>
                </View>
              </View>

              {groupedSlips[date].map(slip => {
                const meta = getStatusMeta(slip.specifyStatus);
                const goDetail = () => {
                  if (slip.specifyVoteID) {
                    router.push({
                      pathname: '/customer/prescription-slip-detail',
                      params: { specifyVoteID: slip.specifyVoteID },
                    });
                  }
                };
                return (
                  <View
                    key={slip.specifyVoteID}
                    className="rounded-2xl mb-2.5 border flex-row items-stretch overflow-hidden"
                    style={{
                      backgroundColor: COLORS.card,
                      borderColor: COLORS.border,
                      ...Platform.select({
                        ios: {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 10 },
                          shadowOpacity: 0.05,
                          shadowRadius: 12,
                        },
                        android: { elevation: 1 },
                        web: { boxShadow: '0px 10px 12px rgba(0, 0, 0, 0.04)' } as any,
                      }),
                    }}>
                    <Pressable
                      className="flex-1 flex-row items-center px-3.5 py-3.5 active:opacity-90"
                      onPress={goDetail}>
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center gap-2 pr-1.5">
                          <Text
                            className="text-[13px] font-black shrink"
                            style={{ color: COLORS.primary }}
                            numberOfLines={1}>
                            {slip.specifyVoteID}
                          </Text>

                          <View
                            className="px-2.5 py-1 rounded-full border shrink-0"
                            style={{ backgroundColor: meta.bg, borderColor: meta.bd }}>
                            <Text className="text-[11px] font-black" style={{ color: meta.fg }}>
                              {meta.label}
                            </Text>
                          </View>
                        </View>

                        {slip.genomeTest?.testName && (
                          <Text
                            className="mt-2 text-sm font-black"
                            style={{ color: COLORS.text }}
                            numberOfLines={2}>
                            {slip.genomeTest.testName}
                          </Text>
                        )}

                        {slip.patient?.patientName && (
                          <Text
                            className="mt-1.5 text-xs font-extrabold"
                            style={{ color: COLORS.sub }}
                            numberOfLines={2}>
                            {slip.patient.patientName}
                          </Text>
                        )}
                      </View>
                      <ChevronRight size={18} color={COLORS.sub} />
                    </Pressable>

                    {canCancelSpecifyAtInitiation(slip.specifyStatus) ? (
                      <TouchableOpacity
                        onPress={() => slip.specifyVoteID && handleDelete(slip.specifyVoteID)}
                        disabled={deleteMutation.isPending}
                        className="px-3 justify-center border-l"
                        style={{
                          borderLeftColor: COLORS.border,
                          backgroundColor: COLORS.primarySoft,
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Hủy phiếu"
                      >
                        <View
                          className="p-2 rounded-lg"
                          style={{
                            backgroundColor: deleteMutation.isPending ? COLORS.bg : '#FEE2E2',
                          }}
                        >
                          <Trash2
                            size={16}
                            color={deleteMutation.isPending ? COLORS.sub : '#EF4444'}
                          />
                        </View>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmModal
        visible={showDeleteConfirm}
        title="Hủy phiếu chỉ định"
        message="Chỉ có thể hủy phiếu ở trạng thái Khởi tạo. Bạn có chắc muốn hủy phiếu này? Thao tác không thể hoàn tác."
        confirmText="Hủy phiếu"
        cancelText="Đóng"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteTargetId(null);
        }}
      />

    </SafeAreaView>
  );
}
