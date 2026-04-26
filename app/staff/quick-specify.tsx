import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SelectionModal } from '@/components/modals/SelectionModal';
import { presentFeedbackError } from '@/lib/feedbackModal';
import { getApiResponseData } from '@/lib/types/api-types';
import { doctorService, type DoctorResponse } from '@/services/doctorService';
import { genomeTestService, type GenomeTestResponse } from '@/services/genomeTestService';
import { patientService, type PatientResponse } from '@/services/patientService';
import { serviceService, type ServiceResponse } from '@/services/serviceService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';

function normalizeServiceTypeFromName(name?: string): 'reproduction' | 'embryo' | 'disease' | '' {
  const n = String(name || '')
    .trim()
    .toLowerCase();
  if (!n) return '';
  if (n.includes('phôi') || n.includes('phoi') || n.includes('embryo')) return 'embryo';
  if (n.includes('bệnh') || n.includes('benh') || n.includes('disease')) return 'disease';
  return 'reproduction';
}

function serviceNameVi(name?: string): string {
  const key = normalizeServiceTypeFromName(name);
  if (key === 'reproduction') return 'Nhóm sản';
  if (key === 'embryo') return 'Nhóm phôi';
  if (key === 'disease') return 'Nhóm bệnh lý';
  return String(name || '');
}

