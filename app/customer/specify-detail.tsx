import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileText,
  FlaskConical,
  Heart,
  Pencil,
  Stethoscope,
  User,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ForwardTestModal } from '@/components/modals/ForwardTestModal';
import {
  getSpecifyStatusDetailPill,
  getSpecifyStatusLabel,
  normalizeSpecifyStatusKey,
} from '@/lib/specify-status';
import { MEDICAL } from '@/lib/theme/medical';
import { getApiResponseData, getApiResponseSingle } from '@/lib/types/api-types';
import {
  orderService,
  pickLatestOrderResultDate,
  type OrderResponse,
} from '@/services/orderService';
import { SpecifyVoteTestResponse, specifyVoteTestService } from '@/services/specifyVoteTestService';

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('vi-VN');
  } catch {
    return dateString;
  }
};
const formatDateTimeSafe = (dateString?: string) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return String(dateString);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateString);
  }
};

const serviceTypeLabel = (t?: string) =>
  t === 'disease'
    ? 'Bệnh lý di truyền'
    : t === 'embryo'
      ? 'Phôi thai'
      : t === 'reproduction'
        ? 'Sinh sản'
        : t || '—';

const genderLabel = (g?: string) => {
  if (g === 'male' || g === 'MALE') return 'Nam';
  if (g === 'female' || g === 'FEMALE') return 'Nữ';
  return g || '—';
};

const formatMoneyVnd = (n?: number) =>
  n != null && !Number.isNaN(n) ? `${n.toLocaleString('vi-VN')} VNĐ` : '—';

const Section = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) => (
  <View className="bg-white rounded-2xl mb-3 border border-sky-100 overflow-hidden">
    <View className="flex-row items-center px-3 py-3 bg-sky-50 border-b border-sky-100">
      <Icon size={18} color={MEDICAL.primary} />
      <Text className="ml-2 text-[15px] font-bold text-black">{title}</Text>
    </View>
    <View className="px-3 pb-1">{children}</View>
  </View>
);


const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | boolean | null;
}) => {
  let display: string;
  if (value === true) display = 'Có';
  else if (value === false) display = 'Không';
  else if (value === null || value === undefined || value === '') display = '—';
  else display = String(value);
  return (
    <View className="py-2.5 border-b border-sky-50 last:border-b-0">
      <Text className="text-xs text-slate-600 font-semibold">{label}</Text>
      <Text className="mt-0.5 text-[15px] text-black font-medium leading-5" selectable>
        {display}
      </Text>
    </View>
  );
};

const LongText = ({ label, text }: { label: string; text: string }) => (
  <View className="py-2.5">
    <Text className="text-xs text-slate-600 font-semibold mb-1">{label}</Text>
    <View className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2.5">
      <Text className="text-sm text-black leading-5" selectable>
        {text}
      </Text>
    </View>
  </View>
);

