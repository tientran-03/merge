import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Package,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { ConfirmModal, SuccessModal } from '@/components/modals';
import { getApiResponseData } from '@/lib/types/api-types';
import { sampleAddService, SampleAddResponse } from '@/services/sampleAddService';
import { orderService } from '@/services/orderService';
import { sampleAddServiceCatalogService, type SampleAddServiceCatalogResponse } from '@/services/sampleAddServiceCatalogService';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('vi-VN');
  } catch {
    return dateString;
  }
};

const getStatusLabel = (status?: string): string => {
  if (!status) return 'Khởi tạo';
  const s = status.toLowerCase();
  const statusMap: Record<string, string> = {
    initation: 'Khởi tạo',
    completed: 'Hoàn thành',
    canceled: 'Hủy',
    rejected: 'Từ chối',
  };
  return statusMap[s] || status;
};

const getStatusMeta = (status?: string) => {
  if (!status) {
    return {
      label: 'Khởi tạo',
      bg: 'bg-sky-50',
      fg: 'text-sky-700',
      bd: 'border-sky-200',
    };
  }
  const s = status.toLowerCase();
  if (s === 'completed') {
    return {
      label: getStatusLabel(status),
      bg: 'bg-emerald-50',
      fg: 'text-emerald-700',
      bd: 'border-emerald-200',
    };
  }
  if (s === 'canceled' || s === 'rejected') {
    return {
      label: getStatusLabel(status),
      bg: 'bg-red-50',
      fg: 'text-red-700',
      bd: 'border-red-200',
    };
  }
  return {
    label: getStatusLabel(status),
    bg: 'bg-sky-50',
    fg: 'text-sky-700',
    bd: 'border-sky-200',
  };
};

const getPaymentStatusMeta = (paymentStatus?: string) => {
  const status = (paymentStatus || 'PENDING').toUpperCase();
  if (status === 'COMPLETED') {
    return {
      label: 'Đã thanh toán',
      bg: 'bg-emerald-50',
      fg: 'text-emerald-700',
      bd: 'border-emerald-200',
    };
  }
  if (status === 'FAILED') {
    return {
      label: 'Thất bại',
      bg: 'bg-red-50',
      fg: 'text-red-700',
      bd: 'border-red-200',
    };
  }
  return {
    label: 'Chờ thanh toán',
    bg: 'bg-amber-50',
    fg: 'text-amber-700',
    bd: 'border-amber-200',
  };
};

const canRetrySampleAddPayment = (sample: SampleAddResponse): boolean => {
  const paymentStatus = String(sample.paymentStatus || '').toUpperCase();
  const paymentType = String(sample.paymentType || '').toUpperCase();
  return paymentStatus !== 'COMPLETED' && paymentType !== 'CASH';
};

