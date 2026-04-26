import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  FlaskConical,
  ReceiptText,
  XCircle
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { MEDICAL } from '@/lib/theme/medical';
import { getApiResponseData, getApiResponseSingle } from '@/lib/types/api-types';
import {
  customerStatisticsService,
  type CustomerPaymentHistoryResponse,
  type CustomerStatisticsResponse,
} from '@/services/customerStatisticsService';

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(amount);
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Card = ({
  children,
  className = '',
  accentClass,
}: {
  children: React.ReactNode;
  className?: string;
  accentClass?: string;
}) => (
  <View
    className={`rounded-2xl border border-sky-100/90 bg-white shadow-sm shadow-sky-900/10 overflow-hidden ${className}`}
  >
    {accentClass ? <View className={`absolute left-0 top-0 bottom-0 w-1 ${accentClass}`} /> : null}
    <View className={accentClass ? 'pl-1' : ''}>{children}</View>
  </View>
);

const SectionHeader = ({
  title,
  right,
  kicker,
}: {
  title: string;
  right?: React.ReactNode;
  kicker?: string;
}) => (
  <View className="mb-3 mt-1 flex-row items-end justify-between">
    <View className="flex-1 min-w-0 pr-2">
      {kicker ? (
        <Text className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-500">
          {kicker}
        </Text>
      ) : null}
      <Text className="text-[17px] font-extrabold text-slate-900">{title}</Text>
    </View>
    {right}
  </View>
);

const Chip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    className={`rounded-full border px-3.5 py-2 ${active ? 'border-sky-600 bg-sky-600' : 'border-sky-200/80 bg-white'
      }`}
  >
    <Text className={`text-xs font-extrabold ${active ? 'text-white' : 'text-slate-600'}`}>
      {label}
    </Text>
  </TouchableOpacity>
);

