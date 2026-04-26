import React, { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { Text, View } from 'react-native';

import { FormDatePicker, FormInput, FormSelect } from '@/components/form';
import { getServiceEntityLabelVi } from '@/lib/service-entity-display';
import { ServiceType } from '@/lib/schemas/order-form-schema';
import { EMBRYO_NUMBER_OPTIONS } from '@/lib/schemas/order-schemas';
import type { SpecifyFormData } from '@/lib/schemas/specify-form-schema';
import type { DoctorResponse } from '@/services/doctorService';
import type { GenomeTestResponse } from '@/services/genomeTestService';
import type { HospitalResponse } from '@/services/hospitalService';
import type { ServiceEntityResponse } from '@/services/serviceEntityService';

interface Step3ServiceTestProps {
  services: ServiceEntityResponse[];
  genomeTests: GenomeTestResponse[];
  doctors: DoctorResponse[];
  hospitals?: HospitalResponse[];
  isCurrentUserDoctor?: boolean;
}

export default function Step3ServiceTest({
  services,
  genomeTests,
  doctors,
  hospitals = [],
  isCurrentUserDoctor = false,
}: Step3ServiceTestProps) {
  const { watch, setValue } = useFormContext<SpecifyFormData>();
  const serviceId = watch('serviceId');
  const serviceType = watch('serviceType');
  const doctorId = watch('doctorId');
  const hospitalId = watch('hospitalId');
  const genomeTestId = watch('genomeTestId');
  const selectedGenomeTest = genomeTests.find(g => g.testId === genomeTestId);

  const selectedDoctor = doctors.find(d => d.doctorId === doctorId);
  const hospitalNameFromDoctor = selectedDoctor?.hospitalName;
  const hospId = selectedDoctor?.hospitalId ?? hospitalId;
  const hospitalFromList = hospId
    ? hospitals.find(h => String(h.hospitalId) === String(hospId))
    : null;
  const hospitalName = hospitalNameFromDoctor || hospitalFromList?.hospitalName || null;
  useEffect(() => {
    if (!doctorId || !doctors.length) return;
    const doc = doctors.find(d => d.doctorId === doctorId);
    if (doc?.hospitalId && String(hospitalId) !== String(doc.hospitalId)) {
      setValue('hospitalId', doc.hospitalId);
    }
  }, [doctorId, doctors, hospitalId, setValue]);

  const deriveServiceType = (
    svc: { name?: string; serviceId?: string } | null
  ): ServiceType | undefined => {
    if (!svc) return undefined;
    const name = (svc.name || '').toLowerCase();
    if (name.includes('sinh sản') || name.includes('reproduction'))
      return ServiceType.REPRODUCTION;

    if (name.includes('phôi') || name.includes('embryo'))
      return ServiceType.EMBRYO;

    if (name.includes('bệnh lý') || name.includes('disease'))
      return ServiceType.DISEASE;
    return undefined;
  };

  useEffect(() => {
    if (!serviceId || !services.length) return;
    const svc = services.find(s => s.serviceId === serviceId);
    const derived = deriveServiceType(svc ?? null);
    if (derived && serviceType !== derived) {
      setValue('serviceType', derived);
    }
  }, [serviceId, services, serviceType, setValue]);

  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Loại dịch vụ và xét nghiệm
      </Text>

      <FormSelect
        name="serviceId"
        label="Loại dịch vụ"
        required
        options={services}
        getLabel={s => getServiceEntityLabelVi(s)}
        getValue={s => s.serviceId}
        placeholder="Chọn loại dịch vụ"
        modalTitle="Chọn loại dịch vụ"
        searchable
        onValueChange={(_val, item) => {
          const derived = item && deriveServiceType(item);
          if (derived) setValue('serviceType', derived);
        }}
      />

      <FormSelect
        name="genomeTestId"
        label="Xét nghiệm"
        required
        options={genomeTests}
        getLabel={g => `${g.testId} — ${g.testName || ''}`}
        getValue={g => g.testId}
        placeholder="Chọn xét nghiệm"
        modalTitle="Chọn xét nghiệm"
        searchable
      />

      {selectedGenomeTest ? (
        <View className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <Text className="text-[12px] font-bold text-slate-500 mb-1">Tên xét nghiệm</Text>
          <Text className="text-[14px] text-slate-800 mb-2">{selectedGenomeTest.testName || '—'}</Text>
          {selectedGenomeTest.testDescription ? (
            <>
              <Text className="text-[12px] font-bold text-slate-500 mb-1">Mô tả</Text>
              <Text className="text-[13px] text-slate-700 mb-2">{selectedGenomeTest.testDescription}</Text>
            </>
          ) : null}
          {Array.isArray(selectedGenomeTest.testSample) && selectedGenomeTest.testSample.length > 0 ? (
            <>
              <Text className="text-[12px] font-bold text-slate-500 mb-1">Mẫu xét nghiệm</Text>
              <Text className="text-[13px] text-slate-700">
                {selectedGenomeTest.testSample.join(', ')}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      {isCurrentUserDoctor && doctors.length === 1 ? (
        <View className="mb-4">
          <Text className="text-[13px] font-extrabold text-slate-700 mb-2">Bác sĩ chỉ định</Text>
          <Text className="text-[14px] text-slate-600">
            {doctors[0]?.doctorName || 'Chưa có thông tin'}
          </Text>
        </View>
      ) : (
        <FormSelect
          name="doctorId"
          label="Bác sĩ chỉ định"
          options={doctors}
          getLabel={d => d.doctorName || d.doctorId}
          getValue={d => d.doctorId}
          placeholder="Chọn bác sĩ"
          modalTitle="Chọn bác sĩ"
          searchable
        />
      )}

      {(doctorId || hospitalId) && (
        <View className="mb-4">
          <Text className="text-[13px] font-extrabold text-slate-700 mb-2">Phòng khám</Text>
          <Text className="text-[14px] text-slate-600">{hospitalName || 'Chưa có thông tin'}</Text>
        </View>
      )}

      <FormInput name="samplingSite" label="Nơi lấy mẫu" placeholder="Nhập nơi lấy mẫu" />

      <FormDatePicker name="sampleCollectDate" label="Ngày lấy mẫu" placeholder="Chọn ngày" />

      <FormSelect
        name="embryoNumber"
        label="Số phôi"
        options={EMBRYO_NUMBER_OPTIONS}
        getLabel={o => o.label}
        getValue={o => o.value}
        placeholder="Chọn số phôi"
        modalTitle="Chọn số phôi"
      />
    </View>
  );
}
