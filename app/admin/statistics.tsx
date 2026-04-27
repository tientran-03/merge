import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  DollarSign,
  Package,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import {
  statisticsService,
  type PaymentHistoryResponse,
} from "@/services/statisticsService";

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);

/** Chuẩn hoá số từ API (Long/BigDecimal/string) */
function statNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Giống admin web `service-statistics` / `hospital-statistics` */
function getServiceDisplayName(serviceName: string | null | undefined): string {
  switch (String(serviceName || "").toUpperCase()) {
    case "EMBRYO":
      return "Sàng lọc phôi";
    case "DISEASE":
      return "Xét nghiệm bệnh di truyền";
    case "REPRODUCTION":
      return "Xét nghiệm sinh sản";
    default:
      return serviceName || "-";
  }
}

function formatDateTimeVi(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("vi-VN");
}

type StatisticsTab = "revenue" | "services" | "hospitals";

export default function AdminStatisticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<StatisticsTab>("revenue");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const { data: revenueStats, isLoading: revenueLoading, refetch: refetchRevenue } = useQuery({
    queryKey: ["admin-statistics-revenue", selectedYear],
    queryFn: () => statisticsService.getRevenueStatistics(selectedYear),
    enabled: user?.role === "ROLE_ADMIN" && activeTab === "revenue",
  });

  const {
    data: paymentHistoryResp,
    isLoading: paymentHistoryLoading,
    refetch: refetchPaymentHistory,
  } = useQuery({
    queryKey: ["admin-statistics-payment-history", selectedYear],
    queryFn: () =>
      statisticsService.getPaymentHistory({ year: selectedYear, page: 0, size: 80 }),
    enabled: user?.role === "ROLE_ADMIN" && activeTab === "revenue",
  });

  const { data: serviceStats, isLoading: serviceLoading, refetch: refetchServices } = useQuery({
    queryKey: ["admin-statistics-services"],
    queryFn: () => statisticsService.getServiceStatistics(),
    enabled: user?.role === "ROLE_ADMIN" && activeTab === "services",
  });

  const { data: hospitalStats, isLoading: hospitalLoading, refetch: refetchHospitals } = useQuery({
    queryKey: ["admin-statistics-hospitals"],
    queryFn: () => statisticsService.getHospitalStatistics(),
    enabled: user?.role === "ROLE_ADMIN" && activeTab === "hospitals",
  });

  if (user?.role !== "ROLE_ADMIN") {
    return null;
  }

  const isLoading =
    activeTab === "revenue"
      ? revenueLoading || paymentHistoryLoading
      : activeTab === "services"
        ? serviceLoading
        : hospitalLoading;

  const handleRefetch = () => {
    if (activeTab === "revenue") {
      refetchRevenue();
      refetchPaymentHistory();
    } else if (activeTab === "services") refetchServices();
    else if (activeTab === "hospitals") refetchHospitals();
  };

  const yearOptions = useMemo(() => {
    const data = revenueStats?.success ? revenueStats.data : null;
    const fromApi = data?.availableYears;
    if (Array.isArray(fromApi) && fromApi.length > 0) {
      return [...fromApi].sort((a, b) => b - a);
    }
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, [revenueStats]);

  const paymentHistoryRows: PaymentHistoryResponse[] = useMemo(() => {
    if (!paymentHistoryResp?.success || !paymentHistoryResp.data) return [];
    const d = paymentHistoryResp.data;
    return Array.isArray(d) ? d : [];
  }, [paymentHistoryResp]);

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen
        options={{
          title: "Thống kê chi tiết",
          headerStyle: { backgroundColor: "#0891b2" },
          headerTintColor: "#fff",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} className="ml-2">
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Tabs */}
      <View className="bg-white px-4 py-3 border-b border-sky-100">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setActiveTab("revenue")}
              className={`px-4 py-2 rounded-xl border ${activeTab === "revenue"
                  ? "bg-sky-600 border-sky-600"
                  : "bg-white border-sky-200"
                }`}
              activeOpacity={0.85}
            >
              <View className="flex-row items-center gap-2">
                <DollarSign size={16} color={activeTab === "revenue" ? "#fff" : "#64748b"} />
                <Text
                  className={`text-xs font-bold ${activeTab === "revenue" ? "text-white" : "text-slate-600"
                    }`}
                >
                  Doanh thu
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("services")}
              className={`px-4 py-2 rounded-xl border ${activeTab === "services"
                  ? "bg-sky-600 border-sky-600"
                  : "bg-white border-sky-200"
                }`}
              activeOpacity={0.85}
            >
              <View className="flex-row items-center gap-2">
                <Package size={16} color={activeTab === "services" ? "#fff" : "#64748b"} />
                <Text
                  className={`text-xs font-bold ${activeTab === "services" ? "text-white" : "text-slate-600"
                    }`}
                >
                  Dịch vụ
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("hospitals")}
              className={`px-4 py-2 rounded-xl border ${activeTab === "hospitals"
                  ? "bg-sky-600 border-sky-600"
                  : "bg-white border-sky-200"
                }`}
              activeOpacity={0.85}
            >
              <View className="flex-row items-center gap-2">
                <Building2 size={16} color={activeTab === "hospitals" ? "#fff" : "#64748b"} />
                <Text
                  className={`text-xs font-bold ${activeTab === "hospitals" ? "text-white" : "text-slate-600"
                    }`}
                >
                  Bệnh viện
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Year Selector for Revenue */}
      {activeTab === "revenue" && (
        <View className="bg-white px-4 py-3 border-b border-sky-100">
          <View className="flex-row items-center gap-2">
            <Calendar size={16} color="#64748b" />
            <Text className="text-xs font-bold text-slate-700">Năm:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {yearOptions.map((year) => (
                  <TouchableOpacity
                    key={year}
                    onPress={() => setSelectedYear(year)}
                    className={`px-3 py-1.5 rounded-full border ${selectedYear === year
                        ? "bg-sky-600 border-sky-600"
                        : "bg-white border-sky-200"
                      }`}
                    activeOpacity={0.85}
                  >
                    <Text
                      className={`text-xs font-bold ${selectedYear === year ? "text-white" : "text-slate-600"
                        }`}
                    >
                      {year}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Content */}
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefetch} />}
      >
        <View className="p-4">
          {isLoading ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
              <ActivityIndicator size="large" color="#0284C7" />
              <Text className="text-sm font-bold text-slate-500 mt-3">Đang tải dữ liệu...</Text>
            </View>
          ) : (
            <>
              {activeTab === "revenue" && (
                <RevenueTab
                  data={revenueStats?.success ? revenueStats.data : null}
                  selectedYear={selectedYear}
                  rawResponse={revenueStats}
                  paymentHistory={paymentHistoryRows}
                />
              )}
              {activeTab === "services" && (
                <ServicesTab data={serviceStats?.success ? serviceStats.data : null} />
              )}
              {activeTab === "hospitals" && (
                <HospitalsTab data={hospitalStats?.success ? hospitalStats.data : null} />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Revenue Tab — khớp admin web `revenue-statistics` (cùng API / DTO backend)
function RevenueTab({
  data,
  selectedYear,
  rawResponse,
  paymentHistory,
}: {
  data: any;
  selectedYear: number;
  rawResponse?: any;
  paymentHistory: PaymentHistoryResponse[];
}) {
  if (!data) {
    return (
      <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
        <BarChart3 size={48} color="#cbd5e1" />
        <Text className="text-sm font-bold text-slate-500 mt-3 text-center">
          Không có dữ liệu thống kê
        </Text>
        {rawResponse?.error && (
          <Text className="text-xs text-red-500 mt-2 text-center">
            Lỗi: {rawResponse.error}
          </Text>
        )}
        {rawResponse?.success === false && rawResponse?.message && (
          <Text className="text-xs text-orange-500 mt-2 text-center">
            {rawResponse.message}
          </Text>
        )}
      </View>
    );
  }

  const monthlyRevenues = data.monthlyRevenue || data.monthlyRevenues || [];
  const totalRevenue = statNum(data.totalYearRevenue ?? data.totalRevenue);
  const totalOrders = statNum(data.totalYearOrders ?? data.totalOrders);

  const osc = data.orderStatusCount;
  const orderStatusRows: { status: string; count: number }[] = osc
    ? [
      { status: "Hoàn thành", count: statNum(osc.completedCount) },
      { status: "Từ chối / Hủy", count: statNum(osc.rejectedCount) },
      { status: "Đang xử lý", count: statNum(osc.pendingCount) },
      { status: "Tổng đơn", count: statNum(osc.totalCount) },
    ]
    : Array.isArray(data.orderStatusCounts)
      ? data.orderStatusCounts
      : [];

  const completedCount = osc ? statNum(osc.completedCount) : 0;
  const pendingCount = osc ? statNum(osc.pendingCount) : 0;

  return (
    <View className="gap-4">
      <Text className="text-xs font-bold text-slate-500 px-1">
        Báo cáo doanh thu năm {selectedYear} (giống trang admin web)
      </Text>

      <View className="flex-row gap-3 flex-wrap">
        <View className="flex-1 min-w-[140px] bg-white rounded-2xl p-4 border border-sky-100">
          <View className="flex-row items-center gap-2 mb-2">
            <DollarSign size={20} color="#0891b2" />
            <Text className="text-xs font-bold text-slate-500">Tổng doanh thu</Text>
          </View>
          <Text className="text-lg font-extrabold text-slate-900">
            {formatCurrency(totalRevenue)}
          </Text>
        </View>
        <View className="flex-1 min-w-[140px] bg-white rounded-2xl p-4 border border-sky-100">
          <View className="flex-row items-center gap-2 mb-2">
            <Package size={20} color="#0891b2" />
            <Text className="text-xs font-bold text-slate-500">Tổng đơn hàng</Text>
          </View>
          <Text className="text-lg font-extrabold text-slate-900">{totalOrders}</Text>
        </View>
      </View>

      <View className="flex-row gap-3 flex-wrap">
        <View className="flex-1 min-w-[140px] bg-white rounded-2xl p-4 border border-emerald-100">
          <Text className="text-xs font-bold text-emerald-700 mb-1">Đơn hoàn thành</Text>
          <Text className="text-lg font-extrabold text-slate-900">{completedCount}</Text>
        </View>
        <View className="flex-1 min-w-[140px] bg-white rounded-2xl p-4 border border-amber-100">
          <Text className="text-xs font-bold text-amber-800 mb-1">Đang xử lý</Text>
          <Text className="text-lg font-extrabold text-slate-900">{pendingCount}</Text>
        </View>
      </View>

      <View className="bg-white rounded-2xl p-4 border border-sky-100">
        <Text className="text-sm font-extrabold text-slate-900 mb-3">
          Doanh thu theo tháng năm {selectedYear}
        </Text>
        <View className="gap-2">
          {monthlyRevenues.length === 0 ? (
            <Text className="text-xs text-slate-500 text-center py-4">
              Không có dữ liệu tháng
            </Text>
          ) : (
            monthlyRevenues.map((item: any) => (
              <View
                key={`${item.year ?? selectedYear}-${item.month}`}
                className="flex-row items-center justify-between p-3 bg-sky-50 rounded-xl border border-sky-100"
              >
                <Text className="text-sm font-bold text-slate-700">Tháng {item.month}</Text>
                <View className="items-end">
                  <Text className="text-sm font-extrabold text-slate-900">
                    {formatCurrency(statNum(item.totalRevenue ?? item.revenue))}
                  </Text>
                  <Text className="text-xs text-slate-500">{statNum(item.orderCount)} đơn</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {orderStatusRows.length > 0 && (
        <View className="bg-white rounded-2xl p-4 border border-sky-100">
          <Text className="text-sm font-extrabold text-slate-900 mb-3">
            Thống kê trạng thái đơn (theo năm)
          </Text>
          <View className="gap-2">
            {orderStatusRows.map((item: { status: string; count: number }) => (
              <View
                key={item.status}
                className="flex-row items-center justify-between p-3 bg-sky-50 rounded-xl border border-sky-100"
              >
                <Text className="text-sm font-bold text-slate-700">{item.status}</Text>
                <Text className="text-sm font-extrabold text-slate-900">{item.count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className="bg-white rounded-2xl p-4 border border-sky-100">
        <Text className="text-sm font-extrabold text-slate-900 mb-2">
          Lịch sử thanh toán (mẫu {paymentHistory.length} gần nhất)
        </Text>
        <Text className="text-xs text-slate-500 mb-3">

        </Text>
        {paymentHistory.length === 0 ? (
          <Text className="text-xs text-slate-500 text-center py-3">Chưa có giao dịch</Text>
        ) : (
          <View className="gap-2">
            {paymentHistory.slice(0, 40).map((row, idx) => (
              <View
                key={`${row.paymentId ?? row.transactionId ?? idx}-${idx}`}
                className="p-3 bg-slate-50 rounded-xl border border-slate-100"
              >
                <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                  {row.orderName || row.orderId || "—"}
                </Text>
                <Text className="text-[11px] text-slate-500 mt-0.5">
                  {formatDateTimeVi(row.transactionDate ?? null)} ·{" "}
                  {row.paymentStatus ?? "—"} · {statNum(row.amountIn).toLocaleString("vi-VN")} ₫
                </Text>
                {(row.hospitalName || row.serviceName) && (
                  <Text className="text-[11px] text-slate-600 mt-1" numberOfLines={2}>
                    {[row.hospitalName, row.serviceName].filter(Boolean).join(" · ")}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// Services Tab — khớp admin web `service-statistics` (cùng payload API)
function ServicesTab({ data }: { data: any }) {
  if (!data) {
    return (
      <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
        <Package size={48} color="#cbd5e1" />
        <Text className="text-sm font-bold text-slate-500 mt-3 text-center">
          Không có dữ liệu thống kê
        </Text>
      </View>
    );
  }

  const serviceOrderCounts = data.serviceOrderCounts || [];
  const serviceRevenues = data.serviceRevenues || [];
  const hospitalServiceUsages = data.hospitalServiceUsages || [];
  const genomeTestByHospitals = (data.genomeTestByHospitals || []).slice(0, 10);
  const sampleAddStats = data.sampleAddStatistics;
  const sampleAddRevenues = data.sampleAddRevenues || [];

  return (
    <View className="gap-4">
      <View className="bg-white rounded-2xl p-4 border border-sky-100">
        <Text className="text-sm font-extrabold text-slate-900 mb-3">Số đơn hàng theo dịch vụ</Text>
        <View className="gap-2">
          {serviceOrderCounts.length === 0 ? (
            <Text className="text-xs text-slate-500 text-center py-4">Không có dữ liệu</Text>
          ) : (
            serviceOrderCounts.map((item: any, index: number) => (
              <View
                key={item.serviceId || index}
                className="flex-row items-center justify-between p-3 bg-sky-50 rounded-xl border border-sky-100"
              >
                <Text className="text-sm font-bold text-slate-700 flex-1">
                  {getServiceDisplayName(item.serviceName)}
                </Text>
                <Text className="text-sm font-extrabold text-slate-900">{item.orderCount}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View className="bg-white rounded-2xl p-4 border border-sky-100">
        <Text className="text-sm font-extrabold text-slate-900 mb-3">Doanh thu theo dịch vụ</Text>
        <View className="gap-2">
          {serviceRevenues.length === 0 ? (
            <Text className="text-xs text-slate-500 text-center py-4">Không có dữ liệu</Text>
          ) : (
            serviceRevenues.map((item: any, index: number) => (
              <View
                key={item.serviceId || index}
                className="flex-row items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100"
              >
                <Text className="text-sm font-bold text-slate-700 flex-1">
                  {getServiceDisplayName(item.serviceName)}
                </Text>
                <Text className="text-sm font-extrabold text-slate-900">
                  {formatCurrency(statNum(item.totalRevenue))}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {hospitalServiceUsages.length > 0 && (
        <View className="bg-white rounded-2xl p-4 border border-sky-100">
          <Text className="text-sm font-extrabold text-slate-900 mb-3">
            Sử dụng dịch vụ theo bệnh viện
          </Text>
          <View className="gap-2">
            {hospitalServiceUsages.map((row: any, i: number) => (
              <View
                key={`${row.hospitalId}-${row.serviceId}-${i}`}
                className="p-3 bg-indigo-50 rounded-xl border border-indigo-100"
              >
                <Text className="text-sm font-bold text-slate-800">{row.hospitalName}</Text>
                <Text className="text-xs text-slate-600 mt-1">
                  {getServiceDisplayName(row.serviceName)} — {statNum(row.usageCount)} lượt
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {genomeTestByHospitals.length > 0 && (
        <View className="bg-white rounded-2xl p-4 border border-sky-100">
          <Text className="text-sm font-extrabold text-slate-900 mb-3">
            Xét nghiệm theo bệnh viện (top 10)
          </Text>
          <View className="gap-2">
            {genomeTestByHospitals.map((row: any, i: number) => (
              <View
                key={`${row.testId}-${row.hospitalId}-${i}`}
                className="flex-row items-center justify-between p-3 bg-fuchsia-50 rounded-xl border border-fuchsia-100"
              >
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-bold text-slate-800" numberOfLines={2}>
                    {row.testName}
                  </Text>
                  <Text className="text-xs text-slate-500">{row.hospitalName}</Text>
                </View>
                <Text className="text-sm font-extrabold text-slate-900">{statNum(row.testCount)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {sampleAddStats && (
        <View className="bg-white rounded-2xl p-4 border border-sky-100">
          <Text className="text-sm font-extrabold text-slate-900 mb-3">Thống kê thêm mẫu</Text>
          <View className="gap-1">
            <Text className="text-xs text-slate-700">
              Tổng thêm mẫu: {statNum(sampleAddStats.totalSampleAdds)}
            </Text>
            <Text className="text-xs text-slate-700">
              Chuyển phân tích: {statNum(sampleAddStats.forwardAnalysisCount)} · Chấp nhận:{" "}
              {statNum(sampleAddStats.acceptedCount)} · Từ chối: {statNum(sampleAddStats.rejectedCount)} · Khởi
              tạo: {statNum(sampleAddStats.initiationCount)}
            </Text>
          </View>
        </View>
      )}

      {sampleAddRevenues.length > 0 && (
        <View className="bg-white rounded-2xl p-4 border border-sky-100">
          <Text className="text-sm font-extrabold text-slate-900 mb-3">Doanh thu thêm mẫu theo loại</Text>
          <View className="gap-2">
            {sampleAddRevenues.map((row: any, i: number) => (
              <View
                key={`${row.sampleName}-${i}`}
                className="flex-row items-center justify-between p-3 bg-teal-50 rounded-xl border border-teal-100"
              >
                <Text className="text-sm font-bold text-slate-700 flex-1" numberOfLines={2}>
                  {row.sampleName || "—"}
                </Text>
                <Text className="text-sm font-extrabold text-slate-900">
                  {formatCurrency(statNum(row.totalRevenue))}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// Hospitals Tab — khớp admin web `hospital-statistics` (DTO backend)
function HospitalsTab({ data }: { data: any }) {
  if (!data) {
    return (
      <View className="bg-white rounded-2xl p-8 items-center border border-sky-100">
        <Building2 size={48} color="#cbd5e1" />
        <Text className="text-sm font-bold text-slate-500 mt-3 text-center">
          Không có dữ liệu thống kê
        </Text>
      </View>
    );
  }

  const topHospitals = data.topHospitalsByRevenue || [];
  const hospitalSummaries = data.hospitalPaymentSummaries || [];

  return (
    <View className="gap-4">
      <View className="bg-white rounded-2xl p-4 border border-sky-100">
        <Text className="text-sm font-extrabold text-slate-900 mb-3">
          Top bệnh viện theo doanh thu
        </Text>
        <View className="gap-2">
          {topHospitals.length === 0 ? (
            <Text className="text-xs text-slate-500 text-center py-4">Không có dữ liệu</Text>
          ) : (
            topHospitals.map((item: any, index: number) => {
              const rank = item.rank != null ? statNum(item.rank) : index + 1;
              const svc = statNum(item.serviceRevenue);
              const add = statNum(item.sampleAddRevenue);
              const total = statNum(item.totalRevenue);
              return (
                <View
                  key={item.hospitalId}
                  className="p-3 bg-sky-50 rounded-xl border border-sky-100"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2 flex-1">
                      <View className="w-6 h-6 rounded-full bg-sky-600 items-center justify-center">
                        <Text className="text-white text-[10px] font-bold">{rank}</Text>
                      </View>
                      <Text className="text-sm font-bold text-slate-700 flex-1">
                        {item.hospitalName || `BV #${item.hospitalId}`}
                      </Text>
                    </View>
                    <Text className="text-sm font-extrabold text-slate-900">
                      {formatCurrency(total)}
                    </Text>
                  </View>
                  <Text className="text-[11px] text-slate-500 mt-1">
                    DV: {formatCurrency(svc)} · Thêm mẫu: {formatCurrency(add)}
                  </Text>
                  <Text className="text-[11px] text-slate-500">
                    {statNum(item.orderCount)} đơn · {statNum(item.sampleAddCount)} mẫu thêm
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </View>

      <View className="bg-white rounded-2xl p-4 border border-sky-100">
        <Text className="text-sm font-extrabold text-slate-900 mb-3">
          Chi tiết thanh toán theo bệnh viện
        </Text>
        <Text className="text-xs text-slate-500 mb-2">
          Cùng các cột chính như bảng trên web (doanh thu dịch vụ / thêm mẫu / dịch vụ & xét nghiệm dùng nhiều).
        </Text>
        <View className="gap-2">
          {hospitalSummaries.length === 0 ? (
            <Text className="text-xs text-slate-500 text-center py-4">Không có dữ liệu</Text>
          ) : (
            hospitalSummaries.map((item: any) => (
              <View
                key={item.hospitalId}
                className="p-3 bg-emerald-50 rounded-xl border border-emerald-100"
              >
                <Text className="text-sm font-extrabold text-slate-900">{item.hospitalName}</Text>
                <Text className="text-[11px] text-slate-400 mb-2">ID: {item.hospitalId}</Text>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-slate-600">Số dịch vụ (lượt):</Text>
                  <Text className="text-xs font-bold text-slate-900">
                    {statNum(item.serviceUsageCount)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-slate-600">Doanh thu dịch vụ:</Text>
                  <Text className="text-xs font-bold text-slate-900">
                    {formatCurrency(statNum(item.serviceRevenue))}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-slate-600">Số mẫu thêm:</Text>
                  <Text className="text-xs font-bold text-slate-900">
                    {statNum(item.sampleAddCount)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-slate-600">Doanh thu thêm mẫu:</Text>
                  <Text className="text-xs font-bold text-slate-900">
                    {formatCurrency(statNum(item.sampleAddRevenue))}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs text-slate-600">Tổng doanh thu:</Text>
                  <Text className="text-xs font-bold text-slate-900">
                    {formatCurrency(statNum(item.totalRevenue))}
                  </Text>
                </View>
                <Text className="text-[11px] text-slate-600">
                  Dịch vụ nhiều nhất: {getServiceDisplayName(item.mostUsedServiceName)}
                </Text>
                <Text className="text-[11px] text-slate-600 mt-0.5">
                  Xét nghiệm nhiều nhất: {item.mostUsedGenomeTestName || "—"}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}
