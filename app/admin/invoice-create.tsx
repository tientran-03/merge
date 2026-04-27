import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Print from "expo-print";
import { Stack, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { ChevronDown, FileDown } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SelectionModal, type SelectionOption } from "@/components/modals/SelectionModal";
import { orderStatusForUpdatePayload } from "@/lib/constants/order-status";
import { getApiResponseData } from "@/lib/types/api-types";
import { genomeTestService, type GenomeTestResponse } from "@/services/genomeTestService";
import { orderService, type OrderResponse } from "@/services/orderService";
import { patientMetadataService } from "@/services/patientMetadataService";
import { patientService, type PatientResponse } from "@/services/patientService";
import { sampleAddService, type SampleAddResponse } from "@/services/sampleAddService";
import {
  sampleAddServiceConfigService,
  type SampleAddServiceConfigResponse,
} from "@/services/sampleAddServiceConfigService";
import { specifyVoteTestService } from "@/services/specifyVoteTestService";

type SourceType = "ORDER" | "SAMPLE_ADD";
type PaymentType = "CASH" | "ONLINE_PAYMENT" | "";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

const paymentTypeOptions: SelectionOption[] = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "ONLINE_PAYMENT", label: "Thanh toán online" },
];

const escapeHtml = (value?: string | number | null) => {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const getSampleAddRowId = (item: SampleAddResponse) => item.id || item.sampleAddId || "";

const isPaymentCompleted = (status?: string) =>
  String(status || "").toUpperCase() === "COMPLETED";

export default function AdminInvoiceCreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sourceType, setSourceType] = useState<SourceType>("ORDER");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedSampleAddId, setSelectedSampleAddId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedGenomeTestId, setSelectedGenomeTestId] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("");
  const [note, setNote] = useState("");
  const [activeModal, setActiveModal] = useState<"" | "order" | "sample" | "patient" | "test" | "payment">("");
  const [isPayNavigating, setIsPayNavigating] = useState(false);

  const { data: ordersResponse, isLoading: loadingOrders } = useQuery({
    queryKey: ["invoice-create-orders"],
    queryFn: () => orderService.getAll(),
    retry: false,
  });
  const { data: sampleAddsResponse, isLoading: loadingSampleAdds } = useQuery({
    queryKey: ["invoice-create-sample-adds"],
    queryFn: () => sampleAddService.getAll(),
    retry: false,
  });
  const { data: patientsResponse, isLoading: loadingPatients } = useQuery({
    queryKey: ["invoice-create-patients"],
    queryFn: () => patientService.getAll(),
    retry: false,
  });
  const { data: genomeTestsResponse, isLoading: loadingGenomeTests } = useQuery({
    queryKey: ["invoice-create-genome-tests"],
    queryFn: () => genomeTestService.getAll(),
    retry: false,
  });
  const { data: sampleAddServicesResponse, isLoading: loadingSampleAddServices } = useQuery({
    queryKey: ["invoice-create-sample-add-services"],
    queryFn: () => sampleAddServiceConfigService.getAll(),
    retry: false,
  });

  const orders = getApiResponseData<OrderResponse>(ordersResponse) || [];
  const sampleAdds = getApiResponseData<SampleAddResponse>(sampleAddsResponse) || [];
  const patients = getApiResponseData<PatientResponse>(patientsResponse) || [];
  const genomeTests = getApiResponseData<GenomeTestResponse>(genomeTestsResponse) || [];
  const sampleAddServices =
    getApiResponseData<SampleAddServiceConfigResponse>(sampleAddServicesResponse) || [];

  /** Chỉ đơn chưa thanh toán — đã COMPLETED thì không cho chọn tạo hóa đơn */
  const unpaidOrders = useMemo(
    () => orders.filter((o) => !isPaymentCompleted(o.paymentStatus)),
    [orders]
  );

  const unpaidSampleAdds = useMemo(
    () => sampleAdds.filter((s) => !isPaymentCompleted(s.paymentStatus)),
    [sampleAdds]
  );

  const selectedOrder = useMemo(
    () => unpaidOrders.find((item) => item.orderId === selectedOrderId),
    [unpaidOrders, selectedOrderId]
  );

  useEffect(() => {
    if (sourceType !== "ORDER" || !selectedOrderId) return;
    if (!unpaidOrders.some((o) => o.orderId === selectedOrderId)) {
      setSelectedOrderId("");
      setSelectedPatientId("");
      setSelectedGenomeTestId("");
      setPaymentType("");
    }
  }, [sourceType, selectedOrderId, unpaidOrders]);
  const selectedSampleAdd = useMemo(
    () => unpaidSampleAdds.find((item) => getSampleAddRowId(item) === selectedSampleAddId),
    [unpaidSampleAdds, selectedSampleAddId]
  );
  const selectedPatient = useMemo(
    () => patients.find((item) => item.patientId === selectedPatientId),
    [patients, selectedPatientId]
  );
  const selectedGenomeTest = useMemo(
    () => genomeTests.find((item) => item.testId === selectedGenomeTestId),
    [genomeTests, selectedGenomeTestId]
  );

  const matchedSampleService = useMemo(() => {
    if (!selectedSampleAdd?.sampleName) return null;
    return sampleAddServices.find((svc) => svc.sampleName === selectedSampleAdd.sampleName) ?? null;
  }, [selectedSampleAdd, sampleAddServices]);

  const sampleAddBasePrice = matchedSampleService?.price ?? 0;
  const sampleAddTaxRate = matchedSampleService?.taxRate ?? 10;
  const sampleAddVatAmount = Math.round(sampleAddBasePrice * (sampleAddTaxRate / 100));
  const sampleAddFinalPrice =
    matchedSampleService?.finalPrice != null
      ? Math.round(matchedSampleService.finalPrice)
      : sampleAddBasePrice + sampleAddVatAmount;

  const orderOptions = useMemo<SelectionOption[]>(
    () =>
      unpaidOrders.map((item) => ({
        value: item.orderId,
        label: `${item.orderId} - ${item.orderName || "Đơn hàng"}`,
      })),
    [unpaidOrders]
  );
  const sampleOptions = useMemo<SelectionOption[]>(
    () =>
      unpaidSampleAdds.map((item) => {
        const sid = getSampleAddRowId(item);
        return {
          value: sid,
          label: `${item.orderId || sid} - ${item.sampleName || "Mẫu bổ sung"}`,
        };
      }),
    [unpaidSampleAdds]
  );
  const patientOptions = useMemo<SelectionOption[]>(
    () =>
      patients.map((item) => ({
        value: item.patientId,
        label: `${item.patientName || "Không tên"}${item.patientPhone ? ` - ${item.patientPhone}` : ""}`,
      })),
    [patients]
  );
  const genomeTestOptions = useMemo<SelectionOption[]>(
    () =>
      genomeTests.map((item) => ({
        value: item.testId,
        label: `${item.testName}${item.code ? ` - ${item.code}` : ""}`,
      })),
    [genomeTests]
  );

  const isOrder = sourceType === "ORDER";
  /** Sau khi đã chọn đơn / mẫu bổ sung: khóa đổi đơn, BN, dịch vụ (tránh sửa lệch với đơn gốc). */
  const isOrderSelectionLocked = isOrder && Boolean(selectedOrderId);
  const isSampleSelectionLocked = !isOrder && Boolean(selectedSampleAddId);

  const clearOrderSelection = () => {
    setSelectedOrderId("");
    setSelectedPatientId("");
    setSelectedGenomeTestId("");
    setPaymentType("");
  };

  const clearSampleSelection = () => {
    setSelectedSampleAddId("");
    setSelectedPatientId("");
    setPaymentType("");
  };

  /** Theo dịch vụ xét nghiệm — không chỉnh tay khi tạo hóa đơn. */
  const orderTaxRate = Number(selectedGenomeTest?.taxRate ?? 10);
  const orderBasePrice = Number(selectedGenomeTest?.price || 0);
  const orderVatAmount = Math.max(0, Math.round(orderBasePrice * (orderTaxRate / 100)));
  const orderTotalAmount = orderBasePrice + orderVatAmount;

  const previewBase = isOrder ? orderBasePrice : sampleAddBasePrice;
  const previewTaxPct = isOrder ? orderTaxRate : sampleAddTaxRate;
  const previewVat = isOrder ? orderVatAmount : sampleAddVatAmount;
  const previewTotal = isOrder ? orderTotalAmount : sampleAddFinalPrice;

  const previewInvoiceId = isOrder
    ? selectedOrderId || "—"
    : selectedSampleAdd?.orderId || "—";

  const invoiceCode = useMemo(() => {
    if (sourceType === "ORDER") {
      return selectedOrderId ? `INV-${selectedOrderId}` : "—";
    }
    return selectedSampleAdd?.orderId || selectedSampleAddId || "—";
  }, [sourceType, selectedOrderId, selectedSampleAdd, selectedSampleAddId]);

  const setSourceAndReset = (value: SourceType) => {
    setSourceType(value);
    setSelectedOrderId("");
    setSelectedSampleAddId("");
    setSelectedPatientId("");
    setSelectedGenomeTestId("");
    setPaymentType("");
    setNote("");
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setSelectedSampleAddId("");
    const order = unpaidOrders.find((item) => item.orderId === orderId);
    if (order?.specifyId?.patientId) setSelectedPatientId(order.specifyId.patientId);
    if (order?.specifyId?.genomeTestId) setSelectedGenomeTestId(order.specifyId.genomeTestId);
    setPaymentType("");
    const u = String(order?.paymentType || "").toUpperCase();
    if (u === "CASH") setPaymentType("CASH");
    else if (u === "ONLINE_PAYMENT") setPaymentType("ONLINE_PAYMENT");
  };

  const handleSelectSampleAdd = (sampleAddId: string) => {
    setSelectedSampleAddId(sampleAddId);
    setSelectedOrderId("");
    setSelectedGenomeTestId("");
    const sample = unpaidSampleAdds.find((item) => getSampleAddRowId(item) === sampleAddId);
    if (sample?.patientId) setSelectedPatientId(sample.patientId);
    else setSelectedPatientId("");
    const u = String(sample?.paymentType || "").toUpperCase();
    if (u === "CASH") setPaymentType("CASH");
    else if (u === "ONLINE_PAYMENT") setPaymentType("ONLINE_PAYMENT");
    else setPaymentType("");
  };

  const ensureOrderMetadataForCashInvoice = async (order: OrderResponse): Promise<void> => {
    const specifyId = String(order.specifyId?.specifyVoteID || "").trim();
    if (!specifyId) return;


    if ((order as { customerFastq?: boolean }).customerFastq === true) return;

    const existing = await patientMetadataService.getBySpecifyId(specifyId);
    if (existing.success && Array.isArray(existing.data) && existing.data.length > 0) {
      return;
    }

    const specifyRes = await specifyVoteTestService.getById(specifyId);
    if (!specifyRes.success || !specifyRes.data) {
      throw new Error(specifyRes.error || "Không lấy được phiếu chỉ định để tạo metadata.");
    }

    const patientId = String(
      specifyRes.data.patientId || specifyRes.data.patient?.patientId || "",
    ).trim();
    if (!patientId) {
      throw new Error("Thiếu patientId trên phiếu chỉ định.");
    }

    const patientName = String(specifyRes.data.patient?.patientName || "").trim();
    const samples = Array.isArray(specifyRes.data.genomeTest?.testSample)
      ? specifyRes.data.genomeTest!.testSample.filter((s) => String(s || "").trim().length > 0)
      : [];

    if (samples.length === 0) {
      const created = await patientMetadataService.createWithAnalyze({
        specifyId,
        patientId,
        ...(patientName ? { patientName } : {}),
      });
      if (!created.success) {
        throw new Error(created.error || "Không tạo được metadata.");
      }
      return;
    }

    for (const sampleName of samples) {
      const created = await patientMetadataService.createWithAnalyze({
        specifyId,
        patientId,
        ...(patientName ? { patientName } : {}),
        sampleName,
      });
      if (!created.success) {
        throw new Error(created.error || `Không tạo được metadata cho mẫu ${sampleName}.`);
      }
    }
  };

  const ensureSampleAddMetadataForCashInvoice = async (
    sampleAdd: SampleAddResponse,
  ): Promise<void> => {
    const specifyId = String(sampleAdd.specifyId || "").trim();
    const patientId = String(sampleAdd.patientId || "").trim();
    const sampleName = String(sampleAdd.sampleName || "").trim();
    if (!specifyId || !patientId) return;

    const existing = await patientMetadataService.getBySpecifyId(specifyId);
    if (existing.success && Array.isArray(existing.data)) {
      const duplicated = existing.data.some(
        (m) =>
          String(m.sampleName || "").trim().toLowerCase() === sampleName.toLowerCase(),
      );
      if (duplicated) return;
    }

    const created = await patientMetadataService.createWithSampleAdd({
      specifyId,
      patientId,
      ...(String(sampleAdd.patientName || "").trim()
        ? { patientName: String(sampleAdd.patientName || "").trim() }
        : {}),
      ...(sampleName ? { sampleName } : {}),
    });
    if (!created.success) {
      throw new Error(created.error || "Không thể tạo metadata mẫu bổ sung.");
    }
  };

  const handleExportInvoice = async () => {
    if (sourceType === "ORDER") {
      if (!paymentType) {
        Alert.alert("Thiếu thông tin", "Vui lòng chọn hình thức thanh toán.");
        return;
      }
      if (!selectedGenomeTestId) {
        Alert.alert("Thiếu thông tin", "Vui lòng chọn dịch vụ xét nghiệm.");
        return;
      }
      if (!selectedOrderId) {
        Alert.alert("Thiếu thông tin", "Vui lòng chọn đơn hàng.");
        return;
      }
    } else {
      if (!selectedSampleAddId || !selectedSampleAdd) {
        Alert.alert("Thiếu thông tin", "Vui lòng chọn mẫu bổ sung.");
        return;
      }
      if (!paymentType) {
        Alert.alert(
          "Thiếu thông tin",
          "Mẫu bổ sung chưa có hình thức thanh toán (Chưa có). Vui lòng cập nhật trên hệ thống trước khi xuất hóa đơn."
        );
        return;
      }
    }

    if (paymentType === "ONLINE_PAYMENT") {
      setIsPayNavigating(true);
      try {
        if (sourceType === "ORDER" && selectedOrder) {
          const ps = String(selectedOrder.paymentStatus || "").toUpperCase();
          if (ps === "COMPLETED") {
            Alert.alert("Thông báo", "Đơn hàng đã thanh toán hoàn tất.");
            return;
          }
          const payload: Record<string, unknown> = {
            orderName: selectedOrder.orderName || "",
            orderStatus: orderStatusForUpdatePayload(selectedOrder.orderStatus),
            paymentStatus: "PENDING",
            paymentType: "ONLINE_PAYMENT",
            paymentAmount: orderTotalAmount,
          };
          if (selectedOrder.specifyId?.specifyVoteID) {
            payload.specifyId = selectedOrder.specifyId.specifyVoteID;
          }
          if (selectedOrder.specifyVoteImagePath) {
            payload.specifyVoteImagePath = selectedOrder.specifyVoteImagePath;
          }
          if (selectedOrder.sampleCollectorId) {
            payload.sampleCollectorId = selectedOrder.sampleCollectorId;
          }
          if (selectedOrder.staffAnalystId) {
            payload.staffAnalystId = selectedOrder.staffAnalystId;
          }
          if (selectedOrder.barcodeId) {
            payload.barcodeId = selectedOrder.barcodeId;
          }
          // Không gửi customerId: API PUT đơn dùng customerId là userId (User), còn GET trả về là mã khách hàng (customer) — gửi nhầm sẽ 404 CUSTOMER_001.
          const res = await orderService.update(selectedOrderId, payload);
          if (!res.success) {
            Alert.alert("Lỗi", res.error || "Không thể cập nhật đơn hàng để thanh toán online.");
            return;
          }
          router.push({
            pathname: "/payment",
            params: {
              orderId: selectedOrderId,
              orderName: selectedOrder.orderName || selectedOrderId,
              amount: String(orderTotalAmount),
              ...(selectedOrder.specifyId?.specifyVoteID
                ? { specifyId: selectedOrder.specifyId.specifyVoteID }
                : {}),
            },
          });
          return;
        }

        if (sourceType === "SAMPLE_ADD" && selectedSampleAdd) {
          const sid = getSampleAddRowId(selectedSampleAdd);
          const parentOrderId = String(selectedSampleAdd.orderId || "").trim();
          if (!parentOrderId) {
            Alert.alert("Lỗi", "Mẫu bổ sung không gắn mã đơn hàng.");
            return;
          }
          const ptRes = await sampleAddService.updatePaymentType(sid, "ONLINE_PAYMENT");
          if (!ptRes.success) {
            Alert.alert("Lỗi", ptRes.error || "Không thể cập nhật hình thức thanh toán.");
            return;
          }
          const psRes = await sampleAddService.updatePaymentStatus(sid, "PENDING");
          if (!psRes.success) {
            Alert.alert("Lỗi", psRes.error || "Không thể cập nhật trạng thái thanh toán.");
            return;
          }
          router.push({
            pathname: "/payment",
            params: {
              orderId: parentOrderId,
              orderName: selectedSampleAdd.sampleName || "Mẫu bổ sung",
              amount: String(sampleAddFinalPrice),
              sampleAddId: sid,
            },
          });
          return;
        }
      } finally {
        setIsPayNavigating(false);
      }
      return;
    }

    const createdAt = new Date().toLocaleString("vi-VN");
    const sourceCode = sourceType === "ORDER" ? selectedOrderId : getSampleAddRowId(selectedSampleAdd!);
    const payDisplay =
      paymentType === "CASH" ? "Tiền mặt" : paymentType === "ONLINE_PAYMENT" ? "Thanh toán online" : "—";
    const tableLineLabel =
      sourceType === "ORDER"
        ? escapeHtml(selectedGenomeTest?.testName || "Dịch vụ xét nghiệm")
        : escapeHtml(selectedSampleAdd?.sampleName || "Mẫu bổ sung");

    const infoExtra =
      sourceType === "ORDER"
        ? `
          <div class="row"><span>Dịch vụ xét nghiệm</span><span>${escapeHtml(selectedGenomeTest?.testName || "—")}</span></div>`
        : `
          <div class="row"><span>Tên mẫu</span><span>${escapeHtml(selectedSampleAdd?.sampleName || "—")}</span></div>
          <div class="row"><span>Đơn hàng</span><span>${escapeHtml(selectedSampleAdd?.orderId || "—")}</span></div>
          <div class="row"><span>Trạng thái</span><span>${escapeHtml(selectedSampleAdd?.status || "—")}</span></div>`;

    const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
          .header { background:#0369a1; color:#fff; padding:16px; border-radius:12px; }
          .card { border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-top:14px; }
          .row { display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding:8px 0; font-size:13px; }
          .title { font-weight:700; margin-bottom:8px; }
          table { width:100%; border-collapse: collapse; margin-top:10px; }
          th, td { border:1px solid #e2e8f0; padding:8px; font-size:13px; }
          th { background:#f8fafc; text-align:left; }
          .total { background:#0369a1; color:#fff; font-weight:700; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size:22px; font-weight:800;">HT GENETIC LAB</div>
          <div style="margin-top:4px;">Xét nghiệm di truyền chất lượng cao</div>
          <div style="margin-top:8px;">Mã hóa đơn: ${escapeHtml(invoiceCode)}</div>
          <div>Ngày: ${escapeHtml(createdAt)}</div>
        </div>
        <div class="card">
          <div class="title">Thông tin hoá đơn</div>
          <div class="row"><span>Nguồn dữ liệu</span><span>${sourceType === "ORDER" ? "Đơn hàng" : "Mẫu bổ sung"}</span></div>
          <div class="row"><span>Mã nguồn</span><span>${escapeHtml(sourceCode || "—")}</span></div>
          <div class="row"><span>Bệnh nhân</span><span>${escapeHtml(selectedPatient?.patientName || "—")}</span></div>
          ${infoExtra}
          <div class="row"><span>Hình thức thanh toán</span><span>${escapeHtml(payDisplay)}</span></div>
          <div class="row"><span>Ghi chú</span><span>${escapeHtml(note || "—")}</span></div>
        </div>
        <div class="card">
          <div class="title">HÓA ĐƠN THANH TOÁN</div>
          <table>
            <thead><tr><th>Mô tả</th><th>Thành tiền</th></tr></thead>
            <tbody>
              <tr><td>${tableLineLabel}</td><td>${escapeHtml(formatCurrency(previewBase))}</td></tr>
              <tr><td>Thuế VAT (${escapeHtml(previewTaxPct)}%)</td><td>${escapeHtml(formatCurrency(previewVat))}</td></tr>
              <tr class="total"><td>TỔNG CỘNG</td><td>${escapeHtml(formatCurrency(previewTotal))}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card" style="margin-top:14px;text-align:center;font-size:12px;color:#64748b;">
          <div style="font-weight:700;color:#475569;margin-bottom:4px;">HT GENETIC LAB</div>
          <div>Địa chỉ: Tòa nhà FPT, Khu CNC Hòa Lạc, Thạch Thất, Hà Nội</div>
          <div>Hotline: 1900-xxxx | Email: support@htgenetic.io.vn</div>
        </div>
      </body>
    </html>`;

    try {
      const file = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: `Hoa_don_${invoiceCode}.pdf`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Thành công", `Đã xuất hóa đơn tại: ${file.uri}`);
      }

      /** Sau khi xuất PDF (tiền mặt): đánh dấu đã thanh toán; giữ «đã chấp nhận» nếu đơn đang accepted */
      if (paymentType === "CASH" && sourceType === "ORDER" && selectedOrder) {
        const curOs = String(selectedOrder.orderStatus || "").toLowerCase();
        const payload: Record<string, unknown> = {
          orderName: selectedOrder.orderName || "",
          orderStatus: curOs === "accepted" ? "accepted" : "completed",
          paymentStatus: "COMPLETED",
          paymentType: "CASH",
          paymentAmount: orderTotalAmount,
        };
        if (selectedOrder.specifyId?.specifyVoteID) {
          payload.specifyId = selectedOrder.specifyId.specifyVoteID;
        }
        if (selectedOrder.specifyVoteImagePath) {
          payload.specifyVoteImagePath = selectedOrder.specifyVoteImagePath;
        }
        if (selectedOrder.sampleCollectorId) {
          payload.sampleCollectorId = selectedOrder.sampleCollectorId;
        }
        if (selectedOrder.staffAnalystId) {
          payload.staffAnalystId = selectedOrder.staffAnalystId;
        }
        if (selectedOrder.barcodeId) {
          payload.barcodeId = selectedOrder.barcodeId;
        }
        const res = await orderService.update(selectedOrderId, payload);
        if (!res.success) {
          Alert.alert(
            "Cảnh báo",
            res.error || "Đã xuất PDF nhưng không cập nhật trạng thái đơn hàng. Vui lòng cập nhật thủ công.",
          );
        } else {
          try {
            await ensureOrderMetadataForCashInvoice(selectedOrder);
          } catch (metaErr: any) {
            Alert.alert(
              "Cảnh báo",
              metaErr?.message ||
              "Đã xuất hóa đơn và cập nhật thanh toán nhưng chưa tạo được mẫu metadata.",
            );
          }
          queryClient.invalidateQueries({ queryKey: ["invoice-create-orders"] });
          queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["patient-metadatas"] });
        }
      } else if (paymentType === "CASH" && sourceType === "SAMPLE_ADD" && selectedSampleAdd) {
        const sid = getSampleAddRowId(selectedSampleAdd);
        const parentOrderId = String(selectedSampleAdd.orderId || "").trim();
        const psRes = await sampleAddService.updatePaymentStatus(sid, "COMPLETED");
        if (!psRes.success) {
          Alert.alert(
            "Cảnh báo",
            psRes.error || "Đã xuất PDF nhưng không cập nhật trạng thái thanh toán mẫu bổ sung.",
          );
        } else {
          if (parentOrderId) {
            try {
              const parentOrderRes = await orderService.getById(parentOrderId);
              if (parentOrderRes.success && parentOrderRes.data) {
                const currentOrder = parentOrderRes.data as any;
                const orderPayload: Record<string, unknown> = {
                  orderName: currentOrder.orderName || "",
                  orderStatus: currentOrder.orderStatus || "accepted",
                  paymentStatus: "COMPLETED",
                  paymentType: "CASH",
                  paymentAmount: sampleAddFinalPrice,
                };
                if (currentOrder.specifyId?.specifyVoteID) {
                  orderPayload.specifyId = currentOrder.specifyId.specifyVoteID;
                }
                if (currentOrder.specifyVoteImagePath) {
                  orderPayload.specifyVoteImagePath = currentOrder.specifyVoteImagePath;
                }
                if (currentOrder.sampleCollectorId) {
                  orderPayload.sampleCollectorId = currentOrder.sampleCollectorId;
                }
                if (currentOrder.staffAnalystId) {
                  orderPayload.staffAnalystId = currentOrder.staffAnalystId;
                }
                if (currentOrder.barcodeId) {
                  orderPayload.barcodeId = currentOrder.barcodeId;
                }
                const orderUpdateRes = await orderService.update(parentOrderId, orderPayload);
                if (!orderUpdateRes.success) {
                  Alert.alert(
                    "Cảnh báo",
                    orderUpdateRes.error ||
                    "Đã thanh toán mẫu bổ sung nhưng chưa lưu được trạng thái thanh toán đơn hàng cha.",
                  );
                }
              }
            } catch (orderErr: any) {
              Alert.alert(
                "Cảnh báo",
                orderErr?.message ||
                "Đã thanh toán mẫu bổ sung nhưng chưa cập nhật được đơn hàng cha.",
              );
            }
          }


          try {
            await ensureSampleAddMetadataForCashInvoice(selectedSampleAdd);
          } catch (metaErr: any) {
            Alert.alert(
              "Cảnh báo",
              metaErr?.message ||
              "Đã xuất hóa đơn mẫu bổ sung nhưng chưa tạo được metadata.",
            );
          }
          queryClient.invalidateQueries({ queryKey: ["invoice-create-orders"] });
          queryClient.invalidateQueries({ queryKey: ["invoice-create-sample-adds"] });
          queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["patient-metadatas"] });
        }
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể xuất hóa đơn. Vui lòng thử lại.");
    }
  };

  const loading =
    loadingOrders ||
    loadingSampleAdds ||
    loadingPatients ||
    loadingGenomeTests ||
    loadingSampleAddServices;
  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="mt-3 text-slate-500">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1 bg-slate-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      >
        <View className="bg-white border border-slate-200 rounded-2xl p-4">
          <Text className="text-[20px] font-extrabold text-slate-900">Tạo Hoá Đơn</Text>
          <Text className="text-[13px] text-slate-500 mt-1">
            Tạo hoá đơn thanh toán cho dịch vụ xét nghiệm
          </Text>

          <View className="flex-row gap-2 mt-5">
            <TouchableOpacity
              className={`flex-1 rounded-xl py-3 px-3 border ${isOrder ? "bg-sky-600 border-sky-600" : "bg-white border-slate-200"}`}
              onPress={() => {
                if (sourceType !== "ORDER") setSourceAndReset("ORDER");
              }}
              activeOpacity={0.85}
            >
              <Text
                className={`text-center text-[13px] font-semibold ${isOrder ? "text-white" : "text-slate-600"}`}
              >
                Đơn hàng
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-xl py-3 px-3 border ${!isOrder ? "bg-sky-600 border-sky-600" : "bg-white border-slate-200"
                }`}
              onPress={() => {
                if (sourceType !== "SAMPLE_ADD") setSourceAndReset("SAMPLE_ADD");
              }}
              activeOpacity={0.85}
            >
              <Text
                className={`text-center text-[13px] font-semibold ${!isOrder ? "text-white" : "text-slate-600"}`}
              >
                Mẫu bổ sung
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-5 pb-3 border-b border-slate-200">
            <Text className="text-[16px] font-semibold text-slate-700">
              {isOrder ? "Thông tin hoá đơn" : "Hoá đơn mẫu bổ sung"}
            </Text>
          </View>

          <View className="mt-4">
            {isOrder ? (
              <>
                <Text className="text-[12px] font-bold text-slate-600 mb-2">Đơn hàng *</Text>
                {!isOrderSelectionLocked && unpaidOrders.length === 0 ? (
                  <Text className="text-[11px] text-amber-700 font-semibold mb-2">
                    Không có đơn chưa thanh toán — các đơn đã thanh toán sẽ không hiện ở đây.
                  </Text>
                ) : null}
                <TouchableOpacity
                  disabled={isOrderSelectionLocked || unpaidOrders.length === 0}
                  className={`bg-white rounded-xl border border-slate-200 px-4 py-3 flex-row items-center justify-between ${isOrderSelectionLocked || unpaidOrders.length === 0 ? "opacity-55" : ""
                    }`}
                  onPress={() => {
                    if (!isOrderSelectionLocked && unpaidOrders.length > 0) setActiveModal("order");
                  }}
                >
                  <Text className={selectedOrder ? "text-slate-900 font-bold" : "text-slate-400"}>
                    {selectedOrder?.orderName || "Chọn đơn hàng"}
                  </Text>
                  {!isOrderSelectionLocked ? <ChevronDown size={16} color="#64748b" /> : null}
                </TouchableOpacity>
                {isOrderSelectionLocked ? (
                  <View className="mt-2 flex-row items-center justify-between gap-2">
                    <Text className="text-[11px] text-slate-500 flex-1">
                      Đã cố định theo đơn đã chọn — không đổi đơn / bệnh nhân / dịch vụ / hình thức thanh toán.
                    </Text>
                    <TouchableOpacity onPress={clearOrderSelection} className="py-1 px-2 shrink-0" activeOpacity={0.85}>
                      <Text className="text-[12px] font-extrabold text-sky-600">Chọn lại</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <Text className="text-[12px] font-bold text-slate-600 mt-3 mb-2">Bệnh nhân</Text>
                <TouchableOpacity
                  disabled={isOrderSelectionLocked}
                  className={`bg-white rounded-xl border border-slate-200 px-4 py-3 flex-row items-center justify-between ${isOrderSelectionLocked ? "opacity-55" : ""
                    }`}
                  onPress={() => {
                    if (!isOrderSelectionLocked) setActiveModal("patient");
                  }}
                >
                  <Text className={selectedPatient ? "text-slate-900 font-bold" : "text-slate-400"}>
                    {selectedPatient?.patientName || "Chọn bệnh nhân"}
                  </Text>
                  {!isOrderSelectionLocked ? <ChevronDown size={16} color="#64748b" /> : null}
                </TouchableOpacity>

                <Text className="text-[12px] font-bold text-slate-600 mt-3 mb-2">Dịch vụ xét nghiệm</Text>
                <TouchableOpacity
                  disabled={isOrderSelectionLocked}
                  className={`bg-white rounded-xl border border-slate-200 px-4 py-3 flex-row items-center justify-between ${isOrderSelectionLocked ? "opacity-55" : ""
                    }`}
                  onPress={() => {
                    if (!isOrderSelectionLocked) setActiveModal("test");
                  }}
                >
                  <Text className={selectedGenomeTest ? "text-slate-900 font-bold" : "text-slate-400"}>
                    {selectedGenomeTest?.testName || "Chọn dịch vụ xét nghiệm"}
                  </Text>
                  {!isOrderSelectionLocked ? <ChevronDown size={16} color="#64748b" /> : null}
                </TouchableOpacity>

                <View className="mt-3">
                  <Text className="text-[12px] font-bold text-slate-600 mb-2">Giá gốc (VND)</Text>
                  <View className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                    <Text className="text-slate-800 font-bold">{orderBasePrice.toLocaleString("vi-VN")}</Text>
                  </View>
                </View>

                <View className="mt-3">
                  <Text className="text-[12px] font-bold text-slate-600 mb-2">Thuế VAT (%)</Text>
                  <View className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                    <Text className="text-slate-800 font-bold">{String(orderTaxRate)}</Text>
                  </View>
                  <Text className="text-[11px] text-slate-500 mt-1">Theo dịch vụ xét nghiệm đã chọn.</Text>
                </View>

                <View className="mt-3 bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                  <View className="flex-row justify-between py-1">
                    <Text className="text-slate-500 text-[12px]">Giá gốc:</Text>
                    <Text className="text-slate-800 font-bold text-[12px]">{formatCurrency(orderBasePrice)}</Text>
                  </View>
                  <View className="flex-row justify-between py-1">
                    <Text className="text-slate-500 text-[12px]">Thuế VAT ({orderTaxRate}%):</Text>
                    <Text className="text-slate-800 font-bold text-[12px]">{formatCurrency(orderVatAmount)}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-t border-slate-200 mt-1 pt-2">
                    <Text className="text-slate-900 text-[13px] font-extrabold">Tổng cộng:</Text>
                    <Text className="text-cyan-700 text-[13px] font-extrabold">{formatCurrency(orderTotalAmount)}</Text>
                  </View>
                </View>

                <Text className="text-[12px] font-bold text-slate-600 mt-3 mb-2">Hình thức thanh toán *</Text>
                <TouchableOpacity
                  disabled={isOrderSelectionLocked}
                  className={`bg-white rounded-xl border border-slate-200 px-4 py-3 flex-row items-center justify-between ${isOrderSelectionLocked ? "opacity-55" : ""
                    }`}
                  onPress={() => {
                    if (!isOrderSelectionLocked) setActiveModal("payment");
                  }}
                >
                  <Text className={paymentType ? "text-slate-900 font-bold" : "text-slate-400"}>
                    {paymentType === "CASH"
                      ? "Tiền mặt"
                      : paymentType === "ONLINE_PAYMENT"
                        ? "Thanh toán online"
                        : "Chọn hình thức thanh toán"}
                  </Text>
                  {!isOrderSelectionLocked ? <ChevronDown size={16} color="#64748b" /> : null}
                </TouchableOpacity>
                {isOrderSelectionLocked && !paymentType ? (
                  <Text className="text-[11px] text-amber-700 mt-1">
                    Đơn chưa có hình thức thanh toán — cập nhật đơn trước hoặc chọn lại đơn khác.
                  </Text>
                ) : null}

                <Text className="text-[12px] font-bold text-slate-600 mt-3 mb-2">Ghi chú</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  placeholder="Nhập ghi chú (tuỳ chọn)"
                  placeholderTextColor="#94a3b8"
                  className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
                  style={{ minHeight: 88, textAlignVertical: "top" }}
                />
              </>
            ) : (
              <>
                <Text className="text-[12px] font-bold text-slate-600 mb-2">Mẫu bổ sung *</Text>
                <TouchableOpacity
                  disabled={isSampleSelectionLocked}
                  className={`bg-white rounded-xl border border-slate-200 px-4 py-3 flex-row items-center justify-between ${isSampleSelectionLocked ? "opacity-55" : ""
                    }`}
                  onPress={() => {
                    if (!isSampleSelectionLocked) setActiveModal("sample");
                  }}
                >
                  <Text className={selectedSampleAdd ? "text-slate-900 font-bold" : "text-slate-400"}>
                    {selectedSampleAdd?.sampleName || "Chọn mẫu bổ sung"}
                  </Text>
                  {!isSampleSelectionLocked ? <ChevronDown size={16} color="#64748b" /> : null}
                </TouchableOpacity>
                {isSampleSelectionLocked ? (
                  <View className="mt-2 flex-row items-center justify-between gap-2">
                    <Text className="text-[11px] text-slate-500 flex-1">
                      Đã cố định theo mẫu đã chọn — không đổi mẫu khác.
                    </Text>
                    <TouchableOpacity onPress={clearSampleSelection} className="py-1 px-2 shrink-0" activeOpacity={0.85}>
                      <Text className="text-[12px] font-extrabold text-sky-600">Chọn lại</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {unpaidSampleAdds.length === 0 ? (
                  <Text className="text-[11px] text-slate-400 mt-1">
                    Không có mẫu bổ sung nào chưa thanh toán
                  </Text>
                ) : null}

                {selectedSampleAdd ? (
                  <View className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <View className="flex-row justify-between py-0.5">
                      <Text className="text-[12px] text-slate-500">Tên mẫu:</Text>
                      <Text className="text-[12px] font-semibold text-slate-800">
                        {selectedSampleAdd.sampleName || "—"}
                      </Text>
                    </View>
                    <View className="flex-row justify-between py-0.5">
                      <Text className="text-[12px] text-slate-500">Đơn hàng:</Text>
                      <Text className="text-[12px] font-semibold text-slate-800">
                        {selectedSampleAdd.orderId || "—"}
                      </Text>
                    </View>
                    <View className="flex-row justify-between py-0.5">
                      <Text className="text-[12px] text-slate-500">Trạng thái:</Text>
                      <Text className="text-[12px] font-semibold text-slate-800">
                        {selectedSampleAdd.status || "—"}
                      </Text>
                    </View>
                    {selectedPatient ? (
                      <>
                        <View className="flex-row justify-between py-0.5">
                          <Text className="text-[12px] text-slate-500">Bệnh nhân:</Text>
                          <Text className="text-[12px] font-semibold text-slate-800">
                            {selectedPatient.patientName || "—"}
                          </Text>
                        </View>
                        <View className="flex-row justify-between py-0.5">
                          <Text className="text-[12px] text-slate-500">Mã BN:</Text>
                          <Text className="text-[12px] font-semibold text-slate-800">
                            {selectedPatient.patientId || "—"}
                          </Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}

                <View className="mt-3">
                  <Text className="text-[12px] font-bold text-slate-600 mb-2">Giá gốc (VND)</Text>
                  <View className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <Text className="font-bold text-slate-800">{sampleAddBasePrice.toLocaleString("vi-VN")}</Text>
                  </View>
                </View>

                <View className="mt-3">
                  <Text className="text-[12px] font-bold text-slate-600 mb-2">Thuế VAT (%)</Text>
                  <View className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <Text className="font-bold text-slate-800">{String(sampleAddTaxRate)}</Text>
                  </View>
                </View>

                <View className="mt-3 bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                  <View className="flex-row justify-between py-1">
                    <Text className="text-slate-500 text-[12px]">Giá gốc:</Text>
                    <Text className="text-slate-800 font-bold text-[12px]">{formatCurrency(sampleAddBasePrice)}</Text>
                  </View>
                  <View className="flex-row justify-between py-1">
                    <Text className="text-slate-500 text-[12px]">Thuế VAT ({sampleAddTaxRate}%):</Text>
                    <Text className="text-slate-800 font-bold text-[12px]">{formatCurrency(sampleAddVatAmount)}</Text>
                  </View>
                  <View className="flex-row justify-between py-1 border-t border-slate-200 mt-1 pt-2">
                    <Text className="text-slate-900 text-[13px] font-extrabold">Tổng cộng:</Text>
                    <Text className="text-cyan-700 text-[13px] font-extrabold">{formatCurrency(sampleAddFinalPrice)}</Text>
                  </View>
                </View>

                <Text className="text-[12px] font-bold text-slate-600 mt-3 mb-2">Hình thức thanh toán *</Text>
                <View className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Text className={paymentType ? "font-bold text-slate-900" : "font-bold text-slate-400"}>
                    {paymentType === "CASH"
                      ? "Tiền mặt"
                      : paymentType === "ONLINE_PAYMENT"
                        ? "Thanh toán online"
                        : "Chưa có"}
                  </Text>
                </View>

                <Text className="text-[12px] font-bold text-slate-600 mt-3 mb-2">Ghi chú</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  multiline
                  placeholder="Nhập ghi chú (tuỳ chọn)"
                  placeholderTextColor="#94a3b8"
                  className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
                  style={{ minHeight: 88, textAlignVertical: "top" }}
                />
              </>
            )}
          </View>
        </View>

        <View className="bg-white border border-slate-200 rounded-2xl p-4 mt-4">
          <Text className="text-[15px] font-extrabold text-slate-900">Xem trước hoá đơn</Text>
          <View className="bg-cyan-600 rounded-xl p-4 mt-3">
            <Text className="text-white text-[17px] font-extrabold">HT GENETIC LAB</Text>
            <Text className="text-cyan-100 text-[12px] mt-1">Xét nghiệm di truyền chất lượng cao</Text>
          </View>

          <View className="mt-3">
            <Text className="text-[12px] text-slate-500">Mã hóa đơn</Text>
            <Text className="text-[14px] font-bold text-slate-900">{previewInvoiceId}</Text>
          </View>

          <Text className="mt-4 text-[14px] font-extrabold text-slate-900">HÓA ĐƠN THANH TOÁN</Text>
          <Text className="text-[12px] text-slate-500">Ngày: {new Date().toLocaleTimeString("vi-VN")} {new Date().toLocaleDateString("vi-VN")}</Text>

          {paymentType ? (
            <View className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
              <Text className="text-[12px] text-blue-900">
                <Text className="font-extrabold">Hình thức thanh toán: </Text>
                {paymentType === "CASH" ? "Tiền mặt" : paymentType === "ONLINE_PAYMENT" ? "Thanh toán online" : ""}
              </Text>
            </View>
          ) : null}

          {isOrder && selectedPatient ? (
            <View className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
              <Text className="text-[12px] font-extrabold text-slate-700 mb-2">Thông tin bệnh nhân</Text>
              <Text className="text-[11px] text-slate-600">Họ tên: {selectedPatient.patientName || "—"}</Text>
              <Text className="text-[11px] text-slate-600">Mã BN: {selectedPatient.patientId || "—"}</Text>
            </View>
          ) : null}

          {!isOrder && selectedSampleAdd ? (
            <View className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
              <Text className="text-[12px] font-extrabold text-slate-700 mb-2">Thông tin mẫu bổ sung</Text>
              <Text className="text-[11px] text-slate-600">Tên mẫu: {selectedSampleAdd.sampleName || "—"}</Text>
              <Text className="text-[11px] text-slate-600">Mã đơn hàng: {selectedSampleAdd.orderId || "—"}</Text>
              {selectedPatient ? (
                <Text className="text-[11px] text-slate-600">Bệnh nhân: {selectedPatient.patientName || "—"}</Text>
              ) : null}
            </View>
          ) : null}

          <View className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
            <View className="flex-row bg-slate-100">
              <Text className="flex-1 px-3 py-2 text-[12px] font-bold text-slate-700">Mô tả</Text>
              <Text className="px-3 py-2 text-[12px] font-bold text-slate-700">Thành tiền</Text>
            </View>
            <View className="flex-row border-t border-slate-200">
              <Text className="flex-1 px-3 py-2 text-[12px] text-slate-700">
                {isOrder
                  ? selectedGenomeTest?.testName || "Dịch vụ xét nghiệm"
                  : selectedSampleAdd?.sampleName || "Mẫu bổ sung"}
              </Text>
              <Text className="px-3 py-2 text-[12px] text-slate-700">{formatCurrency(previewBase)}</Text>
            </View>
            <View className="flex-row border-t border-slate-200">
              <Text className="flex-1 px-3 py-2 text-[12px] text-slate-700">Thuế VAT ({previewTaxPct}%)</Text>
              <Text className="px-3 py-2 text-[12px] text-slate-700">{formatCurrency(previewVat)}</Text>
            </View>
            <View className="flex-row border-t border-slate-200 bg-cyan-600">
              <Text className="flex-1 px-3 py-2 text-[12px] font-extrabold text-white">TỔNG CỘNG</Text>
              <Text className="px-3 py-2 text-[12px] font-extrabold text-white">{formatCurrency(previewTotal)}</Text>
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-[12px] text-slate-600 font-extrabold">HT GENETIC LAB</Text>
            <Text className="text-[11px] text-slate-500 mt-1">
              Địa chỉ: Tòa nhà FPT, Khu CNC Hòa Lạc, Thạch Thất, Hà Nội
            </Text>
            <Text className="text-[11px] text-slate-500 mt-1">
              Hotline: 1900-xxxx | Email: support@htgenetic.io.vn
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleExportInvoice}
          disabled={isPayNavigating}
          className={`mt-4 rounded-xl py-3 flex-row items-center justify-center ${isPayNavigating ? "bg-cyan-400" : "bg-cyan-600"
            }`}
        >
          {isPayNavigating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <FileDown size={16} color="#fff" />
          )}
          <Text className="ml-2 text-white text-[14px] font-extrabold">
            {paymentType === "ONLINE_PAYMENT"
              ? "Tiến hành thanh toán online"
              : isOrder
                ? "Xuất hoá đơn"
                : "Xuất hoá đơn mẫu bổ sung"}
          </Text>
        </TouchableOpacity>

        <SelectionModal
          visible={activeModal === "order"}
          title="Chọn đơn hàng"
          options={orderOptions}
          selectedValue={selectedOrderId}
          onSelect={handleSelectOrder}
          onClose={() => setActiveModal("")}
        />
        <SelectionModal
          visible={activeModal === "sample"}
          title="Chọn mẫu bổ sung"
          options={sampleOptions}
          selectedValue={selectedSampleAddId}
          onSelect={handleSelectSampleAdd}
          onClose={() => setActiveModal("")}
        />
        <SelectionModal
          visible={activeModal === "patient"}
          title="Chọn bệnh nhân"
          options={patientOptions}
          selectedValue={selectedPatientId}
          onSelect={setSelectedPatientId}
          onClose={() => setActiveModal("")}
        />
        <SelectionModal
          visible={activeModal === "test"}
          title="Chọn dịch vụ xét nghiệm"
          options={genomeTestOptions}
          selectedValue={selectedGenomeTestId}
          onSelect={setSelectedGenomeTestId}
          onClose={() => setActiveModal("")}
        />
        <SelectionModal
          visible={activeModal === "payment"}
          title="Chọn hình thức thanh toán"
          options={paymentTypeOptions}
          selectedValue={paymentType}
          onSelect={(v) => {
            if (!isOrderSelectionLocked) setPaymentType(v as PaymentType);
          }}
          onClose={() => setActiveModal("")}
        />
      </ScrollView>
    </>
  );
}

