import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Layers,
  Search
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-gifted-charts";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { MEDICAL } from "@/lib/theme/medical";
import {
  getApiErrorMessage,
  getApiResponseData,
  getApiResponseSingle,
  isApiResponse,
} from "@/lib/types/api-types";
import {
  statisticsService,
  type HospitalStatisticsResponse,
  type PaymentHistoryResponse,
  type RevenueStatisticsResponse,
  type ServiceStatisticsResponse,
} from "@/services/statisticsService";

type StatsTab = "revenue" | "services" | "hospitals";

const TAB_CONFIG: { key: StatsTab; label: string; hint: string }[] = [
  { key: "revenue", label: "Doanh thu", hint: "Thu & giao dịch" },
  { key: "services", label: "Dịch vụ", hint: "Theo loại dịch vụ" },
  { key: "hospitals", label: "Bệnh viện", hint: "Đơn vị đối tác" },
];

function TabSegmentIcon({ tabKey, active }: { tabKey: StatsTab; active: boolean }) {
  const color = active ? "#FFFFFF" : "#64748B";
  const size = 16;
  switch (tabKey) {
    case "revenue":
      return <DollarSign size={size} color={color} />;
    case "services":
      return <Layers size={size} color={color} />;
    case "hospitals":
      return <Building2 size={size} color={color} />;
  }
}

const cardShadow =
  Platform.OS === "ios"
    ? {
      shadowColor: "#0369A1",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    }
    : { elevation: 4 };

const softShadow =
  Platform.OS === "ios"
    ? {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    }
    : { elevation: 3 };

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

