import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  Trash2,
  User,
  UserCircle,
} from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { patientGenderLabel } from "@/lib/patient-utils";
import { getApiResponseData } from "@/lib/types/api-types";
import { orderService, OrderResponse } from "@/services/orderService";
import {
  patientClinicalService,
  PatientClinicalResponse,
} from "@/services/patientClinicalService";
import { patientService, PatientResponse } from "@/services/patientService";
import {
  specifyVoteTestService,
  SpecifyVoteTestResponse,
} from "@/services/specifyVoteTestService";

const formatDate = (dateString?: string): string => {
  if (!dateString) return "Chưa cập nhật";
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

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => {
  if (!value || value === "Chưa cập nhật") {
    return null;
  }
  return (
    <View className="flex-row items-start mb-4">
      <View className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-xs font-bold text-slate-500 mb-1">{label}</Text>
        <Text className="text-sm font-extrabold text-slate-900">{value}</Text>
      </View>
    </View>
  );
};

export default function PatientDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      if (!id) throw new Error("Patient ID is required");
      return await patientService.getById(id);
    },
    enabled: !!id,
  });
  const { data: clinicalData } = useQuery({
    queryKey: ["patient-clinical", id],
    queryFn: () => patientClinicalService.getByPatientId(id!),
    enabled: !!id,
  });
  const { data: ordersData } = useQuery({
    queryKey: ["orders-by-patient", id],
    queryFn: () => orderService.getByPatientId(id!),
    enabled: !!id,
  });
  const { data: specifyData } = useQuery({
    queryKey: ["specify-by-patient", id],
    queryFn: () => specifyVoteTestService.getByPatientId(id!),
    enabled: !!id,
  });

  // Mặc định mở tab "Phiếu bệnh nhân" trước
  // Phải đặt hook này TRƯỚC các câu lệnh return sớm
  const [activeTab, setActiveTab] = React.useState<"info" | "specify">("specify");

  const patient: PatientResponse | null = data?.success
    ? (data.data as PatientResponse)
    : null;

  const clinical: PatientClinicalResponse | null =
    clinicalData?.success && clinicalData.data
      ? (clinicalData.data as PatientClinicalResponse)
      : null;

  const orders: OrderResponse[] = getApiResponseData<OrderResponse>(ordersData);
  const patientSpecifies: SpecifyVoteTestResponse[] =
    getApiResponseData<SpecifyVoteTestResponse>(specifyData);

  const deleteMutation = useMutation({
    mutationFn: () => patientService.delete(id!),
    onSuccess: res => {
      if (!res.success) {
        presentFeedbackError({
          title: 'Lỗi',
          message: res.error || res.message || 'Không thể xóa',
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      presentFeedbackSuccess({
        title: 'Thành công',
        message: 'Đã xóa bệnh nhân.',
        onAfterClose: () => router.back(),
      });
    },
    onError: (e: any) =>
      presentFeedbackError({ title: 'Lỗi', message: e?.message || 'Không thể xóa bệnh nhân' }),
  });

  const confirmDelete = () => {
    if (!id) return;
    const p = data?.success ? (data.data as PatientResponse) : null;
    const display = p?.patientName || p?.name || id;
    Alert.alert("Xác nhận xóa", `Xóa bệnh nhân "${display}"? Không hoàn tác.`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  };

  const totalServicesUsed = React.useMemo(() => {
    const uniqueTests = new Set(
      patientSpecifies
        .map((s) => s.genomeTestId || s.genomeTest?.testId)
        .filter(Boolean) as string[],
    );
    return uniqueTests.size;
  }, [patientSpecifies]);

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "";
    try {
      const d = new Date(dateString);
      return d.toLocaleString("vi-VN");
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">
          Đang tải thông tin bệnh nhân...
        </Text>
      </View>
    );
  }

  if (error || !patient) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-slate-900 text-center mb-2">
            Không tải được thông tin
          </Text>
          <Text className="text-xs text-slate-500 text-center mb-4">
            {error?.message || "Không tìm thấy bệnh nhân"}
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

  const code = patient.patientCode || patient.patientId || "";
  const name = patient.patientName || patient.name || "Chưa cập nhật";
  const phone = patient.patientPhone || patient.phone || "";
  const email = patient.patientEmail || patient.email || "";
  const address = patient.patientAddress || patient.address || "";
  const dob = patient.patientDob || patient.dateOfBirth || "";
  const job = patient.patientJob || "";
  const contactName = patient.patientContactName || "";
  const contactPhone = patient.patientContactPhone || "";
  const gender = patient.gender;

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View className="pb-4 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#0284C7" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">
              Chi tiết bệnh nhân
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Thông tin đầy đủ
            </Text>
          </View>

          <TouchableOpacity
            onPress={() =>
              router.push(`/customer/edit-patient?patientId=${encodeURIComponent(patient.patientId)}`)
            }
            className="flex-row items-center px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 mr-2"
            activeOpacity={0.8}
            accessibilityLabel="Sửa bệnh nhân"
          >
            <Pencil size={18} color="#0284C7" />
            <Text className="ml-1.5 text-xs font-extrabold text-sky-700">Sửa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={deleteMutation.isPending}
            className="flex-row items-center px-3 py-2 rounded-xl bg-rose-50 border border-rose-200"
            activeOpacity={0.8}
            accessibilityLabel="Xóa bệnh nhân"
          >
            <Trash2 size={18} color="#DC2626" />
            <Text className="ml-1.5 text-xs font-extrabold text-rose-700">Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor="#0284C7"
          />
        }
      >
        {/* Patient Card */}
        <View className="bg-white rounded-2xl p-5 mb-4 border border-sky-100">
          <View className="flex-row items-center mb-4">
            <View className="w-16 h-16 rounded-2xl bg-sky-100 border border-sky-200 items-center justify-center mr-4">
              <User size={28} color="#0284C7" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-extrabold text-slate-900 mb-1">
                {name}
              </Text>
              <View className="flex-row items-center">
                <View className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 mr-2">
                  <Text className="text-xs font-extrabold text-sky-700">
                    {code}
                  </Text>
                </View>
                {gender && (
                  <View className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200">
                    <Text className="text-xs font-extrabold text-slate-600">
                      {patientGenderLabel(gender) || "Chưa cập nhật"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Tabs: 1) Phiếu bệnh nhân (trái), 2) Thông tin cá nhân (phải) */}
        <View className="flex-row mt-1 mb-3 bg-slate-100 rounded-2xl p-1">
          <TouchableOpacity
            onPress={() => setActiveTab("specify")}
            activeOpacity={0.85}
            className={`flex-1 py-2 rounded-2xl items-center ${
              activeTab === "specify" ? "bg-white" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-xs font-extrabold ${
                activeTab === "specify" ? "text-sky-700" : "text-slate-500"
              }`}
            >
              Phiếu bệnh nhân
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("info")}
            activeOpacity={0.85}
            className={`flex-1 py-2 rounded-2xl items-center ${
              activeTab === "info" ? "bg-white" : "bg-transparent"
            }`}
          >
            <Text
              className={`text-xs font-extrabold ${
                activeTab === "info" ? "text-sky-700" : "text-slate-500"
              }`}
            >
              Thông tin cá nhân
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "info" ? (
          <>
            {/* Thông tin cá nhân */}
            <View className="bg-white rounded-2xl p-5 border border-sky-100">
              <Text className="text-base font-extrabold text-slate-900 mb-4">
                Thông tin cá nhân
              </Text>

              <InfoRow
                icon={<Phone size={18} color="#0284C7" />}
                label="Số điện thoại"
                value={phone}
              />

              <InfoRow
                icon={<Mail size={18} color="#0284C7" />}
                label="Email"
                value={email}
              />

              <InfoRow
                icon={<Calendar size={18} color="#0284C7" />}
                label="Ngày sinh"
                value={formatDate(dob)}
              />

              <InfoRow
                icon={<Briefcase size={18} color="#0284C7" />}
                label="Nghề nghiệp"
                value={job}
              />

              <InfoRow
                icon={<MapPin size={18} color="#0284C7" />}
                label="Địa chỉ"
                value={address}
              />
            </View>

            {/* Thông tin lâm sàng */}
            {clinical && (
              <View className="bg-white rounded-2xl p-5 mt-4 border border-sky-100">
                <Text className="text-base font-extrabold text-slate-900 mb-4">
                  Thông tin lâm sàng
                </Text>

                <InfoRow
                  icon={<Briefcase size={18} color="#0284C7" />}
                  label="Tiền sử bản thân"
                  value={clinical.patientHistory || "Chưa cập nhật"}
                />
                <InfoRow
                  icon={<Briefcase size={18} color="#0284C7" />}
                  label="Tiền sử gia đình"
                  value={clinical.familyHistory || "Chưa cập nhật"}
                />
                <InfoRow
                  icon={<Briefcase size={18} color="#0284C7" />}
                  label="Bệnh mạn tính"
                  value={clinical.chronicDisease || "Chưa cập nhật"}
                />
                <InfoRow
                  icon={<Briefcase size={18} color="#0284C7" />}
                  label="Bệnh cấp tính"
                  value={clinical.acuteDisease || "Chưa cập nhật"}
                />
                <InfoRow
                  icon={<Briefcase size={18} color="#0284C7" />}
                  label="Tiền sử phơi nhiễm độc chất"
                  value={clinical.toxicExposure || "Chưa cập nhật"}
                />
                <InfoRow
                  icon={<Briefcase size={18} color="#0284C7" />}
                  label="Chiều cao / Cân nặng"
                  value={
                    clinical.patientHeight || clinical.patientWeight
                      ? `${clinical.patientHeight ?? "?"} cm / ${
                          clinical.patientWeight ?? "?"
                        } kg`
                      : "Chưa cập nhật"
                  }
                />
              </View>
            )}
            {(contactName || contactPhone) && (
              <View className="bg-white rounded-2xl p-5 mt-4 border border-sky-100">
                <Text className="text-base font-extrabold text-slate-900 mb-4">
                  Thông tin liên hệ
                </Text>

                <InfoRow
                  icon={<UserCircle size={18} color="#0284C7" />}
                  label="Người liên hệ"
                  value={contactName}
                />

                <InfoRow
                  icon={<PhoneCall size={18} color="#0284C7" />}
                  label="SĐT người liên hệ"
                  value={contactPhone}
                />
              </View>
            )}
          </>
        ) : (
          <>
            {/* Danh sách phiếu bệnh nhân */}
            <View className="bg-white rounded-2xl p-5 border border-sky-100">
              <Text className="text-base font-extrabold text-slate-900 mb-4">
                Phiếu bệnh nhân
              </Text>
              {patientSpecifies.length === 0 ? (
                <Text className="text-xs font-bold text-slate-500">
                  Chưa có phiếu nào.
                </Text>
              ) : (
                patientSpecifies.map((s) => (
                  <View
                    key={s.specifyVoteID}
                    className="py-3 border-b border-slate-100"
                  >
                    <Text className="text-sm font-extrabold text-sky-700">
                      {s.specifyVoteID || "Mã phiếu"}
                    </Text>
                    <Text className="mt-1 text-[13px] font-extrabold text-slate-900">
                      {s.genomeTest?.testName ||
                        s.genomeTestId ||
                        "Chưa có tên xét nghiệm"}
                    </Text>
                    <View className="mt-1 flex-row items-center justify-between">
                      {!!s.createdAt && (
                        <Text className="text-[11px] text-slate-500">
                          {formatDateTime(s.createdAt)}
                        </Text>
                      )}
                      {s.specifyStatus && (
                        <View className="px-2 py-1 rounded-full bg-slate-50 border border-slate-200">
                          <Text className="text-[11px] font-extrabold text-slate-600">
                            {s.specifyStatus}
                          </Text>
                        </View>
                      )}
                    </View>
                    {s.samplingSite && (
                      <Text className="mt-1 text-[11px] text-slate-500">
                        Vị trí lấy mẫu: {s.samplingSite}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>
            <View className="bg-white rounded-2xl p-5 mt-4 border border-sky-100">
              <Text className="text-base font-extrabold text-slate-900 mb-4">
                Thống kê dịch vụ
              </Text>

              <View className="flex-row justify-between mb-2">
                <Text className="text-xs font-bold text-slate-500">
                  Số phiếu chỉ định (specify)
                </Text>
                <Text className="text-sm font-extrabold text-slate-900">
                  {patientSpecifies.length}
                </Text>
              </View>

              <View className="flex-row justify-between mb-2">
                <Text className="text-xs font-bold text-slate-500">
                  Số đơn hàng xét nghiệm
                </Text>
                <Text className="text-sm font-extrabold text-slate-900">
                  {orders.length}
                </Text>
              </View>

              <View className="flex-row justify-between mb-2">
                <Text className="text-xs font-bold text-slate-500">
                  Tổng số dịch vụ đã dùng
                </Text>
                <Text className="text-sm font-extrabold text-slate-900">
                  {totalServicesUsed}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
