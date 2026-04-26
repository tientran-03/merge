import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Package,
  Search,
  X,
  XCircle,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "@/constants/colors";
import { ConfirmModal } from "@/components/modals";
import { presentFeedbackError, presentFeedbackSuccess } from "@/lib/feedbackModal";
import { isSampleAddPendingApproval } from "@/lib/sample-add-pending";
import { getApiResponseData } from "@/lib/types/api-types";
import { SampleAddResponse, sampleAddService } from "@/services/sampleAddService";

const formatDate = (dateString?: string): string => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

function statusLabel(status?: string): string {
  const s = (status || "").toLowerCase();
  if (s === "initation" || s === "initiation") return "Chờ duyệt";
  if (s === "forward_analysis") return "Chuyển phân tích";
  if (s === "accepted") return "Đã chấp nhận";
  if (s === "rejected") return "Từ chối";
  return status || "—";
}

export default function StaffSampleAddsPendingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectName, setRejectName] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["sample-adds"],
    queryFn: () => sampleAddService.getAll(),
  });

  const samples: SampleAddResponse[] = useMemo(
    () => getApiResponseData<SampleAddResponse>(data) || [],
    [data]
  );

  const pendingList = useMemo(
    () => samples.filter((s) => isSampleAddPendingApproval(s.status)),
    [samples]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pendingList;
    return pendingList.filter((s) => {
      const hay = [
        s.sampleName,
        s.orderId,
        s.patientId,
        s.patientName,
        s.note,
        s.sampleCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [pendingList, searchQuery]);

  const resolveId = (s: SampleAddResponse) => String(s.sampleAddId ?? s.id ?? "");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["sample-adds"] });
  };

  const acceptMutation = useMutation({
    mutationFn: (id: string) => sampleAddService.updateStatus(id, "accepted"),
    onSuccess: () => {
      invalidate();
      presentFeedbackSuccess({ title: "Đã chấp nhận", message: "Đã cập nhật trạng thái mẫu bổ sung." });
    },
    onError: (err: any) =>
      presentFeedbackError({ title: "Lỗi", message: err?.message || "Không thể cập nhật." }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => sampleAddService.updateStatus(id, "rejected"),
    onSuccess: () => {
      setRejectId(null);
      setRejectName("");
      invalidate();
      presentFeedbackSuccess({ title: "Đã từ chối", message: "Yêu cầu mẫu bổ sung đã bị từ chối." });
    },
    onError: (err: any) => {
      setRejectId(null);
      presentFeedbackError({ title: "Lỗi", message: err?.message || "Không thể từ chối." });
    },
  });

  const onPressReject = (s: SampleAddResponse) => {
    const id = resolveId(s);
    if (!id) {
      Alert.alert("Lỗi", "Không xác định được mã mẫu bổ sung.");
      return;
    }
    setRejectId(id);
    setRejectName(s.sampleName || id);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="mt-3 text-sm font-bold text-slate-500">Đang tải...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-sky-50 px-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="mb-4 text-center text-red-500">
          {error instanceof Error ? error.message : "Không tải được danh sách"}
        </Text>
        <TouchableOpacity onPress={() => refetch()} className="rounded-2xl bg-sky-600 px-6 py-3">
          <Text className="font-bold text-white">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen options={{ headerShown: false }} />

      <View className="border-b border-sky-100 bg-white px-4 pb-3 pt-2">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <View className="min-w-0 flex-1">
            <Text className="text-[17px] font-extrabold text-slate-900">Mẫu bổ sung chờ duyệt</Text>
            <Text className="mt-0.5 text-[12px] font-semibold text-slate-500">
              {filtered.length} / {pendingList.length} mẫu
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center rounded-2xl border border-sky-100 bg-sky-50 px-3">
          <Search size={18} color="#64748B" />
          <TextInput
            className="ml-2 h-11 flex-1 text-[14px] font-semibold text-slate-900"
            placeholder="Tìm theo tên mẫu, mã đơn, BN..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {!!searchQuery.trim() && (
            <TouchableOpacity onPress={() => setSearchQuery("")} className="p-2" hitSlop={8}>
              <X size={18} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {filtered.length === 0 ? (
          <View className="items-center py-16 px-4">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-sky-100">
              <Package size={36} color={COLORS.primary} />
            </View>
            <Text className="text-center text-base font-extrabold text-slate-800">
              {pendingList.length === 0 ? "Không có mẫu chờ duyệt" : "Không khớp bộ lọc"}
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
              {pendingList.length === 0
                ? "Các yêu cầu mới sẽ hiện khi khách gửi mẫu bổ sung."
                : "Thử đổi từ khóa tìm kiếm."}
            </Text>
          </View>
        ) : (
          filtered.map((s) => {
            const id = resolveId(s);
            const busy = acceptMutation.isPending || rejectMutation.isPending;
            return (
              <View
                key={id || `${s.orderId}-${s.sampleName}`}
                className="mb-3 overflow-hidden rounded-2xl border border-sky-100 bg-white"
              >
                <View className="border-l-[3px] border-amber-500 px-4 py-3">
                  <View className="flex-row items-start gap-2">
                    <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
                      <ClipboardList size={18} color={COLORS.primary} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[15px] font-extrabold text-slate-900" numberOfLines={2}>
                        {s.sampleName || "Mẫu bổ sung"}
                      </Text>
                      <View className="mt-1 self-start rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5">
                        <Text className="text-[10px] font-extrabold text-amber-800">
                          {statusLabel(s.status)}
                        </Text>
                      </View>
                      {!!s.orderId && (
                        <Text className="mt-2 text-[12px] font-semibold text-slate-600">
                          Đơn: <Text className="font-mono text-slate-800">{s.orderId}</Text>
                        </Text>
                      )}
                      {(s.patientName || s.patientId) && (
                        <Text className="mt-0.5 text-[12px] text-slate-500">
                          BN: {s.patientName || s.patientId}
                        </Text>
                      )}
                      {s.requestDate && (
                        <Text className="mt-1 text-[11px] text-slate-400">
                          Gửi lúc {formatDate(s.requestDate)}
                        </Text>
                      )}
                      {s.note ? (
                        <Text className="mt-2 text-[12px] leading-4 text-slate-600" numberOfLines={3}>
                          {s.note}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View className="mt-3 flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        if (!id || busy) return;
                        Alert.alert(
                          "Chấp nhận mẫu bổ sung",
                          `Xác nhận chấp nhận «${s.sampleName || id}»?`,
                          [
                            { text: "Hủy", style: "cancel" },
                            { text: "Chấp nhận", onPress: () => acceptMutation.mutate(id) },
                          ]
                        );
                      }}
                      disabled={!id || busy}
                      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 ${
                        !id || busy ? "opacity-50" : ""
                      }`}
                      activeOpacity={0.85}
                    >
                      <Check size={18} color="#047857" />
                      <Text className="text-[14px] font-extrabold text-emerald-800">Chấp nhận</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onPressReject(s)}
                      disabled={!id || busy}
                      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2.5 ${
                        !id || busy ? "opacity-50" : ""
                      }`}
                      activeOpacity={0.85}
                    >
                      <XCircle size={18} color="#be123c" />
                      <Text className="text-[14px] font-extrabold text-rose-800">Từ chối</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!rejectId}
        title="Từ chối mẫu bổ sung"
        message={`Từ chối yêu cầu «${rejectName}»? Khách sẽ thấy trạng thái Từ chối.`}
        confirmText="Từ chối"
        cancelText="Hủy"
        destructive
        onConfirm={() => {
          if (rejectId) rejectMutation.mutate(rejectId);
        }}
        onCancel={() => {
          setRejectId(null);
          setRejectName("");
        }}
      />
    </SafeAreaView>
  );
}
