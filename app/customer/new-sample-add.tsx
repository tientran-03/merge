import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  FlaskConical,
  Package,
  StickyNote,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { SuccessModal } from "@/components/modals";
import { canAddSupplementSampleToOrder } from "@/lib/can-add-supplement-sample";
import { MEDICAL } from "@/lib/theme/medical";
import { getApiResponseData, getApiResponseSingle } from "@/lib/types/api-types";
import { OrderResponse, orderService } from "@/services/orderService";
import { sampleAddService } from "@/services/sampleAddService";
import { SampleAddServiceCatalogResponse, sampleAddServiceCatalogService } from "@/services/sampleAddServiceCatalogService";

const formatCurrency = (amount?: number) => {
  if (amount == null) return "-";
  return new Intl.NumberFormat("vi-VN").format(amount);
};
const formatCurrencyVnd = (amount?: number) => {
  if (amount == null || Number.isNaN(amount)) return "-";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

export default function CustomerNewSampleAddScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { data: orderRes, isLoading: loadingOrder } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderService.getById(orderId!),
    enabled: !!orderId,
  });

  const { data: servicesRes, isLoading: loadingServices } = useQuery({
    queryKey: ["sample-add-services-catalog"],
    queryFn: () => sampleAddServiceCatalogService.getAll(),
  });

  const order = getApiResponseSingle<OrderResponse>(orderRes);
  const services = getApiResponseData<SampleAddServiceCatalogResponse>(servicesRes) || [];
  const selectedService = services.find((s) => s.id === selectedServiceId);

  const specify = order?.specifyId as any;
  const specifyId = specify?.specifyVoteID || specify?.specifyVoteId || "";
  const patientId = specify?.patientId || specify?.patient?.patientId || "";

  const createMutation = useMutation({
    mutationFn: (data: any) => sampleAddService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-sample-adds"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "customer"] });
      queryClient.invalidateQueries({ queryKey: ["sample-adds-by-order", orderId] });
      setShowSuccessModal(true);
    },
    onError: (err: any) => {
      Alert.alert("Lỗi", err?.message || "Không thể thêm mẫu bổ sung. Vui lòng thử lại.");
    },
  });

  const handleSubmit = () => {
    if (!selectedService) {
      Alert.alert("Lỗi", "Vui lòng chọn loại mẫu bổ sung");
      return;
    }
    if (!orderId || !specifyId || !patientId) {
      Alert.alert("Lỗi", "Thiếu thông tin đơn hàng. Vui lòng quay lại và thử lại.");
      return;
    }

    setIsSubmitting(true);
    createMutation.mutate(
      {
        sampleName: selectedService.sampleName,
        specifyId,
        orderId,
        patientId,
        note: note.trim() || undefined,
      },
      {
        onSettled: () => setIsSubmitting(false),
      }
    );
  };

  if (loadingOrder && !order) {
    return (
      <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" backgroundColor={MEDICAL.screenBg} />
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={MEDICAL.primary} />
          <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải đơn hàng...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order && !loadingOrder) {
    return (
      <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" backgroundColor={MEDICAL.screenBg} />
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center px-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-sky-100">
            <Package size={32} color={MEDICAL.primary} />
          </View>
          <Text className="text-center text-lg font-extrabold text-slate-900">Không tìm thấy đơn hàng</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
            Đơn có thể đã bị xóa hoặc bạn không có quyền xem.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-8 rounded-2xl bg-sky-600 px-8 py-3.5"
            activeOpacity={0.88}
          >
            <Text className="text-base font-extrabold text-white">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (order && !canAddSupplementSampleToOrder(order.orderStatus)) {
    return (
      <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" backgroundColor={MEDICAL.screenBg} />
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center px-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-amber-100">
            <FlaskConical size={32} color={MEDICAL.primary} />
          </View>
          <Text className="text-center text-lg font-extrabold text-slate-900">Chưa thể bổ sung mẫu</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
            Chỉ khi đơn đã được chấp nhận (không còn ở trạng thái Khởi tạo hoặc Chuyển tiếp phân tích) mới được thêm
            mẫu bổ sung, giống trên web.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-8 rounded-2xl bg-sky-600 px-8 py-3.5"
            activeOpacity={0.88}
          >
            <Text className="text-base font-extrabold text-white">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={MEDICAL.screenBg} />
      <Stack.Screen options={{ headerShown: false }} />

      <View className="border-b border-sky-100 bg-white px-4 pb-3 pt-2 shadow-sm shadow-sky-900/5">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50"
            accessibilityLabel="Quay lại"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color={MEDICAL.primary} />
          </TouchableOpacity>
          <View className="min-w-0 flex-1 pr-2">
            <Text className="text-[17px] font-extrabold text-slate-900" numberOfLines={1}>
              Thêm mẫu bổ sung
            </Text>
            <Text className="mt-0.5 text-[12px] font-semibold text-slate-500" numberOfLines={1}>
              Mã đơn {order?.orderId || orderId}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 120 + Math.max(insets.bottom, 8),
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Đơn hàng */}
          <View className="mb-4 overflow-hidden rounded-2xl border border-sky-100 bg-white">
            <View className="border-l-[3px] border-sky-500 px-4 py-3.5">
              <View className="flex-row items-start gap-3">
                <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
                  <ClipboardList size={18} color={MEDICAL.primary} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Đơn hàng</Text>
                  <Text className="mt-1 text-[15px] font-extrabold leading-5 text-slate-900" numberOfLines={3}>
                    {order?.orderName || "Đơn xét nghiệm"}
                  </Text>
                  <Text className="mt-2 font-mono text-[13px] font-semibold text-slate-600">{order?.orderId}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Chọn loại mẫu */}
          <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
            Chọn loại mẫu
          </Text>
          <View className="mb-4 rounded-2xl border border-sky-100 bg-white p-3.5">
            {loadingServices ? (
              <View className="items-center py-10">
                <ActivityIndicator size="small" color={MEDICAL.primary} />
                <Text className="mt-3 text-sm font-semibold text-slate-500">Đang tải danh sách dịch vụ...</Text>
              </View>
            ) : services.length === 0 ? (
              <View className="items-center py-8">
                <FlaskConical size={40} color="#cbd5e1" />
                <Text className="mt-3 text-center text-sm font-semibold text-slate-500">
                  Hiện chưa có dịch vụ mẫu bổ sung.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {services.map((svc) => {
                  const isSelected = selectedServiceId === svc.id;
                  return (
                    <TouchableOpacity
                      key={svc.id}
                      onPress={() => setSelectedServiceId(svc.id)}
                      className={`rounded-2xl border-2 px-4 py-4 active:opacity-95 ${
                        isSelected ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
                      }`}
                      style={{ minHeight: 72 }}
                      activeOpacity={0.88}
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="min-w-0 flex-1 pr-3">
                          <Text className="text-[15px] font-extrabold leading-5 text-slate-900">{svc.sampleName}</Text>
                          <Text className="mt-2 text-[14px] font-bold text-sky-700">
                            {formatCurrency(svc.finalPrice)} VNĐ
                          </Text>
                        </View>
                        <View
                          className={`h-7 w-7 items-center justify-center rounded-full border-2 ${
                            isSelected ? "border-sky-600 bg-sky-600" : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Chi tiết giá */}
          {selectedService ? (
            <View className="mb-4 rounded-2xl border border-sky-100 bg-white px-4 py-3.5">
              <Text className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Ước tính thanh toán
              </Text>
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-[13px] text-slate-600">Giá gốc</Text>
                  <Text className="text-[13px] font-semibold text-slate-900">
                    {formatCurrencyVnd(selectedService.price)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[13px] text-slate-600">Thuế ({selectedService.taxRate ?? 0}%)</Text>
                  <Text className="text-[13px] font-semibold text-slate-900">
                    {formatCurrencyVnd((selectedService.price * (selectedService.taxRate ?? 0)) / 100)}
                  </Text>
                </View>
                <View className="mt-1 flex-row items-center justify-between border-t border-slate-100 pt-2.5">
                  <Text className="text-[14px] font-extrabold text-slate-800">Tổng tạm tính</Text>
                  <Text className="text-[17px] font-extrabold text-sky-700">
                    {formatCurrencyVnd(selectedService.finalPrice)}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Ghi chú */}
          <Text className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Ghi chú</Text>
          <View className="mb-6 rounded-2xl border border-sky-100 bg-white p-3.5">
            <View className="mb-3 flex-row items-center">
              <StickyNote size={18} color={MEDICAL.primary} />
              <Text className="ml-2 text-[14px] font-extrabold text-slate-900">Lời nhắn cho lab / kế toán</Text>
            </View>
            <TextInput
              className="min-h-[100px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] leading-5 text-slate-900"
              placeholder="VD: lấy mẫu buổi sáng, liên hệ trước khi lấy... (không bắt buộc)"
              placeholderTextColor="#94a3b8"
              value={note}
              onChangeText={setNote}
              multiline
              textAlignVertical="top"
              editable={!isSubmitting}
            />
          </View>
        </ScrollView>

        {/* CTA cố định */}
        <View
          className="border-t border-sky-100 bg-white px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 14) }}
        >
          <View className="mb-3 flex-row items-end justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Tạm tính</Text>
              <Text className="mt-0.5 text-[22px] font-extrabold text-slate-900" numberOfLines={1}>
                {selectedService ? formatCurrencyVnd(selectedService.finalPrice) : "—"}
              </Text>
            </View>
            {selectedService ? (
              <Text className="max-w-[45%] text-right text-[11px] font-semibold leading-4 text-slate-500" numberOfLines={3}>
                {selectedService.sampleName}
              </Text>
            ) : (
              <Text className="text-[12px] font-medium text-slate-400">Chọn loại mẫu</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || !selectedServiceId}
            activeOpacity={0.88}
            className={`rounded-2xl py-3.5 ${isSubmitting || !selectedServiceId ? "bg-sky-300" : "bg-sky-600"}`}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-center text-[16px] font-extrabold text-white">Gửi yêu cầu thêm mẫu</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <SuccessModal
        visible={showSuccessModal}
        title="Thêm mẫu thành công"
        message="Yêu cầu bổ sung mẫu đã được gửi. Bạn có thể xem trạng thái tại mục Bổ sung mẫu."
        onClose={() => {
          setShowSuccessModal(false);
          router.replace("/customer/sample-adds" as any);
        }}
      />
    </SafeAreaView>
  );
}
