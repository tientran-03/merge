import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PaginationControls } from "@/components/PaginationControls";
import { COLORS } from "@/constants/colors";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { consumeListFresh } from "@/lib/list-navigation-flags";
import {
  SpecifyVoteTestResponse,
  specifyVoteTestService,
} from "@/services/specifyVoteTestService";

type TimeFilter = "today" | "week" | "month" | "all";

const getStatusLabel = (status?: string): string => {
  if (!status) return "Khởi tạo";
  const s = status.toLowerCase();
  const statusMap: Record<string, string> = {
    initation: "Khởi tạo",
    payment_failed: "Thanh toán thất bại",
    accepted: "Đã chấp nhận",
    waiting_receive_sample: "Chờ nhận mẫu",
    forward_analysis: "Chuyển phân tích",
    sample_collecting: "Đang thu mẫu",
    sample_retrieved: "Đã tiếp nhận mẫu",
    analyze_in_progress: "Đang phân tích",
    rerun_testing: "Chạy lại",
    awaiting_results_approval: "Chờ duyệt kết quả",
    results_approved: "Kết quả đã duyệt",
    canceled: "Hủy",
    rejected: "Từ chối",
    sample_addition: "Thêm mẫu",
    sample_error: "Mẫu lỗi",
    completed: "Hoàn thành",
  };
  return statusMap[s] || status;
};

const getStatusMeta = (status?: string) => {
  if (!status) {
    return {
      label: "Khởi tạo",
      bg: "rgba(59,130,246,0.12)",
      fg: COLORS.blue,
      bd: "rgba(59,130,246,0.22)",
    };
  }
  const s = status.toLowerCase();
  if (s === "completed" || s === "results_approved") {
    return {
      label: getStatusLabel(status),
      bg: "rgba(34,197,94,0.12)",
      fg: COLORS.green,
      bd: "rgba(34,197,94,0.22)",
    };
  }
  if (s === "canceled" || s === "rejected" || s === "payment_failed" || s === "sample_error") {
    return {
      label: getStatusLabel(status),
      bg: "rgba(239,68,68,0.12)",
      fg: COLORS.red,
      bd: "rgba(239,68,68,0.22)",
    };
  }
  if (
    s === "analyze_in_progress" ||
    s === "sample_collecting" ||
    s === "waiting_receive_sample" ||
    s === "forward_analysis"
  ) {
    return {
      label: getStatusLabel(status),
      bg: "rgba(249,115,22,0.12)",
      fg: COLORS.orange,
      bd: "rgba(249,115,22,0.22)",
    };
  }
  return {
    label: getStatusLabel(status),
    bg: "rgba(59,130,246,0.12)",
    fg: COLORS.blue,
    bd: "rgba(59,130,246,0.22)",
  };
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

const formatDateShort = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  } catch {
    return dateString;
  }
};