export default function AdditionalSamplesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['sample-adds'],
    queryFn: async () => {
      return await sampleAddService.getAll();
    },
  });
  const { data: ordersResponse } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderService.getAll(),
  });
  const { data: sampleServiceCatalogResponse } = useQuery({
    queryKey: ['sample-add-services-catalog'],
    queryFn: () => sampleAddServiceCatalogService.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sampleAddService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample-adds'] });
      setShowDeleteConfirm(false);
      setShowDeleteSuccess(true);
      setDeleteTargetId(null);
    },
    onError: (err: any) => {
      setShowDeleteConfirm(false);
      Alert.alert('Lỗi', err?.message || 'Không thể xóa mẫu xét nghiệm. Vui lòng thử lại.');
      setDeleteTargetId(null);
    },
  });

  const handleDelete = (sampleId: string, event: any) => {
    event?.stopPropagation?.();
    setDeleteTargetId(sampleId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId) deleteMutation.mutate(deleteTargetId);
  };

  const samples: SampleAddResponse[] = useMemo(() => {
    return getApiResponseData<SampleAddResponse>(data) || [];
  }, [data]);
  const orders = useMemo(() => {
    return getApiResponseData<any>(ordersResponse) || [];
  }, [ordersResponse]);
  const sampleServiceCatalog = useMemo(() => {
    return getApiResponseData<SampleAddServiceCatalogResponse>(sampleServiceCatalogResponse) || [];
  }, [sampleServiceCatalogResponse]);
  const hospitalIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    orders.forEach((o: any) => {
      const oid = String(o?.orderId || '').trim();
      if (!oid) return;
      const hid =
        o?.specifyId?.hospitalId ??
        o?.specifyId?.hospital?.hospitalId ??
        o?.specify?.hospitalId ??
        o?.specify?.hospital?.hospitalId;
      if (hid != null && String(hid).trim()) {
        map[oid] = String(hid).trim();
      }
    });
    return map;
  }, [orders]);

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'week', label: 'Tuần này' },
    { key: 'month', label: 'Tháng này' },
    { key: 'all', label: 'Tất cả' },
  ];

  const filteredSamples = useMemo(() => {
    let filtered = samples.filter((sample) => {
      const oid = String(sample.orderId || '').trim();
      const hospitalId = oid ? String(hospitalIdMap[oid] || '').trim() : '';
      if (hospitalId === '1') return true;
      return String(sample.status || '').toLowerCase() === 'forward_analysis';
    });

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter((sample) => {
        const name = sample.sampleName?.toLowerCase() || '';
        const orderId = sample.orderId?.toLowerCase() || '';
        const patientId = sample.patientId?.toLowerCase() || '';
        return name.includes(q) || orderId.includes(q) || patientId.includes(q);
      });
    }

    if (timeFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter((sample: any) => {
        const requestDate = sample.requestDate ? new Date(sample.requestDate) : null;
        if (!requestDate) return false;

        if (timeFilter === 'today') {
          return requestDate.toDateString() === now.toDateString();
        }
        if (timeFilter === 'week') {
          return requestDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        if (timeFilter === 'month') {
          return requestDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        return true;
      });
    }

    return filtered;
  }, [samples, hospitalIdMap, searchQuery, timeFilter]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 px-6">
        <Text className="text-center text-red-500 mb-4">
          {error instanceof Error ? error.message : 'Có lỗi xảy ra khi tải dữ liệu'}
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="rounded-2xl bg-sky-600 px-6 py-3"
        >
          <Text className="font-bold text-white">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">Mẫu xét nghiệm bổ sung</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {filteredSamples.length} mẫu • {timeFilter === 'all' ? 'Tất cả' : timeFilters.find(f => f.key === timeFilter)?.label}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/staff/new-sample-add')}
            className="w-10 h-10 rounded-xl bg-sky-600 items-center justify-center mr-2"
            activeOpacity={0.8}
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowFilters((v) => !v)}
            className={`w-10 h-10 rounded-xl border items-center justify-center ${
              showFilters ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-200'
            }`}
            activeOpacity={0.85}
          >
            <SlidersHorizontal size={18} color={showFilters ? '#FFFFFF' : COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View className="mt-3 flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm theo tên mẫu / mã đơn / bệnh nhân…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {!!searchQuery.trim() && (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center"
              onPress={() => setSearchQuery('')}
              activeOpacity={0.75}
            >
              <Text className="text-slate-400 text-lg">×</Text>
            </TouchableOpacity>
          )}
        </View>

        {showFilters && (
          <View className="mt-3 flex-row gap-2">
            {timeFilters.map((filter) => (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setTimeFilter(filter.key)}
                className={`px-4 py-2 rounded-xl border ${
                  timeFilter === filter.key
                    ? 'bg-sky-600 border-sky-600'
                    : 'bg-white border-slate-200'
                }`}
                activeOpacity={0.8}
              >
                <Text
                  className={`text-xs font-bold ${
                    timeFilter === filter.key ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredSamples.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <Package size={64} color="#94A3B8" />
            <Text className="mt-4 text-center text-lg font-extrabold text-slate-700">
              Không có mẫu xét nghiệm
            </Text>
            <Text className="mt-2 text-center text-sm text-slate-500 leading-5">
              {searchQuery.trim()
                ? 'Không tìm thấy mẫu xét nghiệm phù hợp'
                : 'Chưa có mẫu xét nghiệm bổ sung nào'}
            </Text>
            {!searchQuery.trim() && (
              <TouchableOpacity
                onPress={() => router.push('/staff/new-sample-add')}
                className="mt-6 rounded-2xl bg-sky-600 px-6 py-3"
              >
                <Text className="font-bold text-white text-[15px]">Tạo mẫu mới</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {filteredSamples.map((sample) => {
              const statusMeta = getStatusMeta(sample.status);
              const paymentMeta = getPaymentStatusMeta(sample.paymentStatus);

              return (
                <TouchableOpacity
                  key={sample.sampleAddId || sample.id}
                  className="mb-3 rounded-2xl bg-white border border-slate-200 p-4"
                  activeOpacity={0.7}
                  onPress={() => {
                  }}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-[15px] font-extrabold text-slate-900 mb-1">
                        {sample.sampleName || 'Chưa đặt tên'}
                      </Text>
                      {sample.orderId && (
                        <Text className="text-xs text-slate-500 mb-1">
                          Đơn hàng: {sample.orderId}
                        </Text>
                      )}
                      {sample.patientId && (
                        <Text className="text-xs text-slate-500">
                          Bệnh nhân: {sample.patientId}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center gap-2">
                      {canRetrySampleAddPayment(sample) ? (
                        <TouchableOpacity
                          onPress={() => {
                            const service = sampleServiceCatalog.find(
                              s => String(s.sampleName || '').trim() === String(sample.sampleName || '').trim()
                            );
                            const retryAmount = Number(service?.finalPrice ?? service?.price ?? 0);
                            if (!sample.orderId || retryAmount <= 0) {
                              Alert.alert('Thiếu dữ liệu', 'Không đủ thông tin để tạo mã QR thanh toán.');
                              return;
                            }
                            const linkedSpecifyId =
                              orders.find(o => String(o.orderId || '').trim() === String(sample.orderId || '').trim())
                                ?.specifyId?.specifyVoteID || '';
                            router.push({
                              pathname: '/staff/payment',
                              params: {
                                orderId: String(sample.orderId),
                                orderName: String(sample.sampleName || 'Mẫu bổ sung'),
                                amount: String(retryAmount),
                                specifyId: String(linkedSpecifyId),
                                sampleAddId: String(sample.sampleAddId || sample.id || ''),
                                returnPath: '/staff/additional-samples',
                              } as any,
                            });
                          }}
                          accessibilityLabel="Thanh toán lại"
                          accessibilityRole="button"
                          activeOpacity={0.7}
                          className="w-8 h-8 rounded-lg items-center justify-center bg-indigo-50"
                        >
                          <CreditCard size={16} color="#4F46E5" />
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        onPress={(e) => handleDelete(sample.sampleAddId || sample.id || '', e)}
                        className="w-8 h-8 rounded-lg items-center justify-center bg-red-50"
                        activeOpacity={0.7}
                      >
                        <Trash2 size={16} color={COLORS.red} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2 mt-2">
                    <View
                      className={`px-2.5 py-1 rounded-lg border ${statusMeta.bg} ${statusMeta.bd}`}
                    >
                      <Text className={`text-[10px] font-bold ${statusMeta.fg}`}>
                        {statusMeta.label}
                      </Text>
                    </View>
                    <View
                      className={`px-2.5 py-1 rounded-lg border ${paymentMeta.bg} ${paymentMeta.bd}`}
                    >
                      <Text className={`text-[10px] font-bold ${paymentMeta.fg}`}>
                        {paymentMeta.label}
                      </Text>
                    </View>
                  </View>

                  {sample.requestDate && (
                    <Text className="mt-2 text-xs text-slate-400">
                      Ngày yêu cầu: {formatDate(sample.requestDate)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={showDeleteConfirm}
        title="Xác nhận xóa"
        message={`Bạn có chắc chắn muốn xóa mẫu xét nghiệm này? Hành động này không thể hoàn tác.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteTargetId(null);
        }}
        confirmText="Xóa"
        cancelText="Hủy"
        destructive
      />

      <SuccessModal
        visible={showDeleteSuccess}
        title="Xóa thành công"
        message="Mẫu xét nghiệm đã được xóa thành công."
        onClose={() => setShowDeleteSuccess(false)}
      />
    </SafeAreaView>
  );
}
