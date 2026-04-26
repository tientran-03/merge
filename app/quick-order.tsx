import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Barcode, Bolt, Coins, FilePlus, FileText, ImageIcon, Users } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
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

import { FormInput, FormNumericInput, FormTextarea } from "@/components/form";
import { SelectionModal, type SelectionOption } from "@/components/modals/SelectionModal";
import { useAuth } from "@/contexts/AuthContext";
import { ORDER_STATUS_ON_CREATE } from "@/lib/constants/order-status";
import {
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  quickOrderDefaultValues,
  quickOrderSchema,
  type QuickOrderFormData,
} from "@/lib/schemas/order-schemas";
import { setListFreshOnNextFocus } from "@/lib/list-navigation-flags";
import { getApiResponseData } from "@/lib/types/api-types";
import { barcodeService, type BarcodeResponse } from "@/services/barcodeService";
import { hospitalStaffService, type HospitalStaffResponse } from "@/services/hospitalStaffService";
import { orderService } from "@/services/orderService";
import { uploadFileToCloudinary } from "@/utils/cloudinary";
import {
  isLabPosition,
  isStaffAnalystWebRule,
  isStaffPosition,
} from "@/utils/hospital-staff-position";
import { parseVndAmountInput } from "@/utils/money";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export default function QuickOrderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const queryClient = useQueryClient();
  const targetOrdersRoute = source === "admin" ? "/admin/orders" : "/orders";

  const methods = useForm<QuickOrderFormData>({
    resolver: zodResolver(quickOrderSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: quickOrderDefaultValues,
  });

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showAnalystModal, setShowAnalystModal] = useState(false);
  const [showCollectorModal, setShowCollectorModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);
  const [showPaymentStatusModal, setShowPaymentStatusModal] = useState(false);
  const [isUploadingSpecify, setIsUploadingSpecify] = useState(false);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const staffPrefillDone = useRef(false);

  /** Field chỉ gán qua `setValue` / modal — cần `register` để giá trị được đưa vào `handleSubmit` */
  useEffect(() => {
    (
      [
        "staffId",
        "staffAnalystId",
        "sampleCollectorId",
        "barcodeId",
        "specifyVoteImagePath",
        "invoiceLink",
        "paymentType",
        "paymentStatus",
      ] as const satisfies readonly (keyof QuickOrderFormData)[]
    ).forEach((name) => methods.register(name));
    void methods.trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- đăng ký một lần khi mở màn hình
  }, []);

  const { data: staffsResponse } = useQuery({
    queryKey: ["hospitalStaffs"],
    queryFn: () => hospitalStaffService.getAll(),
    retry: false,
  });

  const { data: barcodesResponse, isLoading: loadingBarcodes } = useQuery({
    queryKey: ["barcodes", "created"],
    queryFn: () => barcodeService.getByStatus("created"),
    retry: false,
  });

  const staffs = useMemo(
    () => getApiResponseData<HospitalStaffResponse>(staffsResponse) ?? [],
    [staffsResponse]
  );
  const barcodes = useMemo(
    () => getApiResponseData<BarcodeResponse>(barcodesResponse) ?? [],
    [barcodesResponse]
  );

  const paymentStaffs = useMemo(() => staffs.filter((s) => isStaffPosition(s.staffPosition)), [staffs]);
  const analystStaffs = useMemo(() => staffs.filter((s) => isStaffAnalystWebRule(s)), [staffs]);
  const collectorStaffs = useMemo(() => staffs.filter((s) => isLabPosition(s.staffPosition)), [staffs]);

  const barcodeOptions = useMemo<SelectionOption[]>(
    () =>
      barcodes
        .map((b) => String(b.barcode || "").trim())
        .filter(Boolean)
        .map((code) => ({ value: code, label: code })),
    [barcodes]
  );

  const staffOptions = useMemo(
    () => paymentStaffs.map((s) => ({ value: s.staffId, label: s.staffName || s.staffId })),
    [paymentStaffs]
  );
  const analystOptions = useMemo(
    () => analystStaffs.map((s) => ({ value: s.staffId, label: s.staffName || s.staffId })),
    [analystStaffs]
  );
  const collectorOptions = useMemo(
    () => collectorStaffs.map((s) => ({ value: s.staffId, label: s.staffName || s.staffId })),
    [collectorStaffs]
  );
  const paymentTypeOptions = useMemo(
    () => PAYMENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    []
  );
  const paymentStatusOptions = useMemo(
    () => PAYMENT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    []
  );

  useEffect(() => {
    if (!user?.id || staffPrefillDone.current) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await hospitalStaffService.getByUserId(user.id);
        if (cancelled || !r.success || !r.data?.staffId) return;
        const cur = methods.getValues("staffId");
        if (!cur) {
          methods.setValue("staffId", r.data.staffId, { shouldValidate: true });
          staffPrefillDone.current = true;
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, methods]);

  const createOrderMutation = useMutation({
    mutationFn: async (form: QuickOrderFormData) => {
      const resolvedPaymentStatus = form.paymentStatus;
      const orderStatus = ORDER_STATUS_ON_CREATE;

      const collected =
        resolvedPaymentStatus === "COMPLETED" ? parseVndAmountInput(form.paymentAmount) : 0;
      if (resolvedPaymentStatus === "COMPLETED" && (!Number.isFinite(collected) || collected <= 0)) {
        throw new Error("Số tiền đã thu không hợp lệ");
      }

      const createPayload: Record<string, unknown> = {
        orderName: form.orderName.trim(),
        paymentType: form.paymentType,
        orderStatus,
        paymentStatus: resolvedPaymentStatus,
        paymentAmount: Number.isFinite(collected) ? collected : 0,
        staffId: form.staffId.trim(),
        staffAnalystId: form.staffAnalystId.trim(),
        sampleCollectorId: form.sampleCollectorId.trim(),
        barcodeId: form.barcodeId.trim(),
        specifyVoteImagePath: form.specifyVoteImagePath.trim(),
      };
      if (form.orderNote?.trim()) createPayload.orderNote = form.orderNote.trim();

      const res = await orderService.create(createPayload);
      if (!res.success || !res.data?.orderId) {
        throw new Error(res.error || res.message || "Không thể tạo đơn hàng");
      }
      const orderId = res.data.orderId;

      if (form.invoiceLink?.trim()) {
        const inv = await orderService.updateInvoiceLink(orderId, form.invoiceLink.trim());
        if (!inv.success && __DEV__) {
          console.warn("updateInvoiceLink:", inv.error);
        }
      }

      try {
        await barcodeService.update(form.barcodeId.trim(), { status: "not_printed" });
      } catch (e) {
        if (__DEV__) console.warn("update barcode:", e);
      }

      return { ...res, orderId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["barcodes"] });

      Alert.alert("Thành công", "Đã tạo đơn hàng thành công.", [
        {
          text: "Xem danh sách",
          onPress: () => {
            setListFreshOnNextFocus(targetOrdersRoute === "/admin/orders" ? "admin-orders" : "orders");
            router.back();
          },
        },
        { text: "OK", style: "cancel", onPress: () => router.back() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể tạo đơn hàng.");
    },
  });

  const formValues = methods.watch();
  const canSubmit = useMemo(() => quickOrderSchema.safeParse(formValues).success, [formValues]);

  const pickAndUpload = async (kind: "specify" | "invoice") => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const mime = String(asset.mimeType || "").toLowerCase();
      const name = String(asset.name || "").toLowerCase();
      const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
      const isImage = mime.startsWith("image/");
      if (!isPdf && !isImage) {
        Alert.alert("Định dạng chưa hỗ trợ", "Chọn ảnh hoặc PDF.");
        return;
      }
      if (typeof asset.size === "number" && asset.size > MAX_UPLOAD_BYTES) {
        Alert.alert("File quá lớn", "Tối đa 10MB.");
        return;
      }
      if (kind === "specify") setIsUploadingSpecify(true);
      else setIsUploadingInvoice(true);
      const folder = kind === "specify" ? "specifyTest" : "invoice-uploads";
      const uploaded = await uploadFileToCloudinary(asset.uri, {
        folder,
        mimeType: isPdf ? "application/pdf" : mime || undefined,
        fileName: asset.name || undefined,
      });
      const url = uploaded.secureUrl || uploaded.url;
      if (kind === "specify") {
        methods.setValue("specifyVoteImagePath", url, { shouldDirty: true, shouldValidate: true });
      } else {
        methods.setValue("invoiceLink", url, { shouldDirty: true, shouldValidate: true });
      }
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không tải được file.");
    } finally {
      setIsUploadingSpecify(false);
      setIsUploadingInvoice(false);
    }
  };

  const labelFor = (options: SelectionOption[], value?: string) =>
    options.find((o) => o.value === value)?.label || "Chọn…";

  const handleSubmit = () => {
    methods.handleSubmit((form) => {
      if (!analystStaffs.some((s) => s.staffId === form.staffAnalystId)) {
        Alert.alert("Lỗi", "Nhân viên phụ trách phải là bác sĩ (DOCTOR) bệnh viện trung tâm (hospital 1), giống web.");
        return;
      }
      if (!collectorStaffs.some((s) => s.staffId === form.sampleCollectorId)) {
        Alert.alert("Lỗi", "Nhân viên thu mẫu phải có vai trò kỹ thuật viên lab.");
        return;
      }
      if (!paymentStaffs.some((s) => s.staffId === form.staffId)) {
        Alert.alert("Lỗi", "Nhân viên thu tiền phải có vai trò STAFF.");
        return;
      }

      createOrderMutation.mutate(form);
    })();
  };

  const paymentStatus = methods.watch("paymentStatus");

  return (
    <FormProvider {...methods}>
      <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" />

        <View className="pb-4 px-4 bg-white border-b border-sky-100">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Bolt size={20} color="#D97706" />
                <Text className="text-slate-900 text-lg font-extrabold">Thêm nhanh đơn hàng</Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        >
          <View className="bg-white rounded-2xl border border-sky-100 p-4">
            <FormInput
              name="orderName"
              label="Tên đơn hàng"
              required
              placeholder="Nhập tên đơn hàng"
              icon={<FilePlus size={18} color="#0284C7" />}
            />

            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
              Nhân viên thu tiền <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              className="h-12 rounded-2xl border border-sky-100 bg-white px-3 flex-row items-center mb-4"
              onPress={() => setShowStaffModal(true)}
              activeOpacity={0.75}
            >
              <Users size={18} color="#0284C7" />
              <Text className="ml-2 flex-1 text-[14px] font-semibold text-slate-900" numberOfLines={1}>
                {labelFor(staffOptions, methods.watch("staffId"))}
              </Text>
            </TouchableOpacity>

            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
              Nhân viên phụ trách <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              className="h-12 rounded-2xl border border-sky-100 bg-white px-3 flex-row items-center mb-4"
              onPress={() => setShowAnalystModal(true)}
              activeOpacity={0.75}
            >
              <Users size={18} color="#0284C7" />
              <Text className="ml-2 flex-1 text-[14px] font-semibold text-slate-900" numberOfLines={1}>
                {labelFor(analystOptions, methods.watch("staffAnalystId"))}
              </Text>
            </TouchableOpacity>

            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
              Nhân viên thu mẫu <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              className="h-12 rounded-2xl border border-sky-100 bg-white px-3 flex-row items-center mb-4"
              onPress={() => setShowCollectorModal(true)}
              activeOpacity={0.75}
            >
              <Users size={18} color="#0284C7" />
              <Text className="ml-2 flex-1 text-[14px] font-semibold text-slate-900" numberOfLines={1}>
                {labelFor(collectorOptions, methods.watch("sampleCollectorId"))}
              </Text>
            </TouchableOpacity>

            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
              Mã barcode <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              className={`h-12 rounded-2xl border border-sky-100 bg-white px-3 flex-row items-center mb-4 ${
                loadingBarcodes ? "opacity-60" : ""
              }`}
              onPress={() => !loadingBarcodes && setShowBarcodeModal(true)}
              disabled={loadingBarcodes}
              activeOpacity={0.75}
            >
              <Barcode size={18} color="#0284C7" />
              <Text className="ml-2 flex-1 text-[14px] font-semibold text-slate-900" numberOfLines={1}>
                {methods.watch("barcodeId") || (loadingBarcodes ? "Đang tải barcode…" : "Chọn barcode (created)")}
              </Text>
            </TouchableOpacity>

            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
              Hình thức thanh toán <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              className="h-12 rounded-2xl border border-sky-100 bg-white px-3 flex-row items-center mb-4"
              onPress={() => setShowPaymentTypeModal(true)}
              activeOpacity={0.75}
            >
              <Coins size={18} color="#0284C7" />
              <Text className="ml-2 flex-1 text-[14px] font-semibold text-slate-900" numberOfLines={1}>
                {labelFor(paymentTypeOptions, methods.watch("paymentType"))}
              </Text>
            </TouchableOpacity>

            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
              Trạng thái thanh toán <Text className="text-red-500">*</Text>
            </Text>
            <TouchableOpacity
              className="h-12 rounded-2xl border border-sky-100 bg-white px-3 flex-row items-center mb-2"
              onPress={() => setShowPaymentStatusModal(true)}
              activeOpacity={0.75}
            >
              <FileText size={18} color="#0284C7" />
              <Text className="ml-2 flex-1 text-[14px] font-semibold text-slate-900" numberOfLines={1}>
                {labelFor(paymentStatusOptions, methods.watch("paymentStatus"))}
              </Text>
            </TouchableOpacity>

            {paymentStatus === "COMPLETED" && (
              <>
                <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
                  Hóa đơn thanh toán <Text className="text-red-500">*</Text>
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-2">
                  <TouchableOpacity
                    className="px-4 py-2.5 rounded-xl bg-violet-50 border border-violet-200"
                    onPress={() => pickAndUpload("invoice")}
                    disabled={isUploadingInvoice}
                    activeOpacity={0.85}
                  >
                    {isUploadingInvoice ? (
                      <ActivityIndicator color="#7C3AED" />
                    ) : (
                      <Text className="text-[13px] font-bold text-violet-800">Tải file hóa đơn</Text>
                    )}
                  </TouchableOpacity>
                  {!!methods.watch("invoiceLink") && (
                    <TouchableOpacity
                      className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200"
                      onPress={() =>
                        methods.setValue("invoiceLink", "", { shouldDirty: true, shouldValidate: true })
                      }
                    >
                      <Text className="text-[13px] font-bold text-rose-700">Xóa</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text className="text-[11px] text-slate-500 mb-4" numberOfLines={2}>
                  {methods.watch("invoiceLink") || "Chưa có link/file hóa đơn"}
                </Text>

                <FormNumericInput
                  name="paymentAmount"
                  label="Số tiền đã thu"
                  type="currency"
                  required
                  placeholder="VD: 1.000.000"
                  icon={<Coins size={18} color="#0284C7" />}
                />
              </>
            )}

            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
              Ảnh/PDF phiếu xét nghiệm <Text className="text-red-500">*</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              <TouchableOpacity
                className="px-4 py-2.5 rounded-xl bg-cyan-50 border border-cyan-200"
                onPress={() => pickAndUpload("specify")}
                disabled={isUploadingSpecify}
                activeOpacity={0.85}
              >
                {isUploadingSpecify ? (
                  <ActivityIndicator color="#0891B2" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <ImageIcon size={16} color="#0891B2" />
                    <Text className="text-[13px] font-bold text-cyan-800">Chọn ảnh/PDF</Text>
                  </View>
                )}
              </TouchableOpacity>
              {!!methods.watch("specifyVoteImagePath") && (
                <TouchableOpacity
                  className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200"
                  onPress={() =>
                    methods.setValue("specifyVoteImagePath", "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <Text className="text-[13px] font-bold text-rose-700">Xóa</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text className="text-[11px] text-slate-500 mb-4" numberOfLines={2}>
              {methods.watch("specifyVoteImagePath") || "Chưa có file"}
            </Text>

            <FormTextarea
              name="orderNote"
              label="Ghi chú"
              placeholder="Nhập ghi chú đơn hàng (tùy chọn)"
              minHeight={72}
              maxLength={2000}
            />
          </View>
        </ScrollView>

        <SelectionModal
          visible={showStaffModal}
          title="Nhân viên thu tiền"
          options={staffOptions}
          selectedValue={methods.watch("staffId")}
          onSelect={(v) => methods.setValue("staffId", v, { shouldValidate: true })}
          onClose={() => setShowStaffModal(false)}
        />
        <SelectionModal
          visible={showAnalystModal}
          title="Nhân viên phụ trách (DOCTOR — BV trung tâm)"
          options={analystOptions}
          selectedValue={methods.watch("staffAnalystId")}
          onSelect={(v) => methods.setValue("staffAnalystId", v, { shouldValidate: true })}
          onClose={() => setShowAnalystModal(false)}
        />
        <SelectionModal
          visible={showCollectorModal}
          title="Nhân viên thu mẫu"
          options={collectorOptions}
          selectedValue={methods.watch("sampleCollectorId")}
          onSelect={(v) => methods.setValue("sampleCollectorId", v, { shouldValidate: true })}
          onClose={() => setShowCollectorModal(false)}
        />
        <SelectionModal
          visible={showBarcodeModal}
          title="Chọn barcode (created)"
          options={barcodeOptions}
          selectedValue={methods.watch("barcodeId")}
          onSelect={(v) => methods.setValue("barcodeId", v, { shouldValidate: true })}
          onClose={() => setShowBarcodeModal(false)}
        />
        <SelectionModal
          visible={showPaymentTypeModal}
          title="Hình thức thanh toán"
          options={paymentTypeOptions}
          selectedValue={methods.watch("paymentType")}
          onSelect={(v) => methods.setValue("paymentType", v as "CASH" | "ONLINE_PAYMENT", { shouldValidate: true })}
          onClose={() => setShowPaymentTypeModal(false)}
        />
        <SelectionModal
          visible={showPaymentStatusModal}
          title="Trạng thái thanh toán"
          options={paymentStatusOptions}
          selectedValue={methods.watch("paymentStatus")}
          onSelect={(v) => {
            methods.setValue("paymentStatus", v as "UNPAID" | "COMPLETED", { shouldValidate: true });
            if (v !== "COMPLETED") {
              methods.setValue("invoiceLink", "", { shouldDirty: true, shouldValidate: true });
              methods.setValue("paymentAmount", "", { shouldDirty: true, shouldValidate: true });
            }
          }}
          onClose={() => setShowPaymentStatusModal(false)}
        />

        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-sky-100 p-4 flex-row gap-3">
          <TouchableOpacity
            className="flex-1 h-12 rounded-2xl items-center justify-center bg-white border border-sky-200"
            onPress={() => router.back()}
            disabled={createOrderMutation.isPending}
            activeOpacity={0.8}
          >
            <Text className="text-[15px] font-extrabold text-slate-600">Huỷ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 h-12 rounded-2xl items-center justify-center ${
              createOrderMutation.isPending || !canSubmit ? "bg-sky-400" : "bg-sky-600"
            }`}
            onPress={handleSubmit}
            disabled={createOrderMutation.isPending || !canSubmit}
            activeOpacity={0.85}
          >
            {createOrderMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-extrabold text-white">Tạo đơn hàng</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </FormProvider>
  );
}
