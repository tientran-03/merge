import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaginationControls } from '@/components/PaginationControls';
import { useAuth } from '@/contexts/AuthContext';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { OrderResponse, orderService } from '@/services/orderService';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

const formatCurrency = (amount: number): string => new Intl.NumberFormat('vi-VN').format(amount);

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('vi-VN');
  } catch {
    return dateString;
  }
};

// Map backend status to display label
const getStatusLabel = (status: string): string => {
  const s = (status || '').toLowerCase();
  const statusMap: Record<string, string> = {
    initiation: 'Khởi tạo',
    forward_analysis: 'Chờ duyệt',
    accepted: 'Đã chấp nhận',
    rejected: 'Từ chối',
    in_progress: 'Đang phân tích',
    sample_error: 'Lỗi mẫu',
    rerun_testing: 'Chạy lại',
    completed: 'Hoàn thành',
    sample_addition: 'Mẫu bổ sung',
    awaiting_results_approval: 'Chờ duyệt kết quả',
    results_approved: 'Đã duyệt kết quả',
    result_approved: 'Đã duyệt kết quả',
    canceled: 'Đã hủy',
  };
  return statusMap[s] || status;
};

// Get status badge colors
const getStatusBadge = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'results_approved' || s === 'result_approved') {
    return {
      label: getStatusLabel(status),
      bg: 'bg-emerald-50',
      fg: 'text-emerald-700',
      bd: 'border-emerald-200',
    };
  }
  if (s === 'rejected' || s === 'canceled') {
    return {
      label: getStatusLabel(status),
      bg: 'bg-red-50',
      fg: 'text-red-700',
      bd: 'border-red-200',
    };
  }
  if (s === 'in_progress' || s === 'accepted') {
    return {
      label: getStatusLabel(status),
      bg: 'bg-blue-50',
      fg: 'text-blue-700',
      bd: 'border-blue-200',
    };
  }
  if (s === 'forward_analysis' || s === 'sample_addition' || s === 'awaiting_results_approval') {
    return {
      label: getStatusLabel(status),
      bg: 'bg-orange-50',
      fg: 'text-orange-700',
      bd: 'border-orange-200',
    };
  }
  if (s === 'sample_error' || s === 'rerun_testing') {
    return {
      label: getStatusLabel(status),
      bg: 'bg-yellow-50',
      fg: 'text-yellow-700',
      bd: 'border-yellow-200',
    };
  }
  return {
    label: getStatusLabel(status),
    bg: 'bg-slate-50',
    fg: 'text-slate-700',
    bd: 'border-slate-200',
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
  return {
    label: 'Chưa thanh toán',
    bg: 'bg-orange-50',
    fg: 'text-orange-700',
    bd: 'border-orange-200',
  };
};

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className={`px-3 py-2 rounded-full border ${
        active ? 'bg-sky-600 border-sky-600' : 'bg-white border-sky-100'
      }`}
    >
      <Text className={`text-xs font-extrabold ${active ? 'text-white' : 'text-slate-600'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Tất cả hooks phải được gọi trước khi có early return
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hospitalFilter, setHospitalFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Fetch all orders with pagination
  const {
    data: ordersData,
    isLoading,
    error,
    refetch,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<OrderResponse>({
    queryKey: ['admin-orders', statusFilter, timeFilter],
    queryFn: async params => await orderService.getAll(params),
    defaultPageSize: 20,
    enabled: user?.role === 'ROLE_ADMIN', // Chỉ fetch khi là admin
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      orderService.updateStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowStatusModal(false);
      setSelectedOrder(null);
      Alert.alert('Thành công', 'Cập nhật trạng thái đơn hàng thành công');
    },
    onError: (error: any) => {
      Alert.alert('Lỗi', error?.message || 'Không thể cập nhật trạng thái đơn hàng');
    },
  });

  // Guard: Chỉ ADMIN mới được vào - đặt sau tất cả hooks
  if (user?.role !== 'ROLE_ADMIN') {
    return null;
  }

  const orders = useMemo(() => {
    return ordersData;
  }, [ordersData]);

  // Get unique hospitals for filter
  const hospitals = useMemo(() => {
    const hospitalSet = new Set<string>();
    orders.forEach(order => {
      const hospitalName = order.specifyId?.hospital?.hospitalName;
      if (hospitalName) hospitalSet.add(hospitalName);
    });
    return Array.from(hospitalSet).sort();
  }, [orders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        String(order.orderId || '')
          .toLowerCase()
          .includes(q) ||
        String(order.orderName || '')
          .toLowerCase()
          .includes(q) ||
        String(order.customerName || '')
          .toLowerCase()
          .includes(q) ||
        String(order.specifyId?.hospital?.hospitalName || '')
          .toLowerCase()
          .includes(q) ||
        String(order.specifyId?.genomeTest?.testName || '')
          .toLowerCase()
          .includes(q);

      // Status filter
      const matchesStatus =
        statusFilter === 'all' || order.orderStatus?.toLowerCase() === statusFilter.toLowerCase();

      // Hospital filter
      const matchesHospital =
        hospitalFilter === 'all' || order.specifyId?.hospital?.hospitalName === hospitalFilter;

      // Time filter
      let matchesTime = true;
      if (order.createdAt) {
        const now = new Date();
        const orderDate = new Date(order.createdAt);
        if (timeFilter === 'today') {
          matchesTime = orderDate.toDateString() === now.toDateString();
        } else if (timeFilter === 'week') {
          matchesTime = orderDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (timeFilter === 'month') {
          matchesTime = orderDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
      }

      return matchesSearch && matchesStatus && matchesHospital && matchesTime;
    });
  }, [orders, searchQuery, statusFilter, hospitalFilter, timeFilter]);

  // Group orders by date
  const groupedOrders = useMemo(() => {
    const groups: Record<string, OrderResponse[]> = {};
    filteredOrders.forEach(order => {
      const date = formatDate(order.createdAt);
      if (!groups[date]) groups[date] = [];
      groups[date].push(order);
    });
    return groups;
  }, [filteredOrders]);

  // Available statuses for update
  const availableStatuses = [
    { value: 'accepted', label: 'Đã chấp nhận', icon: CheckCircle2 },
    { value: 'in_progress', label: 'Đang phân tích', icon: Clock },
    { value: 'completed', label: 'Hoàn thành', icon: CheckCircle2 },
    { value: 'rejected', label: 'Từ chối', icon: XCircle },
    { value: 'sample_error', label: 'Lỗi mẫu', icon: AlertCircle },
    { value: 'rerun_testing', label: 'Chạy lại', icon: Clock },
  ];

  const handleUpdateStatus = (order: OrderResponse, newStatus: string) => {
    setSelectedOrder(order);
    setShowStatusModal(true);
  };

  const handleStatusSelect = (newStatus: string) => {
    if (!selectedOrder) return;
    updateStatusMutation.mutate({
      orderId: selectedOrder.orderId,
      status: newStatus,
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-slate-900 text-center mb-2">
            Không tải được dữ liệu
          </Text>
          <Text className="text-xs text-slate-500 text-center mb-4">
            Vui lòng kiểm tra kết nối mạng và thử lại.
          </Text>
          <TouchableOpacity
            className="bg-sky-600 py-3 rounded-2xl items-center"
            onPress={() => refetch()}
            activeOpacity={0.85}
          >
            <Text className="text-white text-sm font-extrabold">Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const dayKeys = Object.keys(groupedOrders).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (hospitalFilter !== 'all') count++;
    if (timeFilter !== 'all') count++;
    return count;
  }, [statusFilter, hospitalFilter, timeFilter]);

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen
        options={{
          title: 'Quản lý đơn hàng',
          headerStyle: { backgroundColor: '#0891b2' },
          headerTintColor: '#fff',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.push('/admin')}
              className="ml-2"
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Header với search và filter */}
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center mb-3">
          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">Quản lý đơn hàng</Text>
            <Text className="mt-0.5 text-xs text-slate-500">{filteredOrders.length} đơn hàng</Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowFilters(v => !v)}
            className={`w-10 h-10 rounded-xl border items-center justify-center relative ${
              showFilters ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-200'
            }`}
            activeOpacity={0.85}
          >
            <SlidersHorizontal size={18} color={showFilters ? '#FFFFFF' : '#0284C7'} />
            {activeFilterCount > 0 && (
              <View className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white items-center justify-center">
                <Text className="text-[10px] font-bold text-white">{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View className="flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm theo mã / tên đơn / bệnh viện..."
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
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter panel */}
        {showFilters && (
          <View className="mt-3">
            {/* Time filter */}
            <View className="mb-3">
              <View className="flex-row items-center mb-2">
                <Calendar size={16} color="#0284C7" />
                <Text className="ml-2 text-xs font-extrabold text-slate-700">Thời gian</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <FilterPill
                  label="Hôm nay"
                  active={timeFilter === 'today'}
                  onPress={() => setTimeFilter('today')}
                />
                <FilterPill
                  label="Tuần này"
                  active={timeFilter === 'week'}
                  onPress={() => setTimeFilter('week')}
                />
                <FilterPill
                  label="Tháng này"
                  active={timeFilter === 'month'}
                  onPress={() => setTimeFilter('month')}
                />
                <FilterPill
                  label="Tất cả"
                  active={timeFilter === 'all'}
                  onPress={() => setTimeFilter('all')}
                />
              </View>
            </View>

            {/* Status filter */}
            <View className="mb-3">
              <View className="flex-row items-center mb-2">
                <Filter size={16} color="#0284C7" />
                <Text className="ml-2 text-xs font-extrabold text-slate-700">Trạng thái</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <FilterPill
                  label="Tất cả"
                  active={statusFilter === 'all'}
                  onPress={() => setStatusFilter('all')}
                />
                <FilterPill
                  label="Khởi tạo"
                  active={statusFilter === 'initiation'}
                  onPress={() => setStatusFilter('initiation')}
                />
                <FilterPill
                  label="Chờ duyệt"
                  active={statusFilter === 'forward_analysis'}
                  onPress={() => setStatusFilter('forward_analysis')}
                />
                <FilterPill
                  label="Đang xử lý"
                  active={statusFilter === 'in_progress'}
                  onPress={() => setStatusFilter('in_progress')}
                />
                <FilterPill
                  label="Hoàn thành"
                  active={statusFilter === 'completed'}
                  onPress={() => setStatusFilter('completed')}
                />
                <FilterPill
                  label="Từ chối"
                  active={statusFilter === 'rejected'}
                  onPress={() => setStatusFilter('rejected')}
                />
              </View>
            </View>

            {/* Hospital filter */}
            {hospitals.length > 0 && (
              <View className="mb-3">
                <View className="flex-row items-center mb-2">
                  <Text className="text-xs font-extrabold text-slate-700">Bệnh viện</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="flex-row gap-2"
                >
                  <FilterPill
                    label="Tất cả"
                    active={hospitalFilter === 'all'}
                    onPress={() => setHospitalFilter('all')}
                  />
                  {hospitals.map(hospital => (
                    <FilterPill
                      key={hospital}
                      label={hospital}
                      active={hospitalFilter === hospital}
                      onPress={() => setHospitalFilter(hospital)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Orders list */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
      >
        {dayKeys.length === 0 ? (
          <View className="pt-12 items-center px-6">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 items-center justify-center border border-sky-200">
              <Search size={24} color="#0284C7" />
            </View>
            <Text className="mt-4 text-base font-extrabold text-slate-900">Không có đơn hàng</Text>
            <Text className="mt-2 text-xs font-bold text-slate-500 text-center">
              Thử đổi bộ lọc hoặc từ khóa tìm kiếm.
            </Text>
          </View>
        ) : (
          dayKeys.map(date => (
            <View key={date} className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-[15px] font-extrabold text-slate-900">{date}</Text>
                <View className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200">
                  <Text className="text-xs font-extrabold text-sky-700">
                    {groupedOrders[date].length}
                  </Text>
                </View>
              </View>

              {groupedOrders[date].map(order => {
                const statusBadge = getStatusBadge(order.orderStatus || '');
                const paymentMeta = getPaymentStatusMeta(order.paymentStatus);

                return (
                  <TouchableOpacity
                    key={order.orderId}
                    className="bg-white rounded-2xl p-4 mb-3 border border-sky-100"
                    onPress={() =>
                      router.push({
                        pathname: '/order-detail',
                        params: { orderId: order.orderId },
                      })
                    }
                    activeOpacity={0.85}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-extrabold text-sky-700" numberOfLines={1}>
                          {order.orderId}
                        </Text>
                        <Text
                          className="text-[10px] font-bold text-slate-500 mt-0.5"
                          numberOfLines={1}
                        >
                          {formatDate(order.createdAt)}
                        </Text>
                      </View>

                      <View
                        className={`px-2.5 py-1 rounded-full border ${statusBadge.bg} ${statusBadge.bd}`}
                      >
                        <Text className={`text-xs font-extrabold ${statusBadge.fg}`}>
                          {statusBadge.label}
                        </Text>
                      </View>
                    </View>

                    <Text
                      className="mt-2 text-[14px] font-extrabold text-slate-900"
                      numberOfLines={2}
                    >
                      {order.orderName}
                    </Text>

                    <View className="mt-2 flex-row items-center flex-wrap">
                      {order.paymentAmount && (
                        <>
                          <Text className="text-sm font-extrabold text-slate-900">
                            {formatCurrency(order.paymentAmount)} VND
                          </Text>
                          <Text className="mx-2 text-slate-300">•</Text>
                        </>
                      )}

                      {order.specifyId?.hospital?.hospitalName && (
                        <>
                          <Text className="text-xs font-bold text-slate-600" numberOfLines={1}>
                            {order.specifyId.hospital.hospitalName}
                          </Text>
                          <Text className="mx-2 text-slate-300">•</Text>
                        </>
                      )}

                      <View
                        className={`px-2 py-0.5 rounded-full border ${paymentMeta.bg} ${paymentMeta.bd}`}
                      >
                        <Text className={`text-[10px] font-extrabold ${paymentMeta.fg}`}>
                          {paymentMeta.label}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-xs font-bold text-slate-500" numberOfLines={1}>
                        {order.customerName || order.specifyId?.patient?.patientName || ''}
                      </Text>

                      <View className="flex-row gap-2">
                        {/* Update status button for admin */}
                        <TouchableOpacity
                          className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 items-center justify-center"
                          onPress={e => {
                            e.stopPropagation();
                            handleUpdateStatus(order, order.orderStatus || '');
                          }}
                          activeOpacity={0.85}
                        >
                          <Filter size={16} color="#2563EB" />
                        </TouchableOpacity>

                        <View className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center">
                          <ChevronRight size={18} color="#0284C7" />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          pageSize={pageSize}
          totalElements={totalElements}
          isLoading={isLoading}
        />
      )}

      {/* Status update modal */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!updateStatusMutation.isPending) {
            setShowStatusModal(false);
            setSelectedOrder(null);
          }
        }}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center px-4"
          activeOpacity={1}
          onPress={() => {
            if (!updateStatusMutation.isPending) {
              setShowStatusModal(false);
              setSelectedOrder(null);
            }
          }}
        >
          <TouchableOpacity
            className="bg-white rounded-3xl p-6 w-full max-w-[400px]"
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
          >
            <Text className="text-lg font-extrabold text-slate-900 mb-2">Cập nhật trạng thái</Text>
            <Text className="text-sm text-slate-600 mb-4" numberOfLines={2}>
              Đơn hàng: {selectedOrder?.orderName || selectedOrder?.orderId}
            </Text>
            <Text className="text-xs text-slate-500 mb-4">
              Trạng thái hiện tại: {getStatusLabel(selectedOrder?.orderStatus || '')}
            </Text>

            <ScrollView className="max-h-64 mb-4" showsVerticalScrollIndicator={false}>
              {availableStatuses.map(status => {
                const Icon = status.icon;
                const isCurrent =
                  selectedOrder?.orderStatus?.toLowerCase() === status.value.toLowerCase();
                return (
                  <TouchableOpacity
                    key={status.value}
                    className={`flex-row items-center p-3 rounded-xl mb-2 border ${
                      isCurrent ? 'bg-sky-50 border-sky-300' : 'bg-white border-slate-200'
                    }`}
                    onPress={() => {
                      if (!isCurrent && !updateStatusMutation.isPending) {
                        handleStatusSelect(status.value);
                      }
                    }}
                    disabled={isCurrent || updateStatusMutation.isPending}
                    activeOpacity={0.7}
                  >
                    <Icon size={20} color={isCurrent ? '#0284C7' : '#64748B'} />
                    <Text
                      className={`ml-3 flex-1 text-sm font-bold ${
                        isCurrent ? 'text-sky-700' : 'text-slate-700'
                      }`}
                    >
                      {status.label}
                    </Text>
                    {isCurrent && (
                      <View className="w-5 h-5 rounded-full bg-sky-600 items-center justify-center">
                        <Text className="text-white text-xs font-bold">✓</Text>
                      </View>
                    )}
                    {updateStatusMutation.isPending && !isCurrent && (
                      <ActivityIndicator size="small" color="#0284C7" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-slate-100 items-center"
                onPress={() => {
                  if (!updateStatusMutation.isPending) {
                    setShowStatusModal(false);
                    setSelectedOrder(null);
                  }
                }}
                disabled={updateStatusMutation.isPending}
                activeOpacity={0.85}
              >
                <Text className="text-slate-700 text-sm font-extrabold">Đóng</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
