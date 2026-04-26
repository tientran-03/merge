import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { ArrowLeft, Trash2, User, Calendar, FlaskConical, Stethoscope, Building2, MapPin, Mail, Phone, FileText, Clock, Edit, Download } from "lucide-react-native";
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

import { getApiResponseData } from "@/lib/types/api-types";
import { SERVICE_TYPE_MAPPER } from "@/lib/schemas/order-schemas";
import {
  SpecifyVoteTestResponse,
  specifyVoteTestService,
} from "@/services/specifyVoteTestService";
import { patientClinicalService, type PatientClinicalResponse } from "@/services/patientClinicalService";
import { reproductionService } from "@/services/reproductionService";
import { embryoService } from "@/services/embryoService";
import { diseaseService } from "@/services/diseaseService";

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

const formatDateOnly = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

const getGenderLabel = (gender?: string): string => {
  if (!gender) return "";
  const g = gender.toLowerCase();
  if (g === "male" || g === "nam") return "Nam";
  if (g === "female" || g === "nữ") return "Nữ";
  return gender;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export default function PrescriptionSlipDetailScreen() {
  const router = useRouter();
  const { specifyVoteID, source } = useLocalSearchParams<{ specifyVoteID: string; source?: string }>();
  const queryClient = useQueryClient();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const {
    data: slipResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["specify-vote-test", specifyVoteID],
    queryFn: () => specifyVoteTestService.getById(specifyVoteID!),
    enabled: !!specifyVoteID,
  });

  const deleteMutation = useMutation({
    mutationFn: () => specifyVoteTestService.delete(specifyVoteID!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specify-vote-tests"] });
      Alert.alert("Thành công", "Phiếu chỉ định đã được xóa thành công", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể xóa phiếu chỉ định. Vui lòng thử lại.");
    },
  });

  const patientId = slipResponse?.success ? slipResponse.data?.patientId : undefined;
  const serviceType = (slipResponse?.success ? slipResponse.data?.serviceType : undefined)?.toLowerCase();

  const { data: patientClinicalResponse } = useQuery({
    queryKey: ["patient-clinical", patientId],
    queryFn: () => patientClinicalService.getByPatientId(patientId!),
    enabled: !!patientId,
  });

  const { data: reproductionResponse } = useQuery({
    queryKey: ["reproduction-services"],
    queryFn: () => reproductionService.getAll(),
    enabled: !!patientId && serviceType === "reproduction",
  });

  const { data: embryoResponse } = useQuery({
    queryKey: ["embryo-services"],
    queryFn: () => embryoService.getAll(),
    enabled: !!patientId && serviceType === "embryo",
  });

  const { data: diseaseResponse } = useQuery({
    queryKey: ["disease-services"],
    queryFn: () => diseaseService.getAll(),
    enabled: !!patientId && serviceType === "disease",
  });

  const handleDelete = () => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa phiếu chỉ định này? Hành động này không thể hoàn tác.",
      [
        {
          text: "Hủy",
          style: "cancel",
        },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const handleDownloadPdf = async (
    slip: SpecifyVoteTestResponse,
    patientClinical?: PatientClinicalResponse,
    reproductionInfo?: any,
    embryoInfo?: any,
    diseaseInfo?: any
  ) => {
    try {
      setDownloadingPdf(true);
      const rows: Array<{ label: string; value: string; section?: boolean }> = [];
      const appendSection = (title: string) => {
        rows.push({ label: title, value: "", section: true });
      };
      const appendRow = (label: string, value?: unknown) => {
        if (value === undefined || value === null || String(value).trim() === "") return;
        rows.push({ label, value: String(value) });
      };

      appendSection("THONG TIN CO BAN");
      appendRow("Mã phiếu", slip.specifyVoteID);
      appendRow("Trạng thái", getStatusLabel(slip.specifyStatus));
      appendRow("Ngày tạo", formatDate(slip.createdAt));
      appendRow("Loại dịch vụ", slip.serviceType ? SERVICE_TYPE_MAPPER[slip.serviceType] || slip.serviceType : "");

      appendSection("THONG TIN BENH NHAN");
      appendRow("Bệnh nhân", slip.patient?.patientName);
      appendRow("Số điện thoại", slip.patient?.patientPhone);
      appendRow("Ngày sinh", formatDateOnly(slip.patient?.patientDob));
      appendRow("Giới tính", getGenderLabel(slip.patient?.gender));
      appendRow("Email", slip.patient?.patientEmail);
      appendRow("Nghề nghiệp", slip.patient?.patientJob);
      appendRow("Địa chỉ", slip.patient?.patientAddress);
      appendRow("Người liên hệ", slip.patient?.patientContactName);
      appendRow("SĐT người liên hệ", slip.patient?.patientContactPhone);

      appendSection("THONG TIN XET NGHIEM");
      appendRow("Bệnh viện", slip.hospital?.hospitalName);
      appendRow("Bác sĩ chỉ định", slip.doctor?.doctorName);
      appendRow("Xét nghiệm", slip.genomeTest?.testName);
      appendRow("Mô tả xét nghiệm", slip.genomeTest?.testDescription);
      appendRow(
        "Loại mẫu",
        slip.genomeTest?.testSample && slip.genomeTest.testSample.length > 0
          ? slip.genomeTest.testSample.join(", ")
          : ""
      );
      appendRow("Số phôi", slip.embryoNumber);
      appendRow("Địa điểm lấy mẫu", slip.samplingSite);
      appendRow("Ngày thu mẫu", formatDateOnly(slip.sampleCollectDate));
      appendRow("Kết quả xét nghiệm", slip.geneticTestResults);
      appendRow("Mối quan hệ kết quả", slip.geneticTestResultsRelationship);

      if (patientClinical) {
        appendSection("THONG TIN LAM SANG");
        appendRow("Chiều cao (cm)", patientClinical.patientHeight);
        appendRow("Cân nặng (kg)", patientClinical.patientWeight);
        appendRow("Tiền sử bệnh nhân", patientClinical.patientHistory);
        appendRow("Tiền sử bệnh", patientClinical.medicalHistory);
        appendRow("Bệnh lý cấp tính", patientClinical.acuteDisease);
        appendRow("Bệnh lý mãn tính", patientClinical.chronicDisease);
        appendRow("Tiền sử gia đình", patientClinical.familyHistory);
        appendRow("Tiếp xúc độc hại", patientClinical.toxicExposure);
        appendRow(
          "Thuốc đang dùng",
          patientClinical.medicalUsing && patientClinical.medicalUsing.length > 0
            ? patientClinical.medicalUsing.join(", ")
            : ""
        );
      }

      if (reproductionInfo || embryoInfo || diseaseInfo) {
        appendSection("THONG TIN NHOM XET NGHIEM");
      }

      if (reproductionInfo) {
        appendRow("So thai", reproductionInfo.fetusesNumber);
        appendRow("Tuần thai", reproductionInfo.fetusesWeek);
        appendRow("Ngày thai", reproductionInfo.fetusesDay);
        appendRow("Ngày siêu âm", formatDateOnly(reproductionInfo.ultrasoundDay));
        appendRow("Chiều dài đầu mông (CRL) (mm)", reproductionInfo.headRumpLength);
        appendRow("Độ mờ da gáy (NT) (mm)", reproductionInfo.neckLength);
        appendRow("Kết quả combined test", reproductionInfo.combinedTestResult);
        appendRow("Kết quả siêu âm", reproductionInfo.ultrasoundResult);
      }

      if (embryoInfo) {
        appendRow("Sinh thiết", embryoInfo.biospy);
        appendRow("Ngày sinh thiết", formatDateOnly(embryoInfo.biospyDate));
        appendRow("Dung dịch chứa tế bào", embryoInfo.cellContainingSolution);
        appendRow("Số phôi tạo", embryoInfo.embryoCreate);
        appendRow("Trạng thái phôi", embryoInfo.embryoStatus);
        appendRow("Đánh giá hình thái", embryoInfo.morphologicalAssessment);
        appendRow("Số nhân tế bào", embryoInfo.cellNucleus);
        appendRow("Đối chứng âm", embryoInfo.negativeControl);
      }

      if (diseaseInfo) {
        appendRow("Triệu chứng", diseaseInfo.symptom);
        appendRow("Chẩn đoán", diseaseInfo.diagnose);
        appendRow("Ảnh chẩn đoán", diseaseInfo.diagnoseImage);
        appendRow("Xét nghiệm liên quan", diseaseInfo.testRelated);
        appendRow("Phương pháp điều trị", diseaseInfo.treatmentMethods);
        appendRow("Thời gian điều trị (ngày)", diseaseInfo.treatmentTimeDay);
        appendRow("Kháng thuốc", diseaseInfo.drugResistance);
        appendRow("Tái phát", diseaseInfo.relapse);
      }

      appendSection("THONG TIN KHAC");
      appendRow("Ghi chú", slip.specifyNote);
      appendRow("Lý do từ chối", slip.rejectReason);
      appendRow("Gửi email cho bệnh nhân", slip.sendEmailPatient !== undefined ? (slip.sendEmailPatient ? "Có" : "Không") : "");

      const rowsHtml = rows
        .map(
          (row) =>
            row.section
              ? `
            <tr>
              <td class="section" colspan="2">${escapeHtml(row.label)}</td>
            </tr>`
              : `
            <tr>
              <td class="label">${escapeHtml(row.label)}</td>
              <td class="value">${escapeHtml(row.value)}</td>
            </tr>`
        )
        .join("");

      const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 18mm 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            color: #0f172a;
            font-size: 12px;
            line-height: 1.45;
            background: #ffffff;
          }
          .sheet {
            border: 1px solid #dbeafe;
            border-radius: 14px;
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);
            color: #ffffff;
            padding: 18px 20px 16px;
          }
          .header-top {
            display: table;
            width: 100%;
          }
          .header-title {
            display: table-cell;
            width: 72%;
            vertical-align: middle;
          }
          .title {
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 0.3px;
            margin: 0 0 3px;
          }
          .sub {
            font-size: 12px;
            opacity: 0.92;
            margin: 0;
          }
          .meta-card {
            display: table-cell;
            width: 28%;
            vertical-align: middle;
            text-align: right;
          }
          .meta-box {
            display: inline-block;
            background: rgba(255, 255, 255, 0.16);
            border: 1px solid rgba(255, 255, 255, 0.28);
            border-radius: 10px;
            padding: 7px 10px;
            font-size: 10.5px;
            line-height: 1.5;
            text-align: left;
          }
          .body {
            padding: 14px 16px 16px;
          }
          table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            overflow: hidden;
          }
          td {
            border-bottom: 1px solid #e2e8f0;
            padding: 8px 10px;
            vertical-align: top;
          }
          tr:last-child td { border-bottom: none; }
          .section {
            font-weight: 700;
            background: #e0f2fe;
            color: #0c4a6e;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-bottom: 1px solid #bae6fd;
          }
          .label {
            width: 34%;
            font-weight: 700;
            background: #f8fafc;
            color: #334155;
            border-right: 1px solid #e2e8f0;
          }
          .value {
            width: 66%;
            color: #0f172a;
          }
          .footer {
            margin-top: 16px;
          }
          .sign-row {
            display: table;
            width: 100%;
            table-layout: fixed;
          }
          .sign-col {
            display: table-cell;
            width: 50%;
            padding-top: 8px;
            text-align: center;
            vertical-align: top;
          }
          .sign-title {
            font-size: 11.5px;
            font-weight: 700;
            color: #0f172a;
          }
          .sign-note {
            font-size: 10px;
            color: #64748b;
            margin-top: 2px;
          }
          .sign-space {
            height: 56px;
          }
          .printed-at {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px dashed #cbd5e1;
            text-align: right;
            color: #64748b;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div class="header-top">
              <div class="header-title">
                <p class="title">PHIEU XET NGHIEM</p>
                <p class="sub">He thong HT Genetic</p>
              </div>
              <div class="meta-card">
                <div class="meta-box">
                  <div><strong>Ma phieu:</strong><br/>${escapeHtml(slip.specifyVoteID || "")}</div>
                  <div style="margin-top:4px;"><strong>Trang thai:</strong><br/>${escapeHtml(getStatusLabel(slip.specifyStatus))}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="body">
            <table>${rowsHtml}</table>
            <div class="footer">
              <div class="sign-row">
                <div class="sign-col">
                  <div class="sign-title">Nguoi lap phieu</div>
                  <div class="sign-note">(Ky va ghi ro ho ten)</div>
                  <div class="sign-space"></div>
                </div>
                <div class="sign-col">
                  <div class="sign-title">Xac nhan don vi</div>
                  <div class="sign-note">(Ky, dong dau)</div>
                  <div class="sign-space"></div>
                </div>
              </div>
              <div class="printed-at">Ngay in: ${escapeHtml(formatDate(new Date().toISOString()))}</div>
            </div>
          </div>
        </div>
      </body>
      </html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Thông báo", `Đã tạo file PDF tại: ${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `PhieuXetNghiem_${slip.specifyVoteID}`,
      });
    } catch (error: any) {
      Alert.alert("Lỗi", error?.message || "Không thể tạo file PDF");
    } finally {
      setDownloadingPdf(false);
    }
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
  const patientClinical: PatientClinicalResponse | undefined = patientClinicalResponse?.success
    ? patientClinicalResponse.data
    : undefined;
  const reproductionInfo = reproductionResponse?.success
    ? (reproductionResponse.data || [])
        .filter((item: any) => item.patientId === patientId)
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0]
    : undefined;
  const embryoInfo = embryoResponse?.success
    ? (embryoResponse.data || [])
        .filter((item: any) => item.patientId === patientId)
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0]
    : undefined;
  const diseaseInfo = diseaseResponse?.success
    ? (diseaseResponse.data || [])
        .filter((item: any) => item.patientId === patientId)
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0]
    : undefined;

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
            <TouchableOpacity
              onPress={() =>
                handleDownloadPdf(slip, patientClinical, reproductionInfo, embryoInfo, diseaseInfo)
              }
              disabled={downloadingPdf}
              className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 items-center justify-center"
              activeOpacity={0.8}
            >
              {downloadingPdf ? (
                <ActivityIndicator size="small" color="#047857" />
              ) : (
                <Download size={18} color="#047857" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (specifyVoteID) {
                  router.push({
                    pathname: "/create-prescription-slip",
                    params: { specifyVoteID, source },
                  });
                }
              }}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center"
              activeOpacity={0.8}
            >
              <Edit size={18} color="#0284C7" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 items-center justify-center"
              activeOpacity={0.8}
            >
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
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
              <FileText size={18} color="#64748B" className="mt-0.5" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-slate-500 font-bold">Mã phiếu</Text>
                <Text className="mt-1 text-sm font-extrabold text-slate-900">{slip.specifyVoteID}</Text>
              </View>
            </View>

            {slip.serviceType && (
              <View className="flex-row items-start">
                <FlaskConical size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Loại dịch vụ</Text>
                  <Text className="mt-1 text-sm font-extrabold text-slate-900">
                    {SERVICE_TYPE_MAPPER[slip.serviceType] || slip.serviceType}
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

            {slip.createdAt && (
              <View className="flex-row items-start">
                <Clock size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Ngày tạo</Text>
                  <Text className="mt-1 text-sm text-slate-900">{formatDate(slip.createdAt)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Thông tin bệnh nhân */}
        {slip.patient && (
          <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
            <Text className="text-slate-900 text-base font-extrabold mb-4">Thông tin bệnh nhân</Text>

            <View className="gap-3">
              <View className="flex-row items-start">
                <User size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Họ tên</Text>
                  <Text className="mt-1 text-sm font-extrabold text-slate-900">
                    {slip.patient.patientName || "N/A"}
                  </Text>
                </View>
              </View>

              {slip.patient.patientPhone && (
                <View className="flex-row items-start">
                  <Phone size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Số điện thoại</Text>
                    <Text className="mt-1 text-sm text-slate-900">{slip.patient.patientPhone}</Text>
                  </View>
                </View>
              )}

              {slip.patient.patientDob && (
                <View className="flex-row items-start">
                  <Calendar size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Ngày sinh</Text>
                    <Text className="mt-1 text-sm text-slate-900">
                      {formatDateOnly(slip.patient.patientDob)}
                    </Text>
                  </View>
                </View>
              )}

              {slip.patient.gender && (
                <View className="flex-row items-start">
                  <User size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Giới tính</Text>
                    <Text className="mt-1 text-sm text-slate-900">
                      {getGenderLabel(slip.patient.gender)}
                    </Text>
                  </View>
                </View>
              )}

              {slip.patient.patientEmail && (
                <View className="flex-row items-start">
                  <Mail size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Email</Text>
                    <Text className="mt-1 text-sm text-slate-900">{slip.patient.patientEmail}</Text>
                  </View>
                </View>
              )}

              {slip.patient.patientJob && (
                <View className="flex-row items-start">
                  <User size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Nghề nghiệp</Text>
                    <Text className="mt-1 text-sm text-slate-900">{slip.patient.patientJob}</Text>
                  </View>
                </View>
              )}

              {slip.patient.patientAddress && (
                <View className="flex-row items-start">
                  <MapPin size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Địa chỉ</Text>
                    <Text className="mt-1 text-sm text-slate-900">{slip.patient.patientAddress}</Text>
                  </View>
                </View>
              )}

              {slip.patient.patientContactName && (
                <View className="flex-row items-start">
                  <User size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Người liên hệ</Text>
                    <Text className="mt-1 text-sm text-slate-900">{slip.patient.patientContactName}</Text>
                    {slip.patient.patientContactPhone && (
                      <Text className="mt-1 text-xs text-slate-600">
                        {slip.patient.patientContactPhone}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Thông tin xét nghiệm */}
        {slip.genomeTest && (
          <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
            <Text className="text-slate-900 text-base font-extrabold mb-4">Thông tin xét nghiệm</Text>

            <View className="gap-3">
              <View className="flex-row items-start">
                <FlaskConical size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Tên xét nghiệm</Text>
                  <Text className="mt-1 text-sm font-extrabold text-slate-900">
                    {slip.genomeTest.testName || "N/A"}
                  </Text>
                </View>
              </View>

              {slip.genomeTest.testDescription && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Mô tả</Text>
                    <Text className="mt-1 text-sm text-slate-900">
                      {slip.genomeTest.testDescription}
                    </Text>
                  </View>
                </View>
              )}

              {slip.genomeTest.testSample && slip.genomeTest.testSample.length > 0 && (
                <View className="flex-row items-start">
                  <FlaskConical size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Loại mẫu</Text>
                    <Text className="mt-1 text-sm text-slate-900">
                      {slip.genomeTest.testSample.join(", ")}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Thông tin chỉ định */}
        <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
          <Text className="text-slate-900 text-base font-extrabold mb-4">Thông tin chỉ định</Text>

          <View className="gap-3">
            {slip.hospital && (
              <View className="flex-row items-start">
                <Building2 size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Bệnh viện</Text>
                  <Text className="mt-1 text-sm font-extrabold text-slate-900">
                    {slip.hospital.hospitalName}
                  </Text>
                </View>
              </View>
            )}

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

            {slip.embryoNumber !== undefined && slip.embryoNumber !== null && (
              <View className="flex-row items-start">
                <FlaskConical size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Số phôi</Text>
                  <Text className="mt-1 text-sm text-slate-900">{slip.embryoNumber}</Text>
                </View>
              </View>
            )}

            {slip.samplingSite && (
              <View className="flex-row items-start">
                <MapPin size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Địa điểm lấy mẫu</Text>
                  <Text className="mt-1 text-sm text-slate-900">{slip.samplingSite}</Text>
                </View>
              </View>
            )}

            {slip.sampleCollectDate && (
              <View className="flex-row items-start">
                <Calendar size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Ngày thu mẫu</Text>
                  <Text className="mt-1 text-sm text-slate-900">
                    {formatDateOnly(slip.sampleCollectDate)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Kết quả xét nghiệm */}
        {(slip.geneticTestResults || slip.geneticTestResultsRelationship) && (
          <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
            <Text className="text-slate-900 text-base font-extrabold mb-4">Kết quả xét nghiệm</Text>

            <View className="gap-3">
              {slip.geneticTestResults && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Kết quả xét nghiệm di truyền</Text>
                    <Text className="mt-1 text-sm text-slate-900">{slip.geneticTestResults}</Text>
                  </View>
                </View>
              )}

              {slip.geneticTestResultsRelationship && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Mối quan hệ kết quả</Text>
                    <Text className="mt-1 text-sm text-slate-900">
                      {slip.geneticTestResultsRelationship}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Thông tin lâm sàng */}
        {patientClinical && (
          <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
            <Text className="text-slate-900 text-base font-extrabold mb-4">Thông tin lâm sàng</Text>

            <View className="gap-3">
              {patientClinical.patientHeight !== undefined && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Chiều cao (cm)</Text>
                    <Text className="mt-1 text-sm text-slate-900">{patientClinical.patientHeight}</Text>
                  </View>
                </View>
              )}
              {patientClinical.patientWeight !== undefined && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Cân nặng (kg)</Text>
                    <Text className="mt-1 text-sm text-slate-900">{patientClinical.patientWeight}</Text>
                  </View>
                </View>
              )}
              {patientClinical.patientHistory && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Tiền sử bệnh nhân</Text>
                    <Text className="mt-1 text-sm text-slate-900">{patientClinical.patientHistory}</Text>
                  </View>
                </View>
              )}
              {patientClinical.medicalHistory && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Tiền sử bệnh</Text>
                    <Text className="mt-1 text-sm text-slate-900">{patientClinical.medicalHistory}</Text>
                  </View>
                </View>
              )}
              {patientClinical.acuteDisease && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Bệnh lý cấp tính</Text>
                    <Text className="mt-1 text-sm text-slate-900">{patientClinical.acuteDisease}</Text>
                  </View>
                </View>
              )}
              {patientClinical.chronicDisease && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Bệnh lý mãn tính</Text>
                    <Text className="mt-1 text-sm text-slate-900">{patientClinical.chronicDisease}</Text>
                  </View>
                </View>
              )}
              {patientClinical.familyHistory && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Tiền sử gia đình</Text>
                    <Text className="mt-1 text-sm text-slate-900">{patientClinical.familyHistory}</Text>
                  </View>
                </View>
              )}
              {patientClinical.toxicExposure && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Tiếp xúc độc hại</Text>
                    <Text className="mt-1 text-sm text-slate-900">{patientClinical.toxicExposure}</Text>
                  </View>
                </View>
              )}
              {patientClinical.medicalUsing && patientClinical.medicalUsing.length > 0 && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Thuốc đang dùng</Text>
                    <Text className="mt-1 text-sm text-slate-900">{patientClinical.medicalUsing.join(", ")}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Thông tin nhóm xét nghiệm */}
        {(reproductionInfo || embryoInfo || diseaseInfo) && (
          <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
            <Text className="text-slate-900 text-base font-extrabold mb-4">Thông tin nhóm xét nghiệm</Text>

            <View className="gap-3">
              {reproductionInfo && (
                <>
                  {reproductionInfo.fetusesNumber !== undefined && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Số thai</Text>
                        <Text className="mt-1 text-sm text-slate-900">{reproductionInfo.fetusesNumber}</Text>
                      </View>
                    </View>
                  )}
                  {reproductionInfo.fetusesWeek !== undefined && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Tuần thai</Text>
                        <Text className="mt-1 text-sm text-slate-900">{reproductionInfo.fetusesWeek}</Text>
                      </View>
                    </View>
                  )}
                  {reproductionInfo.fetusesDay !== undefined && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Ngày thai</Text>
                        <Text className="mt-1 text-sm text-slate-900">{reproductionInfo.fetusesDay}</Text>
                      </View>
                    </View>
                  )}
                  {reproductionInfo.ultrasoundDay && (
                    <View className="flex-row items-start">
                      <Calendar size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Ngày siêu âm</Text>
                        <Text className="mt-1 text-sm text-slate-900">{formatDateOnly(reproductionInfo.ultrasoundDay)}</Text>
                      </View>
                    </View>
                  )}
                  {reproductionInfo.headRumpLength !== undefined && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Chiều dài đầu mông (CRL) (mm)</Text>
                        <Text className="mt-1 text-sm text-slate-900">{reproductionInfo.headRumpLength}</Text>
                      </View>
                    </View>
                  )}
                  {reproductionInfo.neckLength !== undefined && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Độ mờ da gáy (NT) (mm)</Text>
                        <Text className="mt-1 text-sm text-slate-900">{reproductionInfo.neckLength}</Text>
                      </View>
                    </View>
                  )}
                  {reproductionInfo.combinedTestResult && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Kết quả combined test</Text>
                        <Text className="mt-1 text-sm text-slate-900">{reproductionInfo.combinedTestResult}</Text>
                      </View>
                    </View>
                  )}
                  {reproductionInfo.ultrasoundResult && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Kết quả siêu âm</Text>
                        <Text className="mt-1 text-sm text-slate-900">{reproductionInfo.ultrasoundResult}</Text>
                      </View>
                    </View>
                  )}
                </>
              )}

              {embryoInfo && (
                <>
                  {embryoInfo.biospy && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Sinh thiết</Text>
                        <Text className="mt-1 text-sm text-slate-900">{embryoInfo.biospy}</Text>
                      </View>
                    </View>
                  )}
                  {embryoInfo.biospyDate && (
                    <View className="flex-row items-start">
                      <Calendar size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Ngày sinh thiết</Text>
                        <Text className="mt-1 text-sm text-slate-900">{formatDateOnly(embryoInfo.biospyDate)}</Text>
                      </View>
                    </View>
                  )}
                  {embryoInfo.cellContainingSolution && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Dung dịch chứa tế bào</Text>
                        <Text className="mt-1 text-sm text-slate-900">{embryoInfo.cellContainingSolution}</Text>
                      </View>
                    </View>
                  )}
                  {embryoInfo.embryoCreate !== undefined && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Số phôi tạo</Text>
                        <Text className="mt-1 text-sm text-slate-900">{embryoInfo.embryoCreate}</Text>
                      </View>
                    </View>
                  )}
                  {embryoInfo.embryoStatus && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Trạng thái phôi</Text>
                        <Text className="mt-1 text-sm text-slate-900">{embryoInfo.embryoStatus}</Text>
                      </View>
                    </View>
                  )}
                </>
              )}

              {diseaseInfo && (
                <>
                  {diseaseInfo.symptom && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Triệu chứng</Text>
                        <Text className="mt-1 text-sm text-slate-900">{diseaseInfo.symptom}</Text>
                      </View>
                    </View>
                  )}
                  {diseaseInfo.diagnose && (
                    <View className="flex-row items-start">
                      <FileText size={18} color="#64748B" className="mt-0.5" />
                      <View className="ml-3 flex-1">
                        <Text className="text-xs text-slate-500 font-bold">Chẩn đoán</Text>
                        <Text className="mt-1 text-sm text-slate-900">{diseaseInfo.diagnose}</Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )}

        {/* Ghi chú và thông tin khác */}
        {(slip.specifyNote || slip.rejectReason || slip.sendEmailPatient !== undefined) && (
          <View className="bg-white rounded-2xl border border-sky-100 p-4 mb-4">
            <Text className="text-slate-900 text-base font-extrabold mb-4">Thông tin khác</Text>

            <View className="gap-3">
              {slip.specifyNote && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Ghi chú</Text>
                    <Text className="mt-1 text-sm text-slate-900">{slip.specifyNote}</Text>
                  </View>
                </View>
              )}

              {slip.rejectReason && (
                <View className="flex-row items-start">
                  <FileText size={18} color="#EF4444" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-red-500 font-bold">Lý do từ chối</Text>
                    <Text className="mt-1 text-sm text-red-700">{slip.rejectReason}</Text>
                  </View>
                </View>
              )}

              {slip.sendEmailPatient !== undefined && (
                <View className="flex-row items-start">
                  <Mail size={18} color="#64748B" className="mt-0.5" />
                  <View className="ml-3 flex-1">
                    <Text className="text-xs text-slate-500 font-bold">Gửi email cho bệnh nhân</Text>
                    <Text className="mt-1 text-sm text-slate-900">
                      {slip.sendEmailPatient ? "Có" : "Không"}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