export default function QuickSpecifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnPath?: string;
    orderId?: string;
    serviceType?: string;
    genomeTestId?: string;
    doctorId?: string;
  }>();

  const returnPath = String(params.returnPath || '/staff/create-order');
  const initialDoctorId = String(params.doctorId || '');
  const initialServiceType = String(params.serviceType || '').toLowerCase();
  const initialGenomeTestId = String(params.genomeTestId || '');

  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceResponse[]>([]);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [tests, setTests] = useState<GenomeTestResponse[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);

  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  const [doctorId, setDoctorId] = useState(initialDoctorId);
  const [hospitalId, setHospitalId] = useState('');
  const [samplingSite, setSamplingSite] = useState('');
  const [patientId, setPatientId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [genomeTestId, setGenomeTestId] = useState(initialGenomeTestId);
  const [specifyNote, setSpecifyNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [serviceRes, doctorRes] = await Promise.all([serviceService.getAll(), doctorService.getAll()]);
      if (cancelled) return;
      const allServices = getApiResponseData<ServiceResponse>(serviceRes) || [];
      const allDoctors = getApiResponseData<DoctorResponse>(doctorRes) || [];
      setServices(allServices);
      setDoctors(allDoctors);
      if (initialServiceType) {
        const matched = allServices.find(s => normalizeServiceTypeFromName(s.name) === initialServiceType);
        if (matched) setServiceId(String(matched.serviceId));
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialServiceType]);

  useEffect(() => {
    const d = doctors.find(x => String(x.doctorId) === doctorId);
    const hid = String(d?.hospitalId || '');
    setHospitalId(hid);
    setSamplingSite(String(d?.hospitalName || ''));
    setPatientId('');
  }, [doctorId, doctors]);

  useEffect(() => {
    if (!hospitalId) {
      setPatients([]);
      return;
    }
    let cancelled = false;
    setLoadingPatients(true);
    patientService
      .getByHospitalId(hospitalId)
      .then(res => {
        if (!cancelled) setPatients(getApiResponseData<PatientResponse>(res) || []);
      })
      .catch(() => {
        if (!cancelled) setPatients([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPatients(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hospitalId]);

  useEffect(() => {
    if (!serviceId) {
      setTests([]);
      setGenomeTestId('');
      return;
    }
    let cancelled = false;
    setLoadingTests(true);
    genomeTestService
      .getByServiceId(serviceId)
      .then(res => {
        if (!cancelled) setTests(getApiResponseData<GenomeTestResponse>(res) || []);
      })
      .catch(() => {
        if (!cancelled) setTests([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTests(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  const selectedDoctor = useMemo(
    () => doctors.find(d => String(d.doctorId) === doctorId),
    [doctors, doctorId]
  );

  const submit = async () => {
    if (!serviceId) return presentFeedbackError({ title: 'Thiếu thông tin', message: 'Vui lòng chọn dịch vụ.' });
    if (!patientId) return presentFeedbackError({ title: 'Thiếu thông tin', message: 'Vui lòng chọn bệnh nhân.' });
    if (!genomeTestId)
      return presentFeedbackError({ title: 'Thiếu thông tin', message: 'Vui lòng chọn xét nghiệm.' });

    setLoading(true);
    try {
      const created = await specifyVoteTestService.create({
        serviceId,
        patientId,
        genomeTestId,
        hospitalId: hospitalId || undefined,
        doctorId: doctorId || undefined,
        samplingSite: samplingSite.trim() || undefined,
        specifyNote: specifyNote.trim() || undefined,
        sendEmailPatient: false,
      });
      if (!created.success || !created.data?.specifyVoteID) {
        throw new Error(created.error || created.message || 'Không thể tạo phiếu xét nghiệm.');
      }
      await specifyVoteTestService.updateStatus(created.data.specifyVoteID, 'accepted');

      router.push({
        pathname: returnPath as any,
        params: {
          orderId: String(params.orderId || ''),
          initialStep: '4',
          quickSpecifyId: created.data.specifyVoteID,
          quickServiceType: normalizeServiceTypeFromName(
            services.find(s => String(s.serviceId) === serviceId)?.name
          ),
          quickGenomeTestId: genomeTestId,
        },
      });
    } catch (e: any) {
      presentFeedbackError({
        title: 'Tạo nhanh phiếu xét nghiệm thất bại',
        message: e?.message || 'Không thể tạo nhanh phiếu xét nghiệm.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />
      <View className="border-b border-sky-100 bg-white px-4 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            className="mr-3 h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50"
          >
            <ArrowLeft size={20} color="#0284C7" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-slate-900">Tạo nhanh phiếu xét nghiệm</Text>
            <Text className="mt-0.5 text-xs text-slate-500">Nhập nhanh theo đúng luồng web</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View className="rounded-2xl border border-sky-100 bg-white p-4 gap-3">
          <TouchableOpacity
            onPress={() => setShowDoctorModal(true)}
            className="h-14 border border-sky-100 rounded-2xl px-3 py-2 bg-white justify-center"
          >
            <Text className="text-[11px] font-bold text-slate-500">Bác sĩ chỉ định *</Text>
            <Text className="text-[14px] font-semibold text-slate-900" numberOfLines={1}>
              {selectedDoctor?.doctorName || 'Chọn bác sĩ chỉ định'}
            </Text>
          </TouchableOpacity>

          <View className="h-14 border border-slate-200 rounded-2xl px-3 py-2 bg-slate-50 justify-center">
            <Text className="text-[11px] font-bold text-slate-500">Phòng khám / Bệnh viện</Text>
            <Text className="text-[14px] font-semibold text-slate-700" numberOfLines={1}>
              {selectedDoctor?.hospitalName || 'Tự động theo bác sĩ'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() =>
              doctorId
                ? setShowPatientModal(true)
                : presentFeedbackError({ title: 'Thiếu thông tin', message: 'Vui lòng chọn bác sĩ trước.' })
            }
            className={`h-14 border rounded-2xl px-3 py-2 justify-center ${doctorId ? 'border-sky-100 bg-white' : 'border-slate-200 bg-slate-100'}`}
          >
            <Text className="text-[11px] font-bold text-slate-500">Bệnh nhân *</Text>
            <Text className="text-[14px] font-semibold text-slate-900" numberOfLines={1}>
              {patients.find(p => String(p.patientId) === patientId)?.patientName ||
                (doctorId ? (loadingPatients ? 'Đang tải bệnh nhân...' : 'Chọn bệnh nhân') : 'Vui lòng chọn bác sĩ trước')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowServiceModal(true)}
            className="h-14 border border-sky-100 rounded-2xl px-3 py-2 bg-white justify-center"
          >
            <Text className="text-[11px] font-bold text-slate-500">Dịch vụ *</Text>
            <Text className="text-[14px] font-semibold text-slate-900" numberOfLines={1}>
              {serviceNameVi(services.find(s => String(s.serviceId) === serviceId)?.name) || 'Chọn dịch vụ'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              serviceId
                ? setShowTestModal(true)
                : presentFeedbackError({ title: 'Thiếu thông tin', message: 'Vui lòng chọn dịch vụ trước.' })
            }
            className={`h-14 border rounded-2xl px-3 py-2 justify-center ${serviceId ? 'border-sky-100 bg-white' : 'border-slate-200 bg-slate-100'}`}
          >
            <Text className="text-[11px] font-bold text-slate-500">Xét nghiệm *</Text>
            <Text className="text-[14px] font-semibold text-slate-900" numberOfLines={1}>
              {tests.find(t => String(t.testId) === genomeTestId)?.testName ||
                (serviceId ? (loadingTests ? 'Đang tải xét nghiệm...' : 'Chọn xét nghiệm') : 'Vui lòng chọn dịch vụ trước')}
            </Text>
          </TouchableOpacity>

          <TextInput
            value={samplingSite}
            onChangeText={setSamplingSite}
            placeholder="Nơi thu mẫu"
            className="border border-sky-100 rounded-2xl px-3 py-3 bg-white"
          />
          <TextInput
            value={specifyNote}
            onChangeText={setSpecifyNote}
            placeholder="Ghi chú"
            className="border border-sky-100 rounded-2xl px-3 py-3 bg-white"
          />
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-3 border-t border-sky-100 bg-white flex-row gap-2">
        <TouchableOpacity onPress={() => router.back()} className="flex-1 rounded-xl border border-slate-200 py-3 items-center bg-white">
          <Text className="font-bold text-slate-700">Huỷ</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void submit()} disabled={loading} className="flex-1 rounded-xl bg-cyan-600 py-3 items-center">
          {loading ? <ActivityIndicator color="#fff" /> : <Text className="font-extrabold text-white">Tạo phiếu</Text>}
        </TouchableOpacity>
      </View>

      <SelectionModal
        visible={showDoctorModal}
        title="Chọn bác sĩ chỉ định"
        options={doctors.map(d => ({ value: String(d.doctorId), label: `${d.doctorName}${d.hospitalName ? ` - ${d.hospitalName}` : ''}` }))}
        selectedValue={doctorId}
        onSelect={setDoctorId}
        onClose={() => setShowDoctorModal(false)}
      />
      <SelectionModal
        visible={showPatientModal}
        title={loadingPatients ? 'Đang tải bệnh nhân...' : 'Chọn bệnh nhân'}
        options={patients.map(p => ({ value: String(p.patientId), label: `${p.patientName || '-'} - ${p.patientPhone || ''}` }))}
        selectedValue={patientId}
        onSelect={setPatientId}
        onClose={() => setShowPatientModal(false)}
      />
      <SelectionModal
        visible={showServiceModal}
        title="Chọn dịch vụ"
        options={services.map(s => ({ value: String(s.serviceId), label: serviceNameVi(s.name) }))}
        selectedValue={serviceId}
        onSelect={value => {
          setServiceId(value);
          setGenomeTestId('');
        }}
        onClose={() => setShowServiceModal(false)}
      />
      <SelectionModal
        visible={showTestModal}
        title={loadingTests ? 'Đang tải xét nghiệm...' : 'Chọn xét nghiệm'}
        options={tests.map(t => ({ value: String(t.testId), label: `${t.testId} - ${t.testName}` }))}
        selectedValue={genomeTestId}
        onSelect={setGenomeTestId}
        onClose={() => setShowTestModal(false)}
      />
    </SafeAreaView>
  );
}

