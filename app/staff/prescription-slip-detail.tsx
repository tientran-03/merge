import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Building2,
  Download,
  FlaskConical,
  Mail,
  Pencil,
  Phone,
  Stethoscope,
  Trash2,
  User,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
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
import { ROLE_LAB_TECHNICIAN } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { presentFeedbackError } from "@/lib/feedbackModal";
import { patientGenderLabel } from "@/lib/patient-utils";
import { downloadSpecifyPdf } from "@/lib/specifyPdf";
import {
  canCancelSpecifyAtInitiation,
  getSpecifyStatusDetailPill,
  getSpecifyStatusLabel,
} from "@/lib/specify-status";
import { MEDICAL } from "@/lib/theme/medical";
import { getApiResponseData } from "@/lib/types/api-types";
import {
  type OrderResponse,
  orderService,
  pickLatestOrderResultDate,
} from "@/services/orderService";
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

function serviceTypeLabel(type?: string): string {
  if (!type) return "—";
  if (type === "disease") return "Bệnh lý di truyền";
  if (type === "embryo") return "Phôi thai";
  if (type === "reproduction") return "Sinh sản";
  return type;
}

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

function formatScalar(v?: string | number | boolean | null): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Có" : "Không";
  return String(v);
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
      <Text className="text-slate-900 text-base font-extrabold mb-3">{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  return (
    <View className="py-2.5 border-b border-slate-100 last:border-b-0">
      <Text className="text-[11px] text-slate-500 font-bold">{label}</Text>
      <Text className="mt-1 text-sm text-slate-900 leading-5">{formatScalar(value)}</Text>
    </View>
  );
}

