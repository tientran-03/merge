import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Eye,
  FlaskConical,
  Lock,
  Package,
  Search,
  Smartphone,
  UserRound,
  Wallet,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { INVOICE_WIDTH, InvoiceView, type InvoiceData } from "@/components/invoice/InvoiceView";
import { MEDICAL } from "@/lib/theme/medical";
import { getApiResponseData, getApiResponseSingle } from "@/lib/types/api-types";
import { useSheetBottomInset } from "@/lib/useSheetBottomInset";
import { genomeTestService, type GenomeTestResponse } from "@/services/genomeTestService";
import { orderService, type OrderResponse } from "@/services/orderService";
import { patientMetadataService } from "@/services/patientMetadataService";
import { patientService, type PatientResponse } from "@/services/patientService";
import { paymentService } from "@/services/paymentService";
import { sampleAddService, type SampleAddResponse } from "@/services/sampleAddService";
import {
  sampleAddServiceCatalogService,
  type SampleAddServiceCatalogResponse,
} from "@/services/sampleAddServiceCatalogService";
import { specifyVoteTestService } from "@/services/specifyVoteTestService";
import { uploadImageToCloudinary } from "@/utils/cloudinary";

type InvoiceMode = "order" | "sampleAdd";

type CaptureJob = {
  kind: "order" | "sampleAdd";
  orderId: string;
  sampleAddId?: string;
  data: InvoiceData;
  staffCashAfterUpload?: { specifyId: string };
};

const isCompleted = (s?: string) => String(s || "").toUpperCase() === "COMPLETED";
function sampleAddPrimaryId(sa: SampleAddResponse | undefined | null): string {
  if (!sa) return "";
  const raw = sa.id ?? sa.sampleAddId;
  return raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";
}

const formatMoney = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const norm = (s: string) => s.trim().toLowerCase();

function filterByQuery<T>(items: T[], q: string, getText: (t: T) => string): T[] {
  if (!q.trim()) return items;
  const n = norm(q);
  return items.filter((x) => norm(getText(x)).includes(n));
}

