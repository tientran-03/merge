import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FileText, Upload, ExternalLink } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { orderStatusForUpdatePayload } from "@/lib/constants/order-status";
import { useAuth } from "@/contexts/AuthContext";
import { orderService, type OrderResponse } from "@/services/orderService";
import { patientService, type PatientResponse } from "@/services/patientService";
import { genomeTestService, type GenomeTestResponse } from "@/services/genomeTestService";
import { uploadFileToCloudinary } from "@/utils/cloudinary";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
};

const InfoRow = ({ label, value }: { label: string; value?: string }) => (
  <View className="flex-row justify-between py-2 border-b border-slate-100">
    <Text className="text-slate-500 text-[13px]">{label}</Text>
    <Text className="text-slate-800 text-[13px] font-bold ml-3 flex-1 text-right">{value || "-"}</Text>
  </View>
);

export default function InvoiceScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [isUploading, setIsUploading] = useState(false);

  const isAdmin = user?.role === "ROLE_ADMIN";

  const { data: orderResponse, isLoading } = useQuery({
    queryKey: ["invoice-order", orderId],
    queryFn: () => orderService.getById(orderId!),
    enabled: !!orderId,
  });

  const order: OrderResponse | undefined = orderResponse?.success ? orderResponse.data : undefined;
  const patientId = order?.specifyId?.patientId;
  const genomeTestId = order?.specifyId?.genomeTestId;

  const { data: patientResponse } = useQuery({
    queryKey: ["invoice-patient", patientId],
    queryFn: () => patientService.getById(patientId!),
    enabled: !!patientId,
  });
  const { data: genomeTestResponse } = useQuery({
    queryKey: ["invoice-genome-test", genomeTestId],
    queryFn: () => genomeTestService.getById(genomeTestId!),
    enabled: !!genomeTestId,
  });

  const patient: PatientResponse | undefined = patientResponse?.success ? patientResponse.data : undefined;
  const genomeTest: GenomeTestResponse | undefined = genomeTestResponse?.success
    ? genomeTestResponse.data
    : undefined;

  const priceInfo = useMemo(() => {
    const basePrice = Number(genomeTest?.price || 0);
    const taxRate = Number(genomeTest?.taxRate ?? 10);
    const vatAmount = Math.round(basePrice * (taxRate / 100));
    const finalPrice = basePrice + vatAmount;
    const amountPaid = Number(order?.paymentAmount || 0);
    return { basePrice, taxRate, vatAmount, finalPrice, amountPaid };
  }, [genomeTest, order]);

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceLink }: { invoiceLink: string }) => {
      if (!order) throw new Error("Không tìm thấy đơn hàng");
      const payload: any = {
        orderName: order.orderName || "",
        orderStatus: orderStatusForUpdatePayload(order.orderStatus),
        paymentStatus: order.paymentStatus || "UNPAID",
        paymentType: order.paymentType || "CASH",
        invoiceLink,
      };
      if (order.specifyId?.specifyVoteID) payload.specifyId = order.specifyId.specifyVoteID;
      if (order.specifyVoteImagePath) payload.specifyVoteImagePath = order.specifyVoteImagePath;
      if (order.sampleCollectorId) payload.sampleCollectorId = order.sampleCollectorId;
      if (order.staffAnalystId) payload.staffAnalystId = order.staffAnalystId;
      if (order.barcodeId) payload.barcodeId = order.barcodeId;
      if (typeof order.paymentAmount === "number" && Number.isFinite(order.paymentAmount)) {
        payload.paymentAmount = order.paymentAmount;
      }
      return orderService.update(order.orderId, payload);
    },
    onSuccess: (res) => {
      if (!res?.success) {
        Alert.alert("Lỗi", res?.error || "Không thể lưu hóa đơn.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["invoice-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["patient-metadatas"] });
      Alert.alert("Thành công", "Đã lưu hóa đơn thành công.");
    },
    onError: (err: any) => {
      Alert.alert("Lỗi", err?.message || "Không thể cập nhật hóa đơn.");
    },
  });

  const handleUploadInvoice = async () => {
    if (!order) return;
    const paymentStatus = String(order.paymentStatus || "").toUpperCase();
    if (paymentStatus !== "COMPLETED") {
      Alert.alert("Thông báo", "Chỉ tạo hóa đơn khi đơn đã thanh toán.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      if (typeof file.size === "number" && file.size > 10 * 1024 * 1024) {
        Alert.alert("File quá lớn", "Vui lòng chọn file nhỏ hơn hoặc bằng 10MB.");
        return;
      }

      setIsUploading(true);
      const fileName = String(file.name || "").trim();
      const mimeType = String(file.mimeType || "").toLowerCase();
      const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
      const uploaded = await uploadFileToCloudinary(file.uri, {
        folder: "invoices",
        fileName: fileName || undefined,
        mimeType: isPdf ? "application/pdf" : mimeType || undefined,
      });
      const invoiceLink = uploaded.secureUrl || uploaded.url;
      if (!invoiceLink) throw new Error("Upload hóa đơn thất bại");
      await updateInvoiceMutation.mutateAsync({ invoiceLink });
    } catch (error: any) {
      Alert.alert("Lỗi", error?.message || "Không thể upload hóa đơn.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenInvoiceLink = async () => {
    const invoiceLink = String(order?.invoiceLink || "").trim();
    if (!invoiceLink) {
      Alert.alert("Thông báo", "Đơn này chưa có file hóa đơn.");
      return;
    }
    const canOpen = await Linking.canOpenURL(invoiceLink);
    if (!canOpen) {
      Alert.alert("Lỗi", "Không thể mở liên kết hóa đơn trên thiết bị này.");
      return;
    }
    await Linking.openURL(invoiceLink);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="mt-3 text-slate-500">Đang tải hóa đơn...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="text-slate-600 text-center">Không tìm thấy thông tin đơn hàng để tạo hóa đơn.</Text>
        <TouchableOpacity className="mt-4 px-4 py-2 rounded-xl bg-cyan-600" onPress={() => router.back()}>
          <Text className="text-white font-bold">Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const paidAmount = priceInfo.amountPaid > 0 ? priceInfo.amountPaid : priceInfo.finalPrice;

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
      <View className="bg-cyan-600 rounded-2xl p-4">
        <Text className="text-white text-[20px] font-extrabold">HT GENETIC LAB</Text>
        <Text className="text-cyan-100 text-[12px] mt-1">Hóa đơn thanh toán</Text>
        <Text className="text-cyan-100 text-[12px] mt-2">Mã hóa đơn: {order.orderId}</Text>
        <Text className="text-cyan-100 text-[12px]">Ngày: {formatDateTime(order.createdAt)}</Text>
      </View>

      <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-4">
        <Text className="text-slate-900 font-extrabold mb-2">Thông tin bệnh nhân</Text>
        <InfoRow label="Họ tên" value={patient?.patientName} />
        <InfoRow label="Mã BN" value={patient?.patientId} />
        <InfoRow label="Điện thoại" value={patient?.patientPhone} />
        <InfoRow label="Địa chỉ" value={patient?.patientAddress} />
      </View>

      <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-4">
        <Text className="text-slate-900 font-extrabold mb-2">Thông tin dịch vụ</Text>
        <InfoRow label="Tên xét nghiệm" value={genomeTest?.testName || order.orderName} />
        <InfoRow label="Mã xét nghiệm" value={genomeTest?.code || genomeTest?.testId} />
        <InfoRow
          label="Loại mẫu"
          value={Array.isArray(genomeTest?.testSample) ? genomeTest?.testSample.join(", ") : "-"}
        />
      </View>

      <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-4">
        <Text className="text-slate-900 font-extrabold mb-2">Chi tiết thanh toán</Text>
        <InfoRow label="Đơn giá" value={formatCurrency(priceInfo.basePrice)} />
        <InfoRow label={`VAT (${priceInfo.taxRate}%)`} value={formatCurrency(priceInfo.vatAmount)} />
        <InfoRow label="Tổng cộng" value={formatCurrency(paidAmount)} />
      </View>

      <View className="bg-white rounded-2xl border border-slate-200 p-4 mt-4">
        <Text className="text-slate-900 font-extrabold mb-2">Trạng thái hóa đơn</Text>
        <InfoRow label="Trạng thái thanh toán" value={String(order.paymentStatus || "UNPAID")} />
        <InfoRow label="File hóa đơn" value={order.invoiceLink ? "Đã phát hành" : "Chưa có"} />
        {order.invoiceLink ? (
          <TouchableOpacity
            className="mt-3 flex-row items-center justify-center py-3 rounded-xl bg-emerald-50 border border-emerald-200"
            onPress={handleOpenInvoiceLink}
          >
            <ExternalLink size={16} color="#047857" />
            <Text className="ml-2 text-emerald-700 font-bold">Mở file hóa đơn</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isAdmin && String(order.paymentStatus || "").toUpperCase() === "COMPLETED" ? (
        <TouchableOpacity
          className="mt-4 flex-row items-center justify-center py-3 rounded-xl bg-cyan-600"
          onPress={handleUploadInvoice}
          disabled={isUploading || updateInvoiceMutation.isPending}
        >
          {isUploading || updateInvoiceMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Upload size={16} color="#fff" />
              <Text className="ml-2 text-white font-extrabold">
                {order.invoiceLink ? "Cập nhật hóa đơn" : "Tạo file hóa đơn (ảnh/PDF)"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Text className="text-[12px] text-amber-700">
            Chỉ tạo hóa đơn sau khi đơn hàng được thanh toán hoàn tất.
          </Text>
        </View>
      )}

      <View className="mt-5 items-center">
        <FileText size={20} color="#94a3b8" />
        <Text className="text-[11px] text-slate-400 mt-2 text-center">
          Cảm ơn quý khách đã sử dụng dịch vụ HT GENETIC LAB.
        </Text>
      </View>
    </ScrollView>
  );
}

