import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Barcode, Coins, FilePlus, Users } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Step2SpecifyImage } from "@/components/order/create-order-steps";
import { FormInfoBox, FormInput, FormNumericInput } from "@/components/form";
import { SelectionModal } from "@/components/modals";
import { presentFeedbackError, presentFeedbackSuccess } from "@/lib/feedbackModal";
import {
  cashierStaffOptionsForOrder,
  isCashierAllowed,
  isSampleCollectorAllowed,
  isStaffAnalystAllowed,
} from "@/lib/hospitalStaffOrderOptions";
import { BarcodeStatus, getStaffPositionDisplayName } from "@/lib/schemas/order-form-schema";
import {
  PAYMENT_TYPE_OPTIONS,
  quickOrderDefaultValues,
  quickOrderSchema,
  type QuickOrderFormData,
} from "@/lib/schemas/order-schemas";
import { barcodeService, type BarcodeResponse } from "@/services/barcodeService";
import { hospitalStaffService, type HospitalStaffResponse } from "@/services/hospitalStaffService";
import { orderService, type OrderResponse } from "@/services/orderService";
import { uploadImageToCloudinary } from "@/utils/cloudinary";

function unwrapOrderData(res: { success?: boolean; data?: unknown } | null | undefined): OrderResponse | null {
  if (!res?.success || res.data == null) return null;
  const raw = res.data as unknown;
  if (raw && typeof raw === "object" && "orderId" in (raw as object)) return raw as OrderResponse;
  const nested = (raw as { data?: OrderResponse }).data;
  return nested ?? null;
}

function paymentCompletedFromOrder(o: OrderResponse): boolean {
  const u = String(o.paymentStatus ?? "")
    .trim()
    .toUpperCase();
  return u === "COMPLETED" || u === "PAID" || u === "TRUE" || u === "1";
}

function normalizePosition(pos?: string | null): string {
  return String(pos ?? "")
    .trim()
    .toLowerCase();
}

