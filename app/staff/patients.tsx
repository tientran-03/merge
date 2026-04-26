import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PaginationControls } from "@/components/PaginationControls";
import { useAuth } from "@/contexts/AuthContext";
import { presentFeedbackError, presentFeedbackSuccess } from "@/lib/feedbackModal";
import { patientGenderLabel } from "@/lib/patient-utils";
import { useStaffDoctorBasePath } from "@/lib/staff-doctor-route";
import { PatientResponse, patientService } from "@/services/patientService";

const PAGE_SIZE = 20;

type GenderFilter = "all" | "male" | "female" | "other";

function patientSearchBlob(p: PatientResponse): string {
  return [
    p.patientId,
    p.patientName,
    p.name,
    p.patientPhone,
    p.phone,
    p.patientEmail,
    p.email,
    p.patientAddress,
    p.address,
  ]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ");
}

function patientMatchesSearch(p: PatientResponse, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return patientSearchBlob(p).includes(n);
}

export default function PatientsScreen() {
  const router = useRouter();
  const base = useStaffDoctorBasePath();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const hospitalId =
    user?.hospitalId != null && String(user.hospitalId).trim() !== ""
      ? String(user.hospitalId).trim()
      : null;

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedQuery, genderFilter]);

  const {
    data: hospitalRes,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["patients", "by-hospital", hospitalId],
    queryFn: () => patientService.getByHospitalId(hospitalId!),
    enabled: !!hospitalId,
    retry: false,
  });

  const allPatients = useMemo((): PatientResponse[] => {
    if (!hospitalRes?.success || !hospitalRes.data) return [];
    const d = hospitalRes.data as unknown;
    return Array.isArray(d) ? d : [];
  }, [hospitalRes]);

  const filteredPatients = useMemo(() => {
    let rows = [...allPatients];
    if (genderFilter !== "all") {
      rows = rows.filter((p) => (p.gender || "") === genderFilter);
    }
    if (debouncedQuery.trim()) {
      rows = rows.filter((p) => patientMatchesSearch(p, debouncedQuery));
    }
    return rows;
  }, [allPatients, debouncedQuery, genderFilter]);

  const totalElements = filteredPatients.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE) || 1);

  const paginatedPatients = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredPatients.slice(start, start + PAGE_SIZE);
  }, [filteredPatients, currentPage]);

  useEffect(() => {
    if (currentPage > 0 && currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => patientService.delete(id),
    onSuccess: (res, id) => {
      if (!res.success) {
        presentFeedbackError({
          title: "Lỗi",
          message: res.error || res.message || "Không thể xóa bệnh nhân",
        });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      void refetch();
      presentFeedbackSuccess({ title: "Thành công", message: "Đã xóa bệnh nhân." });
    },
    onError: (e: any) => {
      presentFeedbackError({ title: "Lỗi", message: e?.message || "Không thể xóa bệnh nhân" });
    },
  });

  const confirmDelete = (p: PatientResponse) => {
    const name = p.patientName || p.name || p.patientId;
    Alert.alert("Xác nhận xóa", `Xóa bệnh nhân "${name}"? Thao tác không hoàn tác.`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => deleteMutation.mutate(p.patientId),
      },
    ]);
  };

  if (!hospitalId) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-base font-extrabold text-slate-900 text-center">
          Chưa gắn cơ sở (bệnh viện)
        </Text>
        <Text className="mt-2 text-xs font-semibold text-slate-600 text-center leading-5">
          Tài khoản nhân viên cần có hospitalId để xem danh sách bệnh nhân theo cơ sở (giống web).
        </Text>
        <TouchableOpacity
          className="mt-6 rounded-2xl bg-sky-600 px-6 py-3"
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text className="text-white font-extrabold">Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <Stack.Screen options={{ headerShown: false }} />
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
    <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
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
              <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={2}>
                Theo cơ sở của bạn — tra cứu & quản lý (giống web)
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/staff/create-patient")}
              className="w-10 h-10 rounded-xl bg-sky-600 items-center justify-center mr-2"
              activeOpacity={0.8}
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>

            <View className="px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-200">
              <Text className="text-sm font-extrabold text-sky-700">{totalElements}</Text>
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
            placeholder="Tìm theo mã, tên, SĐT, email, địa chỉ…"
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        >
          {(
            [
              { key: "all" as const, label: "Tất cả" },
              { key: "male" as const, label: "Nam" },
              { key: "female" as const, label: "Nữ" },
              { key: "other" as const, label: "Khác" },
            ] as const
          ).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setGenderFilter(opt.key)}
              className={`px-3 py-2 rounded-full border ${
                genderFilter === opt.key ? "bg-sky-600 border-sky-600" : "bg-white border-sky-100"
              }`}
              activeOpacity={0.85}
            >
              <Text
                className={`text-xs font-extrabold ${
                  genderFilter === opt.key ? "text-white" : "text-slate-600"
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
        {paginatedPatients.length === 0 ? (
          <View className="pt-10 items-center px-6">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 items-center justify-center border border-sky-200">
              <User size={26} color="#0284C7" />
            </View>
            <Text className="mt-4 text-base font-extrabold text-slate-900">
              {debouncedQuery.trim() || genderFilter !== "all"
                ? "Không có bệnh nhân phù hợp"
                : "Chưa có bệnh nhân"}
            </Text>
            <Text className="mt-2 text-xs font-bold text-slate-500 text-center">
              {debouncedQuery.trim() || genderFilter !== "all"
                ? "Thử đổi bộ lọc hoặc từ khóa."
                : "Thêm bệnh nhân hoặc chờ đồng bộ từ đơn hàng."}
            </Text>
            {!debouncedQuery.trim() && genderFilter === "all" ? (
              <TouchableOpacity
                onPress={() => router.push(`${base}/create-patient` as any)}
                className="mt-6 rounded-2xl bg-sky-600 px-6 py-3 flex-row items-center"
                activeOpacity={0.85}
              >
                <Plus size={18} color="#fff" />
                <Text className="ml-2 text-white font-extrabold">Thêm bệnh nhân</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          paginatedPatients.map((p: PatientResponse) => {
            const code = p.patientCode || p.patientId || "";
            const name = p.patientName || p.name || "Không có tên";
            const phone = p.patientPhone || p.phone || "";
            const email = p.patientEmail || p.email || "";
            const address = p.patientAddress || p.address || "";
            const gender = p.gender;

            return (
              <View
                key={p.patientId}
                className="bg-white rounded-2xl mb-3 border border-sky-100 overflow-hidden"
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  className="p-4"
                  onPress={() => router.push(`${base}/patient-detail?id=${p.patientId}` as any)}
                >
                  <View className="flex-row justify-between items-center">
                    <View className="px-2.5 py-1.5 rounded-full bg-sky-50 border border-sky-200">
                      <Text className="text-xs font-extrabold text-sky-700">{code}</Text>
                    </View>
                    {gender ? (
                      <View className="px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200">
                        <Text className="text-xs font-extrabold text-slate-600">
                          {patientGenderLabel(gender)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text className="mt-3 text-[15px] font-extrabold text-slate-900">{name}</Text>

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
                <View className="flex-row border-t border-sky-100">
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center py-3 bg-sky-50/80"
                    onPress={() =>
                      router.push(
                        `${base}/edit-patient?patientId=${encodeURIComponent(p.patientId)}` as any
                      )
                    }
                    activeOpacity={0.85}
                  >
                    <Pencil size={16} color="#0284C7" />
                    <Text className="ml-2 text-xs font-extrabold text-sky-700">Sửa</Text>
                  </TouchableOpacity>
                  <View className="w-px bg-sky-100" />
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center py-3 bg-rose-50/50"
                    onPress={() => confirmDelete(p)}
                    disabled={deleteMutation.isPending}
                    activeOpacity={0.85}
                  >
                    <Trash2 size={16} color="#DC2626" />
                    <Text className="ml-2 text-xs font-extrabold text-rose-700">Xóa</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={PAGE_SIZE}
          totalElements={totalElements}
          isLoading={isLoading}
        />
      )}
    </SafeAreaView>
  );
}
