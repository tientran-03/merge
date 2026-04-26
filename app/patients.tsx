import { Stack, useRouter } from "expo-router";
import { Search, X, User, Phone, Mail, MapPin, ArrowLeft } from "lucide-react-native";
import React, { useMemo, useState, useEffect } from "react";
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

import { PaginationControls } from "@/components/PaginationControls";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { getPatientMbnDisplay } from "@/lib/patient-display";
import { patientService, PatientResponse } from "@/services/patientService";

const genderLabel = (g?: string) => {
  const s = (g || "").toUpperCase();
  if (s === "MALE") return "Nam";
  if (s === "FEMALE") return "Nữ";
  if (s === "OTHER") return "Khác";
  return g || "";
};

export default function PatientsScreen() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);

  // Debounce search query - chờ 500ms sau khi người dùng ngừng gõ
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data: patients,
    isLoading,
    error,
    refetch,
    isFetching,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<PatientResponse>({
    queryKey: ["patients", debouncedQuery.trim()],
    queryFn: async (params) => {
      const q = debouncedQuery.trim();
      console.log("[Patients] Searching with query:", q);
      if (q) {
        const result = await patientService.search(q, params);
        console.log("[Patients] Search result:", result);
        return result;
      }
      const result = await patientService.getAll(params);
      console.log("[Patients] GetAll result:", result);
      return result;
    },
    defaultPageSize: 20,
  });

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-slate-900 text-center mb-2">
            Không tải được dữ liệu
          </Text>
          <Text className="text-xs text-slate-500 text-center mb-4">
            Vui lòng kiểm tra kết nối mạng
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
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-slate-900 text-lg font-extrabold">Bệnh nhân</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                Tra cứu & quản lý thông tin bệnh nhân
              </Text>
            </View>

            <View className="px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-200 mr-2">
              <Text className="text-sm font-extrabold text-sky-700">{patients.length}</Text>
            </View>
          </View>
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
            placeholder="Tìm theo tên, mã, SĐT, email…"
            placeholderTextColor="#94A3B8"
            value={searchInput}
            onChangeText={setSearchInput}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
            returnKeyType="search"
          />
          {searchInput.trim() ? (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center"
              onPress={() => setSearchInput("")}
              activeOpacity={0.75}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor="#0284C7"
          />
        }
      >
        {patients.length === 0 ? (
          <View className="pt-10 items-center px-6">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 items-center justify-center border border-sky-200">
              <User size={26} color="#0284C7" />
            </View>
            <Text className="mt-4 text-base font-extrabold text-slate-900">
              {debouncedQuery.trim() ? "Không tìm thấy kết quả" : "Chưa có bệnh nhân"}
            </Text>
            <Text className="mt-2 text-xs font-bold text-slate-500 text-center">
              {debouncedQuery.trim()
                ? "Thử từ khóa khác hoặc xóa tìm kiếm."
                : "Danh sách bệnh nhân sẽ hiển thị tại đây."}
            </Text>
          </View>
        ) : (
          patients.map((p: PatientResponse) => {
            // Map data từ backend response
            const code = getPatientMbnDisplay(p);
            const name = p.patientName || p.name || "Không có tên";
            const phone = p.patientPhone || p.phone || "";
            const email = p.patientEmail || p.email || "";
            const address = p.patientAddress || p.address || "";
            const gender = p.gender;

            return (
              <TouchableOpacity
                key={p.patientId}
                activeOpacity={0.85}
                className="bg-white rounded-2xl p-4 mb-3 border border-sky-100"
                onPress={() => router.push(`/patient-detail?id=${p.patientId}`)}
              >
                <View className="flex-row justify-between items-center">
                  <View className="px-2.5 py-1.5 rounded-full bg-sky-50 border border-sky-200">
                    <Text className="text-xs font-extrabold text-sky-700">{code}</Text>
                  </View>
                  {gender ? (
                    <View className="px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200">
                      <Text className="text-xs font-extrabold text-slate-600">
                        {genderLabel(gender)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text className="mt-3 text-[15px] font-extrabold text-slate-900">
                  {name}
                </Text>

                <View className="mt-3 gap-2">
                  {!!phone && (
                    <View className="flex-row items-center">
                      <Phone size={14} color="#64748B" />
                      <Text className="ml-2 text-xs font-bold text-slate-600">{phone}</Text>
                    </View>
                  )}

                  {!!email && (
                    <View className="flex-row items-center">
                      <Mail size={14} color="#64748B" />
                      <Text className="ml-2 text-xs font-bold text-slate-600">{email}</Text>
                    </View>
                  )}

                  {!!address && (
                    <View className="flex-row items-center">
                      <MapPin size={14} color="#64748B" />
                      <Text
                        className="ml-2 flex-1 text-xs font-bold text-slate-600"
                        numberOfLines={2}
                      >
                        {address}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
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
