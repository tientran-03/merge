import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Trash2, User, Calendar, FlaskConical, Stethoscope } from "lucide-react-native";
import React, { useState } from "react";
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

import { ConfirmModal, SuccessModal } from "@/components/modals";
import { canCancelSpecifyAtInitiation } from "@/lib/specify-status";
import { getApiResponseData } from "@/lib/types/api-types";
import {
  SpecifyVoteTestResponse,
  specifyVoteTestService,
} from "@/services/specifyVoteTestService";

const getStatusLabel = (status?: string): string => {
  if (!status) return "Khởi tạo";
  const s = status.toLowerCase();
  const statusMap: Record<string, string> = {
    initation: "Khởi tạo",
    payment_failed: "Thanh toán thất bại",
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

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

export default function PrescriptionSlipDetailScreen() {
  const router = useRouter();
  const { specifyVoteID } = useLocalSearchParams<{ specifyVoteID: string }>();
  const queryClient = useQueryClient();

  const {
    data: slipResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["specify-vote-test", specifyVoteID],
    queryFn: () => specifyVoteTestService.getById(specifyVoteID!),
    enabled: !!specifyVoteID,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => specifyVoteTestService.delete(specifyVoteID!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specify-vote-tests"] });
      queryClient.invalidateQueries({ queryKey: ["customer-specifies"] });
      queryClient.invalidateQueries({ queryKey: ["specify-vote-test", specifyVoteID] });
      setShowDeleteConfirm(false);
      setShowDeleteSuccess(true);
    },
    onError: (error: any) => {
      setShowDeleteConfirm(false);
      Alert.alert("Lỗi", error?.message || "Không thể hủy phiếu chỉ định. Vui lòng thử lại.");
    },
  });

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    deleteMutation.mutate();
  };

  const handleDeleteSuccessClose = () => {
    setShowDeleteSuccess(false);
    router.back();
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error || !slipResponse?.success) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-slate-900 text-center mb-2">
            Không tải được dữ liệu
          </Text>
          <Text className="text-xs text-slate-500 text-center mb-4">
            {error?.message || "Không tìm thấy phiếu chỉ định"}
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

  const slip: SpecifyVoteTestResponse = slipResponse.data as SpecifyVoteTestResponse;
  const canCancelSlip = canCancelSpecifyAtInitiation(slip.specifyStatus);

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
              <Text className="text-slate-900 text-lg font-extrabold">Chi tiết phiếu chỉ định</Text>
              <Text className="mt-0.5 text-xs text-slate-500">{slip.specifyVoteID}</Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            {/* TODO: Implement edit-prescription-slip screen */}
            {/* <TouchableOpacity
              onPress={() => {
                if (specifyVoteID) {
                  router.push({
                    pathname: "/customer/edit-prescription-slip",
                    params: { specifyVoteID },
                  });
                }
              }}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center"
              activeOpacity={0.8}
            >
              <Edit size={18} color="#0284C7" />
            </TouchableOpacity> */}
            {canCancelSlip ? (
              <TouchableOpacity
                onPress={handleDelete}
                disabled={deleteMutation.isPending}
                className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 items-center justify-center"
                activeOpacity={0.8}
                accessibilityLabel="Hủy phiếu"
              >
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Thông tin cơ bản */}
        <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
          <Text className="text-slate-900 text-base font-extrabold mb-4">Thông tin cơ bản</Text>

          <View className="gap-3">
            <View className="flex-row items-start">
              <FlaskConical size={18} color="#64748B" className="mt-0.5" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-slate-500 font-bold">Mã phiếu</Text>
                <Text className="mt-1 text-sm font-extrabold text-slate-900">{slip.specifyVoteID}</Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <User size={18} color="#64748B" className="mt-0.5" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-slate-500 font-bold">Bệnh nhân</Text>
                <Text className="mt-1 text-sm font-extrabold text-slate-900">
                  {slip.patient?.patientName || "N/A"}
                </Text>
                {slip.patient?.patientPhone && (
                  <Text className="mt-1 text-xs text-slate-600">{slip.patient.patientPhone}</Text>
                )}
              </View>
            </View>

            <View className="flex-row items-start">
              <FlaskConical size={18} color="#64748B" className="mt-0.5" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-slate-500 font-bold">Xét nghiệm</Text>
                <Text className="mt-1 text-sm font-extrabold text-slate-900">
                  {slip.genomeTest?.testName || "N/A"}
                </Text>
              </View>
            </View>

            {slip.doctor && (
              <View className="flex-row items-start">
                <Stethoscope size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Bác sĩ chỉ định</Text>
                  <Text className="mt-1 text-sm font-extrabold text-slate-900">
                    {slip.doctor.doctorName}
                  </Text>
                </View>
              </View>
            )}

            <View className="flex-row items-start">
              <Calendar size={18} color="#64748B" className="mt-0.5" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-slate-500 font-bold">Trạng thái</Text>
                <Text className="mt-1 text-sm font-extrabold text-slate-900">
                  {getStatusLabel(slip.specifyStatus)}
                </Text>
              </View>
            </View>

            {slip.specifyNote && (
              <View className="flex-row items-start">
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Ghi chú</Text>
                  <Text className="mt-1 text-sm text-slate-900">{slip.specifyNote}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title="Hủy phiếu chỉ định"
        message="Chỉ có thể hủy phiếu ở trạng thái Khởi tạo. Bạn có chắc muốn hủy phiếu này? Thao tác không thể hoàn tác."
        confirmText="Hủy phiếu"
        cancelText="Đóng"
        destructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Delete Success Modal */}
      <SuccessModal
        visible={showDeleteSuccess}
        title="Thành công"
        message="Phiếu chỉ định đã được hủy."
        buttonText="OK"
        onClose={handleDeleteSuccessClose}
      />
    </SafeAreaView>
  );
}