export default function PrescriptionSlipsScreen() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [showStatusDropdown, setShowStatusDropdown] = useState<boolean>(false);

  const {
    data: slips,
    isLoading,
    error,
    refetch,
    isFetching,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
    resetToFirstPage,
  } = usePaginatedQuery<SpecifyVoteTestResponse>({
    queryKey: ["specify-vote-tests", statusFilter],
    queryFn: async (params) => {
      if (statusFilter !== "all") {
        return await specifyVoteTestService.getByStatus(statusFilter, params);
      }
      return await specifyVoteTestService.getAll(params);
    },
    defaultPageSize: 20,
  });

  useFocusEffect(
    useCallback(() => {
      if (consumeListFresh("prescription-slips")) {
        resetToFirstPage();
      }
    }, [resetToFirstPage])
  );

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: "today", label: "Hôm nay" },
    { key: "week", label: "Tuần này" },
    { key: "month", label: "Tháng này" },
    { key: "all", label: "Tất cả" },
  ];

  const statusOptions: { key: string; label: string }[] = [
    { key: "all", label: "Tất cả trạng thái" },
    { key: "completed", label: "Hoàn thành" },
    { key: "results_approved", label: "Kết quả đã duyệt" },
    { key: "initation", label: "Khởi tạo" },
    { key: "canceled", label: "Hủy" },
    { key: "rejected", label: "Từ chối" },
    { key: "analyze_in_progress", label: "Đang phân tích" },
    { key: "sample_collecting", label: "Đang thu mẫu" },
  ];

  const filteredSlips = useMemo(() => {
    let filtered = slips;

    // Filter by search query
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter((slip) => {
        const code = slip.specifyVoteID?.toLowerCase() || "";
        const testName = slip.genomeTest?.testName?.toLowerCase() || "";
        const patientName = slip.patient?.patientName?.toLowerCase() || "";
        return code.includes(q) || testName.includes(q) || patientName.includes(q);
      });
    }

    // Filter by time
    if (timeFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter((slip: any) => {
        const createdAt = slip.createdAt ? new Date(slip.createdAt) : null;
        if (!createdAt) return false;

        if (timeFilter === "today") {
          return createdAt.toDateString() === now.toDateString();
        } else if (timeFilter === "week") {
          return createdAt >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (timeFilter === "month") {
          return createdAt >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        return true;
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return sorted;
  }, [slips, searchQuery, timeFilter]);

  const groupedSlips = useMemo(() => {
    const groups: { [key: string]: SpecifyVoteTestResponse[] } = {};
    filteredSlips.forEach((slip: any) => {
      const date = slip.createdAt ? formatDateShort(slip.createdAt) : "Không xác định";
      if (!groups[date]) groups[date] = [];
      groups[date].push(slip);
    });
    return groups;
  }, [filteredSlips]);

  const slipDayKeys = useMemo(
    () =>
      Object.keys(groupedSlips).sort((a, b) => {
        const maxA = Math.max(
          ...groupedSlips[a].map((s) => (s.createdAt ? new Date(s.createdAt).getTime() : 0))
        );
        const maxB = Math.max(
          ...groupedSlips[b].map((s) => (s.createdAt ? new Date(s.createdAt).getTime() : 0))
        );
        return maxB - maxA;
      }),
    [groupedSlips]
  );

  const currentStatusLabel = statusOptions.find((opt) => opt.key === statusFilter)?.label || "Tất cả trạng thái";

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              style={styles.backBtn}
            >
              <ArrowLeft size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Phiếu chỉ định</Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.sub }}>Đang tải dữ liệu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              style={styles.backBtn}
            >
              <ArrowLeft size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Phiếu chỉ định</Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 8 }}>
            Không tải được dữ liệu
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.primary,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
              marginTop: 12,
            }}
            onPress={() => refetch()}
            activeOpacity={0.85}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.backBtn}
          >
            <ArrowLeft size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Phiếu chỉ định</Text>
            <Text style={styles.headerSub}>Tra cứu & lọc phiếu chỉ định xét nghiệm</Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/create-prescription-slip")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 8,
            }}
            activeOpacity={0.85}
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.countPill}>
            <Text style={styles.countText}>{filteredSlips.length}</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search size={18} color={COLORS.sub} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo mã phiếu / xét nghiệm / bệnh nhân…"
            placeholderTextColor={COLORS.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>

        <View style={styles.pillsRow}>
          {timeFilters.map((f) => {
            const active = timeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setTimeFilter(f.key)}
                activeOpacity={0.85}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, styles.filterChipWide]}
            onPress={() => setShowStatusDropdown((v) => !v)}
            activeOpacity={0.85}
          >
            <SlidersHorizontal size={16} color={COLORS.sub} />
            <Text style={[styles.filterChipText, { flex: 1 }]} numberOfLines={1}>
              {currentStatusLabel}
            </Text>
            <ChevronDown size={16} color={COLORS.sub} />
          </TouchableOpacity>
        </View>

        {showStatusDropdown && (
          <View style={styles.dropdown}>
            {statusOptions.map((opt) => {
              const active = opt.key === statusFilter;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => {
                    setStatusFilter(opt.key);
                    setShowStatusDropdown(false);
                  }}
                  activeOpacity={0.85}
                  style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                >
                  <Text style={[styles.dropdownText, active && styles.dropdownTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {slipDayKeys.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <FileText size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>Không có phiếu chỉ định</Text>
            <Text style={styles.emptySub}>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</Text>
            <TouchableOpacity
              style={{
                marginTop: 16,
                backgroundColor: COLORS.primary,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 12,
              }}
              onPress={() => router.push("/create-prescription-slip")}
              activeOpacity={0.85}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>Thêm phiếu chỉ định</Text>
            </TouchableOpacity>
          </View>
        ) : (
          slipDayKeys.map((date) => (
            <View key={date} style={{ marginBottom: 14 }}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{date}</Text>
                <View style={styles.groupCount}>
                  <Text style={styles.groupCountText}>{groupedSlips[date].length}</Text>
                </View>
              </View>

              {groupedSlips[date].map((slip) => {
                const meta = getStatusMeta(slip.specifyStatus);
                return (
                  <TouchableOpacity
                    key={slip.specifyVoteID}
                    activeOpacity={0.85}
                    style={styles.card}
                    onPress={() => {
                      if (slip.specifyVoteID) {
                        router.push({
                          pathname: "/prescription-slip-detail",
                          params: { specifyVoteID: slip.specifyVoteID },
                        });
                      }
                    }}
                  >
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.codeRow}>
                          <Text style={styles.code} numberOfLines={1}>
                            {slip.specifyVoteID}
                          </Text>

                          <View
                            style={[
                              styles.statusPill,
                              { backgroundColor: meta.bg, borderColor: meta.bd },
                            ]}
                          >
                            <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
                          </View>
                        </View>

                        {slip.genomeTest?.testName && (
                          <Text style={styles.name} numberOfLines={2}>
                            {slip.genomeTest.testName}
                          </Text>
                        )}

                        {slip.patient?.patientName && (
                          <Text style={styles.metaText} numberOfLines={2}>
                            {slip.patient.patientName}
                          </Text>
                        )}
                      </View>

                      <View style={styles.actionBtn}>
                        <ChevronRight size={18} color={COLORS.sub} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  headerSub: { marginTop: 2, fontSize: 12, fontWeight: "700", color: COLORS.sub },

  countPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border2,
    marginLeft: 8,
  },
  countText: { fontSize: 12, fontWeight: "900", color: COLORS.primary },

  searchBox: {
    marginTop: 10,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: "700", color: COLORS.text },

  pillsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  pill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: 12, fontWeight: "800", color: COLORS.sub },
  pillTextActive: { color: "#FFFFFF" },

  filtersRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  filterChip: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  filterChipWide: { flex: 1 },
  filterChipText: { fontSize: 12, fontWeight: "800", color: COLORS.sub },

  dropdown: {
    marginTop: 10,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownItemActive: { backgroundColor: COLORS.primarySoft },
  dropdownText: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  dropdownTextActive: { color: COLORS.primary },

  listContent: { padding: 16, paddingBottom: 24 },

  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },
  groupTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  groupCount: {
    minWidth: 28,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  groupCountText: { fontSize: 12, fontWeight: "900", color: COLORS.primary },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 1,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },

  codeRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 6 },
  code: { fontSize: 13, fontWeight: "900", color: COLORS.primary, flexShrink: 1 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "900" },

  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  name: { marginTop: 8, fontSize: 14, fontWeight: "900", color: COLORS.text },
  metaText: { marginTop: 6, fontSize: 12, fontWeight: "800", color: COLORS.sub },

  emptyWrap: {
    marginTop: 22,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border2,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: "900", color: COLORS.text },
  emptySub: { marginTop: 6, fontSize: 13, fontWeight: "700", color: COLORS.sub, textAlign: "center" },
});
