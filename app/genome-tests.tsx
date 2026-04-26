import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, FlaskConical, Plus, Search, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getApiResponseData } from "@/lib/types/api-types";
import { GenomeTestResponse, genomeTestService } from "@/services/genomeTestService";
import { SERVICE_TYPE_MAPPER } from "@/lib/schemas/order-schemas";

export default function GenomeTestsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["genome-tests"],
    queryFn: () => genomeTestService.getAll(),
  });

  const tests: GenomeTestResponse[] = useMemo(() => {
    return getApiResponseData<GenomeTestResponse>(data) || [];
  }, [data]);

  const filteredTests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((test) => {
      const name = (test.testName || "").toLowerCase();
      const id = (test.testId || "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [tests, searchQuery]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="pt-14 pb-3 px-4 bg-white border-b border-sky-100">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>
            <Text className="text-slate-900 text-lg font-extrabold">Xét nghiệm</Text>
          </View>
        </View>

        <View className="flex-1 justify-center items-center px-5">
          <Text className="text-slate-900 text-base font-extrabold mb-2">
            Không tải được dữ liệu
          </Text>
          <TouchableOpacity
            className="bg-sky-600 px-6 py-3 rounded-2xl"
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
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-slate-900 text-lg font-extrabold">Xét nghiệm</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                {filteredTests.length} xét nghiệm
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/create-genome-test")}
            className="w-10 h-10 rounded-xl bg-sky-600 items-center justify-center"
            activeOpacity={0.8}
          >
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View
          className={`mt-3 flex-row items-center rounded-2xl px-3 bg-sky-50 border ${
            focusSearch ? "border-sky-400" : "border-sky-100"
          }`}
        >
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm theo tên xét nghiệm…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
            returnKeyType="search"
          />
          {!!searchQuery.trim() && (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center"
              onPress={() => setSearchQuery("")}
              activeOpacity={0.75}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor="#0284C7" />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredTests.length === 0 ? (
          <View className="pt-10 items-center px-6">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 items-center justify-center border border-sky-200">
              <FlaskConical size={26} color="#0284C7" />
            </View>
            <Text className="mt-4 text-base font-extrabold text-slate-900">
              {searchQuery.trim() ? "Không có kết quả" : "Chưa có xét nghiệm"}
            </Text>
            <Text className="mt-2 text-xs font-bold text-slate-500 text-center">
              {searchQuery.trim()
                ? "Thử từ khóa khác."
                : "Danh sách xét nghiệm sẽ hiển thị ở đây."}
            </Text>
            {!searchQuery.trim() && (
              <TouchableOpacity
                className="mt-4 flex-row items-center bg-sky-600 px-4 py-3 rounded-2xl"
                onPress={() => router.push("/create-genome-test")}
                activeOpacity={0.85}
              >
                <Plus size={18} color="#fff" />
                <Text className="ml-2 text-white text-sm font-extrabold">Thêm xét nghiệm</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredTests.map((test) => (
            <TouchableOpacity
              key={test.testId}
              activeOpacity={0.85}
              className="bg-white rounded-2xl p-4 mb-3 border border-sky-100"
              onPress={() => {
                router.push({
                  pathname: "/genome-test-detail",
                  params: { testId: test.testId },
                });
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="px-2.5 py-1.5 rounded-full bg-sky-50 border border-sky-200">
                  <Text className="text-xs font-extrabold text-sky-700">{test.testId}</Text>
                </View>
                {test.service && (
                  <View className="px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200">
                    <Text className="text-xs font-extrabold text-slate-600">
                      {SERVICE_TYPE_MAPPER[test.service.name] || test.service.name}
                    </Text>
                  </View>
                )}
              </View>

              <Text className="text-[15px] font-extrabold text-slate-900 mb-2" numberOfLines={2}>
                {test.testName}
              </Text>

              {test.testDescription && (
                <Text className="text-xs text-slate-600 mb-2" numberOfLines={2}>
                  {test.testDescription}
                </Text>
              )}

              {test.price && (
                <Text className="text-sm font-extrabold text-sky-700">
                  {new Intl.NumberFormat("vi-VN").format(test.price)} VNĐ
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
