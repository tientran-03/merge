import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, ChevronDown, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { ORDER_STATUS_OPTIONS, ORDER_STATUS_DEFAULT } from "@/lib/constants/order-status";
import { barcodeService } from "@/services/barcodeService";
import { customerService } from "@/services/customerService";
import {
  HospitalStaffResponse,
  hospitalStaffService,
} from "@/services/hospitalStaffService";
import { OrderResponse, orderService, pickOrderSampleCollector } from "@/services/orderService";
import { OrderStatus } from "@/types";
import { ensurePatientMetadataForOrder } from "@/utils/ensurePatientMetadataForOrder";
import { getBarcodeStringFromOrder } from "@/utils/order-barcode";
import {
  formatVndAmountFromNumber,
  formatVndAmountInput,
  parseVndAmountInput,
} from "@/utils/money";
import { isLabPosition, isStaffAnalystWebRule } from "@/utils/hospital-staff-position";

type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "UNPAID";
type PaymentType = "CASH" | "ONLINE_PAYMENT";

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "PENDING", label: "Chờ thanh toán" },
  { value: "COMPLETED", label: "Đã thanh toán" },
  { value: "FAILED", label: "Thanh toán thất bại" },
  { value: "UNPAID", label: "Chưa thanh toán" },
];

const PAYMENT_TYPE_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "ONLINE_PAYMENT", label: "Thanh toán online" },
];

interface FormData {
  orderName: string;
  customerId: string;
  sampleCollectorId: string;
  staffAnalystId: string;
  barcodeId: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentType: PaymentType;
  paymentAmount: string;
  orderNote: string;
}