function SectionBlock({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-3.5">
      <View className="mb-2 flex-row items-start">
        <View className="h-6 w-6 items-center justify-center rounded-lg bg-sky-600">
          <Text className="text-[11px] font-extrabold text-white">{step}</Text>
        </View>
        <View className="ml-2 flex-1 pt-0">
          <Text className="text-[13px] font-extrabold text-slate-900">{title}</Text>
          {subtitle ? (
            <Text className="mt-0.5 text-[10px] leading-4 text-slate-500">{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <View className="rounded-xl border border-slate-200/90 bg-white p-2.5" style={{ elevation: 1 }}>
        {children}
      </View>
    </View>
  );
}

function PaymentOptionCard({
  selected,
  onPress,
  icon,
  title,
  description,
  locked,
}: {
  selected: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  locked?: boolean;
}) {
  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      disabled={!!locked}
      className={`flex-row items-center rounded-xl border px-3 py-2.5 ${locked ? "opacity-80" : ""} ${selected ? "border-sky-600 bg-sky-50" : "border-slate-200 bg-white"
        }`}
      style={{ minHeight: 56 }}
    >
      <View
        className={`mr-2.5 h-9 w-9 items-center justify-center rounded-lg ${selected ? "bg-sky-100" : "bg-slate-100"
          }`}
      >
        {icon}
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[13px] font-bold text-slate-900">{title}</Text>
        <Text className="mt-0.5 text-[10px] leading-4 text-slate-500">{description}</Text>
      </View>
      <View
        className={`ml-1.5 h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? "border-sky-600 bg-sky-600" : "border-slate-300 bg-white"
          }`}
      >
        {locked ? <Lock size={12} color="#64748b" /> : selected ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

function InvoiceSelectRow({
  label,
  value,
  placeholder,
  onPress,
  icon,
  locked,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  icon?: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <Pressable
      disabled={!!locked}
      onPress={locked ? undefined : onPress}
      className={`flex-row items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 ${locked ? "opacity-90" : ""}`}
      style={{ minHeight: 44 }}
    >
      {icon ? <View className="mr-1.5 opacity-90">{icon}</View> : null}
      <View className="flex-1 min-w-0">
        <Text className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</Text>
        <Text className="mt-0.5 text-[12px] font-semibold text-slate-900" numberOfLines={2}>
          {value || placeholder}
        </Text>
      </View>
      {locked ? <Lock size={14} color="#94a3b8" /> : <ChevronRight size={16} color="#94a3b8" />}
    </Pressable>
  );
}

function InvoiceSearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  return (
    <View className="mb-2 flex-row items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <Search size={15} color="#64748b" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        className="ml-2 flex-1 py-1 text-[13px] text-slate-900"
        returnKeyType="search"
      />
    </View>
  );
}

export default function StaffInvoiceCreationScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    sampleAddId?: string;
  }>();
  const initialMode = String(params.mode || "").trim().toLowerCase();
  const initialSampleAddId = String(params.sampleAddId || "").trim();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const sheetPickerInset = useSheetBottomInset(16);
  const invoiceViewRef = useRef<View>(null);
  const previewInvoiceLayoutWidth = useMemo(
    () => Math.max(280, Math.min(INVOICE_WIDTH, windowWidth - 24)),
    [windowWidth]
  );

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<InvoiceMode>("order");

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [genomeTests, setGenomeTests] = useState<GenomeTestResponse[]>([]);
  const [sampleAdds, setSampleAdds] = useState<SampleAddResponse[]>([]);
  const [sampleAddServices, setSampleAddServices] = useState<SampleAddServiceCatalogResponse[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedGenomeTestId, setSelectedGenomeTestId] = useState("");
  const [paymentType, setPaymentType] = useState<"" | "CASH" | "ONLINE_PAYMENT">("");
  const [note, setNote] = useState("");

  const [selectedSampleAddId, setSelectedSampleAddId] = useState("");
  const [sampleAddPaymentType, setSampleAddPaymentType] = useState<"" | "CASH" | "ONLINE_PAYMENT">("");
  const [sampleAddNote, setSampleAddNote] = useState("");

  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [gtPickerOpen, setGtPickerOpen] = useState(false);
  const [saPickerOpen, setSaPickerOpen] = useState(false);
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);

  const [orderSearch, setOrderSearch] = useState("");
  const [gtSearch, setGtSearch] = useState("");
  const [saSearch, setSaSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");

  const [captureJob, setCaptureJob] = useState<CaptureJob | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (initialMode !== "sampleadd") return;
    setMode("sampleAdd");
    if (initialSampleAddId) {
      setSelectedSampleAddId(initialSampleAddId);
    }
  }, [initialMode, initialSampleAddId]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.orderId === selectedOrderId),
    [orders, selectedOrderId]
  );
  const selectedGt = useMemo(
    () => genomeTests.find((t) => t.testId === selectedGenomeTestId),
    [genomeTests, selectedGenomeTestId]
  );
  const selectedPatient = useMemo(
    () => patients.find((p) => p.patientId === selectedPatientId),
    [patients, selectedPatientId]
  );
  const selectedSa = useMemo(
    () => sampleAdds.find((s) => (s.id || s.sampleAddId) === selectedSampleAddId),
    [sampleAdds, selectedSampleAddId]
  );

  const specFromOrder = selectedOrder?.specifyId;
  const lockOrderGenome = Boolean(
    mode === "order" &&
    selectedOrderId &&
    (specFromOrder?.genomeTestId ||
      specFromOrder?.genomeTest?.testId ||
      specFromOrder?.genomeTest?.testName)
  );
  const lockOrderPatient = Boolean(
    mode === "order" &&
    selectedOrderId &&
    (specFromOrder?.patientId || specFromOrder?.patient?.patientId || specFromOrder?.patient?.patientName)
  );
  const lockOrderPayment = Boolean(mode === "order" && selectedOrderId && selectedOrder?.paymentType);

  const sampleAddLineLocked = mode === "sampleAdd" && !!selectedSampleAddId;
  const lockSamplePayment = Boolean(sampleAddLineLocked && selectedSa?.paymentType);

  const displayGenomeName = useMemo(() => {
    if (selectedGt?.testName) return selectedGt.testName;
    return specFromOrder?.genomeTest?.testName?.trim() || "";
  }, [selectedGt, specFromOrder]);

  const displayPatientName = useMemo(() => {
    if (selectedPatient?.patientName) return selectedPatient.patientName;
    return specFromOrder?.patient?.patientName?.trim() || "";
  }, [selectedPatient, specFromOrder]);

  const displayPatientPhone = useMemo(() => {
    if (selectedPatient?.patientPhone) return selectedPatient.patientPhone;
    return specFromOrder?.patient?.patientPhone?.trim() || "";
  }, [selectedPatient, specFromOrder]);

  const orderHasGenome = useMemo(() => {
    if (!selectedOrderId) return false;
    if (selectedGt) return true;
    return !!(
      specFromOrder?.genomeTestId ||
      specFromOrder?.genomeTest?.testId ||
      specFromOrder?.genomeTest?.testName
    );
  }, [selectedOrderId, selectedGt, specFromOrder]);

  const orderHasPatient = useMemo(() => {
    if (!selectedOrderId) return false;
    if (selectedPatient) return true;
    return !!(specFromOrder?.patientId || specFromOrder?.patient?.patientId || specFromOrder?.patient?.patientName);
  }, [selectedOrderId, selectedPatient, specFromOrder]);

  const orderFinalPrice = useMemo(() => {
    if (selectedGt) {
      const base = selectedGt.price ?? 0;
      const tax = selectedGt.taxRate ?? 10;
      return selectedGt.finalPrice ?? base + (base * tax) / 100;
    }
    const nested = specFromOrder?.genomeTest;
    if (nested) {
      if (nested.finalPrice != null) return nested.finalPrice;
      const base = (nested as { price?: number }).price ?? 0;
      const tax = 10;
      return base + (base * tax) / 100;
    }
    if (selectedOrder?.paymentAmount != null && selectedOrder.paymentAmount > 0) {
      return selectedOrder.paymentAmount;
    }
    return 0;
  }, [selectedGt, specFromOrder, selectedOrder]);

  const saService = useMemo(() => {
    if (!selectedSa) return undefined;
    return sampleAddServices.find((x) => x.sampleName === selectedSa.sampleName);
  }, [selectedSa, sampleAddServices]);

  const sampleAddFinal = useMemo(() => {
    if (!saService) return 0;
    const base = saService.price ?? 0;
    const tax = saService.taxRate ?? 10;
    return saService.finalPrice ?? base + (base * tax) / 100;
  }, [saService]);

  const footerAmount = mode === "order" ? orderFinalPrice : sampleAddFinal;

  const orderReady = Boolean(selectedOrderId && orderHasGenome && orderHasPatient && paymentType);
  const sampleAddReady = Boolean(selectedSampleAddId && sampleAddPaymentType);
  const canSubmit = mode === "order" ? orderReady : sampleAddReady;

  const filteredOrders = useMemo(
    () =>
      filterByQuery(orders, orderSearch, (o) =>
        [o.orderName, o.orderId, o.barcodeId].filter(Boolean).join(" ")
      ),
    [orders, orderSearch]
  );
  const filteredGt = useMemo(
    () => filterByQuery(genomeTests, gtSearch, (t) => [t.testName, t.code, t.testId].filter(Boolean).join(" ")),
    [genomeTests, gtSearch]
  );
  const filteredSa = useMemo(
    () =>
      filterByQuery(sampleAdds, saSearch, (s) =>
        [s.sampleName, s.orderId, s.id, s.sampleAddId].filter(Boolean).join(" ")
      ),
    [sampleAdds, saSearch]
  );
  const filteredPatients = useMemo(
    () =>
      filterByQuery(patients, patientSearch, (p) =>
        [p.patientName, p.patientId, p.patientPhone].filter(Boolean).join(" ")
      ),
    [patients, patientSearch]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [or, pr, gt, sa, svc] = await Promise.all([
          orderService.getAll(),
          patientService.getAll(),
          genomeTestService.getAll(),
          sampleAddService.getAll(),
          sampleAddServiceCatalogService.getAll(),
        ]);
        if (cancelled) return;
        const orderList = getApiResponseData<OrderResponse>(or);
        setOrders(orderList.filter((o) => !isCompleted(o.paymentStatus)));
        setPatients(getApiResponseData<PatientResponse>(pr));
        setGenomeTests(getApiResponseData<GenomeTestResponse>(gt));
        const saList = getApiResponseData<SampleAddResponse>(sa);
        setSampleAdds(saList.filter((x) => !isCompleted(x.paymentStatus)));
        setSampleAddServices(getApiResponseData<SampleAddServiceCatalogResponse>(svc));
      } catch {
        Alert.alert("Lỗi", "Không tải được dữ liệu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedOrderId) return;
    const o = orders.find((x) => x.orderId === selectedOrderId);
    if (!o?.specifyId) return;
    const spec = o.specifyId;
    const pid = spec.patientId || spec.patient?.patientId;
    if (pid) setSelectedPatientId(String(pid));
    const gtid = spec.genomeTestId || spec.genomeTest?.testId;
    if (gtid) setSelectedGenomeTestId(String(gtid));
    if (o.paymentType) setPaymentType(o.paymentType as "CASH" | "ONLINE_PAYMENT");
  }, [selectedOrderId, orders]);

  useEffect(() => {
    if (!selectedSampleAddId) return;
    const sa = sampleAdds.find((s) => (s.id || s.sampleAddId) === selectedSampleAddId);
    if (sa?.paymentType) setSampleAddPaymentType(sa.paymentType as "CASH" | "ONLINE_PAYMENT");
  }, [selectedSampleAddId, sampleAdds]);

  useEffect(() => {
    if (!orderPickerOpen) setOrderSearch("");
  }, [orderPickerOpen]);
  useEffect(() => {
    if (!gtPickerOpen) setGtSearch("");
  }, [gtPickerOpen]);
  useEffect(() => {
    if (!saPickerOpen) setSaSearch("");
  }, [saPickerOpen]);
  useEffect(() => {
    if (!patientPickerOpen) setPatientSearch("");
  }, [patientPickerOpen]);

  const buildOrderInvoice = useCallback(
    (transactionId: string, transactionDate: Date): InvoiceData => {
      const spec = selectedOrder?.specifyId;
      const nested = spec?.genomeTest;

      const patientFromSpec =
        spec?.patient && (spec.patient.patientId || spec.patient.patientName)
          ? {
            patientId: String(spec.patient.patientId ?? ""),
            patientName: spec.patient.patientName,
            patientPhone: spec.patient.patientPhone,
            patientDob: spec.patient.patientDob,
          }
          : undefined;

      const patientBlock =
        selectedPatient
          ? {
            patientId: selectedPatient.patientId,
            patientName: selectedPatient.patientName,
            patientPhone: selectedPatient.patientPhone,
            patientDob: selectedPatient.patientDob,
          }
          : patientFromSpec;

      if (selectedGt) {
        const base = selectedGt.price ?? 0;
        const tax = selectedGt.taxRate ?? 10;
        const final = selectedGt.finalPrice ?? base + (base * tax) / 100;
        return {
          orderId: selectedOrderId,
          orderName: selectedOrder?.orderName,
          transactionId,
          transactionDate: transactionDate.toISOString(),
          genomeTest: {
            testId: selectedGt.testId,
            testName: selectedGt.testName,
            code: selectedGt.code ?? undefined,
            price: base,
            taxRate: tax,
            finalPrice: final,
          },
          patient: patientBlock,
          amountPaid: final,
        };
      }

      if (nested?.testName || nested?.testId) {
        const base = (nested as { price?: number }).price ?? 0;
        const tax = 10;
        const final = nested.finalPrice ?? base + (base * tax) / 100;
        return {
          orderId: selectedOrderId,
          orderName: selectedOrder?.orderName,
          transactionId,
          transactionDate: transactionDate.toISOString(),
          genomeTest: {
            testId: nested.testId,
            testName: nested.testName,
            code: nested.code ?? undefined,
            price: base,
            taxRate: tax,
            finalPrice: final,
          },
          patient: patientBlock,
          amountPaid: final,
        };
      }

      const fallback = selectedOrder?.paymentAmount ?? 0;
      return {
        orderId: selectedOrderId,
        orderName: selectedOrder?.orderName,
        transactionId,
        transactionDate: transactionDate.toISOString(),
        patient: patientBlock,
        amountPaid: fallback,
      };
    },
    [selectedOrderId, selectedOrder, selectedGt, selectedPatient]
  );

  const buildSampleAddInvoice = useCallback(
    (transactionId: string, transactionDate: Date): InvoiceData => {
      if (!selectedSa || !saService) {
        return { orderId: selectedSampleAddId, transactionId, transactionDate: transactionDate.toISOString() };
      }
      const base = saService.price ?? 0;
      const tax = saService.taxRate ?? 10;
      const final = saService.finalPrice ?? base + (base * tax) / 100;
      const p = selectedSa.patientId
        ? patients.find((x) => x.patientId === selectedSa.patientId)
        : undefined;
      return {
        orderId: sampleAddPrimaryId(selectedSa) || selectedSampleAddId,
        orderName: `Bổ sung mẫu - ${selectedSa.sampleName}`,
        transactionId,
        transactionDate: transactionDate.toISOString(),
        genomeTest: {
          testName: `Bổ sung mẫu - ${saService.sampleName}`,
          price: base,
          taxRate: tax,
          finalPrice: final,
        },
        patient: p
          ? {
            patientId: p.patientId,
            patientName: p.patientName,
            patientPhone: p.patientPhone,
            patientDob: p.patientDob,
          }
          : undefined,
        amountPaid: final,
      };
    },
    [selectedSa, saService, selectedSampleAddId, patients]
  );

  const previewInvoiceData = useMemo((): InvoiceData | null => {
    if (mode === "order") {
      if (!selectedOrderId || !orderHasGenome || !orderHasPatient) return null;
      return buildOrderInvoice("", new Date());
    }
    if (mode === "sampleAdd") {
      if (!selectedSampleAddId || !selectedSa || !saService) return null;
      return buildSampleAddInvoice("", new Date());
    }
    return null;
  }, [
    mode,
    selectedOrderId,
    orderHasGenome,
    orderHasPatient,
    buildOrderInvoice,
    selectedSampleAddId,
    selectedSa,
    saService,
    buildSampleAddInvoice,
  ]);

  useEffect(() => {
    if (!captureJob) return;
    const job = captureJob;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        if (cancelled) return;
        if (!invoiceViewRef.current) {
          setCaptureJob(null);
          setSubmitting(false);
          return;
        }
        const uri = await captureRef(invoiceViewRef, {
          format: "png",
          quality: 1,
          result: "tmpfile",
          width: 600,
          height: 1400,
        });
        if (cancelled) return;
        const up = await uploadImageToCloudinary(uri, { folder: "invoice" });
        if (cancelled) return;
        if (up.secureUrl) {
          if (job.kind === "order") {
            await orderService.updateInvoiceLink(job.orderId, up.secureUrl);
            await orderService.updateStatus(job.orderId, "accepted");
          } else if (job.sampleAddId) {
            await sampleAddService.updateInvoiceLink(job.sampleAddId, up.secureUrl);
          }
        }
        if (cancelled) return;

        if (!up.secureUrl) {
          Alert.alert("Lỗi", "Không upload được hóa đơn. Chưa tạo mẫu trên hệ thống.");
        } else if (job.kind === "order" && job.staffCashAfterUpload?.specifyId) {
          const sid = job.staffCashAfterUpload.specifyId;
          if (cancelled) return;
          const specRes = await specifyVoteTestService.getById(sid);
          if (cancelled) return;
          const spec = getApiResponseSingle(specRes) as any;
          const samples = spec?.genomeTest?.testSample;
          const rawArr = Array.isArray(samples) ? samples : samples ? [String(samples)] : [];
          const seen = new Set<string>();
          const uniqueSampleNames: string[] = [];
          for (const s of rawArr) {
            const label = String(s).trim();
            const key = label.toLowerCase();
            if (!key) continue;
            if (seen.has(key)) continue;
            seen.add(key);
            uniqueSampleNames.push(label);
          }
          const pat = spec?.patient;
          for (const sampleName of uniqueSampleNames) {
            if (cancelled) return;
            await patientMetadataService.createWithAnalyze({
              specifyId: sid,
              patientId: pat?.patientId,
              patientName: pat?.patientName,
              sampleName,
            });
          }
          if (cancelled) return;
          Alert.alert(
            "Thành công",
            "Đã xác nhận thanh toán, lưu hóa đơn và tạo mẫu."
          );
          setSelectedOrderId("");
          setSelectedPatientId("");
          setSelectedGenomeTestId("");
          setPaymentType("");
          setNote("");
        } else if (job.kind === "order" && !job.staffCashAfterUpload) {
          Alert.alert("Thành công", "Đã tạo hóa đơn và cập nhật thanh toán.");
          setSelectedOrderId("");
          setSelectedPatientId("");
          setSelectedGenomeTestId("");
          setPaymentType("");
          setNote("");
        }
      } catch (e) {
        console.error("Invoice capture:", e);
        if (!cancelled) {
          Alert.alert("Lỗi", "Không hoàn tất lưu hóa đơn hoặc tạo mẫu. Vui lòng thử lại.");
        }
      } finally {
        setCaptureJob(null);
        setSubmitting(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [captureJob]);

  const runOrderCash = async () => {
    if (!selectedOrderId || !paymentType) {
      Alert.alert("Thiếu thông tin", "Chọn đơn hàng và hình thức thanh toán");
      return;
    }
    if (!orderHasGenome) {
      Alert.alert("Thiếu thông tin", "Đơn chưa có gói xét nghiệm trên phiếu chỉ định");
      return;
    }
    if (!orderHasPatient) {
      Alert.alert("Thiếu thông tin", "Đơn chưa có thông tin bệnh nhân trên phiếu chỉ định");
      return;
    }
    let deferSubmittingUntilInvoice = false;
    setSubmitting(true);
    try {
      const init = await paymentService.initiatePayment({
        orderId: selectedOrderId,
        amount: orderFinalPrice,
        description: note || selectedOrder?.orderName || "Hóa đơn",
        returnUrl: "htgenmobile://payment/success",
        cancelUrl: "htgenmobile://payment/cancel",
      });
      if (!init.success || !init.data) {
        Alert.alert("Lỗi", init.error || "Không khởi tạo thanh toán");
        return;
      }
      const paymentId = init.data.paymentId;
      const transactionId = `CASH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const transactionDate = new Date();
      const upd = await paymentService.updatePayment(paymentId, {
        orderId: selectedOrderId,
        transactionId,
        transactionDate: transactionDate.toISOString(),
        amountIn: orderFinalPrice,
        transactionContent: note || `Thanh toán tiền mặt - ${selectedOrder?.orderName || selectedOrderId}`,
        paymentStatus: "COMPLETED",
        paymentType: "CASH",
      });
      if (!upd.success) {
        Alert.alert("Lỗi", upd.error || "Không cập nhật thanh toán");
        return;
      }

      const paidCheck = await paymentService.checkOrderPaymentStatus(selectedOrderId);
      if (!paidCheck.success || !paidCheck.data) {
        Alert.alert("Lỗi", "Không xác nhận được trạng thái thanh toán đơn hàng.");
        return;
      }
      if (String(paidCheck.data.paymentStatus || "").toUpperCase() !== "COMPLETED") {
        Alert.alert(
          "Lỗi",
          "Đơn hàng chưa ở trạng thái đã thanh toán. Không tạo mẫu — vui lòng kiểm tra lại."
        );
        return;
      }

      const inv = buildOrderInvoice(transactionId, transactionDate);
      const sid = selectedOrder?.specifyId?.specifyVoteID;
      setCaptureJob({
        kind: "order",
        orderId: selectedOrderId,
        data: inv,
        ...(sid ? { staffCashAfterUpload: { specifyId: sid } } : {}),
      });
      deferSubmittingUntilInvoice = true;
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Không hoàn tất tạo hóa đơn");
    } finally {
      if (!deferSubmittingUntilInvoice) setSubmitting(false);
    }
  };

  const runSampleAddCash = async () => {
    if (!selectedSampleAddId || !sampleAddPaymentType) {
      Alert.alert("Thiếu thông tin", "Chọn mẫu bổ sung và hình thức thanh toán");
      return;
    }
    const sa = selectedSa;
    if (!sa) {
      Alert.alert("Lỗi", "Không tìm thấy mẫu bổ sung. Vui lòng chọn lại.");
      return;
    }
    const saId = sampleAddPrimaryId(sa);
    if (!saId) {
      Alert.alert("Lỗi", "Không có mã mẫu bổ sung");
      return;
    }
    setSubmitting(true);
    try {
      const init = await paymentService.initiatePayment({
        orderId: sa.orderId || saId,
        amount: sampleAddFinal,
        description: `SA ${sa.orderId}`,
        sampleAddId: saId,
        returnUrl: "htgenmobile://payment/success",
        cancelUrl: "htgenmobile://payment/cancel",
      });
      if (!init.success || !init.data) {
        Alert.alert("Lỗi", init.error || "Không khởi tạo thanh toán");
        return;
      }
      const paymentId = init.data.paymentId;
      const transactionId = `CASH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const transactionDate = new Date();
      await paymentService.updatePayment(paymentId, {
        orderId: sa.orderId || saId,
        transactionId,
        transactionDate: transactionDate.toISOString(),
        amountIn: sampleAddFinal,
        transactionContent: sampleAddNote || `Tiền mặt - ${sa.sampleName}`,
        paymentStatus: "COMPLETED",
        paymentType: "CASH",
      });
      await sampleAddService.updatePaymentStatus(saId, "COMPLETED");
      await sampleAddService.updatePaymentType(saId, "CASH");
      await sampleAddService.updateStatus(saId, "accepted");

      const inv = buildSampleAddInvoice(transactionId, transactionDate);
      setCaptureJob({
        kind: "sampleAdd",
        orderId: sa.orderId || saId,
        sampleAddId: saId,
        data: inv,
      });

      if (sa.specifyId && sa.patientId) {
        let pname = sa.patientName;
        if (!pname) {
          const pr = await patientService.getById(sa.patientId);
          pname = getApiResponseSingle<PatientResponse>(pr)?.patientName;
        }
        await patientMetadataService.createWithSampleAdd({
          specifyId: sa.specifyId,
          patientId: sa.patientId,
          patientName: pname,
          sampleName: sa.sampleName,
        });
      }

      Alert.alert("Thành công", "Đã tạo hóa đơn mẫu bổ sung.");
      setSelectedSampleAddId("");
      setSampleAddPaymentType("");
      setSampleAddNote("");
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Không hoàn tất hóa đơn mẫu bổ sung");
    } finally {
      setSubmitting(false);
    }
  };

  const runOrderOnline = () => {
    if (!selectedOrderId || !paymentType) {
      Alert.alert("Thiếu thông tin", "Chọn đơn hàng và hình thức thanh toán");
      return;
    }
    if (!orderHasGenome) {
      Alert.alert("Thiếu thông tin", "Đơn chưa có gói xét nghiệm trên phiếu chỉ định");
      return;
    }
    if (!orderHasPatient) {
      Alert.alert("Thiếu thông tin", "Đơn chưa có thông tin bệnh nhân trên phiếu chỉ định");
      return;
    }
    const sid = selectedOrder?.specifyId?.specifyVoteID || "";
    router.push({
      pathname: "/staff/payment",
      params: {
        orderId: selectedOrderId,
        orderName: selectedOrder?.orderName || "",
        amount: String(orderFinalPrice),
        specifyId: sid,
        returnPath: "/staff/invoice-creation",
      },
    });
  };

  const runSampleAddOnline = () => {
    if (!selectedSampleAddId || !sampleAddPaymentType) {
      Alert.alert("Thiếu thông tin", "Chọn mẫu và hình thức thanh toán");
      return;
    }
    const sa = selectedSa;
    if (!sa) {
      Alert.alert("Lỗi", "Không tìm thấy mẫu bổ sung. Vui lòng chọn lại.");
      return;
    }
    const saId = sampleAddPrimaryId(sa);
    if (!saId || !sa.orderId) {
      Alert.alert("Lỗi", "Thiếu thông tin đơn/mẫu (mã mẫu bổ sung hoặc mã đơn).");
      return;
    }
    router.push({
      pathname: "/customer/payment",
      params: {
        orderId: sa.orderId,
        sampleAddId: saId,
        orderName: `Bổ sung mẫu - ${sa.sampleName}`,
        amount: String(sampleAddFinal),
        specifyId: sa.specifyId || "",
        patientId: sa.patientId || "",
        patientName: sa.patientName || "",
        sampleName: sa.sampleName || "",
        hasFastq: "false",
        returnPath: "/staff/invoice-creation",
      },
    });
  };

  const onSubmit = () => {
    if (mode === "order") {
      if (!orderHasPatient) {
        Alert.alert("Thiếu thông tin", "Thiếu bệnh nhân trên đơn/phiếu chỉ định");
        return;
      }
      if (paymentType === "CASH") runOrderCash();
      else if (paymentType === "ONLINE_PAYMENT") runOrderOnline();
      else Alert.alert("Thiếu thông tin", "Chọn hình thức thanh toán");
    } else {
      if (sampleAddPaymentType === "CASH") runSampleAddCash();
      else if (sampleAddPaymentType === "ONLINE_PAYMENT") runSampleAddOnline();
      else Alert.alert("Thiếu thông tin", "Chọn hình thức thanh toán");
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-100">
        <ActivityIndicator size="large" color={MEDICAL.primary} />
        <Text className="mt-2 text-slate-600 font-semibold">Đang tải...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      {/* Capture off-screen at full opacity: low opacity breaks view-shot (bitmap alpha) → blank Cloudinary invoice. */}
      {captureJob ? (
        <View
          ref={invoiceViewRef}
          style={{ position: "absolute", left: -9999, top: 0, opacity: 1, pointerEvents: "none" }}
          collapsable={false}
        >
          <InvoiceView data={captureJob.data} collapsable={false} />
        </View>
      ) : null}

      <View className="flex-row items-center border-b border-slate-200 bg-white px-3 py-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100"
          accessibilityLabel="Quay lại"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 28 + Math.max(insets.bottom, 12) + 108,
          }}
        >
          <Text className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Loại hóa đơn
          </Text>
          <View className="mb-4 flex-row rounded-xl border border-slate-200 bg-white p-1">
            <Pressable
              onPress={() => setMode("order")}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 ${mode === "order" ? "bg-sky-600" : ""
                }`}
            >
              <Package size={16} color={mode === "order" ? "#fff" : MEDICAL.primary} />
              <Text
                className={`text-[12px] font-extrabold ${mode === "order" ? "text-white" : "text-slate-700"}`}
                numberOfLines={1}
              >
                Theo đơn hàng
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("sampleAdd")}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 ${mode === "sampleAdd" ? "bg-sky-600" : ""
                }`}
            >
              <FlaskConical size={16} color={mode === "sampleAdd" ? "#fff" : MEDICAL.primary} />
              <Text
                className={`text-[12px] font-extrabold ${mode === "sampleAdd" ? "text-white" : "text-slate-700"}`}
                numberOfLines={1}
              >
                Mẫu bổ sung
              </Text>
            </Pressable>
          </View>

          {mode === "order" ? (
            <>
              <SectionBlock
                step={1}
                title="Đơn hàng & gói xét nghiệm"
                subtitle={
                  selectedOrderId
                    ? "Gói xét nghiệm lấy theo phiếu — khóa khi đã có trên đơn"
                    : "Chọn đơn chưa thanh toán"
                }
              >
                <View className="gap-2">
                  <InvoiceSelectRow
                    label="Đơn hàng"
                    value={selectedOrder ? `${selectedOrder.orderName || "Đơn"} · ${selectedOrderId}` : ""}
                    placeholder="Chạm để chọn đơn"
                    onPress={() => {
                      Keyboard.dismiss();
                      setOrderPickerOpen(true);
                    }}
                    icon={<Package size={17} color={MEDICAL.primary} />}
                  />
                  <InvoiceSelectRow
                    label="Gói xét nghiệm"
                    value={displayGenomeName}
                    placeholder="Chạm để chọn gói"
                    locked={lockOrderGenome}
                    onPress={() => {
                      Keyboard.dismiss();
                      setGtPickerOpen(true);
                    }}
                    icon={<FlaskConical size={17} color={MEDICAL.primary} />}
                  />
                </View>
              </SectionBlock>

              <SectionBlock
                step={2}
                title="Bệnh nhân trên hóa đơn"

              >
                <InvoiceSelectRow
                  label="Tên hiển thị"
                  value={displayPatientName}
                  placeholder="Chọn bệnh nhân"
                  locked={lockOrderPatient}
                  onPress={() => {
                    Keyboard.dismiss();
                    setPatientPickerOpen(true);
                  }}
                  icon={<UserRound size={17} color={MEDICAL.primary} />}
                />
                {displayPatientPhone ? (
                  <View className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 border border-slate-100">
                    <Text className="text-[10px] text-slate-500">Số điện thoại</Text>
                    <Text className="mt-0.5 text-[12px] font-semibold text-slate-800">
                      {displayPatientPhone}
                    </Text>
                  </View>
                ) : null}
              </SectionBlock>

              <SectionBlock step={3} title="Ghi chú" subtitle="Tùy chọn — VD. nội dung chuyển khoản">
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Nhập ghi chú (không bắt buộc)"
                  placeholderTextColor="#94a3b8"
                  multiline
                  className="min-h-[72px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[12px] text-slate-900"
                  textAlignVertical="top"
                />
              </SectionBlock>

              <SectionBlock
                step={4}
                title="Hình thức thanh toán"
                subtitle={
                  lockOrderPayment
                    ? "Theo đơn hàng — không đổi tay"
                    : "Chọn một hình thức (hoặc theo đơn nếu đã có)"
                }
              >
                <View className="gap-2">
                  <PaymentOptionCard
                    selected={paymentType === "CASH"}
                    locked={lockOrderPayment}
                    onPress={() => setPaymentType("CASH")}
                    icon={<Wallet size={18} color={paymentType === "CASH" ? MEDICAL.primary : "#64748b"} />}
                    title="Tiền mặt"
                    description="Thu tại quầy, lưu hóa đơn sau khi xác nhận"
                  />
                  <PaymentOptionCard
                    selected={paymentType === "ONLINE_PAYMENT"}
                    locked={lockOrderPayment}
                    onPress={() => setPaymentType("ONLINE_PAYMENT")}
                    icon={
                      <Smartphone
                        size={18}
                        color={paymentType === "ONLINE_PAYMENT" ? MEDICAL.primary : "#64748b"}
                      />
                    }
                    title="Chuyển khoản / QR"
                    description="Mở màn thanh toán để quét mã"
                  />
                </View>
              </SectionBlock>
            </>
          ) : (
            <>
              <SectionBlock
                step={1}
                title="Mẫu bổ sung cần thanh toán"
                subtitle="Chỉ hiển thị mẫu chưa hoàn tất thanh toán"
              >
                <InvoiceSelectRow
                  label="Mẫu"
                  value={
                    selectedSa
                      ? `${selectedSa.sampleName}${selectedSa.orderId ? ` · Đơn ${selectedSa.orderId}` : ""}`
                      : ""
                  }
                  placeholder="Chạm để chọn mẫu"
                  locked={sampleAddLineLocked}
                  onPress={() => {
                    Keyboard.dismiss();
                    setSaPickerOpen(true);
                  }}
                  icon={<FlaskConical size={17} color={MEDICAL.primary} />}
                />
              </SectionBlock>

              <SectionBlock step={2} title="Ghi chú" subtitle="Tùy chọn">
                <TextInput
                  value={sampleAddNote}
                  onChangeText={setSampleAddNote}
                  placeholder="Ghi chú cho kế toán hoặc lab (không bắt buộc)"
                  placeholderTextColor="#94a3b8"
                  multiline
                  className="min-h-[72px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[12px] text-slate-900"
                  textAlignVertical="top"
                />
              </SectionBlock>

              <SectionBlock
                step={3}
                title="Thanh toán"
                subtitle={lockSamplePayment ? "Theo mẫu bổ sung — không đổi tay" : "Chọn một hình thức"}
              >
                <View className="gap-2">
                  <PaymentOptionCard
                    selected={sampleAddPaymentType === "CASH"}
                    locked={lockSamplePayment}
                    onPress={() => setSampleAddPaymentType("CASH")}
                    icon={
                      <Wallet size={18} color={sampleAddPaymentType === "CASH" ? MEDICAL.primary : "#64748b"} />
                    }
                    title="Tiền mặt"
                    description="Hoàn tất ngay và lưu hóa đơn"
                  />
                  <PaymentOptionCard
                    selected={sampleAddPaymentType === "ONLINE_PAYMENT"}
                    locked={lockSamplePayment}
                    onPress={() => setSampleAddPaymentType("ONLINE_PAYMENT")}
                    icon={
                      <Smartphone
                        size={18}
                        color={sampleAddPaymentType === "ONLINE_PAYMENT" ? MEDICAL.primary : "#64748b"}
                      />
                    }
                    title="Chuyển khoản / QR"
                    description="Cổng thanh toán cho khách"
                  />
                </View>
              </SectionBlock>
            </>
          )}

          {!canSubmit ? (
            <View className="mt-1 rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-2">
              <Text className="text-center text-[10px] leading-4 text-amber-900">
                {mode === "order"
                  ? "Chọn đủ đơn, gói xét nghiệm, bệnh nhân và hình thức thanh toán."
                  : "Chọn mẫu bổ sung và hình thức thanh toán."}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <View
        className="border-t border-slate-200 bg-white px-3 pt-3"
        style={{
          paddingBottom: Math.max(insets.bottom, 12),
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <View className="mb-2.5 flex-row items-end justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
              Tạm tính (VAT)
            </Text>
            <Text className="mt-0.5 text-[20px] font-extrabold text-slate-900" numberOfLines={1}>
              {formatMoney(footerAmount)}
            </Text>
          </View>
          {mode === "order" && (selectedGt || displayGenomeName) ? (
            <Text className="max-w-[48%] text-right text-[10px] font-medium leading-4 text-slate-500" numberOfLines={3}>
              {selectedGt?.testName || displayGenomeName}
            </Text>
          ) : mode === "sampleAdd" && selectedSa ? (
            <Text className="max-w-[48%] text-right text-[10px] font-medium leading-4 text-slate-500" numberOfLines={3}>
              {selectedSa.sampleName}
            </Text>
          ) : (
            <Text className="max-w-[48%] text-right text-[10px] text-slate-400">Chưa chọn dịch vụ</Text>
          )}
        </View>
        {previewInvoiceData ? (
          <TouchableOpacity
            onPress={() => setPreviewOpen(true)}
            activeOpacity={0.85}
            className="mb-2 flex-row items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5"
          >
            <Eye size={16} color="#0369a1" />
            <Text className="text-[13px] font-bold text-sky-700">Xem trước hóa đơn</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={onSubmit}
          disabled={submitting || !canSubmit}
          activeOpacity={0.88}
          className={`rounded-xl py-3 ${canSubmit && !submitting ? "bg-sky-600" : "bg-sky-300"}`}
          style={
            canSubmit && !submitting
              ? {
                shadowColor: "#0369a1",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 4,
              }
              : undefined
          }
        >
          <Text className="text-center text-[14px] font-extrabold text-white">
            {submitting ? "Đang xử lý..." : "Xác nhận & tạo hóa đơn"}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={previewOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-slate-100" edges={["top", "left", "right"]}>
          <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
            <Text className="text-[14px] font-extrabold text-slate-900">Xem trước hóa đơn</Text>
            <TouchableOpacity
              onPress={() => setPreviewOpen(false)}
              className="h-8 w-8 items-center justify-center rounded-lg bg-slate-100"
              accessibilityLabel="Đóng"
            >
              <X size={18} color="#334155" />
            </TouchableOpacity>
          </View>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16), flexGrow: 1 }}
            showsVerticalScrollIndicator
          >
            <View className="items-center px-3 py-3">
              {previewInvoiceData ? (
                <InvoiceView
                  data={previewInvoiceData}
                  preview
                  collapsable={false}
                  width={previewInvoiceLayoutWidth}
                />
              ) : null}
            </View>
            <Text className="px-4 pb-4 text-center text-[10px] font-semibold text-slate-400">
              Nội dung trùng khớp khi xác nhận thanh toán (tiền mặt / online).
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modals */}
      <Modal visible={orderPickerOpen} transparent animationType="slide" onRequestClose={() => setOrderPickerOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/45" onPress={() => setOrderPickerOpen(false)}>
          <Pressable
            className="max-h-[85%] rounded-t-3xl bg-white px-4 pb-4 pt-3"
            style={{ paddingBottom: sheetPickerInset }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-2 h-1 w-10 self-center rounded-full bg-sky-200" />
            <Text className="mb-1 text-lg font-bold text-sky-950">Chọn đơn hàng</Text>
            <Text className="mb-3 text-xs text-sky-600">Chỉ hiển thị đơn chưa thanh toán đủ</Text>
            <InvoiceSearchBar value={orderSearch} onChangeText={setOrderSearch} placeholder="Tìm theo tên, mã đơn..." />
            <ScrollView keyboardShouldPersistTaps="handled" className="max-h-[60%]">
              {filteredOrders.length === 0 ? (
                <Text className="py-8 text-center text-sky-500">Không có đơn phù hợp</Text>
              ) : (
                filteredOrders.map((o) => (
                  <TouchableOpacity
                    key={o.orderId}
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectedOrderId(o.orderId);
                      setOrderPickerOpen(false);
                    }}
                    className="border-b border-sky-50 py-3.5"
                  >
                    <Text className="text-[15px] font-semibold text-sky-950">{o.orderName || o.orderId}</Text>
                    <Text className="mt-0.5 text-xs text-sky-500">{o.orderId}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setOrderPickerOpen(false)} className="mt-2 py-3">
              <Text className="text-center text-base font-semibold text-sky-600">Đóng</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={gtPickerOpen} transparent animationType="slide" onRequestClose={() => setGtPickerOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/45" onPress={() => setGtPickerOpen(false)}>
          <Pressable
            className="max-h-[85%] rounded-t-3xl bg-white px-4 pb-4 pt-3"
            style={{ paddingBottom: sheetPickerInset }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-2 h-1 w-10 self-center rounded-full bg-sky-200" />
            <Text className="mb-1 text-lg font-bold text-sky-950">Chọn xét nghiệm</Text>
            <Text className="mb-3 text-xs text-sky-600">Giá đã gồm VAT (nếu có)</Text>
            <InvoiceSearchBar value={gtSearch} onChangeText={setGtSearch} placeholder="Tìm theo tên gói, mã..." />
            <ScrollView keyboardShouldPersistTaps="handled" className="max-h-[60%]">
              {filteredGt.length === 0 ? (
                <Text className="py-8 text-center text-sky-500">Không có gói phù hợp</Text>
              ) : (
                filteredGt.map((t) => (
                  <TouchableOpacity
                    key={t.testId}
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectedGenomeTestId(t.testId);
                      setGtPickerOpen(false);
                    }}
                    className="flex-row items-center justify-between border-b border-sky-50 py-3.5"
                  >
                    <View className="mr-2 flex-1">
                      <Text className="text-[15px] font-semibold text-sky-950">{t.testName}</Text>
                      {t.code ? <Text className="mt-0.5 text-xs text-sky-500">{t.code}</Text> : null}
                    </View>
                    <Text className="text-sm font-bold text-sky-700">
                      {formatMoney(t.finalPrice ?? t.price ?? 0)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setGtPickerOpen(false)} className="mt-2 py-3">
              <Text className="text-center text-base font-semibold text-sky-600">Đóng</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={saPickerOpen} transparent animationType="slide" onRequestClose={() => setSaPickerOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/45" onPress={() => setSaPickerOpen(false)}>
          <Pressable
            className="max-h-[85%] rounded-t-3xl bg-white px-4 pb-4 pt-3"
            style={{ paddingBottom: sheetPickerInset }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-2 h-1 w-10 self-center rounded-full bg-sky-200" />
            <Text className="mb-1 text-lg font-bold text-sky-950">Chọn mẫu bổ sung</Text>
            <Text className="mb-3 text-xs text-sky-600">Mẫu chưa hoàn tất thanh toán</Text>
            <InvoiceSearchBar value={saSearch} onChangeText={setSaSearch} placeholder="Tìm tên mẫu, mã đơn..." />
            <ScrollView keyboardShouldPersistTaps="handled" className="max-h-[60%]">
              {filteredSa.length === 0 ? (
                <Text className="py-8 text-center text-sky-500">Không có mẫu phù hợp</Text>
              ) : (
                filteredSa.map((sa) => {
                  const id = sa.id || sa.sampleAddId || "";
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => {
                        Keyboard.dismiss();
                        setSelectedSampleAddId(id);
                        setSaPickerOpen(false);
                      }}
                      className="border-b border-sky-50 py-3.5"
                    >
                      <Text className="text-[15px] font-semibold text-sky-950">{sa.sampleName}</Text>
                      <Text className="mt-0.5 text-xs text-sky-500">{sa.orderId}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setSaPickerOpen(false)} className="mt-2 py-3">
              <Text className="text-center text-base font-semibold text-sky-600">Đóng</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={patientPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPatientPickerOpen(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/45" onPress={() => setPatientPickerOpen(false)}>
          <Pressable
            className="max-h-[85%] rounded-t-3xl bg-white px-4 pb-4 pt-3"
            style={{ paddingBottom: sheetPickerInset }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-2 h-1 w-10 self-center rounded-full bg-sky-200" />
            <Text className="mb-1 text-lg font-bold text-sky-950">Chọn bệnh nhân</Text>
            <Text className="mb-3 text-xs text-sky-600">Tìm nhanh theo tên hoặc SĐT</Text>
            <InvoiceSearchBar value={patientSearch} onChangeText={setPatientSearch} placeholder="Tìm bệnh nhân..." />
            <ScrollView keyboardShouldPersistTaps="handled" className="max-h-[60%]">
              {filteredPatients.length === 0 ? (
                <Text className="py-8 text-center text-sky-500">Không có bệnh nhân phù hợp</Text>
              ) : (
                filteredPatients.map((p) => (
                  <TouchableOpacity
                    key={p.patientId}
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectedPatientId(p.patientId);
                      setPatientPickerOpen(false);
                    }}
                    className="border-b border-sky-50 py-3.5"
                  >
                    <Text className="text-[15px] font-semibold text-sky-950">{p.patientName}</Text>
                    <Text className="mt-0.5 text-xs text-sky-500">
                      {[p.patientPhone, p.patientId].filter(Boolean).join(" · ")}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setPatientPickerOpen(false)} className="mt-2 py-3">
              <Text className="text-center text-base font-semibold text-sky-600">Đóng</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
