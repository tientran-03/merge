import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  Hash,
  Heart,
  Hospital,
  Mail,
  MapPin,
  Package,
  Phone,
  Pill,
  Plus,
  RotateCcw,
  Stethoscope,
  TestTube,
  User,
  Users,
  Wallet,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InvoiceModal } from '@/components/modals';
import { COLORS } from '@/constants/colors';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { canAddSupplementSampleToOrder } from '@/lib/can-add-supplement-sample';
import { getSpecifyStatusLabel } from '@/lib/specify-status';
import { getApiResponseData } from '@/lib/types/api-types';
import { OrderResponse, orderService } from '@/services/orderService';
import { patientMetadataService } from '@/services/patientMetadataService';
import { sampleAddService, type SampleAddResponse } from '@/services/sampleAddService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString?: string) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

const formatCurrency = (amount?: number) => {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

const getPaymentTypeLabel = (type?: string) => {
  if (!type) return '-';
  switch (type.toUpperCase()) {
    case 'CASH':
      return 'Tiền mặt';
    case 'ONLINE_PAYMENT':
      return 'Chuyển khoản';
    default:
      return type;
  }
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <View className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
    {children}
  </View>
);

const Section = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Card>
    <View className="flex-row items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
      {icon}
      <Text className="text-[15px] font-bold text-slate-900">{title}</Text>
    </View>
    <View className="px-4 py-3">{children}</View>
  </Card>
);

const InfoRow = ({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | number | null;
  icon?: React.ReactNode;
}) => {
  if (!value && value !== 0) return null;

  return (
    <View className="flex-row items-start py-2">
      {icon ? (
        <View className="w-9 h-9 rounded-xl bg-slate-100 items-center justify-center mr-3">
          {icon}
        </View>
      ) : (
        <View className="w-9 mr-3" />
      )}

      <View className="flex-1">
        <Text className="text-[12px] text-slate-500">{label}</Text>
        <Text className="text-[14px] font-semibold text-slate-900 mt-0.5">{String(value)}</Text>
      </View>
    </View>
  );
};

const StatusBadge = ({
  status,
  type = 'order',
}: {
  status?: string;
  type?: 'order' | 'payment';
}) => {
  const cfg = useMemo(() => {
    if (!status) return { label: '-', bg: 'bg-slate-200', text: 'text-slate-700' };
    const s = status.toUpperCase();

    if (type === 'payment') {
      switch (s) {
        case 'COMPLETED':
          return { label: 'Đã thanh toán', bg: 'bg-emerald-100', text: 'text-emerald-700' };
        case 'PENDING':
          return { label: 'Chờ thanh toán', bg: 'bg-amber-100', text: 'text-amber-800' };
        case 'FAILED':
          return { label: 'Thất bại', bg: 'bg-rose-100', text: 'text-rose-700' };
        case 'UNPAID':
          return { label: 'Chưa thanh toán', bg: 'bg-slate-200', text: 'text-slate-700' };
        default:
          return { label: status, bg: 'bg-slate-200', text: 'text-slate-700' };
      }
    }

    switch (s) {
      case 'INITIATION':
        return { label: 'Khởi tạo', bg: 'bg-sky-100', text: 'text-sky-700' };
      case 'FORWARD_ANALYSIS':
        return { label: 'Chuyển tiếp phân tích', bg: 'bg-indigo-100', text: 'text-indigo-700' };
      case 'ACCEPTED':
        return { label: 'Chấp nhận', bg: 'bg-emerald-100', text: 'text-emerald-700' };
      case 'REJECTED':
        return { label: 'Từ chối', bg: 'bg-rose-100', text: 'text-rose-700' };
      case 'IN_PROGRESS':
        return { label: 'Đang xử lý', bg: 'bg-amber-100', text: 'text-amber-800' };
      case 'SAMPLE_ERROR':
        return { label: 'Mẫu lỗi', bg: 'bg-rose-100', text: 'text-rose-700' };
      case 'RERUN_TESTING':
        return { label: 'Chạy lại mẫu', bg: 'bg-violet-100', text: 'text-violet-700' };
      case 'RESULTS_APPROVED':
        return { label: 'Đã duyệt kết quả', bg: 'bg-teal-100', text: 'text-teal-700' };
      case 'COMPLETED':
        return { label: 'Hoàn thành', bg: 'bg-emerald-100', text: 'text-emerald-700' };
      default:
        return { label: status, bg: 'bg-slate-200', text: 'text-slate-700' };
    }
  }, [status, type]);

  return (
    <View className={`px-3 py-1 rounded-full ${cfg.bg} self-start`}>
      <Text className={`text-[12px] font-bold ${cfg.text}`}>{cfg.label}</Text>
    </View>
  );
};
function sampleAddStatusLabel(status?: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'initation' || s === 'initiation') return 'Khởi tạo';
  if (s === 'forward_analysis') return 'Chuyển phân tích';
  if (s === 'accepted') return 'Đã chấp nhận';
  if (s === 'rejected') return 'Từ chối';
  return status || '-';
}