export default function EditQuickOrderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const methods = useForm<QuickOrderFormData>({
    resolver: zodResolver(quickOrderSchema),
    mode: "onTouched",
    defaultValues: quickOrderDefaultValues,
  });

  const [showStaffAnalystModal, setShowStaffAnalystModal] = useState(false);
  const [showSampleCollectorModal, setShowSampleCollectorModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const { data: staffsResponse } = useQuery({
    queryKey: ["hospitalStaffs"],
    queryFn: () => hospitalStaffService.getAll(),
    retry: false,
  });

  const { data: barcodesResponse } = useQuery({
    queryKey: ["barcodes", BarcodeStatus.CREATED],
    queryFn: () => barcodeService.getByStatus(BarcodeStatus.CREATED),
    retry: false,
  });

  const {
    data: orderResponse,
    isLoading: isLoadingOrder,
    isError: isOrderError,
    refetch: refetchOrder,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderService.getById(orderId!),
    enabled: !!orderId,
    retry: false,
  });

  const staffs = (staffsResponse as any)?.success
    ? ((staffsResponse as any).data as HospitalStaffResponse[]) || []
    : [];

  const createdBarcodes = (barcodesResponse as any)?.success
    ? ((barcodesResponse as any).data as BarcodeResponse[]) || []
    : [];

  const loadedOrder = unwrapOrderData(orderResponse as any);

  useEffect(() => {
    if (!loadedOrder || !orderId) return;

    methods.reset({
      orderName: loadedOrder.orderName || "",
      staffId: loadedOrder.staffId || "",
      staffAnalystId: loadedOrder.staffAnalystId || "",
      sampleCollectorId: loadedOrder.sampleCollectorId || "",
      barcodeId: loadedOrder.barcodeId || "",
      paymentType: (loadedOrder.paymentType as "CASH" | "ONLINE_PAYMENT") || "CASH",
      paymentCompleted: paymentCompletedFromOrder(loadedOrder),
      paymentAmount:
        loadedOrder.paymentAmount != null && loadedOrder.paymentAmount !== undefined
          ? String(loadedOrder.paymentAmount)
          : "",
      invoiceLink: loadedOrder.invoiceLink || "",
      specifyVoteImagePath: loadedOrder.specifyVoteImagePath || "",
      orderNote: loadedOrder.orderNote || "",
    });
    setHydrated(true);
  }, [loadedOrder, orderId, methods]);

  const barcodeOptions = useMemo(() => {
    const map = new Map<string, string>();
    createdBarcodes.forEach(b => map.set(b.barcode, b.barcode));
    const current = loadedOrder?.barcodeId?.trim();
    if (current && !map.has(current)) {
      map.set(current, current);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [createdBarcodes, loadedOrder?.barcodeId]);

  const staffIdWatch = methods.watch("staffId");
  const staffAnalystIdWatch = methods.watch("staffAnalystId");
  const sampleCollectorIdWatch = methods.watch("sampleCollectorId");

  const cashierSelectOptions = useMemo(
    () =>
      cashierStaffOptionsForOrder(staffs, staffIdWatch || loadedOrder?.staffId || "").map(s => ({
        value: s.staffId,
        label: s.staffName || s.staffId,
      })),
    [staffs, staffIdWatch, loadedOrder?.staffId]
  );

  const staffAnalystSelectOptions = useMemo(
    () => {
      const selectedId = (staffAnalystIdWatch || loadedOrder?.staffAnalystId || "").trim();
      const base = staffs.filter(
        s =>
          normalizePosition(s.staffPosition) === "doctor" &&
          String(s.hospitalId ?? "") === "1"
      );
      const withFallback =
        selectedId && !base.some(s => s.staffId === selectedId)
          ? [
              ...base,
              ...(staffs.filter(s => s.staffId === selectedId).slice(0, 1) as HospitalStaffResponse[]),
            ]
          : base;
      return withFallback.map(s => ({
        value: s.staffId,
        label: `${s.staffName || s.staffId} — ${getStaffPositionDisplayName(s.staffPosition)}`,
      }));
    },
    [staffs, staffAnalystIdWatch, loadedOrder?.staffAnalystId]
  );

  const sampleCollectorSelectOptions = useMemo(
    () => {
      const selectedId = (sampleCollectorIdWatch || loadedOrder?.sampleCollectorId || "").trim();
      const base = staffs.filter(s => normalizePosition(s.staffPosition) === "lab_technician");
      const withFallback =
        selectedId && !base.some(s => s.staffId === selectedId)
          ? [
              ...base,
              ...(staffs.filter(s => s.staffId === selectedId).slice(0, 1) as HospitalStaffResponse[]),
            ]
          : base;
      return withFallback.map(s => ({
        value: s.staffId,
        label: `${s.staffName || s.staffId} — ${getStaffPositionDisplayName(s.staffPosition)}`,
      }));
    },
    [staffs, sampleCollectorIdWatch, loadedOrder?.sampleCollectorId]
  );

  const paymentTypeOptions = useMemo(
    () =>
      PAYMENT_TYPE_OPTIONS.map(opt => ({
        value: opt.value,
        label: opt.label,
      })),
    []
  );

  const getSelectedStaffAnalystName = () => {
    const id = methods.watch("staffAnalystId");
    const staff = staffs.find(s => s.staffId === id);
    return staff?.staffName || "Chọn nhân viên phụ trách";
  };

  const getSelectedSampleCollectorName = () => {
    const id = methods.watch("sampleCollectorId");
    const staff = staffs.find(s => s.staffId === id);
    return staff?.staffName || "Chọn nhân viên thu mẫu";
  };

  const getSelectedStaffName = () => {
    const id = methods.watch("staffId");
    const staff = staffs.find(s => s.staffId === id);
    return staff?.staffName || "Chọn nhân viên thu tiền";
  };

  const getSelectedPaymentTypeName = () => {
    const paymentType = methods.watch("paymentType");
    const option = PAYMENT_TYPE_OPTIONS.find(opt => opt.value === paymentType);
    return option?.label || "Chọn hình thức thanh toán";
  };

  const getSelectedBarcodeLabel = () => {
    const id = methods.watch("barcodeId");
    return id?.trim() ? id : "Chọn barcode";
  };

  const handleSlipUpload = async (uri: string) => {
    setUploadingSlip(true);
    try {
      const r = await uploadImageToCloudinary(uri, { folder: "specify-votes" });
      return r.secureUrl || r.url || null;
    } catch (e: any) {
      Alert.alert("Lỗi tải ảnh", e?.message || "Không tải được ảnh phiếu xét nghiệm.");
      return null;
    } finally {
      setUploadingSlip(false);
    }
  };

  const handleInvoiceUpload = async (uri: string) => {
    setUploadingInvoice(true);
    try {
      const r = await uploadImageToCloudinary(uri, { folder: "invoices" });
      return r.secureUrl || r.url || null;
    } catch (e: any) {
      Alert.alert("Lỗi tải ảnh", e?.message || "Không tải được ảnh hóa đơn.");
      return null;
    } finally {
      setUploadingInvoice(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const valid = await methods.trigger();
      if (!valid) {
        const err = methods.formState.errors;
        throw new Error(
          err.orderName?.message ||
            err.staffId?.message ||
            err.staffAnalystId?.message ||
            err.sampleCollectorId?.message ||
            err.barcodeId?.message ||
            err.specifyVoteImagePath?.message ||
            err.invoiceLink?.message ||
            "Vui lòng kiểm tra lại thông tin"
        );
      }

      const formData = methods.getValues();
      if (!isStaffAnalystAllowed(staffs, formData.staffAnalystId)) {
        throw new Error(
          "Nhân viên phụ trách phải là bác sĩ thuộc HT Genetic (DOCTOR, cơ sở HTG)."
        );
      }
      if (!isSampleCollectorAllowed(staffs, formData.sampleCollectorId)) {
        throw new Error("Nhân viên thu mẫu phải là kỹ thuật viên lab (LAB_TECHNICIAN).");
      }
      if (!isCashierAllowed(staffs, formData.staffId)) {
        throw new Error(
          "Nhân viên thu tiền phải có vị trí nhân viên thu ngân (STAFF), hoặc chọn trong danh sách được phép."
        );
      }

      const fresh = await orderService.getById(orderId!);
      const order = unwrapOrderData(fresh as any);
      if (!order?.orderId) {
        throw new Error("Không tải được đơn hàng để cập nhật");
      }

      const paymentAmountNum =
        formData.paymentAmount?.trim() && !Number.isNaN(parseFloat(formData.paymentAmount))
          ? parseFloat(formData.paymentAmount)
          : undefined;

      const payload: Record<string, unknown> = {
        orderName: formData.orderName.trim(),
        orderStatus: order.orderStatus,
        paymentStatus: formData.paymentCompleted ? "COMPLETED" : "UNPAID",
        paymentType: formData.paymentType,
        staffId: formData.staffId.trim(),
        staffAnalystId: formData.staffAnalystId.trim(),
        sampleCollectorId: formData.sampleCollectorId.trim(),
        specifyVoteImagePath: formData.specifyVoteImagePath.trim(),
      };

      if (formData.paymentCompleted && formData.invoiceLink?.trim()) {
        payload.invoiceLink = formData.invoiceLink.trim();
      }

      if (paymentAmountNum != null && paymentAmountNum > 0) {
        payload.paymentAmount = paymentAmountNum;
      }

      if (formData.orderNote?.trim()) {
        payload.orderNote = formData.orderNote.trim();
      }

      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && v !== "")
      );

      const orderUpdate = await orderService.update(orderId!, cleanPayload as any);
      if (!orderUpdate.success) {
        throw new Error(orderUpdate.error || orderUpdate.message || "Cập nhật đơn hàng thất bại");
      }

      return orderUpdate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      presentFeedbackSuccess({
        title: "Đã lưu",
        message: "Đơn hàng đã được cập nhật.",
      });
      router.back();
    },
    onError: (e: any) => {
      presentFeedbackError({
        title: "Không lưu được",
        message: e?.message || "Đã xảy ra lỗi khi cập nhật.",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate();
  };

  const paymentCompleted = methods.watch("paymentCompleted");

  if (!orderId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-sky-50 p-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-center font-bold text-slate-700">Thiếu mã đơn hàng.</Text>
        <TouchableOpacity className="mt-4 rounded-2xl bg-sky-600 px-6 py-3" onPress={() => router.back()}>
          <Text className="font-extrabold text-white">Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoadingOrder || !hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-sm font-bold text-slate-500">Đang tải đơn hàng...</Text>
      </View>
    );
  }

  if (isOrderError || !loadedOrder) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-sky-50 p-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="mb-4 text-center font-bold text-slate-700">Không tải được đơn hàng.</Text>
        <TouchableOpacity className="rounded-2xl bg-sky-600 px-6 py-3" onPress={() => refetchOrder()}>
          <Text className="font-extrabold text-white">Thử lại</Text>
        </TouchableOpacity>
        <TouchableOpacity className="mt-3" onPress={() => router.back()}>
          <Text className="font-bold text-sky-700">Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <FormProvider {...methods}>
      <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" />

        <View className="border-b border-sky-100 bg-white px-4 pb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              className="mr-3 h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50"
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-lg font-extrabold text-slate-900">Sửa nhanh đơn hàng</Text>
              <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
                {orderId}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        >
          <View className="rounded-2xl border border-sky-100 bg-white p-4">
            <FormInput
              name="orderName"
              label="Tên đơn hàng"
              required
              placeholder="Nhập tên đơn hàng"
              icon={<FilePlus size={18} color="#0284C7" />}
            />

            <View className="mb-4">
              <Text className="mb-2 text-sm font-bold text-slate-900">
                Nhân viên thu tiền <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="h-12 flex-row items-center rounded-2xl border border-sky-100 bg-white px-3"
                activeOpacity={0.75}
                onPress={() => setShowStaffModal(true)}
              >
                <Users size={18} color="#0284C7" />
                <Text
                  className={`ml-2 flex-1 text-[14px] font-semibold ${
                    !methods.watch("staffId") ? "text-slate-400" : "text-slate-900"
                  }`}
                  numberOfLines={1}
                >
                  {getSelectedStaffName()}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-bold text-slate-900">
                Nhân viên phụ trách <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="h-12 flex-row items-center rounded-2xl border border-sky-100 bg-white px-3"
                activeOpacity={0.75}
                onPress={() => setShowStaffAnalystModal(true)}
              >
                <Users size={18} color="#0284C7" />
                <Text
                  className={`ml-2 flex-1 text-[14px] font-semibold ${
                    !methods.watch("staffAnalystId") ? "text-slate-400" : "text-slate-900"
                  }`}
                  numberOfLines={1}
                >
                  {getSelectedStaffAnalystName()}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-bold text-slate-900">
                Nhân viên thu mẫu <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="h-12 flex-row items-center rounded-2xl border border-sky-100 bg-white px-3"
                activeOpacity={0.75}
                onPress={() => setShowSampleCollectorModal(true)}
              >
                <Users size={18} color="#0284C7" />
                <Text
                  className={`ml-2 flex-1 text-[14px] font-semibold ${
                    !methods.watch("sampleCollectorId") ? "text-slate-400" : "text-slate-900"
                  }`}
                  numberOfLines={1}
                >
                  {getSelectedSampleCollectorName()}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-bold text-slate-900">
                Barcode <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="h-12 flex-row items-center rounded-2xl border border-sky-100 bg-white px-3"
                activeOpacity={1}
                onPress={undefined}
              >
                <Barcode size={18} color="#0284C7" />
                <Text
                  className={`ml-2 flex-1 text-[14px] font-semibold ${
                    !methods.watch("barcodeId") ? "text-slate-400" : "text-slate-900"
                  }`}
                  numberOfLines={1}
                >
                  {getSelectedBarcodeLabel()}
                </Text>
                <Text className="text-[11px] font-bold text-slate-400">Khoá</Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-bold text-slate-900">
                Hình thức thanh toán <Text className="text-red-500">*</Text>
              </Text>
              <TouchableOpacity
                className="h-12 flex-row items-center rounded-2xl border border-sky-100 bg-white px-3"
                activeOpacity={0.75}
                onPress={() => setShowPaymentTypeModal(true)}
              >
                <Coins size={18} color="#0284C7" />
                <Text
                  className={`ml-2 flex-1 text-[14px] font-semibold ${
                    !methods.watch("paymentType") ? "text-slate-400" : "text-slate-900"
                  }`}
                  numberOfLines={1}
                >
                  {getSelectedPaymentTypeName()}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-sm font-bold text-slate-900">Đã thanh toán</Text>
                <Text className="mt-0.5 text-[11px] text-slate-500">
                  Bật nếu đã thu — cần ảnh hóa đơn
                </Text>
              </View>
              <Switch
                value={paymentCompleted}
                onValueChange={v => methods.setValue("paymentCompleted", v)}
                trackColor={{ false: "#E2E8F0", true: "#0284C7" }}
                thumbColor="#FFFFFF"
              />
            </View>

            {paymentCompleted ? (
              <View className="mb-4">
                <FormNumericInput
                  name="paymentAmount"
                  label="Số tiền (nếu có)"
                  type="integer"
                  placeholder="Ví dụ: 5000000"
                  icon={<Coins size={18} color="#0284C7" />}
                />
              </View>
            ) : null}

            <View className="mb-4">
              <Step2SpecifyImage
                fieldName="specifyVoteImagePath"
                title="Ảnh phiếu xét nghiệm *"
                isUploading={uploadingSlip}
                onImageSelect={handleSlipUpload}
              />
            </View>

            {paymentCompleted ? (
              <View className="mb-4">
                <Step2SpecifyImage
                  fieldName="invoiceLink"
                  title="Ảnh hóa đơn *"
                  isUploading={uploadingInvoice}
                  onImageSelect={handleInvoiceUpload}
                />
              </View>
            ) : null}

            <FormInput name="orderNote" label="Ghi chú" placeholder="Ghi chú thêm (tùy chọn)" multiline />

            <FormInfoBox>Chỉnh sửa các trường trên; trạng thái đơn giữ nguyên trừ thanh toán.</FormInfoBox>
          </View>
        </ScrollView>

        <SelectionModal
          visible={showStaffAnalystModal}
          title="Chọn nhân viên phụ trách"
          options={staffAnalystSelectOptions}
          selectedValue={methods.watch("staffAnalystId")}
          onSelect={value => methods.setValue("staffAnalystId", value)}
          onClose={() => setShowStaffAnalystModal(false)}
        />

        <SelectionModal
          visible={showSampleCollectorModal}
          title="Chọn nhân viên thu mẫu"
          options={sampleCollectorSelectOptions}
          selectedValue={methods.watch("sampleCollectorId")}
          onSelect={value => methods.setValue("sampleCollectorId", value)}
          onClose={() => setShowSampleCollectorModal(false)}
        />

        <SelectionModal
          visible={showStaffModal}
          title="Chọn nhân viên thu tiền"
          options={cashierSelectOptions}
          selectedValue={methods.watch("staffId")}
          onSelect={value => methods.setValue("staffId", value)}
          onClose={() => setShowStaffModal(false)}
        />

        <SelectionModal
          visible={showPaymentTypeModal}
          title="Chọn hình thức thanh toán"
          options={paymentTypeOptions}
          selectedValue={methods.watch("paymentType")}
          onSelect={value => methods.setValue("paymentType", value as "CASH" | "ONLINE_PAYMENT")}
          onClose={() => setShowPaymentTypeModal(false)}
        />

        <SelectionModal
          visible={showBarcodeModal}
          title="Chọn barcode"
          options={barcodeOptions}
          selectedValue={methods.watch("barcodeId")}
          onSelect={value => methods.setValue("barcodeId", value)}
          onClose={() => setShowBarcodeModal(false)}
        />

        <View className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-sky-100 bg-white p-4">
          <TouchableOpacity
            className="h-12 flex-1 items-center justify-center rounded-2xl border border-sky-200 bg-white"
            onPress={() => router.back()}
            activeOpacity={0.8}
            disabled={updateMutation.isPending}
          >
            <Text className="text-[15px] font-extrabold text-slate-600">Huỷ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`h-12 flex-1 items-center justify-center rounded-2xl ${
              updateMutation.isPending ? "bg-sky-400" : "bg-sky-600"
            }`}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-extrabold text-white">Lưu thay đổi</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </FormProvider>
  );
}
