import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Edit, FlaskConical, Trash2 } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getApiResponseData } from "@/lib/types/api-types";
import { SERVICE_TYPE_MAPPER } from "@/lib/schemas/order-schemas";
import { GenomeTestResponse, genomeTestService } from "@/services/genomeTestService";

export default function GenomeTestDetailScreen() {
  const router = useRouter();
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const queryClient = useQueryClient();

  const {
    data: testResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["genome-test", testId],
    queryFn: () => genomeTestService.getById(testId!),
    enabled: !!testId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => genomeTestService.delete(testId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genome-tests"] });
      Alert.alert("Thành công", "Xét nghiệm đã được xóa thành công", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể xóa xét nghiệm. Vui lòng thử lại.");
    },
  });

  const handleDelete = () => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa xét nghiệm này? Hành động này không thể hoàn tác.",
      [
        {
          text: "Hủy",
          style: "cancel",
        },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error || !testResponse?.success) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-slate-900 text-center mb-2">
            Không tải được dữ liệu
          </Text>
          <Text className="text-xs text-slate-500 text-center mb-4">
            {error?.message || "Không tìm thấy xét nghiệm"}
          </Text>
          <TouchableOpacity
            className="bg-sky-600 py-3 rounded-2xl items-center"
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text className="text-white text-sm font-extrabold">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const test: GenomeTestResponse = testResponse.data as GenomeTestResponse;

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-slate-900 text-lg font-extrabold">Chi tiết xét nghiệm</Text>
              <Text className="mt-0.5 text-xs text-slate-500">{test.testId}</Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => {
                if (testId) {
                  router.push({
                    pathname: "/staff/edit-genome-test",
                    params: { testId },
                  });
                }
              }}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center"
              activeOpacity={0.8}
            >
              <Edit size={18} color="#0284C7" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 items-center justify-center"
              activeOpacity={0.8}
            >
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white rounded-2xl border border-sky-100 p-4">
          <Text className="text-slate-900 text-base font-extrabold mb-4">Thông tin xét nghiệm</Text>

          <View className="gap-3">
            <View className="flex-row items-start">
              <FlaskConical size={18} color="#64748B" className="mt-0.5" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-slate-500 font-bold">Mã xét nghiệm</Text>
                <Text className="mt-1 text-sm font-extrabold text-slate-900">{test.testId}</Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="ml-3 flex-1">
                <Text className="text-xs text-slate-500 font-bold">Tên xét nghiệm</Text>
                <Text className="mt-1 text-sm font-extrabold text-slate-900">{test.testName}</Text>
              </View>
            </View>

            {test.testDescription && (
              <View className="flex-row items-start">
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Mô tả</Text>
                  <Text className="mt-1 text-sm text-slate-900">{test.testDescription}</Text>
                </View>
              </View>
            )}

            {test.service && (
              <View className="flex-row items-start">
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Loại dịch vụ</Text>
                  <Text className="mt-1 text-sm font-extrabold text-slate-900">
                    {SERVICE_TYPE_MAPPER[test.service.name] || test.service.name}
                  </Text>
                </View>
              </View>
            )}

            {test.price && (
              <View className="flex-row items-start">
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Giá</Text>
                  <Text className="mt-1 text-sm font-extrabold text-sky-700">
                    {new Intl.NumberFormat("vi-VN").format(test.price)} VNĐ
                  </Text>
                </View>
              </View>
            )}

            {test.testSample && test.testSample.length > 0 && (
              <View className="flex-row items-start">
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Mẫu xét nghiệm</Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {test.testSample.map((sample, index) => (
                      <View
                        key={index}
                        className="px-2.5 py-1.5 rounded-full bg-sky-50 border border-sky-200"
                      >
                        <Text className="text-xs font-extrabold text-sky-700">{sample}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