function sampleAddStatusPillClass(status?: string): { bg: string; text: string } {
  const s = (status || '').toLowerCase();
  if (s === 'accepted') return { bg: 'bg-emerald-100', text: 'text-emerald-800' };
  if (s === 'rejected') return { bg: 'bg-rose-100', text: 'text-rose-800' };
  if (s === 'forward_analysis') return { bg: 'bg-sky-100', text: 'text-sky-800' };
  return { bg: 'bg-amber-100', text: 'text-amber-900' };
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  const rerunMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Không có đơn hàng');
      const specifyId = (order.specifyId as any)?.specifyVoteID || (order.specifyId as any)?.specifyVoteId;
      await orderService.updateStatus(order.orderId, 'rerun_testing');
      if (specifyId) await specifyVoteTestService.updateStatus(specifyId, 'sample_rerun');
      const pmList = order.patientMetadata || [];
      for (const pm of pmList) {
        if (pm.labcode) {
          await patientMetadataService.updateStatus(pm.labcode, 'sample_rerun').catch(() => { });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      presentFeedbackSuccess({
        title: 'Thành công',
        message: 'Đã gửi yêu cầu chạy lại mẫu. Staff sẽ xem xét và thông báo.',
      });
    },
    onError: (err: any) =>
      presentFeedbackError({ title: 'Lỗi', message: err?.message || 'Gửi yêu cầu thất bại' }),
  });

  const {
    data: orderResponse,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderService.getById(orderId!),
    enabled: !!orderId,
    retry: false,
  });

  const order = orderResponse?.success ? (orderResponse.data as OrderResponse) : null;

  const { data: sampleAddsResponse } = useQuery({
    queryKey: ['sample-adds-by-order', orderId],
    queryFn: () => sampleAddService.getByOrderId(orderId!),
    enabled: !!orderId && !!order,
    retry: false,
  });

  const sampleAddsList = useMemo(
    () => getApiResponseData<SampleAddResponse>(sampleAddsResponse),
    [sampleAddsResponse]
  );

  const handlePayment = () => {
    if (order && order.paymentAmount) {
      const specifyId = (order.specifyId as any)?.specifyVoteID || (order.specifyId as any)?.specifyVoteId;
      router.push({
        pathname: '/customer/payment',
        params: {
          orderId: order.orderId,
          amount: order.paymentAmount.toString(),
          orderName: order.orderName,
          ...(specifyId && { specifyId }),
          returnPath: '/customer/patient-metadatas',
          cancelPath: '/customer/orders',
        },
      });
    }
  };

  const specify = order?.specifyId;
  const patient = (specify as any)?.patient;
  const doctor = (specify as any)?.doctor;
  const hospital = (specify as any)?.hospital;
  const genomeTest = (specify as any)?.genomeTest;
  const clinical = (specify as any)?.patientClinical;
  const patientMetadata = order?.patientMetadata;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text className="text-slate-500">Đang tải thông tin đơn hàng...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <View className="w-16 h-16 rounded-2xl bg-rose-50 items-center justify-center">
            <FileText size={36} color={COLORS.danger} />
          </View>
          <Text className="text-slate-900 font-bold text-base">Không tìm thấy đơn hàng</Text>

          <TouchableOpacity
            className="flex-row items-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200"
            onPress={() => router.back()}
          >
            <ArrowLeft size={18} color={COLORS.primary} />
            <Text className="font-bold text-slate-900">Quay lại danh sách</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const showPayButton =
    order.paymentType?.toUpperCase() === 'ONLINE_PAYMENT' &&
    order.paymentStatus?.toUpperCase() !== 'COMPLETED' &&
    !!order.paymentAmount;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ['sample-adds-by-order', orderId] });
            }}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View className="p-4 flex-row items-center">
            <View className="flex-1">
              <Text className="text-[12px] text-slate-500 mb-2">Trạng thái đơn hàng</Text>
              <StatusBadge status={order.orderStatus} type="order" />
            </View>
            <View className="w-px h-12 bg-slate-100 mx-4" />
            <View className="flex-1">
              <Text className="text-[12px] text-slate-500 mb-2">Thanh toán</Text>
              <StatusBadge status={order.paymentStatus} type="payment" />
            </View>
          </View>
          <View className="px-4 pb-4 gap-3">
            {canAddSupplementSampleToOrder(order.orderStatus) && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/customer/new-sample-add',
                    params: { orderId: order.orderId },
                  })
                }
                className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-sky-50 border border-sky-200"
                activeOpacity={0.8}
              >
                <Plus size={18} color={COLORS.primary} />
                <Text className="text-sky-700 font-bold">Thêm mẫu bổ sung</Text>
              </TouchableOpacity>
            )}
            {((order.orderStatus || '').toLowerCase() === 'completed' ||
              (order.orderStatus || '').toLowerCase() === 'results_approved') && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Yêu cầu chạy lại mẫu',
                      'Kết quả chưa ổn định? Bạn có thể yêu cầu chạy lại mẫu. Staff sẽ xem xét và xử lý.',
                      [
                        { text: 'Hủy', style: 'cancel' },
                        {
                          text: 'Yêu cầu chạy lại',
                          onPress: () => rerunMutation.mutate(),
                        },
                      ]
                    );
                  }}
                  disabled={rerunMutation.isPending}
                  className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-amber-50 border border-amber-200"
                  activeOpacity={0.8}
                >
                  {rerunMutation.isPending ? (
                    <ActivityIndicator size="small" color="#D97706" />
                  ) : (
                    <RotateCcw size={18} color="#D97706" />
                  )}
                  <Text className="text-amber-700 font-bold">Yêu cầu chạy lại mẫu</Text>
                </TouchableOpacity>
              )}
          </View>
        </Card>
        <Section title="Thông tin đơn hàng" icon={<Package size={18} color={COLORS.primary} />}>
          <InfoRow
            label="Mã đơn hàng"
            value={order.orderId}
            icon={<Hash size={16} color={COLORS.muted} />}
          />
          <InfoRow
            label="Tên đơn hàng"
            value={order.orderName}
            icon={<FileText size={16} color={COLORS.muted} />}
          />
          <InfoRow
            label="Ngày tạo"
            value={formatDateTime(order.createdAt)}
            icon={<Calendar size={16} color={COLORS.muted} />}
          />
          <InfoRow
            label="Ngày trả kết quả"
            value={order.resultDate ? formatDateTime(order.resultDate) : 'N/A'}
            icon={<Calendar size={16} color={COLORS.muted} />}
          />
          <InfoRow
            label="Mã vạch"
            value={order.barcodeId}
            icon={<Hash size={16} color={COLORS.muted} />}
          />
          {order.orderNote ? (
            <InfoRow
              label="Ghi chú"
              value={order.orderNote}
              icon={<ClipboardList size={16} color={COLORS.muted} />}
            />
          ) : null}
        </Section>

        <Section
          title="Thông tin thanh toán"
          icon={<CreditCard size={18} color={COLORS.primary} />}
        >
          <InfoRow
            label="Phương thức"
            value={getPaymentTypeLabel(order.paymentType)}
            icon={<Wallet size={16} color={COLORS.muted} />}
          />
          <InfoRow
            label="Số tiền"
            value={formatCurrency(order.paymentAmount)}
            icon={<CreditCard size={16} color={COLORS.muted} />}
          />
          {showPayButton && (
            <TouchableOpacity
              onPress={handlePayment}
              className="mt-3 rounded-xl px-4 py-3 bg-slate-900 flex-row items-center justify-center gap-2"
            >
              <CreditCard size={18} color="#fff" />
              <Text className="text-white font-extrabold">Thanh toán ngay</Text>
            </TouchableOpacity>
          )}
          {order.invoiceLink && order.paymentStatus?.toUpperCase() === 'COMPLETED' && (
            <TouchableOpacity
              onPress={() => setInvoiceModalOpen(true)}
              className="mt-3 rounded-xl px-4 py-3 bg-sky-600 flex-row items-center justify-center gap-2"
            >
              <FileText size={18} color="#fff" />
              <Text className="text-white font-extrabold">Xem hóa đơn</Text>
            </TouchableOpacity>
          )}
        </Section>

        <Section title="Nhân viên phụ trách" icon={<Users size={18} color={COLORS.primary} />}>
          <InfoRow
            label="Khách hàng"
            value={order.customerName || order.customerId}
            icon={<User size={16} color={COLORS.muted} />}
          />
          <InfoRow
            label="Người thu mẫu"
            value={order.sampleCollectorName || order.sampleCollectorId}
            icon={<TestTube size={16} color={COLORS.muted} />}
          />
          <InfoRow
            label="Nhân viên phân tích"
            value={order.staffAnalystName || order.staffAnalystId}
            icon={<FlaskConical size={16} color={COLORS.muted} />}
          />
        </Section>

        {patient && (
          <Section title="Thông tin bệnh nhân" icon={<User size={18} color={COLORS.primary} />}>
            <InfoRow
              label="Mã bệnh nhân"
              value={patient.patientId}
              icon={<Hash size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Họ tên"
              value={patient.patientName}
              icon={<User size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Ngày sinh"
              value={formatDate(patient.patientDob)}
              icon={<Calendar size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Giới tính"
              value={
                patient.gender === 'MALE'
                  ? 'Nam'
                  : patient.gender === 'FEMALE'
                    ? 'Nữ'
                    : patient.gender
              }
              icon={<User size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Số điện thoại"
              value={patient.patientPhone}
              icon={<Phone size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Email"
              value={patient.patientEmail}
              icon={<Mail size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Địa chỉ"
              value={patient.patientAddress}
              icon={<MapPin size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Nghề nghiệp"
              value={patient.patientJob}
              icon={<Briefcase size={16} color={COLORS.muted} />}
            />
          </Section>
        )}
        {doctor && (
          <Section title="Thông tin bác sĩ" icon={<Stethoscope size={18} color={COLORS.primary} />}>
            <InfoRow
              label="Họ tên"
              value={doctor.doctorName}
              icon={<User size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Số điện thoại"
              value={doctor.doctorPhone}
              icon={<Phone size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Email"
              value={doctor.doctorEmail}
              icon={<Mail size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Chuyên khoa"
              value={doctor.doctorSpecialized}
              icon={<Stethoscope size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Học vị"
              value={doctor.doctorDegree}
              icon={<BadgeCheck size={16} color={COLORS.muted} />}
            />
          </Section>
        )}

        {hospital && (
          <Section title="Thông tin bệnh viện" icon={<Hospital size={18} color={COLORS.primary} />}>
            <InfoRow
              label="Tên bệnh viện"
              value={hospital.hospitalName}
              icon={<Building2 size={16} color={COLORS.muted} />}
            />
          </Section>
        )}

        {genomeTest && (
          <Section
            title="Thông tin xét nghiệm"
            icon={<FlaskConical size={18} color={COLORS.primary} />}
          >
            <InfoRow
              label="Mã xét nghiệm"
              value={genomeTest.testId}
              icon={<Hash size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Tên xét nghiệm"
              value={genomeTest.testName}
              icon={<FlaskConical size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Mô tả"
              value={genomeTest.testDescription}
              icon={<FileText size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Loại mẫu"
              value={genomeTest.testSample}
              icon={<TestTube size={16} color={COLORS.muted} />}
            />
          </Section>
        )}

        {specify && (
          <Section
            title="Thông tin phiếu chỉ định"
            icon={<ClipboardList size={18} color={COLORS.primary} />}
          >
            <InfoRow
              label="Mã phiếu"
              value={specify.specifyVoteID}
              icon={<Hash size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Loại dịch vụ"
              value={specify.serviceType}
              icon={<Package size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Vị trí lấy mẫu"
              value={specify.samplingSite}
              icon={<MapPin size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Ngày lấy mẫu"
              value={formatDate(specify.sampleCollectDate)}
              icon={<Calendar size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Số phôi"
              value={specify.embryoNumber}
              icon={<Heart size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Trạng thái"
              value={getSpecifyStatusLabel(specify.specifyStatus)}
              icon={<Activity size={16} color={COLORS.muted} />}
            />
            {specify.specifyNote ? (
              <InfoRow
                label="Ghi chú"
                value={specify.specifyNote}
                icon={<ClipboardList size={16} color={COLORS.muted} />}
              />
            ) : null}
          </Section>
        )}

        {clinical && (
          <Section title="Thông tin lâm sàng" icon={<Activity size={18} color={COLORS.primary} />}>
            <InfoRow
              label="Chiều cao"
              value={clinical.patientHeight ? `${clinical.patientHeight} cm` : null}
              icon={<Activity size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Cân nặng"
              value={clinical.patientWeight ? `${clinical.patientWeight} kg` : null}
              icon={<Activity size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Tiền sử bệnh"
              value={clinical.patientHistory}
              icon={<FileText size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Tiền sử gia đình"
              value={clinical.familyHistory}
              icon={<Users size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Bệnh mãn tính"
              value={clinical.chronicDisease}
              icon={<AlertTriangle size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Bệnh cấp tính"
              value={clinical.acuteDisease}
              icon={<AlertTriangle size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Thuốc đang dùng"
              value={clinical.medicalUsing}
              icon={<Pill size={16} color={COLORS.muted} />}
            />
            <InfoRow
              label="Tiếp xúc độc hại"
              value={clinical.toxicExposure}
              icon={<AlertTriangle size={16} color={COLORS.muted} />}
            />
          </Section>
        )}

        {patientMetadata && patientMetadata.length > 0 && (
          <Section
            title={`Thông tin mẫu (${patientMetadata.length})`}
            icon={<TestTube size={18} color={COLORS.primary} />}
          >
            <View className="gap-3">
              {patientMetadata.map((meta: any, index: number) => (
                <View key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <Text className="text-slate-900 font-extrabold mb-2">Mẫu #{index + 1}</Text>
                  <InfoRow
                    label="Labcode"
                    value={meta.labcode}
                    icon={<Hash size={16} color={COLORS.muted} />}
                  />
                  {meta.sampleName ? (
                    <InfoRow
                      label="Tên mẫu"
                      value={meta.sampleName}
                      icon={<TestTube size={16} color={COLORS.muted} />}
                    />
                  ) : null}
                  {meta.status ? (
                    <InfoRow
                      label="Trạng thái"
                      value={meta.status}
                      icon={<Activity size={16} color={COLORS.muted} />}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </Section>
        )}

        {sampleAddsList.length > 0 && (
          <Section title="Mẫu bổ sung" icon={<ClipboardList size={18} color={COLORS.primary} />}>
            <View className="gap-3">
              {sampleAddsList.map((sa, idx) => {
                const pill = sampleAddStatusPillClass(sa.status);
                const key = sa.id || sa.sampleAddId || `${sa.orderId}-${idx}-${sa.sampleName || ''}`;
                return (
                  <View
                    key={key}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-3 gap-2"
                  >
                    <View className="flex-row justify-between items-start gap-2">
                      <Text className="text-[13px] text-slate-500 flex-1">Tên mẫu</Text>
                      <Text className="text-[14px] font-bold text-slate-900 flex-1 text-right">
                        {sa.sampleName || '-'}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center gap-2 flex-wrap">
                      <Text className="text-[13px] text-slate-500">Trạng thái</Text>
                      <View className={`px-2.5 py-1 rounded-full ${pill.bg}`}>
                        <Text className={`text-[11px] font-extrabold ${pill.text}`}>
                          {sampleAddStatusLabel(sa.status)}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row justify-between items-start gap-2">
                      <Text className="text-[13px] text-slate-500">Thanh toán</Text>
                      <Text className="text-[13px] font-semibold text-slate-800 text-right flex-1">
                        {sa.paymentStatus || '-'}
                      </Text>
                    </View>
                    {sa.note ? (
                      <View className="flex-row justify-between items-start gap-2">
                        <Text className="text-[13px] text-slate-500">Ghi chú</Text>
                        <Text className="text-[13px] text-slate-700 text-right flex-1">{sa.note}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Section>
        )}

        <View className="h-10" />
      </ScrollView>

      <InvoiceModal
        visible={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        invoiceLink={order.invoiceLink ?? null}
        orderId={order.orderId}
      />
    </SafeAreaView>
  );
}