export default function SpecifyDetailScreen() {
  const router = useRouter();
  const { specifyId } = useLocalSearchParams<{ specifyId: string }>();
  const [forwardOpen, setForwardOpen] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['specify', specifyId],
    queryFn: () => specifyVoteTestService.getById(specifyId!),
    enabled: !!specifyId,
    retry: false,
  });

  const { data: ordersForSpecify, isLoading: loadingOrderResultDate } = useQuery({
    queryKey: ['orders-by-specify', specifyId],
    queryFn: async () => {
      const res = await orderService.getBySpecifyId(specifyId!);
      return getApiResponseData<OrderResponse>(res) || [];
    },
    enabled: !!specifyId,
    staleTime: 60 * 1000,
  });

  const resultReturnDateIso = useMemo(
    () => pickLatestOrderResultDate(ordersForSpecify),
    [ordersForSpecify]
  );

  const sp = getApiResponseSingle<SpecifyVoteTestResponse>(data);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={MEDICAL.primary} />
        <Text className="mt-2 text-black text-sm font-semibold">Đang tải...</Text>
      </View>
    );
  }

  if (error || !sp) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-center text-black font-bold mb-4">Không tìm thấy phiếu</Text>
        <TouchableOpacity className="bg-sky-600 px-6 py-3 rounded-xl" onPress={() => router.back()}>
          <Text className="text-white font-bold">Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pill = getSpecifyStatusDetailPill(sp.specifyStatus || '');
  const statusText = getSpecifyStatusLabel(sp.specifyStatus || '');
  const canForward = normalizeSpecifyStatusKey(sp.specifyStatus) === 'initation';
  const rs = sp.reproductionService;
  const es = sp.embryoService;
  const ds = sp.diseaseService;
  const pc = sp.patientClinical;
  const gt = sp.genomeTest;

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor={MEDICAL.screenBg} />

      <View className="flex-row items-center px-4 py-3 bg-white border-b border-sky-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center"
        >
          <ArrowLeft size={20} color={MEDICAL.primary} />
        </TouchableOpacity>
        <View className="ml-3 flex-1 min-w-0">
          <Text className="text-lg font-bold text-black">Chi tiết phiếu xét nghiệm</Text>
          <Text className="text-[11px] text-slate-600 font-mono" numberOfLines={1}>
            Mã phiếu: {sp.specifyVoteID}
          </Text>
        </View>
        <View className={`px-2 py-1 rounded-lg ${pill.bg}`}>
          <Text className={`text-[10px] font-bold ${pill.tx}`} numberOfLines={1}>
            {statusText}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={MEDICAL.primary} />}
      >
        <Section title="Thông tin phiếu xét nghiệm" icon={FileText}>
          <DetailRow label="Mã phiếu xét nghiệm" value={sp.specifyVoteID} />
          <DetailRow label="Loại dịch vụ" value={serviceTypeLabel(sp.serviceType)} />
          <DetailRow label="Bệnh viện / Phòng khám" value={sp.hospital?.hospitalName} />
          <DetailRow
            label="Ngày lấy mẫu"
            value={
              sp.sampleCollectDate
                ? formatDateTimeSafe(String(sp.sampleCollectDate))
                : undefined
            }
          />
          <DetailRow label="Vị trí lấy mẫu" value={sp.samplingSite} />
          {sp.embryoNumber != null ? (
            <DetailRow label="Số lượng phôi" value={String(sp.embryoNumber)} />
          ) : (
            <DetailRow label="Số lượng phôi" value={undefined} />
          )}
          <DetailRow label="Trạng thái" value={statusText} />
          <DetailRow
            label="Ngày tạo"
            value={sp.createdAt ? formatDateTimeSafe(String(sp.createdAt)) : undefined}
          />
          <DetailRow
            label="Dự kiến có kết quả"
            value={
              sp.expectedResultDate
                ? formatDateTimeSafe(String(sp.expectedResultDate))
                : undefined
            }
          />
          <DetailRow
            label="Ngày trả kết quả"
            value={
              loadingOrderResultDate
                ? 'Đang tải…'
                : resultReturnDateIso
                  ? formatDateTimeSafe(String(resultReturnDateIso))
                  : 'N/A'
            }
          />
          <DetailRow label="Gửi email cho bệnh nhân" value={sp.sendEmailPatient} />
          {sp.rejectReason ? <LongText label="Lý do từ chối" text={sp.rejectReason} /> : null}
          {sp.specifyNote ? <LongText label="Ghi chú phiếu" text={sp.specifyNote} /> : null}
        </Section>

        {sp.patient ? (
          <Section title="Thông tin bệnh nhân" icon={User}>
            <DetailRow label="Họ và tên" value={sp.patient.patientName} />
            <DetailRow
              label="Ngày sinh"
              value={sp.patient.patientDob ? formatDate(sp.patient.patientDob) : undefined}
            />
            <DetailRow label="Giới tính" value={genderLabel(sp.patient.gender)} />
            <DetailRow label="Số điện thoại" value={sp.patient.patientPhone} />
            <DetailRow label="Email" value={sp.patient.patientEmail} />
            <DetailRow label="Nghề nghiệp" value={sp.patient.patientJob} />
            <DetailRow label="Địa chỉ" value={sp.patient.patientAddress} />
            {sp.patient.patientContactName ? (
              <View className="mt-2 pt-3 border-t border-sky-100">
                <Text className="text-[11px] font-bold text-slate-500 uppercase mb-2">
                  Người liên hệ khẩn cấp
                </Text>
                <DetailRow label="Họ và tên" value={sp.patient.patientContactName} />
                <DetailRow label="Số điện thoại" value={sp.patient.patientContactPhone} />
              </View>
            ) : null}
          </Section>
        ) : null}

        {sp.doctor ? (
          <Section title="Thông tin bác sĩ chỉ định" icon={Stethoscope}>
            <DetailRow label="Họ và tên" value={sp.doctor.doctorName} />
            <DetailRow label="Học vị" value={sp.doctor.doctorDegree} />
            <DetailRow label="Chuyên khoa" value={sp.doctor.doctorSpecialized} />
            <DetailRow label="Số điện thoại" value={sp.doctor.doctorPhone} />
            <DetailRow label="Email" value={sp.doctor.doctorEmail} />
          </Section>
        ) : null}

        {gt ? (
          <Section title="Thông tin xét nghiệm" icon={FlaskConical}>
            <DetailRow label="Mã xét nghiệm" value={gt.testId} />
            <DetailRow label="Tên xét nghiệm" value={gt.testName} />
            <DetailRow label="Mã code" value={gt.code} />
            <DetailRow label="Giá" value={gt.finalPrice != null ? formatMoneyVnd(gt.finalPrice) : undefined} />
            {gt.testDescription ? <LongText label="Mô tả" text={gt.testDescription} /> : null}
            {gt.testSample && gt.testSample.length > 0 ? (
              <View className="py-2.5">
                <Text className="text-xs text-slate-600 font-semibold mb-2">Loại mẫu hỗ trợ</Text>
                <View className="flex-row flex-wrap gap-2">
                  {gt.testSample.map((sample, idx) => (
                    <View
                      key={`${sample}-${idx}`}
                      className="px-3 py-1 rounded-full bg-sky-100 border border-sky-200"
                    >
                      <Text className="text-xs font-semibold text-sky-900">{sample}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </Section>
        ) : null}

        {sp.hospital ? (
          <Section title="Thông tin bệnh viện" icon={Building2}>
            <DetailRow
              label="Mã bệnh viện"
              value={sp.hospital.hospitalId != null ? String(sp.hospital.hospitalId) : undefined}
            />
            <DetailRow label="Tên bệnh viện" value={sp.hospital.hospitalName} />
          </Section>
        ) : null}

        {pc ? (
          <Section title="Thông tin lâm sàng" icon={Heart}>
            <DetailRow label="Chiều cao (cm)" value={pc.patientHeight != null ? String(pc.patientHeight) : undefined} />
            <DetailRow label="Cân nặng (kg)" value={pc.patientWeight != null ? String(pc.patientWeight) : undefined} />
            {pc.patientHistory ? <LongText label="Tiền sử bệnh (bản thân)" text={pc.patientHistory} /> : null}
            {pc.familyHistory ? <LongText label="Tiền sử bệnh (gia đình)" text={pc.familyHistory} /> : null}
            {pc.medicalHistory ? <LongText label="Tiền sử y tế" text={pc.medicalHistory} /> : null}
            {pc.acuteDisease ? <LongText label="Bệnh cấp tính" text={pc.acuteDisease} /> : null}
            {pc.chronicDisease ? <LongText label="Bệnh mãn tính" text={pc.chronicDisease} /> : null}
            {pc.medicalUsing && pc.medicalUsing.length > 0 ? (
              <LongText label="Thuốc đang sử dụng" text={pc.medicalUsing.join(', ')} />
            ) : null}
            {pc.toxicExposure ? <LongText label="Tiếp xúc độc hại" text={pc.toxicExposure} /> : null}
          </Section>
        ) : null}

        {sp.geneticTestResults || sp.geneticTestResultsRelationship ? (
          <Section title="Kết quả xét nghiệm di truyền trước đó" icon={FlaskConical}>
            {sp.geneticTestResults ? (
              <LongText label="Kết quả xét nghiệm di truyền (bản thân)" text={sp.geneticTestResults} />
            ) : null}
            {sp.geneticTestResultsRelationship ? (
              <LongText label="Kết quả xét nghiệm di truyền (người thân)" text={sp.geneticTestResultsRelationship} />
            ) : null}
          </Section>
        ) : null}

        {sp.serviceType === 'reproduction' && rs ? (
          <Section title="Thông tin sinh sản" icon={FlaskConical}>
            <DetailRow label="Số thai" value={rs.fetusesNumber != null ? String(rs.fetusesNumber) : undefined} />
            <DetailRow
              label="Tuần thai / Ngày thai"
              value={
                rs.fetusesWeek != null || rs.fetusesDay != null
                  ? `${rs.fetusesWeek ?? 0} tuần ${rs.fetusesDay ?? 0} ngày`
                  : undefined
              }
            />
            <DetailRow label="Ngày siêu âm" value={rs.ultrasoundDay ? formatDate(rs.ultrasoundDay) : undefined} />
            <DetailRow
              label="Chiều dài đầu mông (CRL)"
              value={rs.headRumpLength != null ? `${rs.headRumpLength} mm` : undefined}
            />
            <DetailRow label="Độ mờ da gáy (NT)" value={rs.neckLength != null ? `${rs.neckLength} mm` : undefined} />
            {rs.combinedTestResult ? <LongText label="Kết quả xét nghiệm kết hợp" text={rs.combinedTestResult} /> : null}
            {rs.ultrasoundResult ? <LongText label="Kết quả siêu âm" text={rs.ultrasoundResult} /> : null}
          </Section>
        ) : null}

        {sp.serviceType === 'embryo' && es ? (
          <Section title="Thông tin phôi thai" icon={FlaskConical}>
            <DetailRow label="Sinh thiết" value={es.biospy} />
            <DetailRow label="Ngày sinh thiết" value={es.biospyDate ? formatDate(es.biospyDate) : undefined} />
            <DetailRow label="Dung dịch chứa tế bào" value={es.cellContainingSolution} />
            <DetailRow label="Số phôi tạo" value={es.embryoCreate != null ? String(es.embryoCreate) : undefined} />
            <DetailRow label="Tình trạng phôi" value={es.embryoStatus} />
            <DetailRow label="Đối chứng âm" value={es.negativeControl} />
            {es.cellNucleus != null ? (
              <DetailRow label="Nhân tế bào" value={es.cellNucleus ? 'Có' : 'Không'} />
            ) : null}
            {es.morphologicalAssessment ? (
              <LongText label="Đánh giá hình thái" text={es.morphologicalAssessment} />
            ) : null}
          </Section>
        ) : null}

        {sp.serviceType === 'disease' && ds ? (
          <Section title="Thông tin bệnh lý" icon={FlaskConical}>
            <DetailRow
              label="Thời gian điều trị"
              value={ds.treatmentTimeDay != null ? `${ds.treatmentTimeDay} ngày` : undefined}
            />
            <DetailRow label="Kháng thuốc" value={ds.drugResistance} />
            {ds.symptom ? <LongText label="Triệu chứng" text={ds.symptom} /> : null}
            {ds.diagnose ? <LongText label="Chẩn đoán" text={ds.diagnose} /> : null}
            {ds.diagnoseImage ? <LongText label="Hình ảnh chẩn đoán" text={ds.diagnoseImage} /> : null}
            {ds.testRelated ? <LongText label="Xét nghiệm liên quan" text={ds.testRelated} /> : null}
            {ds.treatmentMethods ? <LongText label="Phương pháp điều trị" text={ds.treatmentMethods} /> : null}
            {ds.relapse ? <LongText label="Tái phát" text={ds.relapse} /> : null}
          </Section>
        ) : null}
      </ScrollView>

      <View className="bg-white border-t border-sky-100 px-4 py-3 flex-row gap-3">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-2 bg-sky-600 py-3.5 rounded-xl"
          onPress={() =>
            router.push({ pathname: '/customer/specify-edit', params: { specifyId: sp.specifyVoteID } })
          }
        >
          <Pencil size={18} color="#fff" />
          <Text className="text-white font-bold">Cập nhật</Text>
        </TouchableOpacity>
        {canForward ? (
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-2 border border-sky-400 bg-sky-50 py-3.5 rounded-xl"
            onPress={() => setForwardOpen(true)}
          >
            <ArrowRight size={18} color={MEDICAL.primaryDark} />
            <Text className="text-black font-bold">Chuyển tiếp</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ForwardTestModal
        visible={forwardOpen}
        onClose={() => setForwardOpen(false)}
        specifyDataList={[{ specifyVoteID: sp.specifyVoteID, fullSpecifyData: sp }]}
        onSuccess={() => refetch()}
        onNavigateToPayment={(p) => {
          setForwardOpen(false);
          refetch();
          router.push({
            pathname: '/customer/payment',
            params: {
              orderId: p.orderId,
              orderName: p.orderName,
              amount: String(p.amount),
              specifyId: p.specifyId,
              hasFastq: p.hasFastq ? 'true' : 'false',
              ...(p.allOrderIds && { allOrderIds: p.allOrderIds }),
              ...(p.allSpecifyIds && { allSpecifyIds: p.allSpecifyIds }),
              returnPath: p.hasFastq ? '/customer/patient-metadatas' : '/customer/orders',
              cancelPath: '/customer/specifies',
            },
          });
        }}
        onNavigateToOrders={() => router.replace('/customer/orders')}
        onNavigateToPatientMetadatas={() => router.replace('/customer/patient-metadatas')}
      />
    </SafeAreaView>
  );
}