const PaymentStatusBadge = ({ status }: { status: string | null }) => {
  const config: Record<string, { label: string; className: string; text: string }> = {
    COMPLETED: {
      label: 'Hoàn thành',
      className: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-800',
    },
    PENDING: {
      label: 'Đang chờ',
      className: 'bg-amber-50 border-amber-200',
      text: 'text-amber-800',
    },
    FAILED: { label: 'Thất bại', className: 'bg-red-50 border-red-200', text: 'text-red-800' },
    UNPAID: { label: 'Chưa TT', className: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
  };
  const c =
    status && config[status]
      ? config[status]
      : {
        label: status || '—',
        text: 'text-slate-700',
        className: 'bg-slate-50 border-slate-200',
      };

  return (
    <View className={`rounded-full border px-2.5 py-1 ${c.className}`}>
      <Text className={`text-[10px] font-extrabold ${c.text}`}>{c.label}</Text>
    </View>
  );
};

const PaymentTypeBadge = ({ type }: { type: string | null }) => {
  const config: Record<string, { label: string; className: string; text: string }> = {
    CASH: { label: 'Tiền mặt', className: 'bg-sky-50 border-sky-200', text: 'text-sky-800' },
    ONLINE_PAYMENT: {
      label: 'Chuyển khoản',
      className: 'bg-violet-50 border-violet-200',
      text: 'text-violet-800',
    },
  };
  const c =
    type && config[type]
      ? config[type]
      : { label: type || '—', className: 'bg-slate-50 border-slate-200', text: 'text-slate-700' };

  return (
    <View className={`rounded-full border px-2.5 py-1 ${c.className}`}>
      <Text className={`text-[10px] font-extrabold ${c.text}`}>{c.label}</Text>
    </View>
  );
};

function ProgressRow({
  label,
  count,
  total,
  dotClass,
  barClass,
}: {
  label: string;
  count: number;
  total: number;
  dotClass: string;
  barClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className={`h-2 w-2 rounded-full ${dotClass}`} />
          <Text className="text-sm font-bold text-slate-800">{label}</Text>
          <Text className="text-xs font-bold text-slate-400">({count})</Text>
        </View>
        <Text className="text-sm font-extrabold text-slate-900">{pct}%</Text>
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-sky-100">
        <View className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

export default function CustomerStatisticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const hospitalId = user?.hospitalId != null ? Number(user.hospitalId) : undefined;
  const hospitalLabel =
    user?.hospitalName?.trim() && user.hospitalName !== 'Trống'
      ? user.hospitalName
      : hospitalId != null
        ? `Mã BV ${hospitalId}`
        : 'Theo tài khoản của bạn';

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const {
    data: statsRes,
    isLoading: loadingStats,
    refetch: refetchStats,
    isFetching: fetchingStats,
  } = useQuery({
    queryKey: ['customer-statistics', selectedYear, hospitalId],
    queryFn: () => customerStatisticsService.getStatistics(selectedYear, hospitalId),
    enabled: true,
  });

  const {
    data: paymentsRes,
    isLoading: loadingPayments,
    refetch: refetchPayments,
    isFetching: fetchingPayments,
  } = useQuery({
    queryKey: ['customer-payment-history', selectedYear, currentPage, hospitalId],
    queryFn: () =>
      customerStatisticsService.getPaymentHistory({
        year: selectedYear,
        page: currentPage - 1,
        size: pageSize,
        hospitalId,
      }),
    enabled: true,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear]);

  const statistics = useMemo(
    () => getApiResponseSingle<CustomerStatisticsResponse>(statsRes),
    [statsRes]
  );
  const paymentHistory = useMemo(
    () => getApiResponseData<CustomerPaymentHistoryResponse>(paymentsRes) || [],
    [paymentsRes]
  );

  const yearOptions = useMemo(() => {
    const years = statistics?.availableYears || [];
    const current = new Date().getFullYear();
    const set = new Set([current, ...years]);
    return Array.from(set).sort((a, b) => b - a);
  }, [statistics?.availableYears]);

  const statsCards = useMemo(() => {
    const oc = statistics?.orderStatusCount;
    const base = {
      total: String(oc?.totalCount ?? 0),
      pending: String(oc?.pendingCount ?? 0),
      completed: String(oc?.completedCount ?? 0),
      rejected: String(oc?.rejectedCount ?? 0),
    };
    return [
      { name: 'Tổng đơn', value: base.total, icon: FileText, accent: 'bg-sky-500', iconBg: 'bg-sky-100' },
      { name: 'Đang xử lý', value: base.pending, icon: Clock, accent: 'bg-amber-500', iconBg: 'bg-amber-100' },
      {
        name: 'Hoàn thành',
        value: base.completed,
        icon: CheckCircle2,
        accent: 'bg-emerald-500',
        iconBg: 'bg-emerald-100',
      },
      { name: 'Từ chối / Hủy', value: base.rejected, icon: XCircle, accent: 'bg-rose-500', iconBg: 'bg-rose-100' },
    ];
  }, [statistics?.orderStatusCount]);

  const serviceUsages = statistics?.serviceUsages ?? [];
  const hasMorePayments = paymentHistory.length >= pageSize;

  const handleRefresh = () => {
    refetchStats();
    refetchPayments();
  };

  const isLoading = loadingStats || loadingPayments;
  const isFetching = fetchingStats || fetchingPayments;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={MEDICAL.primary} />
        <Text className="mt-3 text-sm font-bold text-sky-800">Đang tải dữ liệu…</Text>
      </View>
    );
  }

  const total = statistics?.orderStatusCount?.totalCount ?? 0;
  const completed = statistics?.orderStatusCount?.completedCount ?? 0;
  const pending = statistics?.orderStatusCount?.pendingCount ?? 0;
  const rejected = statistics?.orderStatusCount?.rejectedCount ?? 0;
  const donePct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <View className="border-b border-sky-100 bg-white">
        <View className="flex-row items-center px-4 pb-3 pt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 h-11 w-11 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50"
            activeOpacity={0.85}
          >
            <ArrowLeft size={20} color={MEDICAL.primary} />
          </TouchableOpacity>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg font-extrabold text-slate-900">Thống kê</Text>
            </View>
          </View>
        </View>

        <LinearGradient
          colors={['#e0f2fe', '#f0f9ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}
        >
          <Text className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-sky-600">
            Năm xem báo cáo
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row flex-wrap gap-2">
              {yearOptions.map(y => (
                <Chip
                  key={y}
                  label={String(y)}
                  active={selectedYear === y}
                  onPress={() => setSelectedYear(y)}
                />
              ))}
            </View>
          </ScrollView>
        </LinearGradient>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={handleRefresh} tintColor={MEDICAL.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {total > 0 ? (
          <View className="mb-5 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm shadow-sky-900/10">
            <LinearGradient
              colors={[MEDICAL.primary, MEDICAL.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: 4, width: `${donePct}%` }}
            />
            <View className="flex-row items-center justify-between px-4 py-3.5">
              <View>
                <Text className="text-xs font-bold text-slate-500">Tiến độ hoàn thành · {selectedYear}</Text>
                <Text className="mt-0.5 text-2xl font-extrabold text-slate-900">
                  {completed}
                  <Text className="text-base font-bold text-slate-400"> / {total}</Text>
                  <Text className="text-sm font-semibold text-slate-500"> đơn</Text>
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-3xl font-extrabold text-sky-600">{donePct}%</Text>
                <Text className="text-[10px] font-bold text-sky-500">đạt</Text>
              </View>
            </View>
          </View>
        ) : null}

        <SectionHeader title="Chỉ số nhanh" kicker="Tổng quan" />
        <View className="mb-5 flex-row flex-wrap gap-3">
          {statsCards.map(stat => {
            const Icon = stat.icon;
            return (
              <View key={stat.name} className="w-[48.5%]">
                <Card accentClass={stat.accent} className="p-4">
                  <View className="pl-3">
                    <View className="flex-row items-center justify-between">
                      <View className="min-w-0 flex-1 pr-2">
                        <Text className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                          {stat.name}
                        </Text>
                        <Text className="mt-1 text-2xl font-extrabold text-slate-900">{stat.value}</Text>
                      </View>
                      <View className={`rounded-2xl p-2.5 ${stat.iconBg}`}>
                        <Icon size={22} color={MEDICAL.primaryDark} />
                      </View>
                    </View>
                  </View>
                </Card>
              </View>
            );
          })}
        </View>

        <SectionHeader title="Dịch vụ nổi bật" kicker="Sử dụng nhiều" />
        <Card className="mb-5 p-4">
          {statistics?.mostUsedService?.orderCount ? (
            <View className="flex-row items-center justify-between rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4">
              <View className="min-w-0 flex-1 pr-3">
                <Text className="text-xs font-bold text-sky-600">Top dịch vụ</Text>
                <Text className="mt-1 font-extrabold text-slate-900" numberOfLines={2}>
                  {statistics.mostUsedService.serviceName}
                </Text>
                {!!statistics.mostUsedService.serviceId && (
                  <Text className="mt-1 text-[11px] font-semibold text-slate-500">
                    Mã {statistics.mostUsedService.serviceId}
                  </Text>
                )}
              </View>
              <View className="items-end rounded-2xl bg-white px-3 py-2 shadow-sm shadow-sky-200">
                <Text className="text-2xl font-extrabold text-sky-700">
                  {statistics.mostUsedService.orderCount}
                </Text>
                <Text className="text-[10px] font-bold text-sky-500">đơn</Text>
              </View>
            </View>
          ) : (
            <View className="items-center py-10">
              <FlaskConical size={36} color="#94a3b8" />
              <Text className="mt-2 font-semibold text-slate-500">Chưa có dữ liệu dịch vụ</Text>
            </View>
          )}
        </Card>

        {serviceUsages.length > 0 ? (
          <>
            <SectionHeader title="Theo từng dịch vụ" kicker="Chi tiết" />
            <Card className="mb-5 p-2">
              {serviceUsages.map((svc, idx) => (
                <View
                  key={svc.serviceId ?? idx}
                  className="flex-row items-center justify-between border-b border-sky-50 px-3 py-3 last:border-b-0"
                >
                  <View className="min-w-0 flex-1 flex-row items-center pr-3">
                    <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50">
                      <Text className="text-xs font-extrabold text-sky-800">{idx + 1}</Text>
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-extrabold text-slate-900" numberOfLines={1}>
                        {svc.serviceName}
                      </Text>
                      {!!svc.serviceId && (
                        <Text className="mt-0.5 text-[11px] font-semibold text-slate-500">
                          Mã {svc.serviceId}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5">
                    <Text className="text-sm font-extrabold text-sky-800">{svc.orderCount}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {total > 0 ? (
          <>
            <SectionHeader title={`Trạng thái đơn · ${selectedYear}`} kicker="Phân bổ" />
            <Card className="mb-5 p-4">
              <View className="gap-4">
                <ProgressRow
                  label="Hoàn thành"
                  count={completed}
                  total={total}
                  dotClass="bg-emerald-500"
                  barClass="bg-emerald-500"
                />
                <ProgressRow
                  label="Đang xử lý"
                  count={pending}
                  total={total}
                  dotClass="bg-amber-500"
                  barClass="bg-amber-500"
                />
                <ProgressRow
                  label="Từ chối / Hủy"
                  count={rejected}
                  total={total}
                  dotClass="bg-rose-500"
                  barClass="bg-rose-500"
                />
              </View>
            </Card>
          </>
        ) : null}

        <SectionHeader
          title="Lịch sử thanh toán"
          kicker="Theo năm"
          right={
            <View className="flex-row items-center gap-1.5 rounded-full border border-sky-200 bg-white px-2.5 py-1">
              <ReceiptText size={14} color={MEDICAL.primary} />
              <Text className="text-[11px] font-extrabold text-sky-800">{selectedYear}</Text>
            </View>
          }
        />

        <Card className="mb-2 overflow-hidden">
          {paymentHistory.length === 0 ? (
            <View className="items-center py-12">
              <FileText size={40} color="#94a3b8" />
              <Text className="mt-3 font-semibold text-slate-500">Chưa có lịch sử thanh toán</Text>
            </View>
          ) : (
            <>
              {paymentHistory.map(p => (
                <View key={p.paymentId} className="border-b border-sky-50 px-3 py-3 last:border-b-0">
                  <View className="rounded-2xl border border-sky-100/80 bg-sky-50/40 p-3">
                    <View className="flex-row items-start gap-3">
                      <View className="h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-white">
                        <CreditCard size={18} color={MEDICAL.primary} />
                      </View>
                      <View className="min-w-0 flex-1">
                        <View className="flex-row items-start justify-between gap-2">
                          <View className="min-w-0 flex-1">
                            <Text className="text-[11px] font-extrabold text-slate-500">Đơn hàng</Text>
                            <Text className="font-mono text-sm font-extrabold text-slate-900">
                              {p.orderId || '—'}
                            </Text>
                            <Text
                              className="mt-1 text-sm font-semibold leading-snug text-slate-700"
                              numberOfLines={2}
                            >
                              {p.orderName || '—'}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-right text-lg font-extrabold text-sky-700">
                              {formatCurrency(p.paymentAmount)}
                            </Text>
                            <Text className="text-[10px] font-bold text-slate-400">VNĐ</Text>
                          </View>
                        </View>
                        <View className="mt-3 flex-row flex-wrap gap-2">
                          <PaymentStatusBadge status={p.paymentStatus} />
                          <PaymentTypeBadge type={p.paymentType} />
                        </View>
                        <Text className="mt-2 text-[11px] font-semibold text-slate-500">
                          {formatDate(p.transactionDate)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              {(currentPage > 1 || hasMorePayments) && (
                <View className="flex-row items-center justify-between border-t border-sky-100 bg-white px-4 py-3">
                  <Text className="text-sm font-bold text-slate-500">Trang {currentPage}</Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setCurrentPage(pp => Math.max(1, pp - 1))}
                      disabled={currentPage === 1}
                      className={`h-10 w-10 items-center justify-center rounded-xl border ${currentPage === 1
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-sky-200 bg-sky-50'
                        }`}
                    >
                      <ChevronLeft size={18} color={currentPage === 1 ? '#94a3b8' : MEDICAL.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setCurrentPage(pp => pp + 1)}
                      disabled={!hasMorePayments}
                      className={`h-10 w-10 items-center justify-center rounded-xl border ${!hasMorePayments ? 'border-slate-200 bg-slate-50' : 'border-sky-200 bg-sky-50'
                        }`}
                    >
                      <ChevronRight size={18} color={!hasMorePayments ? '#94a3b8' : MEDICAL.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