function hasClinicalBlock(pc?: SpecifyVoteTestResponse["patientClinical"]): boolean {
  if (!pc) return false;
  return Boolean(
    pc.familyHistory ||
      pc.patientHistory ||
      pc.medicalHistory ||
      (pc.medicalUsing && pc.medicalUsing.length) ||
      pc.chronicDisease ||
      pc.toxicExposure ||
      pc.acuteDisease ||
      pc.patientHeight != null ||
      pc.patientWeight != null
  );
}

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function PrescriptionSlipDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { specifyVoteID, readOnly: readOnlyParam } = useLocalSearchParams<{
    specifyVoteID: string | string[];
    readOnly?: string | string[];
  }>();
  const queryClient = useQueryClient();

  const readOnlyStr = firstParam(readOnlyParam);
  const readOnlyFromRoute =
    readOnlyStr === "1" ||
    readOnlyStr === "true" ||
    String(readOnlyStr ?? "").toLowerCase() === "true";
  /** KTV lab luôn chỉ xem — tránh mất param khi điều hướng giữa các stack. */
  const isLabViewer = user?.role === ROLE_LAB_TECHNICIAN;
  const isReadOnly = isLabViewer || readOnlyFromRoute;

  const voteId = firstParam(specifyVoteID);

  const {
    data: slipResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["specify-vote-test", voteId],
    queryFn: () => specifyVoteTestService.getById(voteId!),
    enabled: !!voteId,
  });

  const { data: ordersForSpecify, isLoading: loadingOrderResultDate } = useQuery({
    queryKey: ["orders-by-specify", voteId],
    queryFn: async () => {
      const res = await orderService.getBySpecifyId(voteId!);
      return getApiResponseData<OrderResponse>(res) || [];
    },
    enabled: !!voteId,
    staleTime: 60 * 1000,
  });

  const resultReturnDateIso = useMemo(
    () => pickLatestOrderResultDate(ordersForSpecify),
    [ordersForSpecify]
  );
  const testSampleLine = useMemo(() => {
    const slip = slipResponse?.data as SpecifyVoteTestResponse | undefined;
    const arr = slip?.genomeTest?.testSample;
    if (!arr || !arr.length) return undefined;
    return arr.join(", ");
  }, [slipResponse?.data]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => specifyVoteTestService.delete(voteId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specify-vote-tests"] });
      queryClient.invalidateQueries({ queryKey: ["customer-specifies"] });
      queryClient.invalidateQueries({ queryKey: ["specify-vote-test", voteId] });
      setShowDeleteConfirm(false);
      setShowDeleteSuccess(true);
    },
    onError: (err: any) => {
      setShowDeleteConfirm(false);
      Alert.alert("Lỗi", err?.message || "Không thể hủy phiếu chỉ định. Vui lòng thử lại.");
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

  const handleDownloadPdf = useCallback(async (slip: SpecifyVoteTestResponse) => {
    setPdfLoading(true);
    try {
      await downloadSpecifyPdf(slip);
    } catch (err: any) {
      presentFeedbackError({
        title: "Không thể tải PDF",
        message: err?.message || "Đã xảy ra lỗi khi tạo PDF phiếu chỉ định.",
      });
    } finally {
      setPdfLoading(false);
    }
  }, []);

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
  const statusPill = getSpecifyStatusDetailPill(slip.specifyStatus || "");
  const statusHeadline = getSpecifyStatusLabel(slip.specifyStatus || "");
  const canCancelSlip = canCancelSpecifyAtInitiation(slip.specifyStatus);
  const pc = slip.patientClinical;
  const showClinical = hasClinicalBlock(pc);

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-sky-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center"
          activeOpacity={0.8}
        >
          <ArrowLeft size={20} color={MEDICAL.primary} />
        </TouchableOpacity>
        <View className="ml-3 flex-1 min-w-0">
          <Text className="text-slate-900 text-lg font-extrabold">Chi tiết phiếu xét nghiệm</Text>
          {isReadOnly ? (
            <Text className="text-[11px] text-amber-800 font-bold mt-0.5">Chỉ xem</Text>
          ) : null}
          <Text className="text-[11px] text-slate-500 font-mono mt-0.5" numberOfLines={1}>
            Mã phiếu: {slip.specifyVoteID}
          </Text>
        </View>
        <TouchableOpacity
          className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-2"
          onPress={() => handleDownloadPdf(slip)}
          disabled={pdfLoading}
          activeOpacity={0.8}
          accessibilityLabel="Tải PDF"
        >
          {pdfLoading ? (
            <ActivityIndicator size="small" color={MEDICAL.primary} />
          ) : (
            <Download size={20} color={MEDICAL.primary} />
          )}
        </TouchableOpacity>
        <View className={`px-2 py-1 rounded-lg shrink-0 ${statusPill.bg}`}>
          <Text className={`text-[10px] font-bold ${statusPill.tx}`} numberOfLines={1}>
            {statusHeadline}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: isReadOnly ? 24 : 12 }}
        showsVerticalScrollIndicator={false}
      >
        <DetailSection title="Thông tin phiếu">
          <DetailRow label="Mã phiếu" value={slip.specifyVoteID} />
          <DetailRow label="Loại dịch vụ" value={serviceTypeLabel(slip.serviceType)} />
          <DetailRow label="Bệnh viện" value={slip.hospital?.hospitalName} />
          <DetailRow label="Ngày lấy mẫu" value={formatDate(slip.sampleCollectDate) || undefined} />
          <DetailRow label="Vị trí lấy mẫu" value={slip.samplingSite} />
          <DetailRow label="Số lượng phôi" value={slip.embryoNumber} />
          <DetailRow label="Trạng thái" value={getStatusLabel(slip.specifyStatus)} />
          <DetailRow label="Ngày tạo" value={formatDate(slip.createdAt) || undefined} />
          <DetailRow label="Ngày dự kiến có kết quả" value={formatDate(slip.expectedResultDate) || undefined} />
          <DetailRow
            label="Ngày trả kết quả"
            value={
              loadingOrderResultDate
                ? "Đang tải…"
                : resultReturnDateIso
                  ? formatDate(resultReturnDateIso)
                  : "N/A"
            }
          />
          <DetailRow label="Gửi email cho bệnh nhân" value={slip.sendEmailPatient} />
          <DetailRow label="Ghi chú" value={slip.specifyNote} />
          {slip.rejectReason ? <DetailRow label="Lý do từ chối" value={slip.rejectReason} /> : null}
        </DetailSection>

        <DetailSection title="Thông tin bệnh nhân">
          <View className="flex-row items-start gap-2 mb-2">
            <User size={18} color="#64748B" />
            <Text className="text-sm font-extrabold text-slate-900 flex-1">
              {slip.patient?.patientName || "—"}
            </Text>
          </View>
          <DetailRow label="Giới tính" value={patientGenderLabel(slip.patient?.gender) || undefined} />
          <DetailRow label="Ngày sinh" value={formatDate(slip.patient?.patientDob) || undefined} />
          <DetailRow label="Số điện thoại" value={slip.patient?.patientPhone} />
          <DetailRow label="Email" value={slip.patient?.patientEmail} />
          <DetailRow label="Nghề nghiệp" value={slip.patient?.patientJob} />
          <DetailRow label="Người liên hệ" value={slip.patient?.patientContactName} />
          <DetailRow label="SĐT người liên hệ" value={slip.patient?.patientContactPhone} />
          <DetailRow label="Địa chỉ" value={slip.patient?.patientAddress} />
        </DetailSection>

        <DetailSection title="Bác sĩ & chỉ định">
          {slip.doctor ? (
            <View className="flex-row items-start gap-2 mb-2">
              <Stethoscope size={18} color="#64748B" />
              <View className="flex-1">
                <Text className="text-xs text-slate-500 font-bold">Bác sĩ chỉ định</Text>
                <Text className="mt-1 text-sm font-extrabold text-slate-900">{slip.doctor.doctorName}</Text>
                {slip.doctor.doctorDegree ? (
                  <Text className="mt-0.5 text-xs text-slate-600">{slip.doctor.doctorDegree}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
          <DetailRow label="Chuyên khoa" value={slip.doctor?.doctorSpecialized} />
          <View className="flex-row items-start py-2.5 border-b border-slate-100">
            <Phone size={16} color="#64748B" style={{ marginTop: 2, marginRight: 8 }} />
            <View className="flex-1">
              <Text className="text-[11px] text-slate-500 font-bold">Điện thoại bác sĩ</Text>
              <Text className="mt-1 text-sm text-slate-900">{formatScalar(slip.doctor?.doctorPhone)}</Text>
            </View>
          </View>
          <View className="flex-row items-start py-2.5 border-b border-slate-100">
            <Mail size={16} color="#64748B" style={{ marginTop: 2, marginRight: 8 }} />
            <View className="flex-1">
              <Text className="text-[11px] text-slate-500 font-bold">Email bác sĩ</Text>
              <Text className="mt-1 text-sm text-slate-900">{formatScalar(slip.doctor?.doctorEmail)}</Text>
            </View>
          </View>
          <View className="flex-row items-start py-2.5 border-b border-slate-100">
            <Building2 size={16} color="#64748B" style={{ marginTop: 2, marginRight: 8 }} />
            <View className="flex-1">
              <Text className="text-[11px] text-slate-500 font-bold">Bệnh viện</Text>
              <Text className="mt-1 text-sm text-slate-900">{formatScalar(slip.hospital?.hospitalName)}</Text>
            </View>
          </View>
          <View className="flex-row items-start py-2.5">
            <FlaskConical size={16} color="#64748B" style={{ marginTop: 2, marginRight: 8 }} />
            <View className="flex-1">
              <Text className="text-[11px] text-slate-500 font-bold">Xét nghiệm</Text>
              <Text className="mt-1 text-sm font-extrabold text-slate-900">
                {formatScalar(slip.genomeTest?.testName)}
              </Text>
              {slip.genomeTest?.code ? (
                <Text className="mt-0.5 text-xs text-slate-600">Mã: {slip.genomeTest.code}</Text>
              ) : null}
            </View>
          </View>
          <DetailRow label="Mô tả xét nghiệm" value={slip.genomeTest?.testDescription} />
          <DetailRow label="Loại mẫu" value={testSampleLine} />
          <DetailRow
            label="Đơn giá (tham khảo)"
            value={slip.genomeTest?.finalPrice != null ? slip.genomeTest.finalPrice : undefined}
          />
        </DetailSection>

        {slip.geneticTestResults || slip.geneticTestResultsRelationship ? (
          <DetailSection title="Kết quả / thông tin di truyền">
            <DetailRow label="Kết quả xét nghiệm di truyền" value={slip.geneticTestResults} />
            <DetailRow label="Quan hệ với kết quả" value={slip.geneticTestResultsRelationship} />
          </DetailSection>
        ) : null}

        {showClinical ? (
          <DetailSection title="Thông tin lâm sàng">
            <DetailRow label="Tiền sử gia đình" value={pc?.familyHistory} />
            <DetailRow label="Tiền sử bệnh nhân" value={pc?.patientHistory} />
            <DetailRow label="Chiều cao (cm)" value={pc?.patientHeight} />
            <DetailRow label="Cân nặng (kg)" value={pc?.patientWeight} />
            <DetailRow label="Bệnh sử" value={pc?.medicalHistory} />
            <DetailRow
              label="Thuốc đang dùng"
              value={pc?.medicalUsing?.length ? pc.medicalUsing.join(", ") : undefined}
            />
            <DetailRow label="Bệnh mạn tính" value={pc?.chronicDisease} />
            <DetailRow label="Phơi nhiễm độc" value={pc?.toxicExposure} />
            <DetailRow label="Bệnh cấp" value={pc?.acuteDisease} />
          </DetailSection>
        ) : null}

        {slip.reproductionService ? (
          <DetailSection title="Dịch vụ sinh sản">
            <DetailRow label="Số thai" value={slip.reproductionService.fetusesNumber} />
            <DetailRow
              label="Tuổi thai (tuần + ngày)"
              value={
                slip.reproductionService.fetusesWeek != null || slip.reproductionService.fetusesDay != null
                  ? `${slip.reproductionService.fetusesWeek ?? "—"} tuần + ${slip.reproductionService.fetusesDay ?? "—"} ngày`
                  : undefined
              }
            />
            <DetailRow label="Ngày siêu âm" value={formatDate(slip.reproductionService.ultrasoundDay) || undefined} />
            <DetailRow label="CRL (mm)" value={slip.reproductionService.headRumpLength} />
            <DetailRow label="Độ mờ da gáy (mm)" value={slip.reproductionService.neckLength} />
            <DetailRow label="Kết quả Combined test" value={slip.reproductionService.combinedTestResult} />
            <DetailRow label="Kết quả siêu âm" value={slip.reproductionService.ultrasoundResult} />
          </DetailSection>
        ) : null}

        {slip.embryoService ? (
          <DetailSection title="Thông tin phôi / TESE">
            <DetailRow label="Sinh thiết" value={slip.embryoService.biospy} />
            <DetailRow label="Ngày sinh thiết" value={formatDate(slip.embryoService.biospyDate) || undefined} />
            <DetailRow label="Dung dịch chứa tế bào" value={slip.embryoService.cellContainingSolution} />
            <DetailRow label="Số phôi tạo" value={slip.embryoService.embryoCreate} />
            <DetailRow label="Tình trạng phôi" value={slip.embryoService.embryoStatus} />
            <DetailRow label="Đánh giá hình thái" value={slip.embryoService.morphologicalAssessment} />
            <DetailRow label="Điều khiển âm" value={slip.embryoService.negativeControl} />
          </DetailSection>
        ) : null}

        {slip.diseaseService ? (
          <DetailSection title="Thông tin bệnh lý">
            <DetailRow label="Triệu chứng" value={slip.diseaseService.symptom} />
            <DetailRow label="Chẩn đoán" value={slip.diseaseService.diagnose} />
            <DetailRow label="XN liên quan" value={slip.diseaseService.testRelated} />
            <DetailRow label="Phương pháp điều trị" value={slip.diseaseService.treatmentMethods} />
            <DetailRow label="Thời gian điều trị (ngày)" value={slip.diseaseService.treatmentTimeDay} />
            <DetailRow label="Kháng thuốc" value={slip.diseaseService.drugResistance} />
            <DetailRow label="Tái phát" value={slip.diseaseService.relapse} />
          </DetailSection>
        ) : null}

        <View className="h-2" />
      </ScrollView>

      {isReadOnly ? (
        <View className="bg-white border-t border-sky-100 px-4 py-3">
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 bg-sky-600 py-3.5 rounded-xl"
            activeOpacity={0.88}
            onPress={() => handleDownloadPdf(slip)}
            disabled={pdfLoading}
            accessibilityLabel="Tải PDF phiếu"
          >
            {pdfLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Download size={18} color="#fff" />
            )}
            <Text className="text-white font-bold">{pdfLoading ? "Đang tạo PDF…" : "Tải PDF"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="bg-white border-t border-sky-100 px-4 py-3 flex-row gap-3">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-2 bg-sky-600 py-3.5 rounded-xl"
            activeOpacity={0.88}
            onPress={() =>
              router.push({
                pathname: "/staff/specify-edit",
                params: { specifyId: slip.specifyVoteID },
              })
            }
            accessibilityLabel="Cập nhật phiếu"
          >
            <Pencil size={18} color="#fff" />
            <Text className="text-white font-bold">Cập nhật</Text>
          </TouchableOpacity>
          {canCancelSlip ? (
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-xl border ${
                deleteMutation.isPending ? "border-slate-200 bg-slate-100" : "border-red-200 bg-red-50"
              }`}
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              activeOpacity={0.88}
              accessibilityLabel="Hủy phiếu"
            >
              <Trash2 size={18} color={deleteMutation.isPending ? "#94a3b8" : "#dc2626"} />
              <Text className={`font-bold ${deleteMutation.isPending ? "text-slate-400" : "text-red-800"}`}>
                Hủy phiếu
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

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
