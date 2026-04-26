import { Stack, useRouter } from "expo-router";
import { ArrowLeft, FileText, Search, X, FlaskConical } from "lucide-react-native";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { annotationService, AnnotationJob } from "@/services/annotationService";

const formatDate = (dateString?: string): string => {
  if (!dateString) return "-";
  try {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

const getStatusLabel = (status?: string): string => {
  if (!status) return "Không rõ";
  const statusMap: Record<string, string> = {
    completed: "Hoàn thành",
    running: "Đang chạy",
    queued: "Đang chờ",
    error: "Lỗi",
    failed: "Thất bại",
  };
  return statusMap[status.toLowerCase()] || status;
};

const getStatusColor = (status?: string): string => {
  if (!status) return "bg-slate-500";
  const s = status.toLowerCase();
  if (s === "completed") return "bg-emerald-500";
  if (s === "running") return "bg-blue-500";
  if (s === "queued") return "bg-amber-500";
  if (s === "error" || s === "failed") return "bg-red-500";
  return "bg-slate-500";
};

export default function AnnotationsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [annotations, setAnnotations] = useState<AnnotationJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnotations = useCallback(async () => {
    try {
      setError(null);
      const response = await annotationService.fetchAllJobs();
      if (response.success && response.data) {
        // Sort by submission time descending
        const sorted = [...response.data].sort((a, b) => {
          const timeA = a.submission_time
            ? new Date(a.submission_time).getTime()
            : 0;
          const timeB = b.submission_time
            ? new Date(b.submission_time).getTime()
            : 0;
          return timeB - timeA;
        });
        setAnnotations(sorted);
        // Nếu không có data nhưng không có lỗi, không set error
        if (sorted.length === 0) {
          setError(null);
        }
      } else {
        // Kiểm tra nếu là lỗi 500 hoặc SYSTEM_003
        const errorMsg = response.error || "";
        if (
          errorMsg.includes("SYSTEM_003") ||
          errorMsg.includes("Lỗi hệ thống") ||
          errorMsg.includes("500")
        ) {
          setError("Tính năng OpenCRAVAT Annotation chưa được kích hoạt trên hệ thống. Vui lòng liên hệ quản trị viên để kích hoạt tính năng này.");
        } else {
          setError(response.error || null);
        }
        setAnnotations([]);
      }
    } catch (err: any) {
      console.error("Error fetching annotations:", err);
      // Kiểm tra nếu là lỗi 500 hoặc SYSTEM_003
      if (err?.message?.includes("500") || err?.message?.includes("SYSTEM_003")) {
        setError("Tính năng OpenCRAVAT Annotation chưa được kích hoạt trên hệ thống. Vui lòng liên hệ quản trị viên.");
      } else {
        setError(err?.message || "Có lỗi xảy ra khi tải dữ liệu");
      }
      setAnnotations([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setIsLoading(true);
    await fetchAnnotations();
  };

  const filtered = annotations.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.id || "").toLowerCase().includes(q) ||
      (item.run_name || "").toLowerCase().includes(q) ||
      (item.note || "").toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center mb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#0284C7" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">Chú giải gen</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Quản lý annotation jobs và kết quả phân tích
            </Text>
          </View>
        </View>

        {/* Search */}
        <View
          className={`flex-row items-center px-3 py-2 rounded-xl border ${
            focusSearch
              ? "bg-white border-sky-400"
              : "bg-sky-50 border-sky-200"
          }`}
        >
          <Search size={18} color="#64748b" />
          <TextInput
            className="flex-1 ml-2 text-slate-900 text-sm"
            placeholder="Tìm kiếm theo ID, tên job, ghi chú..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              className="ml-2"
              activeOpacity={0.7}
            >
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#0284C7" />
            <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center py-20 px-4">
            <View className="w-24 h-24 rounded-full bg-amber-100 items-center justify-center mb-6">
              <FlaskConical size={48} color="#f59e0b" />
            </View>
            <Text className="text-slate-900 text-lg font-extrabold mb-2 text-center">
              Tính năng chưa sẵn sàng
            </Text>
            <Text className="text-slate-600 text-sm text-center mb-1">
              OpenCRAVAT Annotation Service
            </Text>
            <Text className="text-slate-500 text-xs text-center mb-4 px-4 leading-5">
              {error.includes("chưa được kích hoạt") 
                ? error
                : "Tính năng chú giải gen đang được phát triển hoặc chưa được kích hoạt trên hệ thống. Vui lòng liên hệ quản trị viên để biết thêm chi tiết."}
            </Text>
            {!error.includes("chưa được kích hoạt") && (
              <TouchableOpacity
                onPress={handleRefresh}
                className="px-6 py-3 bg-sky-600 rounded-xl"
                activeOpacity={0.8}
              >
                <Text className="text-white font-bold">Thử lại</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-24 h-24 rounded-full bg-sky-100 items-center justify-center mb-6">
              <FlaskConical size={48} color="#0284C7" />
            </View>
            <Text className="text-slate-900 text-xl font-extrabold mb-2 text-center">
              {searchQuery ? "Không tìm thấy" : "Chưa có annotation"}
            </Text>
            <Text className="text-slate-500 text-sm text-center px-4">
              {searchQuery
                ? "Không có annotation nào khớp với từ khóa tìm kiếm."
                : "Chưa có annotation job nào được tạo. Hãy tạo annotation job mới từ web để bắt đầu phân tích gen."}
            </Text>
          </View>
        ) : (
          <>
            <View className="mb-4">
              <Text className="text-slate-600 text-sm font-bold">
                Tổng cộng: {filtered.length} annotation job
              </Text>
            </View>

            {filtered.map((item) => {
              const statusColor = getStatusColor(item.status);
              return (
                <TouchableOpacity
                  key={item.id}
                  className="bg-white rounded-xl p-4 mb-3 border border-sky-100"
                  activeOpacity={0.7}
                  onPress={() => {
                    Alert.alert(
                      "Thông báo",
                      "Tính năng xem chi tiết annotation đang được phát triển.",
                    );
                  }}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-slate-900 font-extrabold text-base mb-1">
                        {item.run_name || item.id || "Không có tên"}
                      </Text>
                      {item.note && (
                        <Text className="text-slate-600 text-sm mb-1">
                          {item.note}
                        </Text>
                      )}
                      {item.orig_input_fname && item.orig_input_fname.length > 0 && (
                        <Text className="text-slate-500 text-xs mb-1">
                          File: {item.orig_input_fname.join(", ")}
                        </Text>
                      )}
                      {item.annotators && item.annotators.length > 0 && (
                        <Text className="text-slate-500 text-xs mb-1">
                          Annotators: {item.annotators.join(", ")}
                        </Text>
                      )}
                      {item.num_input_var !== undefined && (
                        <Text className="text-slate-500 text-xs">
                          Số biến thể: {item.num_input_var}
                        </Text>
                      )}
                    </View>
                    {item.status && (
                      <View className={`ml-2 px-2 py-1 rounded-lg ${statusColor}`}>
                        <Text className="text-white text-xs font-bold">
                          {getStatusLabel(item.status)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-sky-100">
                    {item.submission_time && (
                      <Text className="text-slate-500 text-xs">
                        Tạo: {formatDate(item.submission_time)}
                      </Text>
                    )}
                    <Text className="text-slate-500 text-xs">
                      Nhấn để xem chi tiết
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
