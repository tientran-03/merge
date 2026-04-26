import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  FlaskConical,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "@/constants/colors";
import { getApiResponseData } from "@/lib/types/api-types";
import { OrderResponse, orderService } from "@/services/orderService";
import { sampleAddService, type SampleAddResponse } from "@/services/sampleAddService";
import {
  sampleAddServiceConfigService,
  type SampleAddServiceConfigResponse,
} from "@/services/sampleAddServiceConfigService";

type DropdownOption = { label: string; value: string };

type PaymentType = "CASH" | "ONLINE_PAYMENT" | "";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const getNewSampleAddId = (data: unknown): string => {
  const d = data as SampleAddResponse | undefined;
  return (d?.id || d?.sampleAddId || "").trim();
};

export default function NewSampleAddScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [orderId, setOrderId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("");
  const [note, setNote] = useState("");

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { data: ordersResponse, isLoading: loadingOrders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => orderService.getAll(),
    retry: false,
  });

  const { data: servicesResponse, isLoading: loadingServices } = useQuery({
    queryKey: ["sample-add-services-config"],
    queryFn: () => sampleAddServiceConfigService.getAll(),
    retry: false,
  });

  const { data: sampleAddsResponse, isLoading: loadingSampleAdds } = useQuery({
    queryKey: ["sample-adds"],
    queryFn: () => sampleAddService.getAll(),
    retry: false,
  });

  const orders = useMemo(
    () => getApiResponseData<OrderResponse>(ordersResponse) || [],
    [ordersResponse]
  );
  const existingSampleAdds = useMemo(
    () => getApiResponseData<SampleAddResponse>(sampleAddsResponse) || [],
    [sampleAddsResponse]
  );
  const existingSampleAddOrderIds = useMemo(() => {
    return new Set(
      existingSampleAdds
        .map((sampleAdd) => sampleAdd.orderId?.trim())
        .filter((value): value is string => Boolean(value))
    );
  }, [existingSampleAdds]);
  // Ẩn các đơn hàng đã có mẫu bổ sung khỏi danh sách chọn.
  const sampleAddEligibleOrders = useMemo(
    () => orders.filter((order) => !existingSampleAddOrderIds.has(order.orderId)),
    [orders, existingSampleAddOrderIds]
  );
  const sampleServices = useMemo(
    () => getApiResponseData<SampleAddServiceConfigResponse>(servicesResponse) || [],
    [servicesResponse]
  );
  const orderOptions: DropdownOption[] = useMemo(
    () =>
      sampleAddEligibleOrders.map((o) => ({
        value: o.orderId,
        label: `${o.orderId} — ${o.orderName || o.specifyId?.patient?.patientName || "Đơn hàng"}`,
      })),
    [sampleAddEligibleOrders]
  );

  const serviceOptions: DropdownOption[] = useMemo(
    () =>
      sampleServices.map((s) => ({
        value: s.id,
        label: `${s.sampleName} — ${formatCurrency(s.finalPrice)}`,
      })),
    [sampleServices]
  );

  const paymentOptions: DropdownOption[] = useMemo(
    () => [
      { value: "CASH", label: "Tiền mặt" },
      { value: "ONLINE_PAYMENT", label: "Thanh toán online" },
    ],
    []
  );

  const selectedOrder = useMemo(
    () => sampleAddEligibleOrders.find((o) => o.orderId === orderId),
    [sampleAddEligibleOrders, orderId]
  );
  const selectedService = useMemo(
    () => sampleServices.find((s) => s.id === serviceId),
    [sampleServices, serviceId]
  );

  const paymentHint = useMemo(() => {
    if (paymentType === "ONLINE_PAYMENT") {
      return "Sau khi tạo sẽ chuyển sang trang thanh toán online";
    }
    if (paymentType === "CASH") {
      return "Thanh toán tiền mặt";
    }
    return "Chọn hình thức thanh toán phù hợp";
  }, [paymentType]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!orderId || !serviceId || !paymentType) {
        throw new Error("Vui lòng chọn đơn hàng, loại mẫu và hình thức thanh toán");
      }
      const order = sampleAddEligibleOrders.find((o) => o.orderId === orderId);
      const service = sampleServices.find((s) => s.id === serviceId);
      if (!order || !service) {
        throw new Error("Không tìm thấy đơn hàng hoặc loại mẫu đã chọn");
      }

      const specifyVoteId = order.specifyId?.specifyVoteID;
      const patientId =
        order.specifyId?.patient?.patientId || order.specifyId?.patientId || undefined;

      const payload: Record<string, string> = {
        sampleName: service.sampleName,
        orderId: order.orderId,
      };
      if (specifyVoteId) payload.specifyId = specifyVoteId;
      if (patientId) payload.patientId = patientId;
      const noteTrim = note.trim();
      if (noteTrim) payload.note = noteTrim;

      const createRes = await sampleAddService.create(payload);
      if (!createRes.success) {
        throw new Error(createRes.error || "Không thể tạo mẫu bổ sung");
      }

      const newId = getNewSampleAddId(createRes.data);
      if (!newId) {
        throw new Error("Phản hồi máy chủ không có mã mẫu bổ sung");
      }

      const st = await sampleAddService.updateStatus(newId, "accepted");
      if (!st.success) {
        throw new Error(st.error || "Không thể cập nhật trạng thái mẫu");
      }

      const pt = await sampleAddService.updatePaymentType(newId, paymentType);
      if (!pt.success) {
        throw new Error(pt.error || "Không thể cập nhật hình thức thanh toán");
      }

      if (paymentType === "ONLINE_PAYMENT") {
        const ps = await sampleAddService.updatePaymentStatus(newId, "PENDING");
        if (!ps.success) {
          throw new Error(ps.error || "Không thể cập nhật trạng thái thanh toán");
        }
      } else if (paymentType === "CASH") {
        const ps = await sampleAddService.updatePaymentStatus(newId, "PENDING");
        if (!ps.success) {
          throw new Error(ps.error || "Không thể cập nhật trạng thái thanh toán");
        }
      }

      return {
        paymentType,
        newId,
        navigateOrderId: order.orderId,
        navigateOrderName: service.sampleName || "Mẫu bổ sung",
        navigateAmount: Math.round(service.finalPrice),
      };
    },
    onSuccess: ({ paymentType: pt, newId, navigateOrderId, navigateOrderName, navigateAmount }) => {
      queryClient.invalidateQueries({ queryKey: ["sample-adds"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-mgmt-sample-adds"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      if (pt === "ONLINE_PAYMENT") {
        router.push({
          pathname: "/payment",
          params: {
            orderId: navigateOrderId,
            orderName: navigateOrderName,
            amount: String(navigateAmount),
            sampleAddId: newId,
          },
        });
      } else {
        setShowSuccessModal(true);
      }
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể thêm mẫu bổ sung. Vui lòng thử lại.";
      setErrorMessage(message);
      setShowErrorModal(true);
    },
  });

  const getSelectedLabel = (options: DropdownOption[], value: string, placeholder: string) => {
    const found = options.find((x) => x.value === value);
    return found?.label ?? placeholder;
  };

  const DropdownSheet = ({
    visible,
    onClose,
    title,
    options,
    selectedValue,
    onSelect,
    onClear,
    placeholderSearch = "Tìm kiếm...",
    emptyHint,
  }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    options: DropdownOption[];
    selectedValue: string;
    onSelect: (value: string) => void;
    onClear?: () => void;
    placeholderSearch?: string;
    emptyHint?: string;
  }) => {
    const [q, setQ] = useState("");

    const filtered = useMemo(() => {
      const query = q.trim().toLowerCase();
      if (!query) return options;
      return options.filter((x) => x.label.toLowerCase().includes(query));
    }, [q, options]);

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{title}</Text>
                <Text style={styles.sheetSub}>
                  {options.length} mục • {filtered.length} hiển thị
                </Text>
              </View>

              {onClear && !!selectedValue && (
                <TouchableOpacity
                  style={styles.sheetClearBtn}
                  onPress={() => {
                    onClear();
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Trash2 size={18} color={COLORS.sub} />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose} activeOpacity={0.8}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
              <Search size={18} color={COLORS.muted} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={placeholderSearch}
                placeholderTextColor={COLORS.muted}
                style={styles.searchInput}
              />
              {!!q && (
                <TouchableOpacity onPress={() => setQ("")} style={styles.searchClear} activeOpacity={0.8}>
                  <X size={18} color={COLORS.sub} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {filtered.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>
                    {options.length === 0 ? emptyHint || "Không có dữ liệu" : "Không tìm thấy"}
                  </Text>
                  <Text style={styles.emptySub}>
                    {options.length === 0 ? "" : "Thử từ khóa khác nhé."}
                  </Text>
                </View>
              ) : (
                filtered.map((item) => {
                  const isSelected = item.value === selectedValue;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.sheetItem, isSelected && styles.sheetItemSelected]}
                      onPress={() => {
                        onSelect(item.value);
                        onClose();
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.sheetItemText, isSelected && styles.sheetItemTextSelected]}>
                        {item.label}
                      </Text>
                      {isSelected ? (
                        <View style={styles.checkPill}>
                          <Check size={16} color="#fff" />
                        </View>
                      ) : (
                        <ChevronDown size={18} color={COLORS.muted} style={{ transform: [{ rotate: "-90deg" }] }} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
              <View style={{ height: 14 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const FieldCard = ({
    icon,
    label,
    required,
    children,
    hint,
  }: {
    icon: React.ReactNode;
    label: React.ReactNode;
    required?: boolean;
    hint?: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.fieldCard}>
      <View style={styles.fieldHeader}>
        <View style={styles.fieldIcon}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>
            {label} {required ? <Text style={styles.required}>*</Text> : null}
          </Text>
          {!!hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
      </View>
      {children}
    </View>
  );

  const vatAmount =
    selectedService != null
      ? Math.round((selectedService.price * (selectedService.taxRate || 0)) / 100)
      : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.heroIcon}>
              <FlaskConical size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Bổ sung mẫu</Text>
              <Text style={styles.heroText}>Chọn đơn hàng và loại mẫu để bổ sung</Text>
            </View>
          </View>
        </View>

        <View style={styles.form}>
          <FieldCard icon={<FileText size={18} color={COLORS.primary} />} label="Đơn hàng" required>
            {loadingOrders ? (
              <View style={[styles.dropdown, { justifyContent: "center" }]}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={[styles.dropdownText, { marginLeft: 10 }]}>Đang tải...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.dropdown, !!orderId && styles.dropdownHasValue]}
                onPress={() => setShowOrderModal(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.dropdownText, !orderId && styles.dropdownPlaceholder]}>
                  {getSelectedLabel(orderOptions, orderId, "Chọn đơn hàng")}
                </Text>
                <ChevronDown size={20} color={COLORS.sub} />
              </TouchableOpacity>
            )}
          </FieldCard>

          {selectedOrder ? (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bệnh nhân:</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {selectedOrder.specifyId?.patient?.patientName || "—"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tên đơn hàng:</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {selectedOrder.orderName || "—"}
                </Text>
              </View>
            </View>
          ) : null}

          <FieldCard icon={<FlaskConical size={18} color={COLORS.primary} />} label="Loại mẫu bổ sung" required>
            {loadingServices ? (
              <View style={[styles.dropdown, { justifyContent: "center" }]}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={[styles.dropdownText, { marginLeft: 10 }]}>Đang tải...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.dropdown, !!serviceId && styles.dropdownHasValue]}
                onPress={() => setShowServiceModal(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.dropdownText, !serviceId && styles.dropdownPlaceholder]}>
                  {getSelectedLabel(serviceOptions, serviceId, "Chọn loại mẫu")}
                </Text>
                <ChevronDown size={20} color={COLORS.sub} />
              </TouchableOpacity>
            )}
          </FieldCard>

          {selectedService ? (
            <View style={styles.priceCard}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Giá gốc:</Text>
                <Text style={styles.priceValue}>{formatCurrency(selectedService.price)}</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Thuế ({selectedService.taxRate ?? 0}%):</Text>
                <Text style={styles.priceValue}>{formatCurrency(vatAmount)}</Text>
              </View>
              <View style={[styles.priceRow, styles.priceTotalRow]}>
                <Text style={styles.priceTotalLabel}>Tổng tiền:</Text>
                <Text style={styles.priceTotalValue}>{formatCurrency(selectedService.finalPrice)}</Text>
              </View>
            </View>
          ) : null}

          <FieldCard
            icon={<CreditCard size={18} color={COLORS.primary} />}
            label="Hình thức thanh toán"
            required
            hint={paymentHint}
          >
            <TouchableOpacity
              style={[styles.dropdown, !!paymentType && styles.dropdownHasValue]}
              onPress={() => setShowPaymentModal(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.dropdownText, !paymentType && styles.dropdownPlaceholder]}>
                {paymentType
                  ? getSelectedLabel(paymentOptions, paymentType, "Chọn hình thức thanh toán")
                  : "Chọn hình thức thanh toán"}
              </Text>
              <ChevronDown size={20} color={COLORS.sub} />
            </TouchableOpacity>
          </FieldCard>

          <FieldCard icon={<FileText size={18} color={COLORS.primary} />} label="Ghi chú">
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Nhập ghi chú (không bắt buộc)"
              placeholderTextColor={COLORS.muted}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </FieldCard>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.footer}>
        <LinearGradient
          colors={["rgba(255,255,255,0.00)", "rgba(255,255,255,1)"]}
          style={styles.footerFade}
        />
        <View style={styles.footerInner}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => router.back()}
            disabled={submitMutation.isPending}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelButtonText}>Huỷ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={() => submitMutation.mutate()}
            disabled={
              submitMutation.isPending ||
              !orderId ||
              !serviceId ||
              !paymentType ||
              loadingOrders ||
              loadingServices ||
              loadingSampleAdds
            }
            activeOpacity={0.85}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Thêm mẫu</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <DropdownSheet
        visible={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        title="Chọn đơn hàng"
        options={orderOptions}
        selectedValue={orderId}
        onSelect={(value) => {
          setOrderId(value);
          setServiceId("");
        }}
        onClear={() => {
          setOrderId("");
          setServiceId("");
        }}
        placeholderSearch="Tìm đơn hàng theo tên / mã..."
        emptyHint="Không có đơn hàng phù hợp"
      />

      <DropdownSheet
        visible={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        title="Chọn loại mẫu"
        options={serviceOptions}
        selectedValue={serviceId}
        onSelect={setServiceId}
        onClear={() => setServiceId("")}
        placeholderSearch="Tìm loại mẫu..."
        emptyHint="Không có dịch vụ nào"
      />

      <DropdownSheet
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Chọn hình thức thanh toán"
        options={paymentOptions}
        selectedValue={paymentType}
        onSelect={(v) => setPaymentType(v as PaymentType)}
        onClear={() => setPaymentType("")}
        placeholderSearch="Tìm..."
      />

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, styles.modalIconSuccess]}>
                <Check size={28} color={COLORS.success} />
              </View>
              <Text style={styles.modalTitle}>Thành công</Text>
              <Text style={styles.modalMessage}>Thêm mẫu bổ sung thành công</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.back();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.modalBtnPrimaryText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, styles.modalIconError]}>
                <X size={26} color={COLORS.danger} />
              </View>
              <Text style={styles.modalTitle}>Lỗi</Text>
              <Text style={styles.modalMessage}>{errorMessage}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => setShowErrorModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalBtnPrimaryText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 0 },

  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  heroLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 4,
  },
  heroText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: COLORS.sub,
    lineHeight: 18,
  },

  form: { gap: 14 },

  infoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  infoLabel: { fontSize: 13, color: COLORS.muted, fontWeight: "700", maxWidth: "38%" },
  infoValue: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "800",
    textAlign: "right",
  },

  priceCard: {
    backgroundColor: "rgba(8,145,178,0.08)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(8,145,178,0.2)",
    gap: 8,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { fontSize: 13, color: COLORS.sub, fontWeight: "700" },
  priceValue: { fontSize: 13, color: COLORS.text, fontWeight: "800" },
  priceTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(8,145,178,0.25)",
    paddingTop: 8,
    marginTop: 4,
  },
  priceTotalLabel: { fontSize: 14, color: COLORS.text, fontWeight: "900" },
  priceTotalValue: { fontSize: 14, color: COLORS.primary, fontWeight: "900" },

  fieldCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  fieldIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  required: { color: COLORS.danger },
  hint: { marginTop: 2, fontSize: 12, color: COLORS.muted, fontWeight: "600" },

  input: {
    backgroundColor: "#FBFCFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 14, android: 12, default: 12 }),
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "700",
    minHeight: 50,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 14,
  },

  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FBFCFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 50,
  },
  dropdownHasValue: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dropdownText: { flex: 1, fontSize: 14.5, color: COLORS.text, fontWeight: "800" },
  dropdownPlaceholder: { color: COLORS.muted, fontWeight: "700" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 10,
    backgroundColor: "transparent",
  },
  footerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
  },
  footerInner: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 10,
  },
  button: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: COLORS.border },
  cancelButtonText: { fontSize: 15, fontWeight: "900", color: COLORS.sub },
  saveButton: { backgroundColor: "#059669" },
  saveButtonText: { fontSize: 15, fontWeight: "900", color: "#fff", letterSpacing: 0.3 },

  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 10,
    maxHeight: "82%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  sheetSub: { marginTop: 2, fontSize: 12, fontWeight: "700", color: COLORS.muted },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetClearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  searchWrap: {
    marginTop: 12,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    paddingVertical: 0,
  },
  searchClear: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2F7",
  },

  sheetList: { marginTop: 10 },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 12,
  },
  sheetItemSelected: { backgroundColor: "rgba(8,145,178,0.08)" },
  sheetItemText: { flex: 1, fontSize: 14, fontWeight: "800", color: COLORS.text },
  sheetItemTextSelected: { color: COLORS.primary },
  checkPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyBox: { padding: 24, alignItems: "center" },
  emptyTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  emptySub: { marginTop: 6, fontSize: 12, fontWeight: "700", color: COLORS.muted },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    width: "100%",
    maxWidth: 420,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 14,
  },
  modalHeader: { padding: 22, alignItems: "center" },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalIconSuccess: { backgroundColor: "rgba(34,197,94,0.12)" },
  modalIconError: { backgroundColor: "rgba(239,68,68,0.12)" },
  modalTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, marginBottom: 8 },
  modalMessage: { fontSize: 14, fontWeight: "700", color: COLORS.sub, textAlign: "center", lineHeight: 20 },
  modalActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 14,
  },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  modalBtnPrimary: { backgroundColor: COLORS.primary },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: "900", color: "#fff" },
});