const formatCurrencyShort = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} triệu`;
  return value.toLocaleString("vi-VN");
};

const getServiceDisplayName = (serviceName: string | null) => {
  switch (serviceName) {
    case "EMBRYO":
      return "Sàng lọc phôi";
    case "DISEASE":
      return "Xét nghiệm bệnh di truyền";
    case "REPRODUCTION":
      return "Xét nghiệm sinh sản";
    default:
      return serviceName || "—";
  }
};

const paymentStatusLabel = (status: string | null) => {
  switch (status) {
    case "COMPLETED":
      return {
        text: "Hoàn thành",
        bar: "#10B981",
        pill: "bg-emerald-50 border-emerald-200",
        pillText: "text-emerald-800",
      };
    case "PENDING":
      return {
        text: "Đang xử lý",
        bar: "#F59E0B",
        pill: "bg-amber-50 border-amber-200",
        pillText: "text-amber-800",
      };
    case "FAILED":
      return {
        text: "Thất bại",
        bar: "#EF4444",
        pill: "bg-red-50 border-red-200",
        pillText: "text-red-800",
      };
    default:
      return {
        text: "Không rõ",
        bar: "#94A3B8",
        pill: "bg-slate-50 border-slate-200",
        pillText: "text-slate-700",
      };
  }
};

const formatTransactionDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("vi-VN");
  } catch {
    return dateStr;
  }
};

function apiReturnedError(data: unknown): data is { success: false; error?: string } {
  return isApiResponse(data) && data.success === false;
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View className="mb-3 flex-row items-end justify-between">
      <View className="flex-1 pr-2">
        <Text className="text-xs font-bold uppercase tracking-wide text-sky-600/90">Báo cáo</Text>
        <Text className="mt-0.5 text-lg font-extrabold text-slate-900" numberOfLines={2}>
          {title}
        </Text>
      </View>
      {hint ? (
        <Text className="max-w-[42%] text-right text-[11px] font-semibold leading-4 text-slate-500">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const GIFTED_SKY = ["#38BDF8", "#0EA5E9", "#0284C7", "#0369A1"] as const;
const GIFTED_EMERALD = ["#34D399", "#10B981", "#059669", "#047857"] as const;
const GIFTED_TEAL = ["#5EEAD4", "#2DD4BF", "#14B8A6", "#0D9488"] as const;

function giftedBarWidth(barCount: number, chartW: number) {
  if (barCount <= 0) return 16;
  return Math.max(8, Math.min(24, (chartW - 40) / barCount - 5));
}

function yAxisCap(values: number[], pad = 1.12) {
  const m = Math.max(0, ...values);
  return Math.max(1, Math.ceil(m * pad));
}

function ChartCaption({ text }: { text: string }) {
  return (
    <Text className="mt-2 text-center text-[11px] font-semibold text-slate-500">{text}</Text>
  );
}

function Card({
  children,
  className = "",
  tone = "white",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "white" | "soft";
}) {
  const bg = tone === "soft" ? "bg-sky-50/90" : "bg-white";
  return (
    <View className={`rounded-3xl ${bg} p-4 ${className}`} style={softShadow}>
      {children}
    </View>
  );
}

export default function StatisticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.max(0, windowWidth - 32);
  const chartWidthCard = Math.max(200, contentWidth - 32);
  const chartWidthLoose = Math.max(200, contentWidth - 24);
  const revenueHeroFontSize = windowWidth < 340 ? 20 : windowWidth < 380 ? 24 : 28;
  const revenueCompact = windowWidth < 400;
  const [tab, setTab] = useState<StatsTab>("revenue");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const paymentPageSize = 8;

  const [hospitalSearch, setHospitalSearch] = useState("");
  const [hospitalPage, setHospitalPage] = useState(1);
  const hospitalPageSize = 10;

  const revenueQuery = useQuery({
    queryKey: ["statistics", "revenue", selectedYear],
    queryFn: () => statisticsService.getRevenueStatistics(selectedYear),
    enabled: tab === "revenue",
  });

  const paymentQuery = useQuery({
    queryKey: ["statistics", "payment-history", selectedYear],
    queryFn: () =>
      statisticsService.getPaymentHistory({ year: selectedYear, page: 0, size: 1000 }),
    enabled: tab === "revenue",
  });

  const serviceQuery = useQuery({
    queryKey: ["statistics", "services"],
    queryFn: () => statisticsService.getServiceStatistics(),
    enabled: tab === "services",
  });

  const hospitalQuery = useQuery({
    queryKey: ["statistics", "hospitals"],
    queryFn: () => statisticsService.getHospitalStatistics(),
    enabled: tab === "hospitals",
  });

  const revenue = getApiResponseSingle<RevenueStatisticsResponse>(revenueQuery.data);
  const paymentRows = getApiResponseData<PaymentHistoryResponse>(paymentQuery.data, []);
  const serviceStats = getApiResponseSingle<ServiceStatisticsResponse>(serviceQuery.data);
  const hospitalStats = getApiResponseSingle<HospitalStatisticsResponse>(hospitalQuery.data);

  useEffect(() => {
    if (!revenue?.availableYears?.length) return;
    if (!revenue.availableYears.includes(selectedYear)) {
      const y = revenue.year ?? revenue.availableYears[revenue.availableYears.length - 1];
      setSelectedYear(y);
    }
  }, [revenue?.availableYears, revenue?.year, selectedYear]);

  useEffect(() => {
    setPaymentPage(1);
  }, [paymentSearch, selectedYear]);

  useEffect(() => {
    setHospitalPage(1);
  }, [hospitalSearch]);

  const filteredPayments = useMemo(() => {
    if (!paymentSearch.trim()) return paymentRows;
    const t = paymentSearch.trim().toLowerCase();
    return paymentRows.filter(
      (p) =>
        p.transactionId?.toLowerCase().includes(t) ||
        p.orderId?.toLowerCase().includes(t) ||
        p.orderName?.toLowerCase().includes(t) ||
        p.hospitalName?.toLowerCase().includes(t) ||
        p.serviceName?.toLowerCase().includes(t) ||
        p.genomeTestName?.toLowerCase().includes(t),
    );
  }, [paymentRows, paymentSearch]);

  const paymentTotalPages = Math.max(1, Math.ceil(filteredPayments.length / paymentPageSize));
  const paginatedPayments = useMemo(() => {
    const start = (paymentPage - 1) * paymentPageSize;
    return filteredPayments.slice(start, start + paymentPageSize);
  }, [filteredPayments, paymentPage, paymentPageSize]);

  const filteredHospitals = useMemo(() => {
    if (!hospitalStats?.hospitalPaymentSummaries?.length) return [];
    if (!hospitalSearch.trim()) return hospitalStats.hospitalPaymentSummaries;
    const t = hospitalSearch.trim().toLowerCase();
    return hospitalStats.hospitalPaymentSummaries.filter(
      (h) =>
        h.hospitalId?.toLowerCase().includes(t) ||
        h.hospitalName?.toLowerCase().includes(t) ||
        h.mostUsedServiceName?.toLowerCase().includes(t) ||
        h.mostUsedGenomeTestName?.toLowerCase().includes(t),
    );
  }, [hospitalStats, hospitalSearch]);

  const hospitalTotalPages = Math.max(1, Math.ceil(filteredHospitals.length / hospitalPageSize));
  const paginatedHospitals = useMemo(() => {
    const start = (hospitalPage - 1) * hospitalPageSize;
    return filteredHospitals.slice(start, start + hospitalPageSize);
  }, [filteredHospitals, hospitalPage, hospitalPageSize]);

  const monthlyMax = useMemo(() => {
    const rows = revenue?.monthlyRevenue ?? [];
    return Math.max(...rows.map((m) => m.totalRevenue), 1);
  }, [revenue?.monthlyRevenue]);

  const topGenomeTests = useMemo(() => {
    const rows = serviceStats?.genomeTestByHospitals ?? [];
    return [...rows].sort((a, b) => b.testCount - a.testCount).slice(0, 15);
  }, [serviceStats?.genomeTestByHospitals]);

  const monthlyChartSeries = useMemo(() => {
    const rows = revenue?.monthlyRevenue ?? [];
    const byMonth = new Map(rows.map((m) => [m.month, m.totalRevenue]));
    const labels: string[] = [];
    const data: number[] = [];
    for (let m = 1; m <= 12; m++) {
      labels.push(`${m}`);
      const v = byMonth.get(m) ?? 0;
      data.push(Math.max(0, Math.round(v / 1_000_000)));
    }
    return { labels, data };
  }, [revenue?.monthlyRevenue, revenue?.year]);

  const orderStatusPie = useMemo(() => {
    const osc = revenue?.orderStatusCount;
    if (!osc) return [];
    const slices = [
      { text: "Hoàn thành", value: osc.completedCount, color: "#10B981" },
      { text: "Đang xử lý", value: osc.pendingCount, color: "#F59E0B" },
      { text: "Từ chối", value: osc.rejectedCount, color: "#EF4444" },
    ].filter((s) => s.value > 0);
    if (slices.length === 0) {
      return [{ text: "Chưa có đơn", value: 1, color: "#CBD5E1" }];
    }
    return slices;
  }, [revenue?.orderStatusCount]);

  const serviceOrdersBar = useMemo(() => {
    const rows = serviceStats?.serviceOrderCounts ?? [];
    if (!rows.length) return { labels: [] as string[], data: [] as number[], legend: [] as string[] };
    return {
      labels: rows.map((_, i) => `${i + 1}`),
      data: rows.map((s) => s.orderCount),
      legend: rows.map((s) => getServiceDisplayName(s.serviceName)),
    };
  }, [serviceStats?.serviceOrderCounts]);

  const serviceRevenueBar = useMemo(() => {
    const rows = serviceStats?.serviceRevenues ?? [];
    if (!rows.length) return { labels: [] as string[], data: [] as number[], legend: [] as string[] };
    return {
      labels: rows.map((_, i) => `${i + 1}`),
      data: rows.map((s) => Math.max(0, Math.round(s.totalRevenue / 1_000_000))),
      legend: rows.map((s) => getServiceDisplayName(s.serviceName)),
    };
  }, [serviceStats?.serviceRevenues]);

  const topHospitalsBar = useMemo(() => {
    const rows = (hospitalStats?.topHospitalsByRevenue ?? []).slice(0, 8);
    return {
      labels: rows.map((_, i) => `#${i + 1}`),
      data: rows.map((h) => Math.max(0, Math.round(h.totalRevenue / 1_000_000))),
      names: rows.map((h) => (h.hospitalName || h.hospitalId).slice(0, 22)),
    };
  }, [hospitalStats?.topHospitalsByRevenue]);

  const monthlyLineData = useMemo(
    () =>
      monthlyChartSeries.labels.map((label, i) => ({
        value: monthlyChartSeries.data[i] ?? 0,
        label,
      })),
    [monthlyChartSeries],
  );

  const monthlyYMax = useMemo(() => yAxisCap(monthlyChartSeries.data), [monthlyChartSeries.data]);

  const monthlyBarGifted = useMemo(
    () =>
      monthlyChartSeries.labels.map((label, i) => ({
        value: monthlyChartSeries.data[i] ?? 0,
        label,
        frontColor: "#7DD3FC",
        gradientColor: "#0284C7",
        showGradient: true as const,
      })),
    [monthlyChartSeries],
  );

  const serviceOrdersGifted = useMemo(
    () =>
      serviceOrdersBar.data.map((v, i) => ({
        value: v,
        label: serviceOrdersBar.labels[i] ?? `${i + 1}`,
        frontColor: GIFTED_SKY[i % GIFTED_SKY.length],
      })),
    [serviceOrdersBar],
  );

  const serviceOrdersYMax = useMemo(() => yAxisCap(serviceOrdersBar.data), [serviceOrdersBar.data]);

  const serviceRevenueGifted = useMemo(
    () =>
      serviceRevenueBar.data.map((v, i) => ({
        value: v,
        label: serviceRevenueBar.labels[i] ?? `${i + 1}`,
        frontColor: GIFTED_EMERALD[i % GIFTED_EMERALD.length],
        gradientColor: "#047857",
        showGradient: true as const,
      })),
    [serviceRevenueBar],
  );

  const serviceRevenueYMax = useMemo(() => yAxisCap(serviceRevenueBar.data), [serviceRevenueBar.data]);

  const topHospitalsGifted = useMemo(
    () =>
      topHospitalsBar.data.map((v, i) => ({
        value: v,
        label: topHospitalsBar.labels[i] ?? `${i + 1}`,
        frontColor: GIFTED_TEAL[i % GIFTED_TEAL.length],
      })),
    [topHospitalsBar],
  );

  const topHospitalsYMax = useMemo(() => yAxisCap(topHospitalsBar.data), [topHospitalsBar.data]);

  const onRefresh = useCallback(async () => {
    if (tab === "revenue") {
      await Promise.all([revenueQuery.refetch(), paymentQuery.refetch()]);
    } else if (tab === "services") {
      await serviceQuery.refetch();
    } else {
      await hospitalQuery.refetch();
    }
  }, [tab, revenueQuery, paymentQuery, serviceQuery, hospitalQuery]);

  const revenueLoading = tab === "revenue" && (revenueQuery.isLoading || paymentQuery.isLoading);

  const activeLoading =
    (tab === "revenue" && revenueLoading) ||
    (tab === "services" && serviceQuery.isLoading) ||
    (tab === "hospitals" && hospitalQuery.isLoading);

  const refreshBusy =
    (tab === "revenue" && (revenueQuery.isFetching || paymentQuery.isFetching) && !revenueLoading) ||
    (tab === "services" && serviceQuery.isFetching && !serviceQuery.isLoading) ||
    (tab === "hospitals" && hospitalQuery.isFetching && !hospitalQuery.isLoading);

  const renderErrorBanner = (show: boolean, isQErr: boolean, msg: string, err?: Error | null) =>
    show ? (
      <View className="mx-4 mt-3 flex-row items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-3">
        <AlertCircle size={20} color="#B91C1C" style={{ marginTop: 2 }} />
        <Text className="flex-1 text-sm font-semibold leading-5 text-red-900">
          {isQErr ? err?.message || msg : msg}
        </Text>
      </View>
    ) : null;

  return (
    <View className="flex-1" style={{ backgroundColor: MEDICAL.screenBg }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[MEDICAL.primary, MEDICAL.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center px-1 pb-3 pt-1">
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/staff");
            }}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="p-2">
            <ChevronLeft size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text
            className="flex-1 text-center text-lg font-extrabold text-white"
            numberOfLines={1}
            style={{ marginRight: 44 }}>
            Thống kê
          </Text>
        </View>
      </LinearGradient>

      <SafeAreaView className="flex-1" style={{ backgroundColor: MEDICAL.screenBg }} edges={["bottom", "left", "right"]}>
        <View className="border-b border-slate-200/80 bg-white px-4 pb-3 pt-3">
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Phạm vi báo cáo</Text>
          <View style={styles.tabBarOuter}>
            <View style={styles.tabRow}>
              {TAB_CONFIG.map((t) => {
                const active = tab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setTab(t.key)}
                    activeOpacity={0.88}
                    style={[styles.tabSegment, active ? styles.tabSegmentActive : styles.tabSegmentInactive]}>
                    <View style={styles.tabLabelRow}>
                      <TabSegmentIcon tabKey={t.key} active={active} />
                      <Text
                        style={[styles.tabLabel, active ? styles.tabLabelActive : styles.tabLabelInactive]}
                        numberOfLines={1}>
                        {t.label}
                      </Text>
                    </View>
                    <Text style={[styles.tabHint, active ? styles.tabHintActive : styles.tabHintInactive]} numberOfLines={1}>
                      {t.hint}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {tab === "revenue" &&
          renderErrorBanner(
            revenueQuery.isError || apiReturnedError(revenueQuery.data),
            revenueQuery.isError,
            getApiErrorMessage(revenueQuery.data, "Không tải được thống kê doanh thu."),
            revenueQuery.error,
          )}
        {tab === "revenue" &&
          renderErrorBanner(
            paymentQuery.isError || apiReturnedError(paymentQuery.data),
            paymentQuery.isError,
            getApiErrorMessage(paymentQuery.data, "Không tải được lịch sử thanh toán."),
            paymentQuery.error,
          )}
        {tab === "services" &&
          renderErrorBanner(
            serviceQuery.isError || apiReturnedError(serviceQuery.data),
            serviceQuery.isError,
            getApiErrorMessage(serviceQuery.data, "Không tải được thống kê dịch vụ."),
            serviceQuery.error,
          )}
        {tab === "hospitals" &&
          renderErrorBanner(
            hospitalQuery.isError || apiReturnedError(hospitalQuery.data),
            hospitalQuery.isError,
            getApiErrorMessage(hospitalQuery.data, "Không tải được thống kê bệnh viện."),
            hospitalQuery.error,
          )}

        {activeLoading ? (
          <View className="flex-1 items-center justify-center" style={{ backgroundColor: MEDICAL.screenBg }}>
            <ActivityIndicator size="large" color={MEDICAL.primary} />
            <Text className="mt-4 text-sm font-bold text-slate-500">Đang tải số liệu...</Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 }}
            refreshControl={
              <RefreshControl refreshing={refreshBusy} onRefresh={onRefresh} tintColor={MEDICAL.primary} />
            }
            showsVerticalScrollIndicator={false}>
            {tab === "revenue" && revenue && (
              <>
                <SectionTitle title="Chọn năm báo cáo" hint="Vuốt ngang để đổi năm" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mb-6 -mr-4"
                  contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
                  {(revenue.availableYears?.length
                    ? [...revenue.availableYears].sort((a, b) => b - a)
                    : [selectedYear]
                  ).map((y) => {
                    const active = selectedYear === y;
                    return (
                      <TouchableOpacity
                        key={y}
                        onPress={() => setSelectedYear(y)}
                        activeOpacity={0.85}
                        className={`min-w-[76px] items-center rounded-2xl px-5 py-3 ${active
                          ? "bg-sky-600"
                          : "border border-sky-100 bg-white"
                          }`}
                        style={!active ? softShadow : undefined}>
                        <Text
                          className={`text-lg font-extrabold ${active ? "text-white" : "text-slate-800"}`}>
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <LinearGradient
                  colors={["#0369A1", "#0284C7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="mb-4 w-full max-w-full overflow-hidden rounded-3xl p-4"
                  style={cardShadow}>
                </LinearGradient>

                <View className="mb-4 flex-row flex-wrap gap-3">
                  <View className="min-w-[47%] flex-1 rounded-3xl bg-white p-4" style={softShadow}>
                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-sky-50">
                      <DollarSign size={22} color={MEDICAL.primary} />
                    </View>
                    <Text className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Doanh thu (rút gọn)
                    </Text>
                    <Text className="mt-1 text-xl font-extrabold text-slate-900" numberOfLines={1}>
                      {formatCurrencyShort(revenue.totalYearRevenue)} ₫
                    </Text>
                  </View>
                  <View className="min-w-[47%] flex-1 rounded-3xl bg-white p-4" style={softShadow}>
                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50">
                      <Layers size={22} color="#4F46E5" />
                    </View>
                    <Text className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Tổng đơn
                    </Text>
                    <Text className="mt-1 text-3xl font-extrabold text-slate-900">
                      {revenue.totalYearOrders}
                    </Text>
                  </View>
                  <View className="min-w-[47%] flex-1 rounded-3xl bg-white p-4" style={softShadow}>
                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
                      <CheckCircle2 size={22} color="#059669" />
                    </View>
                    <Text className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Hoàn thành
                    </Text>
                    <Text className="mt-1 text-3xl font-extrabold text-emerald-700">
                      {revenue.orderStatusCount.completedCount}
                    </Text>
                  </View>
                  <View className="min-w-[47%] flex-1 rounded-3xl bg-white p-4" style={softShadow}>
                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-amber-50">
                      <Clock size={22} color="#D97706" />
                    </View>
                    <Text className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Đang xử lý
                    </Text>
                    <Text className="mt-1 text-3xl font-extrabold text-amber-700">
                      {revenue.orderStatusCount.pendingCount}
                    </Text>
                  </View>
                </View>

                <Card className="mb-5">
                  <SectionTitle title="Tỷ lệ trạng thái đơn" hint="Theo tổng ghi nhận năm" />
                  {(() => {
                    const osc = revenue.orderStatusCount;
                    const total = Math.max(osc.totalCount, 1);
                    const wC = (osc.completedCount / total) * 100;
                    const wP = (osc.pendingCount / total) * 100;
                    const wR = (osc.rejectedCount / total) * 100;
                    return (
                      <>
                        <View className="h-3 flex-row overflow-hidden rounded-full bg-slate-100">
                          <View className="h-3 bg-emerald-500" style={{ width: `${wC}%` }} />
                          <View className="h-3 bg-amber-400" style={{ width: `${wP}%` }} />
                          <View className="h-3 bg-red-400" style={{ width: `${wR}%` }} />
                        </View>
                        <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-2">
                          <LegendDot color="#10B981" label="Hoàn thành" value={osc.completedCount} />
                          <LegendDot color="#FBBF24" label="Đang xử lý" value={osc.pendingCount} />
                          <LegendDot color="#F87171" label="Từ chối" value={osc.rejectedCount} />
                          <LegendDot color="#CBD5E1" label="Tổng" value={osc.totalCount} />
                        </View>
                      </>
                    );
                  })()}
                  {orderStatusPie.length > 0 && (
                    <View className="mt-4 items-center border-t border-slate-100 pt-4">
                      <Text className="mb-2 w-full text-center text-xs font-bold uppercase tracking-wide text-sky-700">
                        Biểu đồ tròn — phân bổ trạng thái
                      </Text>
                      <PieChart
                        data={orderStatusPie}
                        donut
                        isAnimated
                        radius={Math.min(88, chartWidthCard / 3.35)}
                        innerRadius={56}
                        innerCircleColor="#F8FAFC"
                        strokeWidth={2}
                        strokeColor="#FFFFFF"
                        showText={false}
                      />
                    </View>
                  )}
                </Card>

                <Card className="mb-5">
                  <SectionTitle title="Doanh thu theo tháng" hint={`Năm ${revenue.year}`} />
                  <View className="mb-4">
                    <LineChart
                      data={monthlyLineData}
                      width={chartWidthCard}
                      height={200}
                      spacing={
                        monthlyLineData.length > 1
                          ? Math.max(6, (chartWidthCard - 32) / (monthlyLineData.length - 1) - 2)
                          : 18
                      }
                      initialSpacing={6}
                      endSpacing={6}
                      thickness={3}
                      color={MEDICAL.primary}
                      curved
                      areaChart
                      startFillColor="rgba(2, 132, 199, 0.28)"
                      endFillColor="rgba(2, 132, 199, 0.03)"
                      dataPointsColor={MEDICAL.primaryDark}
                      dataPointsRadius={4}
                      textColor="#64748B"
                      textFontSize={9}
                      textShiftY={-2}
                      maxValue={monthlyYMax}
                      noOfSections={4}
                      yAxisTextStyle={{ color: "#94A3B8", fontSize: 9 }}
                      xAxisLabelTextStyle={{ color: "#64748B", fontSize: 9 }}
                      rulesColor="#EEF2F7"
                      xAxisColor="#E2E8F0"
                      yAxisColor="transparent"
                      yAxisThickness={0}
                      isAnimated
                    />
                    <ChartCaption text="Đường cong + vùng — đơn vị: triệu VNĐ (tháng 1–12)" />
                    <BarChart
                      data={monthlyBarGifted}
                      width={chartWidthCard}
                      height={216}
                      barWidth={giftedBarWidth(monthlyBarGifted.length, chartWidthCard)}
                      spacing={6}
                      roundedTop
                      roundedBottom
                      maxValue={monthlyYMax}
                      noOfSections={4}
                      yAxisTextStyle={{ color: "#94A3B8", fontSize: 9 }}
                      xAxisLabelTextStyle={{ color: "#64748B", fontSize: 9 }}
                      rulesColor="#EEF2F7"
                      xAxisColor="transparent"
                      yAxisColor="transparent"
                      yAxisThickness={0}
                      showValuesAsTopLabel
                      topLabelTextStyle={{ color: "#0C4A6E", fontSize: 9, fontWeight: "700" }}
                      isAnimated
                    />
                    <ChartCaption text="Cột gradient: doanh thu từng tháng (triệu VNĐ)" />
                  </View>
                  {[...(revenue.monthlyRevenue ?? [])]
                    .sort((a, b) => a.month - b.month)
                    .map((m) => (
                      <View key={`${m.year}-${m.month}`} className="mb-4 last:mb-0">
                        <View className="mb-1.5 flex-row items-center justify-between">
                          <Text className="text-sm font-extrabold text-slate-800">
                            Tháng {m.month}
                          </Text>
                          <Text className="text-[11px] font-bold text-sky-700">
                            {m.orderCount} đơn
                          </Text>
                        </View>
                        <View className="h-2.5 overflow-hidden rounded-full bg-sky-100">
                          <LinearGradient
                            colors={["#0EA5E9", "#0369A1"]}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            className="h-2.5 rounded-full"
                            style={{ width: `${(m.totalRevenue / monthlyMax) * 100}%` }}
                          />
                        </View>
                        <Text className="mt-1 text-xs font-semibold text-slate-600">
                          {formatCurrency(m.totalRevenue)}
                        </Text>
                      </View>
                    ))}
                </Card>

                <SectionTitle title="Lịch sử thanh toán" hint={`${filteredPayments.length} giao dịch`} />
                <View className="mb-3 flex-row items-center rounded-full border border-sky-100 bg-white px-4 py-1" style={softShadow}>
                  <Search size={18} color="#94A3B8" />
                  <TextInput
                    value={paymentSearch}
                    onChangeText={setPaymentSearch}
                    placeholder="Tìm mã GD, đơn, bệnh viện..."
                    placeholderTextColor="#94A3B8"
                    className="ml-2 flex-1 py-3 text-[15px] text-slate-900"
                  />
                </View>
                <View className="gap-3">
                  {paginatedPayments.length === 0 ? (
                    <Card tone="soft">
                      <Text className="py-8 text-center text-sm font-semibold text-slate-500">
                        Chưa có giao dịch khớp bộ lọc
                      </Text>
                    </Card>
                  ) : (
                    paginatedPayments.map((p) => {
                      const st = paymentStatusLabel(p.paymentStatus);
                      return (
                        <View
                          key={p.paymentId}
                          className="overflow-hidden rounded-3xl bg-white pl-1"
                          style={softShadow}>
                          <View className="flex-row">
                            <View className="w-1 self-stretch rounded-full" style={{ backgroundColor: st.bar }} />
                            <View className="flex-1 p-4 pl-3">
                              <Text className="text-[11px] font-bold text-slate-500">
                                {formatTransactionDate(p.transactionDate)}
                              </Text>
                              <Text className="mt-1 text-[15px] font-extrabold leading-5 text-slate-900" numberOfLines={2}>
                                {p.orderName || p.orderId || "—"}
                              </Text>
                              <Text className="mt-1.5 text-xs leading-4 text-slate-600" numberOfLines={2}>
                                {[p.hospitalName, p.serviceName, p.genomeTestName].filter(Boolean).join(" · ")}
                              </Text>
                              <View className="mt-3 flex-row items-center justify-between">
                                <Text className="text-base font-extrabold text-sky-800">
                                  {p.amountIn != null ? formatCurrency(p.amountIn) : "—"}
                                </Text>
                                <View className={`rounded-full border px-2.5 py-1 ${st.pill}`}>
                                  <Text className={`text-[10px] font-extrabold ${st.pillText}`}>{st.text}</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
                {filteredPayments.length > paymentPageSize && (
                  <View className="mt-5 flex-row items-center justify-between px-1">
                    <TouchableOpacity
                      onPress={() => setPaymentPage((x) => Math.max(1, x - 1))}
                      disabled={paymentPage <= 1}
                      className="flex-row items-center rounded-full bg-white px-4 py-3 disabled:opacity-35"
                      style={softShadow}>
                      <ChevronLeft size={20} color={MEDICAL.primary} />
                      <Text className="font-extrabold text-sky-700">Trước</Text>
                    </TouchableOpacity>
                    <View className="rounded-full bg-sky-100 px-4 py-2">
                      <Text className="text-sm font-extrabold text-sky-900">
                        {paymentPage}/{paymentTotalPages}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setPaymentPage((x) => Math.min(paymentTotalPages, x + 1))}
                      disabled={paymentPage >= paymentTotalPages}
                      className="flex-row items-center rounded-full bg-white px-4 py-3 disabled:opacity-35"
                      style={softShadow}>
                      <Text className="font-extrabold text-sky-700">Sau</Text>
                      <ChevronRight size={20} color={MEDICAL.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {tab === "services" && serviceStats && (
              <>
                <SectionTitle title="Đơn theo loại dịch vụ" />
                {serviceOrdersBar.data.length > 0 && (
                  <View className="mb-5 rounded-3xl bg-white p-3" style={softShadow}>
                    <Text className="mb-2 px-1 text-center text-xs font-bold uppercase tracking-wide text-sky-700">
                      Số đơn theo loại hình (cột)
                    </Text>
                    <BarChart
                      data={serviceOrdersGifted}
                      width={chartWidthLoose}
                      height={228}
                      barWidth={giftedBarWidth(serviceOrdersGifted.length, chartWidthLoose)}
                      spacing={8}
                      roundedTop
                      roundedBottom
                      maxValue={serviceOrdersYMax}
                      noOfSections={4}
                      yAxisTextStyle={{ color: "#94A3B8", fontSize: 9 }}
                      xAxisLabelTextStyle={{ color: "#64748B", fontSize: 9 }}
                      rulesColor="#EEF2F7"
                      xAxisColor="transparent"
                      yAxisColor="transparent"
                      yAxisThickness={0}
                      showValuesAsTopLabel
                      topLabelTextStyle={{ color: "#0C4A6E", fontSize: 9, fontWeight: "700" }}
                      isAnimated
                    />
                    <View className="mt-2 gap-1.5 border-t border-slate-100 pt-3">
                      {serviceOrdersBar.legend.map((name, i) => (
                        <Text key={`${name}-${i}`} className="text-[11px] leading-4 text-slate-600">
                          <Text className="font-extrabold text-sky-700">{i + 1}.</Text> {name}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
                <View className="mb-5 flex-row flex-wrap gap-3">
                  {serviceStats.serviceOrderCounts?.map((s, idx) => {
                    const accents = ["#0284C7", "#0D9488", "#EA580C"];
                    const accent = accents[idx % accents.length];
                    return (
                      <View
                        key={s.serviceId}
                        className="min-w-[47%] flex-1 rounded-3xl bg-white p-4"
                        style={softShadow}>
                        <View className="h-1.5 w-10 rounded-full" style={{ backgroundColor: accent }} />
                        <Text className="mt-3 text-[13px] font-extrabold leading-5 text-slate-800">
                          {getServiceDisplayName(s.serviceName)}
                        </Text>
                        <Text className="mt-2 text-3xl font-extrabold" style={{ color: accent }}>
                          {s.orderCount}
                        </Text>
                        <Text className="text-[11px] font-bold text-slate-400">đơn</Text>
                      </View>
                    );
                  })}
                </View>

                <Card className="mb-5">
                  <SectionTitle title="Doanh thu theo dịch vụ" />
                  {serviceRevenueBar.data.length > 0 && (
                    <View className="mb-4">
                      <Text className="mb-2 text-center text-xs font-bold uppercase text-emerald-800">
                        So sánh nhanh (triệu VNĐ)
                      </Text>
                      <BarChart
                        data={serviceRevenueGifted}
                        width={chartWidthCard}
                        height={220}
                        barWidth={giftedBarWidth(serviceRevenueGifted.length, chartWidthCard)}
                        spacing={8}
                        roundedTop
                        roundedBottom
                        maxValue={serviceRevenueYMax}
                        noOfSections={4}
                        yAxisTextStyle={{ color: "#94A3B8", fontSize: 9 }}
                        xAxisLabelTextStyle={{ color: "#64748B", fontSize: 9 }}
                        rulesColor="#EEF2F7"
                        xAxisColor="transparent"
                        yAxisColor="transparent"
                        yAxisThickness={0}
                        showValuesAsTopLabel
                        topLabelTextStyle={{ color: "#047857", fontSize: 9, fontWeight: "700" }}
                        isAnimated
                      />
                      <View className="mt-2 flex-row flex-wrap gap-x-3 gap-y-1">
                        {serviceRevenueBar.legend.map((name, i) => (
                          <Text key={`${name}-rev-${i}`} className="text-[10px] font-semibold text-slate-600">
                            <Text className="text-emerald-700">{i + 1}.</Text> {name}
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                  {serviceStats.serviceRevenues?.map((s) => (
                    <View
                      key={`rev-${s.serviceId}`}
                      className="mb-4 flex-row items-center justify-between border-b border-sky-50 pb-4 last:mb-0 last:border-0 last:pb-0">
                      <Text className="flex-1 pr-2 text-[14px] font-bold text-slate-800">
                        {getServiceDisplayName(s.serviceName)}
                      </Text>
                      <Text className="text-sm font-extrabold text-emerald-700">
                        {formatCurrency(s.totalRevenue)}
                      </Text>
                    </View>
                  ))}
                </Card>

                <Card className="mb-5">
                  <SectionTitle title="Lượt dịch vụ theo BV" hint="Top 25" />
                  {(serviceStats.hospitalServiceUsages ?? []).slice(0, 25).map((u, i) => (
                    <View
                      key={`${u.serviceId}-${u.hospitalId}-${i}`}
                      className="mb-3 flex-row items-start justify-between rounded-2xl bg-sky-50/60 px-3 py-3 last:mb-0">
                      <View className="mr-2 flex-1">
                        <Text className="text-[11px] font-bold uppercase tracking-wide text-sky-700/80">
                          {u.hospitalName}
                        </Text>
                        <Text className="mt-0.5 text-sm font-extrabold text-slate-900">
                          {getServiceDisplayName(u.serviceName)}
                        </Text>
                      </View>
                      <View className="min-w-[36px] items-center rounded-xl bg-white px-2 py-1.5">
                        <Text className="text-sm font-extrabold text-sky-800">{u.usageCount}</Text>
                      </View>
                    </View>
                  ))}
                </Card>

                <Card className="mb-5">
                  <SectionTitle title="Top xét nghiệm" hint="Theo BV" />
                  {topGenomeTests.map((t, idx) => (
                    <View
                      key={`${t.testId}-${t.hospitalId}-${idx}`}
                      className="mb-3 flex-row items-start gap-3 last:mb-0">
                      <View className="h-8 w-8 items-center justify-center rounded-xl bg-slate-100">
                        <Text className="text-xs font-extrabold text-slate-600">{idx + 1}</Text>
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="text-sm font-extrabold text-slate-900" numberOfLines={2}>
                          {t.testName}
                        </Text>
                        <Text className="mt-0.5 text-[11px] font-semibold text-slate-500">{t.hospitalName}</Text>
                      </View>
                      <Text className="font-extrabold text-sky-700">{t.testCount}</Text>
                    </View>
                  ))}
                </Card>

                <Card tone="soft" className="mb-5 border border-amber-100/80">
                  <SectionTitle title="Thêm mẫu — tổng quan" />
                  <View className="flex-row flex-wrap gap-2">
                    <StatChip label="Tổng" value={serviceStats.sampleAddStatistics?.totalSampleAdds ?? 0} />
                    <StatChip
                      label="Chuyển PT"
                      value={serviceStats.sampleAddStatistics?.forwardAnalysisCount ?? 0}
                    />
                    <StatChip label="Chấp nhận" value={serviceStats.sampleAddStatistics?.acceptedCount ?? 0} />
                    <StatChip label="Từ chối" value={serviceStats.sampleAddStatistics?.rejectedCount ?? 0} />
                    <StatChip label="Khởi tạo" value={serviceStats.sampleAddStatistics?.initiationCount ?? 0} />
                  </View>
                </Card>

                <Card className="mb-2">
                  <SectionTitle title="Doanh thu thêm mẫu" />
                  {(serviceStats.sampleAddRevenues ?? []).map((r, i) => (
                    <View
                      key={`${r.sampleName}-${i}`}
                      className="mb-4 flex-row items-center justify-between border-b border-sky-50 pb-4 last:mb-0 last:border-0 last:pb-0">
                      <View className="flex-1 pr-2">
                        <Text className="text-sm font-extrabold text-slate-900">{r.sampleName}</Text>
                        <Text className="mt-0.5 text-[11px] font-semibold text-slate-500">{r.orderCount} đơn</Text>
                      </View>
                      <Text className="text-sm font-extrabold text-emerald-700">
                        {formatCurrency(r.totalRevenue)}
                      </Text>
                    </View>
                  ))}
                </Card>
              </>
            )}

            {tab === "hospitals" && hospitalStats && (
              <>
                <SectionTitle title="Top bệnh viện" hint="Theo doanh thu" />
                {topHospitalsBar.data.length > 0 && (
                  <View className="mb-5 rounded-3xl bg-white p-3" style={softShadow}>
                    <Text className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-sky-700">
                      Doanh thu top BV — triệu VNĐ
                    </Text>
                    <BarChart
                      data={topHospitalsGifted}
                      width={chartWidthLoose}
                      height={248}
                      barWidth={giftedBarWidth(topHospitalsGifted.length, chartWidthLoose)}
                      spacing={8}
                      roundedTop
                      roundedBottom
                      maxValue={topHospitalsYMax}
                      noOfSections={4}
                      yAxisTextStyle={{ color: "#94A3B8", fontSize: 9 }}
                      xAxisLabelTextStyle={{ color: "#64748B", fontSize: 9 }}
                      rulesColor="#EEF2F7"
                      xAxisColor="transparent"
                      yAxisColor="transparent"
                      yAxisThickness={0}
                      showValuesAsTopLabel
                      topLabelTextStyle={{ color: "#0F766E", fontSize: 9, fontWeight: "700" }}
                      isAnimated
                    />
                    <View className="mt-2 gap-1 border-t border-slate-100 pt-3">
                      {topHospitalsBar.names.map((n, i) => (
                        <Text key={`${n}-${i}`} className="text-[11px] text-slate-600">
                          <Text className="font-extrabold text-sky-800">{topHospitalsBar.labels[i]}</Text> {n}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
                <View className="mb-5 rounded-3xl bg-white p-4" style={softShadow}>
                  {(hospitalStats.topHospitalsByRevenue ?? []).map((h) => {
                    const medal =
                      h.rank === 1 ? "#FBBF24" : h.rank === 2 ? "#94A3B8" : h.rank === 3 ? "#D97706" : "#CBD5E1";
                    return (
                      <View
                        key={h.hospitalId}
                        className="mb-4 border-b border-sky-50/80 pb-4 last:mb-0 last:border-0 last:pb-0">
                        <View className="flex-row items-start gap-3">
                          <View
                            className="h-9 w-9 items-center justify-center rounded-2xl"
                            style={{ backgroundColor: `${medal}33` }}>
                            <Text className="text-sm font-extrabold text-slate-800">#{h.rank}</Text>
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text className="text-[15px] font-extrabold text-slate-900" numberOfLines={2}>
                              {h.hospitalName || h.hospitalId}
                            </Text>
                            <Text className="mt-1 text-[11px] font-semibold text-slate-500">
                              DV {formatCurrencyShort(h.serviceRevenue)} ₫ · Thêm mẫu {formatCurrencyShort(h.sampleAddRevenue)} ₫
                            </Text>
                            <Text className="mt-2 text-base font-extrabold text-emerald-700">
                              {formatCurrencyShort(h.totalRevenue)} ₫
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <SectionTitle title="Chi tiết bệnh viện" hint={`${filteredHospitals.length} dòng`} />
                <View className="mb-3 flex-row items-center rounded-full border border-sky-100 bg-white px-4 py-1" style={softShadow}>
                  <Building2 size={18} color="#94A3B8" />
                  <TextInput
                    value={hospitalSearch}
                    onChangeText={setHospitalSearch}
                    placeholder="Tìm mã, tên BV..."
                    placeholderTextColor="#94A3B8"
                    className="ml-2 flex-1 py-3 text-[15px] text-slate-900"
                  />
                </View>
                <View className="gap-3">
                  {paginatedHospitals.length === 0 ? (
                    <Card tone="soft">
                      <Text className="py-8 text-center text-sm font-semibold text-slate-500">Không có dữ liệu</Text>
                    </Card>
                  ) : (
                    paginatedHospitals.map((h) => (
                      <View key={h.hospitalId} className="rounded-3xl bg-white p-4" style={softShadow}>
                        <Text className="text-[15px] font-extrabold text-slate-900">{h.hospitalName}</Text>
                        <Text className="mt-0.5 text-[11px] font-semibold text-slate-500">{h.hospitalId}</Text>
                        <View className="mt-3 gap-2 rounded-2xl bg-slate-50 p-3">
                          <RowKV k="Doanh thu DV" v={formatCurrency(h.serviceRevenue)} />
                          <RowKV k="Doanh thu thêm mẫu" v={formatCurrency(h.sampleAddRevenue)} />
                          <RowKV k="Lượt DV / mẫu thêm" v={`${h.serviceUsageCount} · ${h.sampleAddCount}`} />
                        </View>
                        <Text className="mt-3 text-[11px] leading-4 text-slate-600">
                          <Text className="font-bold text-slate-700">Thường dùng: </Text>
                          {getServiceDisplayName(h.mostUsedServiceName)} · {h.mostUsedGenomeTestName || "—"}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
                {filteredHospitals.length > hospitalPageSize && (
                  <View className="mt-5 flex-row items-center justify-between px-1">
                    <TouchableOpacity
                      onPress={() => setHospitalPage((x) => Math.max(1, x - 1))}
                      disabled={hospitalPage <= 1}
                      className="flex-row items-center rounded-full bg-white px-4 py-3 disabled:opacity-35"
                      style={softShadow}>
                      <ChevronLeft size={20} color={MEDICAL.primary} />
                      <Text className="font-extrabold text-sky-700">Trước</Text>
                    </TouchableOpacity>
                    <View className="rounded-full bg-sky-100 px-4 py-2">
                      <Text className="text-sm font-extrabold text-sky-900">
                        {hospitalPage}/{hospitalTotalPages}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setHospitalPage((x) => Math.min(hospitalTotalPages, x + 1))}
                      disabled={hospitalPage >= hospitalTotalPages}
                      className="flex-row items-center rounded-full bg-white px-4 py-3 disabled:opacity-35"
                      style={softShadow}>
                      <Text className="font-extrabold text-sky-700">Sau</Text>
                      <ChevronRight size={20} color={MEDICAL.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "rgba(241, 245, 249, 0.95)",
    padding: 4,
  },
  tabRow: {
    flexDirection: "row",
  },
  tabSegment: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabSegmentActive: {
    backgroundColor: "#0284C7",
    ...Platform.select({
      ios: {
        shadowColor: "#0369A1",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  tabSegmentInactive: {
    backgroundColor: "transparent",
  },
  tabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  tabLabelActive: {
    color: "#FFFFFF",
  },
  tabLabelInactive: {
    color: "#475569",
  },
  tabHint: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "600",
  },
  tabHintActive: {
    color: "#E0F2FE",
  },
  tabHintInactive: {
    color: "#94A3B8",
  },
});

function LegendDot({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-xs font-semibold text-slate-600">
        {label} <Text className="font-extrabold text-slate-900">{value}</Text>
      </Text>
    </View>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[12px] font-semibold text-slate-600">{k}</Text>
      <Text className="max-w-[58%] text-right text-[12px] font-extrabold text-slate-900" numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-w-[30%] flex-1 rounded-2xl border border-amber-100/90 bg-white px-3 py-2.5" style={softShadow}>
      <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className="mt-0.5 text-lg font-extrabold text-slate-900">{value}</Text>
    </View>
  );
}
