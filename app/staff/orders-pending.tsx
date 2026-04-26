import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ClipboardList,
  FileText,
  Hospital,
  Search,
  X,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
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

import { InvoiceModal, RejectOrderModal } from '@/components/modals';
import { useAuth } from '@/contexts/AuthContext';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { fetchPendingApprovalOrders } from '@/lib/orders-pending';
import type { OrderResponse } from '@/services/orderService';
import { orderService } from '@/services/orderService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';

const formatCurrency = (amount?: number) =>
  new Intl.NumberFormat('vi-VN').format(amount ?? 0);

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('vi-VN');
  } catch {
    return dateString;
  }
};

const statusLabel = (s?: string) => {
  const x = (s || '').toLowerCase();
  if (x === 'forward_analysis') return 'Chuyển tiếp phân tích';
  if (x === 'sample_addition') return 'Bổ sung mẫu';
  return s || '—';
};

export default function OrdersPendingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [invoiceOrder, setInvoiceOrder] = useState<{ id: string; invoiceLink: string | null } | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<OrderResponse | null>(null);

  const canStaff = user?.role === 'ROLE_STAFF' || user?.role === 'ROLE_ADMIN';

  const {
    data: orders = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['orders-pending', 'forward_analysis', 'sample_addition'],
    queryFn: fetchPendingApprovalOrders,
    retry: false,
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ order, reason }: { order: OrderResponse; reason: string }) => {
      const specifyId = (order.specifyId as any)?.specifyVoteID || (order.specifyId as any)?.specifyVoteId;
      await orderService.reject(order.orderId, reason);
      if (specifyId) await specifyVoteTestService.reject(specifyId, reason);
    },
    onSuccess: () => {
      setRejectingOrder(null);
      queryClient.invalidateQueries({ queryKey: ['orders-pending'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      presentFeedbackSuccess({ title: 'Thành công', message: 'Đã từ chối đơn hàng' });
    },
    onError: (err: any) =>
      presentFeedbackError({ title: 'Lỗi', message: err?.message || 'Từ chối thất bại' }),
  });

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o => {
      const spec = o.specifyId as any;
      return (
        String(o.orderId || '')
          .toLowerCase()
          .includes(q) ||
        String(o.orderName || '')
          .toLowerCase()
          .includes(q) ||
        String(spec?.hospital?.hospitalName || '')
          .toLowerCase()
          .includes(q) ||
        String(spec?.genomeTest?.testName || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [orders, searchQuery]);

  const goApprove = (orderId: string) => {
    router.push({
      pathname: '/staff/update-order',
      params: { orderId, approval: '1' },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0284C7" />
          <Text className="mt-3 text-slate-600 text-sm font-bold">Đang tải đơn chờ duyệt…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-sky-50 px-4" edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-center mt-8 text-slate-700 font-bold">Không tải được danh sách</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 self-center bg-sky-600 px-6 py-3 rounded-2xl"
          activeOpacity={0.85}
        >
          <Text className="text-white font-extrabold">Thử lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen options={{ headerShown: false }} />

      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#0284C7" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">Đơn hàng chờ duyệt</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              chuyển tiếp phân tích
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm mã đơn, tên, cơ sở, xét nghiệm…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {!!searchQuery.trim() && (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="w-9 h-9 rounded-xl items-center justify-center">
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} colors={['#0284C7']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View className="items-center pt-16 px-6">
            <ClipboardList size={40} color="#0284C7" />
            <Text className="mt-4 text-base font-extrabold text-slate-900 text-center">
              Không có đơn chờ duyệt
            </Text>
            <Text className="mt-2 text-xs font-bold text-slate-500 text-center leading-5">
              Khi khách chuyển tiếp phân tích hoặc có mẫu bổ sung, đơn sẽ hiện ở đây để bạn phê duyệt và bổ sung
              barcode, nhân viên…
            </Text>
          </View>
        ) : (
          filtered.map(order => {
            const spec = order.specifyId as any;
            const inv = order.invoiceLink;
            return (
              <View
                key={order.orderId}
                className="bg-white rounded-2xl p-4 mb-3 border border-sky-100 shadow-sm shadow-sky-900/5"
              >
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 min-w-0">
                    <Text className="text-xs font-extrabold text-sky-700" numberOfLines={1}>
                      {order.orderId}
                    </Text>
                    <Text className="mt-1 text-[15px] font-extrabold text-slate-900" numberOfLines={2}>
                      {order.orderName || '—'}
                    </Text>
                    <View className="mt-2 flex-row flex-wrap gap-x-2 gap-y-1">
                      <View className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 self-start">
                        <Text className="text-[10px] font-extrabold text-amber-800">
                          {statusLabel(order.orderStatus)}
                        </Text>
                      </View>
                      <Text className="text-xs font-bold text-slate-600">
                        {formatCurrency(order.paymentAmount)} đ
                      </Text>
                      <Text className="text-xs font-bold text-slate-400">• {formatDate(order.createdAt)}</Text>
                    </View>
                    {spec?.hospital?.hospitalName ? (
                      <View className="mt-2 flex-row items-start gap-2">
                        <Hospital size={14} color="#64748B" style={{ marginTop: 2 }} />
                        <Text className="text-xs font-semibold text-slate-600 flex-1" numberOfLines={2}>
                          {spec.hospital.hospitalName}
                        </Text>
                      </View>
                    ) : null}
                    {spec?.genomeTest?.testName ? (
                      <Text className="mt-1 text-xs font-bold text-slate-700" numberOfLines={2}>
                        {spec.genomeTest.testName}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View className="mt-4 flex-row flex-wrap gap-2 justify-end">
                  {inv ? (
                    <TouchableOpacity
                      onPress={() => setInvoiceOrder({ id: order.orderId, invoiceLink: inv })}
                      className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 border border-sky-200"
                      activeOpacity={0.85}
                    >
                      <FileText size={16} color="#0284C7" />
                      <Text className="text-xs font-extrabold text-sky-800">Hóa đơn</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() =>
                      router.push({ pathname: '/staff/order-detail', params: { orderId: order.orderId } })
                    }
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                    activeOpacity={0.85}
                  >
                    <Text className="text-xs font-extrabold text-slate-800">Chi tiết</Text>
                  </TouchableOpacity>
                  {canStaff && (
                    <>
                      <TouchableOpacity
                        onPress={() => setRejectingOrder(order)}
                        disabled={rejectMutation.isPending}
                        className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200"
                        activeOpacity={0.85}
                      >
                        {rejectMutation.isPending ? (
                          <ActivityIndicator size="small" color="#E11D48" />
                        ) : (
                          <Ban size={16} color="#E11D48" />
                        )}
                        <Text className="text-xs font-extrabold text-rose-800">Từ chối</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => goApprove(order.orderId)}
                        className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 border border-emerald-700"
                        activeOpacity={0.85}
                      >
                        <CheckCircle2 size={16} color="#FFFFFF" />
                        <Text className="text-xs font-extrabold text-white">Phê duyệt</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <InvoiceModal
        visible={!!invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
        invoiceLink={invoiceOrder?.invoiceLink ?? null}
        orderId={invoiceOrder?.id ?? ''}
      />
      <RejectOrderModal
        visible={!!rejectingOrder}
        onClose={() => setRejectingOrder(null)}
        onConfirm={reason => {
          if (rejectingOrder) rejectMutation.mutate({ order: rejectingOrder, reason });
        }}
        isLoading={rejectMutation.isPending}
      />
    </SafeAreaView>
  );
}