export default function UpdateOrderScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const initialPaymentStatusRef = useRef<PaymentStatus | null>(null);
  const shouldEnsureMetadataAfterPaidRef = useRef(false);

  const [formData, setFormData] = useState<FormData>({
    orderName: "",
    customerId: "",
    sampleCollectorId: "",
    staffAnalystId: "",
    barcodeId: "",
    orderStatus: "initiation",
    paymentStatus: "PENDING",
    paymentType: "CASH",
    paymentAmount: "",
    orderNote: "",
  });

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSampleCollectorModal, setShowSampleCollectorModal] = useState(false);
  const [showStaffAnalystModal, setShowStaffAnalystModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showOrderStatusModal, setShowOrderStatusModal] = useState(false);
  const [showPaymentStatusModal, setShowPaymentStatusModal] = useState(false);
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { data: orderResponse, isLoading: isLoadingOrder } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderService.getById(orderId!),
    enabled: !!orderId,
  });

  const { data: customersResponse } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customerService.getAll(),
    retry: false,
  });

  const { data: staffResponse } = useQuery({
    queryKey: ["hospital-staffs"],
    queryFn: () => hospitalStaffService.getAll(),
    retry: false,
  });

  const { data: barcodesResponse } = useQuery({
    queryKey: ["barcodes"],
    queryFn: () => barcodeService.getAll(),
    retry: false,
  });

  const { data: ordersResponse } = useQuery({
    queryKey: ["orders"],
    queryFn: () => orderService.getAll(),
    retry: false,
  });

  const customers = customersResponse?.success ? (customersResponse.data || []) : [];
  const staffs: HospitalStaffResponse[] = staffResponse?.success
    ? (staffResponse.data || [])
    : [];

  const analystStaffs = useMemo(
    () => staffs.filter((s) => isStaffAnalystWebRule(s)),
    [staffs]
  );

  const collectorStaffs = useMemo(() => {
    const filtered = staffs.filter((s) => isLabPosition(s.staffPosition));
    const id = formData.sampleCollectorId?.trim();
    if (!id) return filtered;
    if (filtered.some((s) => String(s.staffId).trim() === id)) return filtered;
    const current = staffs.find((s) => String(s.staffId).trim() === id);
    if (current) return [...filtered, current];
    return [
      ...filtered,
      {
        staffId: id,
        staffName: id,
        staffPosition: "sample_collector",
      } as HospitalStaffResponse,
    ];
  }, [staffs, formData.sampleCollectorId]);

  const allBarcodes = barcodesResponse?.success
    ? (barcodesResponse.data || [])
    : [];
  const usedBarcodeIds = new Set<string>();
  if ((ordersResponse as any)?.success && (ordersResponse as any).data) {
    const orders = (ordersResponse as any).data as OrderResponse[];
    orders.forEach((order) => {
      if (String(order.orderId || "").trim() === String(orderId || "").trim()) return;
      const code = getBarcodeStringFromOrder(order);
      if (code) usedBarcodeIds.add(code);
    });
  }
  const currentOrderBarcode =
    (orderResponse as any)?.success && (orderResponse as any)?.data
      ? getBarcodeStringFromOrder((orderResponse as any).data) ?? ""
      : "";
  const barcodes = allBarcodes.filter(
    (b) => !usedBarcodeIds.has(b.barcode) || b.barcode === currentOrderBarcode
  );

  useEffect(() => {
    if ((orderResponse as any)?.success && (orderResponse as any).data) {
      const order: OrderResponse = (orderResponse as any).data;
      const orderCustomer = order.customerId
        ? customers.find((c: any) => c.customerId === order.customerId)
        : null;
      const collector = pickOrderSampleCollector(order);

      setFormData({
        orderName: order.orderName || "",
        customerId: orderCustomer?.customerId || order.customerId || "",
        sampleCollectorId: collector.id,
        staffAnalystId: order.staffAnalystId || "",
        barcodeId: order.barcodeId || "",
        orderStatus: (order.orderStatus as OrderStatus) || ORDER_STATUS_DEFAULT,
        paymentStatus: (order.paymentStatus as PaymentStatus) || "PENDING",
        paymentType: (order.paymentType as PaymentType) || "CASH",
        paymentAmount: formatVndAmountFromNumber(order.paymentAmount ?? 0) || "",
        orderNote: order.orderNote || "",
      });

      const ps = String(order.paymentStatus || "PENDING")
        .trim()
        .toUpperCase() as PaymentStatus;
      initialPaymentStatusRef.current = ps;
    }
  }, [orderResponse, customers]);

  const updateOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await orderService.update(orderId!, data);
      if (!response.success) {
        throw new Error(response.error || "Không thể cập nhật đơn hàng");
      }

      if (shouldEnsureMetadataAfterPaidRef.current) {
        try {
          await ensurePatientMetadataForOrder(orderId!);
          queryClient.invalidateQueries({ queryKey: ["patient-metadatas"] });
        } catch (e) {
          console.warn("[UpdateOrder] ensurePatientMetadataForOrder failed:", e);
        } finally {
          shouldEnsureMetadataAfterPaidRef.current = false;
        }
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowSuccessModal(true);
    },
    onError: (error: any) => {
      console.error("[UpdateOrder] Error:", error);
      let errorMessage = error?.message || error?.error || "Không thể cập nhật đơn hàng. Vui lòng thử lại.";
      if (errorMessage.includes("not found")) {
        if (errorMessage.includes("Customer")) {
          errorMessage = "Khách hàng không tồn tại. Vui lòng chọn lại khách hàng.";
        } else if (errorMessage.includes("Sample collector")) {
          errorMessage = "Nhân viên thu mẫu không tồn tại. Vui lòng chọn lại.";
        } else if (errorMessage.includes("Staff analyst")) {
          errorMessage = "Nhân viên phân tích không tồn tại. Vui lòng chọn lại.";
        } else if (errorMessage.includes("Barcode")) {
          errorMessage = "Mã barcode không tồn tại hoặc đã được sử dụng.";
        }
      } else if (errorMessage.includes("already exists")) {
        errorMessage = "Tên đơn hàng đã tồn tại. Vui lòng chọn tên khác.";
      } else if (errorMessage.includes("already in use")) {
        if (errorMessage.includes("Barcode")) {
          errorMessage = "Mã barcode đã được sử dụng. Vui lòng chọn mã barcode khác.";
        } else {
          errorMessage = "Giá trị này đã được sử dụng. Vui lòng chọn giá trị khác.";
        }
      } else if (errorMessage.includes("500") || errorMessage.includes("Internal Server Error")) {
        errorMessage = "Lỗi máy chủ. Vui lòng thử lại sau hoặc liên hệ quản trị viên.";
      }
      
      Alert.alert("Lỗi cập nhật đơn hàng", errorMessage);
    },
  });

  const handleSubmit = () => {
    if (!formData.orderName.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên đơn hàng");
      return;
    }

    let selectedCustomer: any = null;
    if (formData.customerId.trim()) {
      selectedCustomer = customers?.find(
        (c: any) => c.customerId === formData.customerId,
      );
      if (!selectedCustomer) {
        Alert.alert("Lỗi", "Khách hàng được chọn không hợp lệ. Vui lòng chọn lại.");
        return;
      }
      if (!selectedCustomer.userId) {
        Alert.alert(
          "Lỗi",
          `Khách hàng "${selectedCustomer.customerName}" không có userId.\n\nVui lòng chọn khách hàng khác hoặc để trống.`,
        );
        return;
      }
    }

    const analystId = formData.staffAnalystId?.trim();
    if (analystId) {
      const pick = staffs.find((s) => s.staffId === analystId);
      if (!pick || !isStaffAnalystWebRule(pick)) {
        Alert.alert(
          "Lỗi",
          "Nhân viên phụ trách phải là bác sĩ (DOCTOR) thuộc bệnh viện trung tâm (hospital 1), giống trang quản trị web."
        );
        return;
      }
    }

    const collectorId = formData.sampleCollectorId?.trim();
    if (collectorId && !collectorStaffs.some((s) => s.staffId === collectorId)) {
      Alert.alert(
        "Lỗi",
        "Nhân viên thu mẫu phải có vai trò kỹ thuật viên lab (LAB)."
      );
      return;
    }

    const payload: any = {
      orderName: formData.orderName.trim(),
      orderStatus: formData.orderStatus,
      paymentStatus: formData.paymentStatus,
      paymentType: formData.paymentType,
    };

    if (selectedCustomer?.userId) {
      payload.customerId = selectedCustomer.userId.trim();
    }

    if (formData.sampleCollectorId && formData.sampleCollectorId.trim()) {
      payload.sampleCollectorId = formData.sampleCollectorId.trim();
    }

    if (formData.staffAnalystId && formData.staffAnalystId.trim()) {
      payload.staffAnalystId = formData.staffAnalystId.trim();
    }

    if (formData.barcodeId && formData.barcodeId.trim()) {
      payload.barcodeId = formData.barcodeId.trim();
    }

    if (formData.paymentAmount && formData.paymentAmount.trim()) {
      const amount = parseVndAmountInput(formData.paymentAmount);
      if (Number.isFinite(amount) && amount > 0) {
        payload.paymentAmount = amount;
      }
    }

    if (formData.orderNote && formData.orderNote.trim()) {
      payload.orderNote = formData.orderNote.trim();
    }

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, value]) => {
        if (value === null || value === undefined) return false;
        if (typeof value === "string" && value.trim() === "") return false;
        return true;
      })
    );

    const psTarget = String(formData.paymentStatus || "").trim().toUpperCase() as PaymentStatus;
    const psInitial = String(initialPaymentStatusRef.current || "").trim().toUpperCase() as PaymentStatus;
    shouldEnsureMetadataAfterPaidRef.current = psTarget === "COMPLETED" && psInitial !== "COMPLETED";

    updateOrderMutation.mutate(cleanPayload);
  };

  const getSelectedCustomerName = () => {
    const customer = customers?.find((c) => c.customerId === formData.customerId);
    return customer?.customerName || "Chọn khách hàng";
  };

  const getSelectedSampleCollectorName = () => {
    const staff = staffs?.find((s) => s.staffId === formData.sampleCollectorId);
    return staff?.staffName || "Chọn nhân viên thu mẫu";
  };

  const getSelectedStaffAnalystName = () => {
    const staff = staffs.find((s) => s.staffId === formData.staffAnalystId);
    return staff?.staffName || "Chọn nhân viên phân tích";
  };

  const getSelectedBarcodeName = () => {
    if (!barcodes || !Array.isArray(barcodes)) {
      return "Chọn mã barcode";
    }
    const barcode = barcodes.find((b) => b.barcode === formData.barcodeId);
    return barcode?.barcode || "Chọn mã barcode";
  };

  const getSelectedOrderStatusLabel = () => {
    return ORDER_STATUS_OPTIONS.find((opt) => opt.value === formData.orderStatus)?.label || "Chọn trạng thái";
  };

  const getSelectedPaymentStatusLabel = () => {
    return PAYMENT_STATUS_OPTIONS.find((opt) => opt.value === formData.paymentStatus)?.label || "Chọn trạng thái thanh toán";
  };

  const getSelectedPaymentTypeLabel = () => {
    return PAYMENT_TYPE_OPTIONS.find((opt) => opt.value === formData.paymentType)?.label || "Chọn hình thức thanh toán";
  };

  const renderDropdownModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: any[],
    selectedValue: string,
    onSelect: (value: string) => void,
    getLabel: (item: any) => string,
    getValue: (item: any) => string
  ) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <X size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {options.map((item) => {
              const value = getValue(item);
              const isSelected = value === selectedValue;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  onPress={() => {
                    onSelect(value);
                    onClose();
                  }}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                    {getLabel(item)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (isLoadingOrder) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>
              Tên đơn hàng <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập tên đơn hàng"
              placeholderTextColor={COLORS.muted}
              value={formData.orderName}
              onChangeText={(text) => setFormData({ ...formData, orderName: text })}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Khách hàng</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowCustomerModal(true)}
            >
              <Text style={[styles.dropdownText, !formData.customerId && styles.dropdownPlaceholder]}>
                {getSelectedCustomerName()}
              </Text>
              <ChevronDown size={20} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nhân viên thu mẫu</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowSampleCollectorModal(true)}
            >
              <Text style={[styles.dropdownText, !formData.sampleCollectorId && styles.dropdownPlaceholder]}>
                {getSelectedSampleCollectorName()}
              </Text>
              <ChevronDown size={20} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nhân viên phân tích</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowStaffAnalystModal(true)}
            >
              <Text style={[styles.dropdownText, !formData.staffAnalystId && styles.dropdownPlaceholder]}>
                {getSelectedStaffAnalystName()}
              </Text>
              <ChevronDown size={20} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mã Barcode</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowBarcodeModal(true)}
            >
              <Text style={[styles.dropdownText, !formData.barcodeId && styles.dropdownPlaceholder]}>
                {getSelectedBarcodeName()}
              </Text>
              <ChevronDown size={20} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Trạng thái đơn hàng <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowOrderStatusModal(true)}
            >
              <Text style={styles.dropdownText}>{getSelectedOrderStatusLabel()}</Text>
              <ChevronDown size={20} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Trạng thái thanh toán <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowPaymentStatusModal(true)}
            >
              <Text style={styles.dropdownText}>{getSelectedPaymentStatusLabel()}</Text>
              <ChevronDown size={20} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Hình thức thanh toán <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowPaymentTypeModal(true)}
            >
              <Text style={styles.dropdownText}>{getSelectedPaymentTypeLabel()}</Text>
              <ChevronDown size={20} color={COLORS.sub} />
            </TouchableOpacity>
          </View>

          {formData.paymentStatus !== "UNPAID" && (
            <View style={styles.field}>
              <Text style={styles.label}>Số tiền (VNĐ)</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập số tiền"
                placeholderTextColor={COLORS.muted}
                value={formData.paymentAmount}
                onChangeText={(text) =>
                  setFormData({ ...formData, paymentAmount: formatVndAmountInput(text) })
                }
                keyboardType="numeric"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Ghi chú</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Nhập ghi chú"
              placeholderTextColor={COLORS.muted}
              value={formData.orderNote}
              onChangeText={(text) => setFormData({ ...formData, orderNote: text })}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSubmit}
          disabled={updateOrderMutation.isPending}
        >
          {updateOrderMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Lưu</Text>
          )}
        </TouchableOpacity>
      </View>

      {renderDropdownModal(
        showCustomerModal,
        () => setShowCustomerModal(false),
        "Chọn khách hàng",
        customers,
        formData.customerId,
        (value) => setFormData({ ...formData, customerId: value }),
        (item) => item.customerName,
        (item) => item.customerId
      )}

      {renderDropdownModal(
        showSampleCollectorModal,
        () => setShowSampleCollectorModal(false),
        "Chọn nhân viên thu mẫu",
        collectorStaffs,
        formData.sampleCollectorId,
        (value) => setFormData({ ...formData, sampleCollectorId: value }),
        (item) => item.staffName,
        (item) => item.staffId
      )}

      {renderDropdownModal(
        showStaffAnalystModal,
        () => setShowStaffAnalystModal(false),
        "Chọn nhân viên phân tích",
        analystStaffs,
        formData.staffAnalystId,
        (value) => setFormData({ ...formData, staffAnalystId: value }),
        (item) => item.staffName,
        (item) => item.staffId
      )}

      {renderDropdownModal(
        showBarcodeModal,
        () => setShowBarcodeModal(false),
        "Chọn mã barcode",
        barcodes,
        formData.barcodeId,
        (value) => setFormData({ ...formData, barcodeId: value }),
        (item) => item.barcode,
        (item) => item.barcode
      )}

      {renderDropdownModal(
        showOrderStatusModal,
        () => setShowOrderStatusModal(false),
        "Chọn trạng thái đơn hàng",
        ORDER_STATUS_OPTIONS,
        formData.orderStatus,
        (value) => setFormData({ ...formData, orderStatus: value as OrderStatus }),
        (item) => item.label,
        (item) => item.value
      )}

      {renderDropdownModal(
        showPaymentStatusModal,
        () => setShowPaymentStatusModal(false),
        "Chọn trạng thái thanh toán",
        PAYMENT_STATUS_OPTIONS,
        formData.paymentStatus,
        (value) =>
          setFormData({
            ...formData,
            paymentStatus: value as PaymentStatus,
            paymentAmount: value === "UNPAID" ? "" : formData.paymentAmount,
          }),
        (item) => item.label,
        (item) => item.value
      )}

      {renderDropdownModal(
        showPaymentTypeModal,
        () => setShowPaymentTypeModal(false),
        "Chọn hình thức thanh toán",
        PAYMENT_TYPE_OPTIONS,
        formData.paymentType,
        (value) => setFormData({ ...formData, paymentType: value as PaymentType }),
        (item) => item.label,
        (item) => item.value
      )}

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successModalHeader}>
              <View style={styles.successIconContainer}>
                <Check size={32} color={COLORS.success} strokeWidth={3} />
              </View>
              <Text style={styles.successModalTitle}>Thành công</Text>
              <Text style={styles.successModalMessage}>
                Đơn hàng đã được cập nhật thành công!
              </Text>
              <Text style={styles.successModalSubMessage}>
                Thông tin đơn hàng đã được lưu và cập nhật.
              </Text>
            </View>
            <View style={styles.successModalActions}>
              <TouchableOpacity
                style={[styles.successModalButton, styles.successModalButtonSecondary]}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.back();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.successModalButtonSecondaryText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.successModalButton, styles.successModalButtonPrimary]}
                onPress={() => {
                  setShowSuccessModal(false);
                  if (orderId) {
                    router.push({
                      pathname: "/order-detail",
                      params: { orderId },
                    });
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.successModalButtonPrimaryText}>Xem chi tiết</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.sub,
    fontSize: 14,
  },
  form: {
    gap: 20,
  },
  field: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  required: {
    color: "#EF4444",
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 50,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
  },
  dropdownPlaceholder: {
    color: COLORS.muted,
    fontWeight: "400",
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.sub,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    width: "90%",
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalItemSelected: {
    backgroundColor: COLORS.primarySoft,
  },
  modalItemText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
  },
  modalItemTextSelected: {
    color: COLORS.primary,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    margin: 20,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  successModalHeader: {
    alignItems: "center",
    padding: 24,
    paddingBottom: 20,
  },
  successIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(34,197,94,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 12,
    textAlign: "center",
  },
  successModalMessage: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 8,
  },
  successModalSubMessage: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.sub,
    textAlign: "center",
    lineHeight: 20,
  },
  successModalActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  successModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  successModalButtonSecondary: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  successModalButtonSecondaryText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.sub,
  },
  successModalButtonPrimary: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successModalButtonPrimaryText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});
