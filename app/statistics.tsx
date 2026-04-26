import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  TrendingUp,
  Users,
  XCircle,
  AlertCircle,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getApiResponseData } from "@/lib/types/api-types";
import { SERVICE_TYPE_MAPPER } from "@/lib/schemas/order-schemas";
import { getOrderStatusLabel } from "@/lib/constants/order-status";
import { OrderResponse, orderService } from "@/services/orderService";
import { patientService } from "@/services/patientService";
import { specifyVoteTestService } from "@/services/specifyVoteTestService";
import { genomeTestService } from "@/services/genomeTestService";
import { serviceService } from "@/services/serviceService";

type TimeFilter = "today" | "week" | "month" | "all";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("vi-VN").format(amount);
};

export default function StatisticsScreen() {
  const router = useRouter();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  const { data: ordersResponse, isLoading: ordersLoading, refetch: refetchOrders, isFetching: ordersFetching } = useQuery({
    queryKey: ["orders"],
    queryFn: () => orderService.getAll(),
  });

  const { data: patientsResponse, isLoading: patientsLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: () => patientService.getAll(),
  });

  const { data: slipsResponse, isLoading: slipsLoading } = useQuery({
    queryKey: ["specify-vote-tests"],
    queryFn: () => specifyVoteTestService.getAll(),
  });

  const { data: genomeTestsResponse, isLoading: genomeTestsLoading } = useQuery({
    queryKey: ["genome-tests"],
    queryFn: () => genomeTestService.getAll(),
  });

  const { data: servicesResponse, isLoading: servicesLoading } = useQuery({
    queryKey: ["services"],
    queryFn: () => serviceService.getAll(),
  });

  const orders: OrderResponse[] = useMemo(() => {
    return getApiResponseData<OrderResponse>(ordersResponse) || [];
  }, [ordersResponse]);

  const patients = useMemo(() => {
    return getApiResponseData(patientsResponse) || [];
  }, [patientsResponse]);

  const slips = useMemo(() => {
    return getApiResponseData(slipsResponse) || [];
  }, [slipsResponse]);

  const genomeTests = useMemo(() => {
    return getApiResponseData(genomeTestsResponse) || [];
  }, [genomeTestsResponse]);

  const services = useMemo(() => {
    return getApiResponseData(servicesResponse) || [];
  }, [servicesResponse]);

  const filteredOrders = useMemo(() => {
    if (timeFilter === "all") return orders;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return orders.filter((order: any) => {
      const orderDate = order.orderDate ? new Date(order.orderDate) : null;
      if (!orderDate) return false;

      if (timeFilter === "today") {
        return orderDate >= today;
      } else if (timeFilter === "week") {
        return orderDate >= weekAgo;
      } else if (timeFilter === "month") {
        return orderDate >= monthAgo;
      }
      return true;
    });
  }, [orders, timeFilter]);
  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ordersToday = filteredOrders.filter((order: any) => {
      const orderDate = order.orderDate || order.createdAt ? new Date(order.orderDate || order.createdAt) : null;
      return orderDate && orderDate >= today;
    }).length;

    const ordersByStatus: Record<string, number> = {};
    filteredOrders.forEach((order: any) => {
      const status = order.orderStatus || "unknown";
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });

    const pendingOrders = filteredOrders.filter((order: any) => {
      const status = (order.orderStatus || "").toLowerCase();
      return (
        status === "initiation" ||
        status === "in_progress" ||
        status === "forward_analysis" ||
        status === "accepted"
      );
    }).length;

    const completedOrders = ordersByStatus["completed"] || 0;
    const rejectedOrders = ordersByStatus["rejected"] || 0;
    const analyzingOrders = filteredOrders.filter((order: any) => {
      const status = (order.orderStatus || "").toLowerCase();
      return status === "in_progress" || status === "forward_analysis" || status === "analyze_in_progress";
    }).length;

    const failedOrders = filteredOrders.filter((order: any) => {
      const status = (order.orderStatus || "").toLowerCase();
      return status === "rejected" || status === "sample_error" || status === "payment_failed";
    }).length;

    const revenue = filteredOrders.reduce((sum: number, order: any) => {
      return sum + (order.paymentAmount || 0);
    }, 0);

    const serviceUsage: Record<string, number> = {};
    filteredOrders.forEach((order: any) => {
      let serviceName = "";
      
      if (order.specifyId) {
        if (order.specifyId.serviceId) {
          const service = services.find((s: any) => s.serviceId === order.specifyId.serviceId);
          if (service?.name) {
            serviceName = service.name;
          }
        }
      
        if (!serviceName && order.specifyId.serviceType) {
          serviceName = order.specifyId.serviceType;
        }
        if (!serviceName && order.specifyId.genomeTestId) {
          const genomeTest = genomeTests.find((gt: any) => gt.testId === order.specifyId.genomeTestId);
          if (genomeTest?.service?.name) {
            serviceName = genomeTest.service.name;
          }
        }
      }
      
      if (serviceName) {
        serviceUsage[serviceName] = (serviceUsage[serviceName] || 0) + 1;
      }
    });
    const topServices = Object.entries(serviceUsage)
      .map(([serviceName, count]) => ({
        name: SERVICE_TYPE_MAPPER[serviceName] || serviceName,
        count,
        originalName: serviceName,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const paymentByMonth: Record<string, number> = {};
    filteredOrders.forEach((order: any) => {
      const orderDate = order.orderDate || order.createdAt;
      if (orderDate && order.paymentAmount) {
        const date = new Date(orderDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        paymentByMonth[monthKey] = (paymentByMonth[monthKey] || 0) + (order.paymentAmount || 0);
      }
    });
    const monthlyPayments = Object.entries(paymentByMonth)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 6)
      .reverse(); 

    return {
      totalOrders,
      ordersToday,
      pendingOrders,
      completedOrders,
      rejectedOrders,
      analyzingOrders,
      failedOrders,
      revenue,
      ordersByStatus,
      totalPatients: patients.length,
      totalSlips: slips.length,
      topServices,
      monthlyPayments,
    };
  }, [filteredOrders, patients, slips, genomeTests, services]);

  const isLoading = ordersLoading || patientsLoading || slipsLoading || genomeTestsLoading || servicesLoading;
  const isFetching = ordersFetching;

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: "today", label: "Hôm nay" },
    { key: "week", label: "Tuần này" },
    { key: "month", label: "Tháng này" },
    { key: "all", label: "Tất cả" },
  ];

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

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
            <Text className="text-slate-900 text-lg font-extrabold">Báo cáo & Thống kê</Text>
            <Text className="mt-0.5 text-xs text-slate-500">Tổng quan hoạt động hệ thống</Text>
          </View>
        </View>

        {/* Time filters */}
        <View className="mt-3 flex-row gap-2">
          {timeFilters.map((f) => {
            const active = timeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setTimeFilter(f.key)}
                activeOpacity={0.85}
                className={`flex-1 py-2 rounded-2xl border ${
                  active
                    ? "bg-sky-600 border-sky-600"
                    : "bg-white border-sky-200"
                }`}
              >
                <Text
                  className={`text-center text-xs font-extrabold ${
                    active ? "text-white" : "text-slate-600"
                  }`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetchOrders()}
            tintColor="#0284C7"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Overview Cards */}
        <View className="mb-4">
          <Text className="text-slate-900 text-base font-extrabold mb-3">Tổng quan</Text>
          <View className="flex-row flex-wrap gap-3">
            <View className="bg-white rounded-2xl p-4 border border-sky-100 flex-1 min-w-[48%]">
              <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 rounded-xl bg-sky-100 items-center justify-center mr-2">
                  <FileText size={20} color="#0284C7" />
                </View>
                <Text className="text-xs text-slate-500 font-bold">Tổng đơn hàng</Text>
              </View>
              <Text className="text-2xl font-extrabold text-slate-900">{stats.totalOrders}</Text>
            </View>

            <View className="bg-white rounded-2xl p-4 border border-sky-100 flex-1 min-w-[48%]">
              <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 rounded-xl bg-green-100 items-center justify-center mr-2">
                  <Calendar size={20} color="#16A34A" />
                </View>
                <Text className="text-xs text-slate-500 font-bold">Đơn hôm nay</Text>
              </View>
              <Text className="text-2xl font-extrabold text-slate-900">{stats.ordersToday}</Text>
            </View>

            <View className="bg-white rounded-2xl p-4 border border-sky-100 flex-1 min-w-[48%]">
              <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 rounded-xl bg-orange-100 items-center justify-center mr-2">
                  <Clock size={20} color="#F97316" />
                </View>
                <Text className="text-xs text-slate-500 font-bold">Đang xử lý</Text>
              </View>
              <Text className="text-2xl font-extrabold text-slate-900">{stats.pendingOrders}</Text>
            </View>

            <View className="bg-white rounded-2xl p-4 border border-sky-100 flex-1 min-w-[48%]">
              <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 rounded-xl bg-emerald-100 items-center justify-center mr-2">
                  <TrendingUp size={20} color="#10B981" />
                </View>
                <Text className="text-xs text-slate-500 font-bold">Doanh thu</Text>
              </View>
              <Text className="text-lg font-extrabold text-sky-700">
                {formatCurrency(stats.revenue)} VNĐ
              </Text>
            </View>
          </View>
        </View>

        {/* Status Statistics */}
        <View className="mb-4">
          <Text className="text-slate-900 text-base font-extrabold mb-3">Thống kê theo trạng thái</Text>
          <View className="bg-white rounded-2xl border border-sky-100 p-4">
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-sky-100">
              <View className="flex-row items-center">
                <CheckCircle2 size={18} color="#16A34A" />
                <Text className="ml-2 text-sm font-extrabold text-slate-900">Hoàn thành</Text>
              </View>
              <Text className="text-lg font-extrabold text-green-600">{stats.completedOrders}</Text>
            </View>

            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-sky-100">
              <View className="flex-row items-center">
                <Clock size={18} color="#F97316" />
                <Text className="ml-2 text-sm font-extrabold text-slate-900">Đang phân tích</Text>
              </View>
              <Text className="text-lg font-extrabold text-orange-600">{stats.analyzingOrders}</Text>
            </View>

            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-sky-100">
              <View className="flex-row items-center">
                <AlertCircle size={18} color="#EF4444" />
                <Text className="ml-2 text-sm font-extrabold text-slate-900">Thất bại</Text>
              </View>
              <Text className="text-lg font-extrabold text-red-600">{stats.failedOrders}</Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <XCircle size={18} color="#EF4444" />
                <Text className="ml-2 text-sm font-extrabold text-slate-900">Từ chối</Text>
              </View>
              <Text className="text-lg font-extrabold text-red-600">{stats.rejectedOrders}</Text>
            </View>
          </View>
        </View>

        {/* Other Statistics */}
        <View className="mb-4">
          <Text className="text-slate-900 text-base font-extrabold mb-3">Thống kê khác</Text>
          <View className="flex-row flex-wrap gap-3">
            <View className="bg-white rounded-2xl p-4 border border-sky-100 flex-1 min-w-[48%]">
              <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 rounded-xl bg-purple-100 items-center justify-center mr-2">
                  <Users size={20} color="#9333EA" />
                </View>
                <Text className="text-xs text-slate-500 font-bold">Tổng bệnh nhân</Text>
              </View>
              <Text className="text-2xl font-extrabold text-slate-900">{stats.totalPatients}</Text>
            </View>

            <View className="bg-white rounded-2xl p-4 border border-sky-100 flex-1 min-w-[48%]">
              <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 rounded-xl bg-indigo-100 items-center justify-center mr-2">
                  <FileText size={20} color="#6366F1" />
                </View>
                <Text className="text-xs text-slate-500 font-bold">Phiếu chỉ định</Text>
              </View>
              <Text className="text-2xl font-extrabold text-slate-900">{stats.totalSlips}</Text>
            </View>
          </View>
        </View>

        {/* Top Services */}
        {stats.topServices.length > 0 && (
          <View className="mb-4">
            <Text className="text-slate-900 text-base font-extrabold mb-3">
              Dịch vụ được sử dụng nhiều nhất
            </Text>
            <View className="bg-white rounded-2xl border border-sky-100 p-4">
              {stats.topServices.map((service, index) => (
                <View
                  key={service.originalName}
                  className="flex-row items-center justify-between mb-3 pb-3 border-b border-sky-100 last:mb-0 last:pb-0 last:border-0"
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-8 h-8 rounded-lg bg-sky-100 items-center justify-center mr-3">
                      <Text className="text-xs font-extrabold text-sky-700">#{index + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-extrabold text-slate-900" numberOfLines={1}>
                        {service.name}
                      </Text>
                    </View>
                  </View>
                  <View className="px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200">
                    <Text className="text-sm font-extrabold text-sky-700">{service.count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Payment by Month */}
        {stats.monthlyPayments.length > 0 && (
          <View className="mb-4">
            <Text className="text-slate-900 text-base font-extrabold mb-3">
              Doanh thu theo tháng
            </Text>
            <View className="bg-white rounded-2xl border border-sky-100 p-4">
              {stats.monthlyPayments.map((item) => {
                const [year, month] = item.month.split("-");
                const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
                  "vi-VN",
                  { month: "long", year: "numeric" }
                );
                return (
                  <View
                    key={item.month}
                    className="flex-row items-center justify-between mb-3 pb-3 border-b border-sky-100 last:mb-0 last:pb-0 last:border-0"
                  >
                    <View className="flex-row items-center">
                      <Calendar size={18} color="#64748B" />
                      <Text className="ml-2 text-sm font-bold text-slate-700">{monthName}</Text>
                    </View>
                    <Text className="text-sm font-extrabold text-sky-700">
                      {formatCurrency(item.amount)} VNĐ
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Detailed Status Breakdown */}
        {Object.keys(stats.ordersByStatus).length > 0 && (
          <View className="mb-4">
            <Text className="text-slate-900 text-base font-extrabold mb-3">Chi tiết trạng thái</Text>
            <View className="bg-white rounded-2xl border border-sky-100 p-4">
              {Object.entries(stats.ordersByStatus)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <View
                    key={status}
                    className="flex-row items-center justify-between mb-3 pb-3 border-b border-sky-100 last:mb-0 last:pb-0 last:border-0"
                  >
                    <Text className="text-sm font-bold text-slate-700">
                      {getOrderStatusLabel(status)}
                    </Text>
                    <View className="px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200">
                      <Text className="text-sm font-extrabold text-sky-700">{count}</Text>
                    </View>
                  </View>
                ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
