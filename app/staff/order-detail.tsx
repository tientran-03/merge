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
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  Hash,
  Heart,
  Hospital,
  ListChecks,
  Mail,
  MapPin,
  Package,
  Phone,
  Pill,
  RotateCcw,
  Stethoscope,
  TestTube,
  Trash2,
  User,
  Users,
  Wallet,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal, InvoiceModal, SuccessModal } from '@/components/modals';
import { COLORS } from '@/constants/colors';
import { ROLE_LAB_TECHNICIAN } from '@/constants/roles';
import { useAuth } from '@/contexts/AuthContext';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { getSpecifyStatusLabel } from '@/lib/specify-status';
import { useStaffDoctorBasePath } from '@/lib/staff-doctor-route';
import { OrderResponse, orderService } from '@/services/orderService';
import { patientMetadataService } from '@/services/patientMetadataService';
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
        return { label: 'Chạy lại', bg: 'bg-orange-100', text: 'text-orange-800' };
      case 'AWAITING_RESULTS_APPROVAL':
        return { label: 'Chờ duyệt kết quả', bg: 'bg-violet-100', text: 'text-violet-700' };
      case 'RESULTS_APPROVED':
      case 'RESULT_APPROVED':
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

export default function OrderDetailScreen() {
  const router = useRouter();
  const base = useStaffDoctorBasePath();
  const queryClient = useQueryClient();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [workflowAction, setWorkflowAction] = useState<'doctor_approve' | 'deliver' | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [pendingWorkflow, setPendingWorkflow] = useState<'labStart' | 'labSubmit' | 'rerun' | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: () => orderService.delete(orderId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setSuccessMessage('Xóa đơn hàng thành công!');
      setShowSuccessModal(true);
    },
    onError: (error: any) =>
      presentFeedbackError({ title: 'Lỗi', message: error?.message || 'Không thể xóa đơn hàng' }),
  });

  const approveRerunMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Không có đơn hàng');
      const specifyVoteId =
        (order.specifyId as any)?.specifyVoteID || (order.specifyId as any)?.specifyVoteId;
      await orderService.updateStatus(order.orderId, 'in_progress');
      if (specifyVoteId) {
        await specifyVoteTestService.updateStatus(String(specifyVoteId), 'analyze_in_progress');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
      presentFeedbackSuccess({
        title: 'Đã duyệt chạy lại',
        message: 'Đơn chuyển sang đang xử lý phân tích.',
      });
    },
    onError: (err: any) =>
      presentFeedbackError({ title: 'Lỗi', message: err?.message || 'Duyệt thất bại' }),
  });

  const labStartMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Không có đơn hàng');
      const specifyVoteId =
        (order.specifyId as any)?.specifyVoteID || (order.specifyId as any)?.specifyVoteId;
      await orderService.updateStatus(order.orderId, 'in_progress');
      if (specifyVoteId) {
        await specifyVoteTestService.updateStatus(String(specifyVoteId), 'analyze_in_progress');
      }
      const labs = order.patientMetadata || [];
      for (const pm of labs) {
        if (pm.labcode) {
          await patientMetadataService.updateStatus(pm.labcode, 'sample_in_analyze').catch(() => { });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
      presentFeedbackSuccess({
        title: 'Đã bắt đầu phân tích',
        message: 'Đơn và mẫu đã chuyển sang trạng thái đang phân tích.',
      });
    },
    onError: (err: any) =>
      presentFeedbackError({ title: 'Lỗi', message: err?.message || 'Không thể cập nhật' }),
  });

  const labSubmitMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Không có đơn hàng');
      const specifyVoteId =
        (order.specifyId as any)?.specifyVoteID || (order.specifyId as any)?.specifyVoteId;
      await orderService.updateStatus(order.orderId, 'awaiting_results_approval');
      if (specifyVoteId) {
        await specifyVoteTestService.updateStatus(String(specifyVoteId), 'awaiting_results_approval');
      }
      const labs = order.patientMetadata || [];
      for (const pm of labs) {
        if (pm.labcode) {
          await patientMetadataService.updateStatus(pm.labcode, 'sample_completed').catch(() => { });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
      presentFeedbackSuccess({
        title: 'Đã gửi chờ duyệt',
        message: 'Kết quả đã chuyển sang chờ bác sĩ phê duyệt.',
      });
    },
    onError: (err: any) =>
      presentFeedbackError({ title: 'Lỗi', message: err?.message || 'Không thể cập nhật' }),
  });

  const workflowMutation = useMutation({
    mutationFn: async (action: 'doctor_approve' | 'deliver'): Promise<typeof action> => {
      if (!order) throw new Error('Không có đơn hàng');
      const latestOrderRes = await orderService.getById(order.orderId);
      const latestOrder =
        latestOrderRes?.success && (latestOrderRes as any)?.data
          ? ((latestOrderRes as any).data as OrderResponse)
          : order;
      const latestStatus = String(latestOrder.orderStatus || '').toLowerCase();
      const specifyId =
        (latestOrder.specifyId as any)?.specifyVoteID || (latestOrder.specifyId as any)?.specifyVoteId;

      if (action === 'doctor_approve') {
        if (latestStatus !== 'awaiting_results_approval') {
          throw new Error('Đơn không còn ở trạng thái chờ bác sĩ phê duyệt. Vui lòng tải lại.');
        }
        await orderService.updateStatus(order.orderId, 'results_approved');
        if (specifyId) await specifyVoteTestService.updateStatus(specifyId, 'results_approved');
      } else if (action === 'deliver') {
        if (latestStatus !== 'results_approved' && latestStatus !== 'result_approved') {
          throw new Error('Đơn không ở trạng thái đã phê duyệt kết quả. Vui lòng tải lại.');
        }
        await orderService.updateStatus(order.orderId, 'completed');
        if (specifyId) await specifyVoteTestService.updateStatus(specifyId, 'completed');
        await orderService.updateResultDate(order.orderId, new Date().toISOString());
      }
      return action;
    },
    onSuccess: (action: 'doctor_approve' | 'deliver') => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setWorkflowAction(null);
      const msg =
        action === 'doctor_approve'
          ? 'Đã phê duyệt kết quả'
          : 'Đã trả kết quả cho khách hàng';
      setSuccessMessage(msg);
      setShowSuccessModal(true);
    },
    onError: (error: any) =>
      presentFeedbackError({ title: 'Lỗi', message: error?.message || 'Thao tác thất bại' }),
  });

  const sampleErrorMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Không có đơn hàng');
      const specifyId = (order.specifyId as any)?.specifyVoteID || (order.specifyId as any)?.specifyVoteId;
      await orderService.updateStatus(order.orderId, 'sample_error');
      if (specifyId) await specifyVoteTestService.updateStatus(specifyId, 'sample_error');
      const patientMetadata = order.patientMetadata || [];
      for (const pm of patientMetadata) {
        if (pm.labcode) {
          await patientMetadataService.updateStatus(pm.labcode, 'sample_error');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setSuccessMessage('Đã báo lỗi mẫu');
      setShowSuccessModal(true);
    },
    onError: (error: any) =>
      presentFeedbackError({ title: 'Lỗi', message: error?.message || 'Báo lỗi thất bại' }),
  });

  const handleDelete = () => {
    setShowDeleteModal(false);
    deleteMutation.mutate();
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    router.replace(`${base}/orders` as any);
  };

  const handlePayment = () => {
    if (order && order.paymentAmount) {
      router.push({
        pathname: `${base}/payment`,
        params: {
          orderId: order.orderId,
          amount: order.paymentAmount.toString(),
          orderName: order.orderName,
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

  const orderStatusLower = (order.orderStatus || '').toLowerCase();

  const canReportSampleError =
    ((order.orderStatus || '').toLowerCase() === 'accepted' ||
      (order.orderStatus || '').toLowerCase() === 'in_progress') &&
    (user?.role === 'ROLE_STAFF' || user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_LAB_TECHNICIAN');

  const hasInvoiceLink = Boolean(order.invoiceLink && String(order.invoiceLink).trim());
  const showQuickLookupCard = hasInvoiceLink || canReportSampleError || showPayButton;

  const showWorkflowRerun =
    orderStatusLower === 'rerun_testing' && (user?.role === 'ROLE_STAFF' || user?.role === 'ROLE_ADMIN');
  const showWorkflowDoctor =
    orderStatusLower === 'awaiting_results_approval' && user?.role === 'ROLE_DOCTOR';
  const showWorkflowDeliver =
    (orderStatusLower === 'results_approved' || orderStatusLower === 'result_approved') &&
    (user?.role === 'ROLE_STAFF' || user?.role === 'ROLE_ADMIN');
  const showWorkflowSection = showWorkflowRerun || showWorkflowDoctor || showWorkflowDeliver;
  const showStaffPendingApprovalWizard =
    Platform.OS !== 'web' &&
    (user?.role === 'ROLE_STAFF' || user?.role === 'ROLE_ADMIN') &&
    (orderStatusLower === 'forward_analysis' || orderStatusLower === 'sample_addition');

  const canLabAnalysisActions = user?.role === ROLE_LAB_TECHNICIAN;
  const showLabStart = canLabAnalysisActions && orderStatusLower === 'accepted';
  const showLabSubmit = canLabAnalysisActions && orderStatusLower === 'in_progress';

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-4"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[COLORS.primary]} />
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
          {showPayButton ? (
            <Text className="text-[11px] font-semibold text-slate-500 mt-2 leading-4">
              Thanh toán online: dùng nút ở mục « Tra cứu » bên dưới.
            </Text>
          ) : null}
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

        {showQuickLookupCard ? (
          <View className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm shadow-slate-900/5">
            <View className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <Text className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                Tra cứu & ghi nhận
              </Text>
              <Text className="text-[12px] text-slate-500 mt-1 leading-5">
                Hóa đơn, thanh toán online, báo lỗi mẫu (khi đơn đang xử lý).
              </Text>
            </View>
            <View className="p-4 gap-3">
              {hasInvoiceLink || showPayButton ? (
                <View className="flex-row gap-3">
                  {hasInvoiceLink ? (
                    <TouchableOpacity
                      className="flex-1 min-h-[92px] rounded-2xl px-2 py-3 bg-sky-50 border border-sky-200 items-center justify-center gap-1.5 active:bg-sky-100"
                      onPress={() => setInvoiceModalOpen(true)}
                      activeOpacity={0.88}
                    >
                      <FileText size={24} color="#0369a1" />
                      <Text className="text-[12px] font-extrabold text-sky-900 text-center leading-4">
                        Xem hóa đơn
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {showPayButton ? (
                    <TouchableOpacity
                      className="flex-1 min-h-[92px] rounded-2xl px-2 py-3 bg-slate-900 border border-slate-900 items-center justify-center gap-1.5 active:bg-slate-800"
                      onPress={handlePayment}
                      activeOpacity={0.88}
                    >
                      <CreditCard size={24} color="#fff" />
                      <Text className="text-[12px] font-extrabold text-white text-center leading-4">
                        Thanh toán{'\n'}online
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {canReportSampleError ? (
                <TouchableOpacity
                  className="rounded-2xl py-3.5 px-4 bg-amber-50 border border-amber-200 flex-row items-center justify-center gap-2.5 active:bg-amber-100"
                  activeOpacity={0.88}
                  disabled={sampleErrorMutation.isPending}
                  onPress={() => {
                    Alert.alert(
                      'Báo lỗi mẫu',
                      'Xác nhận báo lỗi mẫu? Staff và khách hàng sẽ nhận thông báo.',
                      [
                        { text: 'Hủy', style: 'cancel' },
                        { text: 'Báo lỗi', onPress: () => sampleErrorMutation.mutate() },
                      ]
                    );
                  }}
                >
                  {sampleErrorMutation.isPending ? (
                    <ActivityIndicator size="small" color="#D97706" />
                  ) : (
                    <AlertTriangle size={22} color="#D97706" />
                  )}
                  <Text className="font-extrabold text-amber-800 text-[14px]">Báo lỗi mẫu</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {showLabStart || showLabSubmit ? (
          <View className="rounded-2xl border border-sky-200 bg-white overflow-hidden shadow-sm shadow-slate-900/5">
            <View className="px-4 py-3 bg-sky-50 border-b border-sky-100">
              <Text className="text-[11px] font-extrabold text-sky-800 uppercase tracking-wider">
                Lab · phân tích
              </Text>
              <Text className="text-[12px] text-sky-700 mt-1 leading-5">
                Chấp nhận đơn (staff) → bắt đầu phân tích → hoàn tất và gửi chờ bác sĩ duyệt kết quả.
              </Text>
            </View>
            <View className="p-4 gap-3">
              {showLabStart ? (
                <TouchableOpacity
                  className="rounded-xl py-4 bg-sky-50 border border-sky-200 flex-row items-center justify-center gap-2"
                  activeOpacity={0.85}
                  disabled={labStartMutation.isPending}
                  onPress={() => setPendingWorkflow('labStart')}
                >
                  {labStartMutation.isPending ? (
                    <ActivityIndicator size="small" color="#0369a1" />
                  ) : (
                    <FlaskConical size={22} color="#0369a1" />
                  )}
                  <Text className="font-extrabold text-sky-800">Bắt đầu phân tích</Text>
                </TouchableOpacity>
              ) : null}
              {showLabSubmit ? (
                <TouchableOpacity
                  className="rounded-xl py-4 bg-indigo-50 border border-indigo-200 flex-row items-center justify-center gap-2"
                  activeOpacity={0.85}
                  disabled={labSubmitMutation.isPending}
                  onPress={() => setPendingWorkflow('labSubmit')}
                >
                  {labSubmitMutation.isPending ? (
                    <ActivityIndicator size="small" color="#4f46e5" />
                  ) : (
                    <FileText size={22} color="#4f46e5" />
                  )}
                  <Text className="font-extrabold text-indigo-800">Hoàn tất & gửi chờ bác sĩ duyệt</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        <View className="gap-4">
          {showWorkflowSection ? (
            <>
              <Text className="text-sm font-bold text-slate-500 uppercase tracking-wide px-1">
                Luồng xử lý
              </Text>
              <View className="gap-3">
                {showWorkflowRerun ? (
                  <TouchableOpacity
                    className="rounded-xl py-4 bg-violet-50 border border-violet-200 flex-row items-center justify-center gap-2"
                    activeOpacity={0.85}
                    disabled={approveRerunMutation.isPending}
                    onPress={() => setPendingWorkflow('rerun')}
                  >
                    {approveRerunMutation.isPending ? (
                      <ActivityIndicator size="small" color="#7C3AED" />
                    ) : (
                      <RotateCcw size={22} color="#7C3AED" />
                    )}
                    <Text className="font-extrabold text-violet-700">Duyệt chạy lại mẫu</Text>
                  </TouchableOpacity>
                ) : null}
                {showWorkflowDoctor ? (
                  <TouchableOpacity
                    className="rounded-xl py-4 bg-violet-50 border border-violet-200 flex-row items-center justify-center gap-2"
                    activeOpacity={0.85}
                    disabled={workflowMutation.isPending}
                    onPress={() => {
                      setWorkflowAction('doctor_approve');
                      Alert.alert(
                        'Phê duyệt kết quả',
                        'Xác nhận phê duyệt kết quả xét nghiệm? Staff sẽ nhận thông báo.',
                        [
                          { text: 'Hủy', style: 'cancel' },
                          { text: 'Phê duyệt', onPress: () => workflowMutation.mutate('doctor_approve') },
                        ]
                      );
                    }}
                  >
                    {workflowMutation.isPending && workflowAction === 'doctor_approve' ? (
                      <ActivityIndicator size="small" color="#7C3AED" />
                    ) : (
                      <CheckCircle2 size={22} color="#7C3AED" />
                    )}
                    <Text className="font-extrabold text-violet-700">Phê duyệt kết quả</Text>
                  </TouchableOpacity>
                ) : null}
                {showWorkflowDeliver ? (
                  <TouchableOpacity
                    className="rounded-xl py-4 bg-teal-50 border border-teal-200 flex-row items-center justify-center gap-2"
                    activeOpacity={0.85}
                    disabled={workflowMutation.isPending}
                    onPress={() => {
                      setWorkflowAction('deliver');
                      Alert.alert(
                        'Trả kết quả cho khách',
                        'Xác nhận đã trả kết quả cho khách hàng? Khách hàng sẽ nhận thông báo.',
                        [
                          { text: 'Hủy', style: 'cancel' },
                          { text: 'Xác nhận', onPress: () => workflowMutation.mutate('deliver') },
                        ]
                      );
                    }}
                  >
                    {workflowMutation.isPending && workflowAction === 'deliver' ? (
                      <ActivityIndicator size="small" color="#0D9488" />
                    ) : (
                      <Package size={22} color="#0D9488" />
                    )}
                    <Text className="font-extrabold text-teal-700">Trả kết quả cho khách</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          ) : null}

          <Text className="text-sm font-bold text-slate-500 uppercase tracking-wide px-1 mt-1">
            Quản lý đơn
          </Text>
          <View className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {showStaffPendingApprovalWizard ? (
              <TouchableOpacity
                className="flex-row items-center gap-3 px-4 py-4 border-b border-emerald-100 bg-emerald-50/80 active:bg-emerald-100/90"
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: `${base}/update-order`,
                    params: { orderId: order.orderId, approval: '1' },
                  })
                }
              >
                <View className="w-10 h-10 rounded-xl bg-emerald-600 items-center justify-center">
                  <CheckCircle2 size={20} color="#FFFFFF" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[14px] font-extrabold text-emerald-950">
                    Phê duyệt & bổ sung thông tin
                  </Text>
                  <Text className="text-[11px] font-semibold text-emerald-900/80 mt-0.5 leading-4">
                    Barcode, nhân viên thu mẫu, nhân viên phân tích…
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              className="flex-row items-center gap-3 px-4 py-4 border-b border-slate-100 active:bg-slate-50"
              activeOpacity={0.85}
              onPress={() => {
                router.push({
                  pathname: `${base}/create-order`,
                  params: { orderId: order.orderId, initialStep: '1' },
                } as Parameters<typeof router.push>[0]);
              }}
            >
              <View className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center">
                <ListChecks size={20} color="#334155" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[14px] font-extrabold text-slate-900">Chỉnh sửa đơn hàng</Text>
                <Text className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Cùng màn hình tạo đơn — dữ liệu được điền sẵn từ đơn hiện tại
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center gap-3 px-4 py-4 active:bg-rose-50/80"
              onPress={() => setShowDeleteModal(true)}
              disabled={deleteMutation.isPending}
              activeOpacity={0.85}
            >
              <View className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 items-center justify-center">
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color={COLORS.danger} />
                ) : (
                  <Trash2 size={20} color={COLORS.danger} />
                )}
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[14px] font-extrabold text-rose-700">Xoá đơn hàng</Text>
                <Text className="text-[11px] font-semibold text-slate-500 mt-0.5">Không thể hoàn tác</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View className="h-10" />
      </ScrollView>

      <ConfirmModal
        visible={showDeleteModal}
        title="Xác nhận xóa"
        message={`Bạn có chắc muốn xóa đơn hàng #${order.orderId} không? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        destructive
      />

      <ConfirmModal
        visible={pendingWorkflow !== null}
        title={
          pendingWorkflow === 'labStart'
            ? 'Bắt đầu phân tích'
            : pendingWorkflow === 'labSubmit'
              ? 'Gửi chờ bác sĩ duyệt'
              : 'Duyệt chạy lại mẫu'
        }
        message={
          pendingWorkflow === 'labStart'
            ? 'Xác nhận chuyển đơn sang đang xử lý phân tích? Phiếu và mẫu sẽ cập nhật trạng thái tương ứng.'
            : pendingWorkflow === 'labSubmit'
              ? 'Xác nhận đã có kết quả phân tích và chuyển sang chờ bác sĩ phê duyệt kết quả?'
              : 'Xác nhận duyệt yêu cầu chạy lại mẫu? Đơn sẽ chuyển sang đang xử lý phân tích.'
        }
        confirmText="Xác nhận"
        cancelText="Hủy"
        destructive={pendingWorkflow === 'rerun'}
        onCancel={() => setPendingWorkflow(null)}
        onConfirm={() => {
          const w = pendingWorkflow;
          setPendingWorkflow(null);
          if (w === 'labStart') labStartMutation.mutate();
          else if (w === 'labSubmit') labSubmitMutation.mutate();
          else if (w === 'rerun') approveRerunMutation.mutate();
        }}
      />

      <SuccessModal
        visible={showSuccessModal}
        message={successMessage}
        onClose={handleSuccessClose}
      />

      <InvoiceModal
        visible={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        invoiceLink={order.invoiceLink ? String(order.invoiceLink) : null}
        orderId={order.orderId}
      />
    </SafeAreaView>
  );
}
