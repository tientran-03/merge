import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  Search,
  Plus,
  X,
  FlaskConical,
  Calendar,
  User,
  FileText,
  ArrowLeft,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { sampleAddService } from "@/services/sampleAddService";

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  } catch {
    return dateString;
  }
};

type UiSample = {
  sampleAddId: string;
  sampleName: string;
  sampleCode: string;
  orderId: string;
  orderCode: string;
  patientId: string;
  patientName: string;
  status: string;
  requestDate: string;
};

const normalizeStatus = (s?: string) => (s || "").toLowerCase();

export default function AdditionalSamplesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [focusSearch, setFocusSearch] = useState(false);

  const { data: samplesResponse, isLoading, error, refetch, isFetching } =
    useQuery({
      queryKey: ["sample-adds"],
      queryFn: async () => await sampleAddService.getAll(),
    });

  const samples: UiSample[] = useMemo(() => {
    if (!samplesResponse?.success) return [];
    return ((samplesResponse.data as any[]) || []).map((item) => ({
      sampleAddId: item.id || item.sampleAddId || "",
      sampleName: item.sampleName || "",
      sampleCode: item.sampleCode || item.id || "",
      orderId: item.orderId || "",
      orderCode: item.orderCode || item.orderId || "",
      patientId: item.patientId || "",
      patientName: item.patientName || "",
      status: item.status || "",
      requestDate: item.requestDate || item.createdAt || "",
    }));
  }, [samplesResponse]);

  const filteredSamples = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return samples;
    return samples.filter((sample) => {
      const name = (sample.sampleName || "").toLowerCase();
      const patient = (sample.patientName || "").toLowerCase();
      const code = (sample.sampleCode || sample.sampleAddId || "").toLowerCase();
      const order = (sample.orderCode || "").toLowerCase();
      return (
        name.includes(q) ||
        patient.includes(q) ||
        code.includes(q) ||
        order.includes(q)
      );
    });
  }, [samples, searchQuery]);

  const pendingCount = useMemo(() => {
    return filteredSamples.filter(
      (s) => normalizeStatus(s.status) === "pending",
    ).length;
  }, [filteredSamples]);

  const getBadge = (status: string) => {
    const s = normalizeStatus(status);
    const pending = s === "pending";
    return {
      text: pending ? "Chờ xử lý" : "Hoàn thành",
      bg: pending ? "rgba(2,132,199,0.10)" : "rgba(34,197,94,0.10)",
      border: pending ? "rgba(2,132,199,0.22)" : "rgba(34,197,94,0.22)",
      color: pending ? "#0284C7" : "#16A34A",
    };
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">
          Đang tải dữ liệu...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <View className="w-full max-w-[420px] bg-white rounded-2xl p-4 border border-sky-100">
          <Text className="text-base font-extrabold text-slate-900 mb-1.5 text-center">
            Không tải được dữ liệu
          </Text>
          <Text className="text-slate-500 text-xs font-bold mb-3.5 text-center leading-4.5">
            Vui lòng kiểm tra mạng hoặc thử lại sau.
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

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.75}
              className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 items-center justify-center mr-3"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color="#0F172A" />
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-slate-900 text-lg font-extrabold">
                Mẫu bổ sung
              </Text>
              <Text className="mt-1 text-xs text-slate-500">
                Quản lý yêu cầu mẫu bổ sung
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className="h-10 px-3 rounded-2xl bg-sky-600 flex-row items-center"
            activeOpacity={0.85}
            onPress={() => router.push("/new-sample-add")}
          >
            <Plus size={18} color="#fff" />
            <Text className="ml-1.5 text-white text-sm font-extrabold">
              Thêm
            </Text>
          </TouchableOpacity>
        </View>

        <View
          className={`mt-3 flex-row items-center rounded-2xl px-3 bg-sky-50 border ${
            focusSearch ? "border-sky-400" : "border-sky-100"
          }`}
          style={{ ...(Platform.OS === "android" ? { elevation: 0 } : {}) }}
        >
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm theo tên mẫu, bệnh nhân, mã mẫu, mã đơn…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
            returnKeyType="search"
          />
          {searchQuery.trim() ? (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center"
              onPress={() => setSearchQuery("")}
              activeOpacity={0.75}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View className="mt-3 flex-row gap-2">
          <View className="flex-1 bg-sky-50 border border-sky-100 rounded-2xl p-3">
            <Text className="text-xs text-slate-500 font-bold">Tổng</Text>
            <Text className="mt-1 text-lg font-extrabold text-slate-900">
              {filteredSamples.length}
            </Text>
          </View>
          <View className="flex-1 bg-sky-50 border border-sky-100 rounded-2xl p-3">
            <Text className="text-xs text-slate-500 font-bold">Chờ xử lý</Text>
            <Text className="mt-1 text-lg font-extrabold text-sky-700">
              {pendingCount}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 12,
          paddingBottom: 110,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor="#0284C7"
          />
        }
      >
        {filteredSamples.length === 0 ? (
          <View className="pt-10 items-center px-6">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 items-center justify-center border border-sky-200">
              <FlaskConical size={26} color="#0284C7" />
            </View>
            <Text className="mt-4 text-base font-extrabold text-slate-900 text-center">
              {searchQuery.trim()
                ? "Không tìm thấy kết quả"
                : "Chưa có mẫu bổ sung"}
            </Text>
            <Text className="mt-2 text-xs font-bold text-slate-500 text-center leading-5">
              {searchQuery.trim()
                ? "Thử từ khóa khác hoặc xóa nội dung tìm kiếm."
                : "Nhấn “Thêm” để tạo mẫu bổ sung mới."}
            </Text>

            <TouchableOpacity
              className="mt-4 flex-row items-center bg-sky-600 px-4 py-3 rounded-2xl"
              onPress={() => router.push("/new-sample-add")}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#fff" />
              <Text className="ml-2 text-white text-sm font-extrabold">
                Thêm mẫu
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredSamples.map((sample) => {
            const badge = getBadge(sample.status);
            const code = sample.sampleCode || sample.sampleAddId;

            return (
              <TouchableOpacity
                key={sample.sampleAddId}
                activeOpacity={0.85}
                className="bg-white rounded-2xl p-4 mb-3 border border-sky-100"
                onPress={() => {}}
              >
                <View className="flex-row items-center justify-between">
                  <View className="px-2.5 py-1.5 rounded-full bg-sky-50 border border-sky-200">
                    <Text className="text-xs font-extrabold text-sky-700 tracking-wide">
                      {code}
                    </Text>
                  </View>

                  <View
                    className="px-2.5 py-1.5 rounded-full border"
                    style={{
                      backgroundColor: badge.bg,
                      borderColor: badge.border,
                    }}
                  >
                    <Text
                      className="text-xs font-extrabold tracking-wide"
                      style={{ color: badge.color }}
                    >
                      {badge.text}
                    </Text>
                  </View>
                </View>

                <Text
                  className="mt-3 text-[15px] font-extrabold text-slate-900 leading-6"
                  numberOfLines={2}
                >
                  {sample.sampleName}
                </Text>

                <View className="mt-3 gap-2">
                  {!!sample.orderCode && (
                    <View className="flex-row items-center">
                      <FileText size={14} color="#64748B" />
                      <Text
                        className="ml-2 flex-1 text-xs font-bold text-slate-600"
                        numberOfLines={1}
                      >
                        Đơn: {sample.orderCode}
                      </Text>
                    </View>
                  )}

                  {!!sample.patientName && (
                    <View className="flex-row items-center">
                      <User size={14} color="#64748B" />
                      <Text
                        className="ml-2 flex-1 text-xs font-bold text-slate-600"
                        numberOfLines={1}
                      >
                        {sample.patientName}
                      </Text>
                    </View>
                  )}

                  {!!sample.requestDate && (
                    <View className="flex-row items-center">
                      <Calendar size={14} color="#64748B" />
                      <Text className="ml-2 flex-1 text-xs font-bold text-slate-600">
                        Ngày yêu cầu: {formatDate(sample.requestDate)}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        className="absolute right-4 bottom-5 w-14 h-14 rounded-2xl"
        onPress={() => router.push("/new-sample-add")}
        activeOpacity={0.9}
        style={
          Platform.OS === "android"
            ? { elevation: 6 }
            : {
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
              }
        }
      >
        <View className="flex-1 rounded-2xl bg-sky-600 items-center justify-center">
          <Plus size={22} color="#fff" />
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
