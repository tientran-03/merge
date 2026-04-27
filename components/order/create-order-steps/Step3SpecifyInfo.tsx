import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { ActivityIndicator, Dimensions, Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  FormAddressPicker,
  FormDatePicker,
  FormFieldGroup,
  FormInput,
  FormReadOnly,
  FormSelect,
} from '@/components/form';
import { EMBRYO_NUMBER_OPTIONS } from '@/lib/schemas/order-schemas';
import { normalizeVnMobileDigits } from '@/lib/schemas/patient-field-rules';
import type { GenomeTestResponse } from '@/services/genomeTestService';
import { patientService, type PatientResponse } from '@/services/patientService';
import type { SpecifyVoteTestResponse } from '@/services/specifyVoteTestService';

interface Step3Props {
  specifyList: SpecifyVoteTestResponse[];
  genomeTests: GenomeTestResponse[];
  isEditMode?: boolean;
}

const genderOptions = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
];
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_LENGTH = 2;

function phoneSuffixForDisplay(stored: string): string {
  const s = normalizeVnMobileDigits(stored || '');
  if (s.startsWith('0') && s.length >= 2) return s.slice(1);
  return s.replace(/\D/g, '').replace(/^0/, '');
}
function storedFromSuffixInput(suffix: string): string {
  const rawDigits = String(suffix || '').replace(/\D/g, '');
  const digits = rawDigits.startsWith('0') ? rawDigits.slice(1) : rawDigits;
  const d = digits.slice(0, 9);
  if (!d) return '';
  return `0${d}`;
}

export default function Step3SpecifyInfo({
  specifyList,
  genomeTests,
  isEditMode = false,
}: Step3Props) {
  const { watch, setValue, control } = useFormContext();
  const specifyId = watch('specifyId');
  const patientPhone = watch('patientPhone');
  const patientName = watch('patientName');
  const patientDob = watch('patientDob');
  const patientGender = watch('patientGender');
  const patientEmail = watch('patientEmail');
  const patientJob = watch('patientJob');
  const patientContactName = watch('patientContactName');
  const patientContactPhone = watch('patientContactPhone');
  const patientAddress = watch('patientAddress');
  const serviceType = watch('serviceType');
  const genomeTestId = watch('genomeTestId');
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [debouncedPhoneSearch, setDebouncedPhoneSearch] = useState('');
  const phoneBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPhoneDigitsRef = useRef<string | null>(null);

  const lockMapRef = useRef<{
    specifyId: boolean;
    patientPhone: boolean;
    patientName: boolean;
    patientDob: boolean;
    patientGender: boolean;
    patientEmail: boolean;
    patientJob: boolean;
    patientContactName: boolean;
    patientContactPhone: boolean;
    patientAddress: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isEditMode || lockMapRef.current) return;
    lockMapRef.current = {
      specifyId: Boolean(String(specifyId || '').trim()),
      patientPhone: Boolean(String(patientPhone || '').trim()),
      patientName: Boolean(String(patientName || '').trim()),
      patientDob: Boolean(String(patientDob || '').trim()),
      patientGender: Boolean(String(patientGender || '').trim()),
      patientEmail: Boolean(String(patientEmail || '').trim()),
      patientJob: Boolean(String(patientJob || '').trim()),
      patientContactName: Boolean(String(patientContactName || '').trim()),
      patientContactPhone: Boolean(String(patientContactPhone || '').trim()),
      patientAddress: Boolean(String(patientAddress || '').trim()),
    };
  }, [
    isEditMode,
    specifyId,
    patientPhone,
    patientName,
    patientDob,
    patientGender,
    patientEmail,
    patientJob,
    patientContactName,
    patientContactPhone,
    patientAddress,
  ]);

  const canEdit = (field: keyof NonNullable<typeof lockMapRef.current>) =>
    !isEditMode || !lockMapRef.current?.[field];
  const allowEdit = !isEditMode;
  const patientPhoneSearchTerm = useMemo(
    () => normalizeVnMobileDigits(String(patientPhone || '')),
    [patientPhone]
  );
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPhoneSearch(patientPhoneSearchTerm), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [patientPhoneSearchTerm]);

  const { data: patientSearchResponse, isLoading: isSearchingPatients } = useQuery({
    queryKey: ['patients', 'search', debouncedPhoneSearch, 'create-order'],
    queryFn: () => patientService.search(debouncedPhoneSearch),
    enabled: canEdit('patientPhone') && debouncedPhoneSearch.length >= MIN_SEARCH_LENGTH,
    staleTime: 30000,
  });
  const patientSearchResults = useMemo(() => {
    return (patientSearchResponse as any)?.success
      ? ((((patientSearchResponse as any).data as PatientResponse[]) || []).filter(Boolean))
      : [];
  }, [patientSearchResponse]);

  const fillPatientInfo = (p: PatientResponse) => {
    const phone = normalizeVnMobileDigits(String(p.patientPhone || ''));
    setValue('selectedPatientId', String((p as any).patientId || ''));
    setValue('patientPhone', phone);
    setValue('patientName', String(p.patientName || ''));
    setValue('patientDob', p.patientDob ? String(p.patientDob).split('T')[0] : '');
    setValue('patientGender', String(p.gender || '') as any);
    setValue('patientEmail', String(p.patientEmail || ''));
    setValue('patientJob', String(p.patientJob || ''));
    setValue('patientContactName', String(p.patientContactName || ''));
    setValue('patientContactPhone', String(p.patientContactPhone || ''));
    setValue('patientAddress', String(p.patientAddress || ''));
  };

  useEffect(() => {
    if (!canEdit('patientPhone')) return;
    if (prevPhoneDigitsRef.current === null) {
      prevPhoneDigitsRef.current = patientPhoneSearchTerm;
      return;
    }
    if (!patientPhoneSearchTerm || patientPhoneSearchTerm.length < MIN_SEARCH_LENGTH) return;

    const exactMatch = patientSearchResults.find(p => {
      const digits = normalizeVnMobileDigits(String(p.patientPhone || ''));
      return digits === patientPhoneSearchTerm;
    });
    if (!exactMatch) {
      prevPhoneDigitsRef.current = patientPhoneSearchTerm;
      return;
    }

    const selectedId = String((exactMatch as any).patientId || '');
    const currentSelectedId = String(watch('selectedPatientId') || '');
    if (currentSelectedId === selectedId && prevPhoneDigitsRef.current === patientPhoneSearchTerm) return;

    prevPhoneDigitsRef.current = patientPhoneSearchTerm;
    fillPatientInfo(exactMatch);
    setShowPhoneDropdown(false);
  }, [patientPhoneSearchTerm, patientSearchResults, setValue]);

  const normalizeServiceType = (raw?: string | null): 'embryo' | 'disease' | 'reproduction' | '' => {
    const v = String(raw || '').trim().toLowerCase();
    if (!v) return '';
    if (v === 'embryo' || v.includes('phôi') || v.includes('phoi') || v.includes('embryo')) return 'embryo';
    if (v === 'disease' || v.includes('bệnh') || v.includes('benh') || v.includes('disease')) return 'disease';
    return 'reproduction';
  };

  const filteredGenomeTests = useMemo(() => {
    const selectedType = normalizeServiceType(serviceType);
    if (!selectedType) return genomeTests;
    return genomeTests.filter(t => {
      const serviceName = (t as any)?.service?.name || (t as any)?.serviceName || '';
      return normalizeServiceType(serviceName) === selectedType;
    });
  }, [genomeTests, serviceType]);

  const _handleSpecifyChange = (newSpecifyId: string) => {
    if (!newSpecifyId) return;

    const selectedSpecify = specifyList.find(s => s.specifyVoteID === newSpecifyId);
    if (!selectedSpecify) return;

    const patient = selectedSpecify.patient;
    if (patient) {
      setValue('patientPhone', patient.patientPhone || '');
      setValue('patientName', patient.patientName || '');
      setValue('patientDob', patient.patientDob ? String(patient.patientDob).split('T')[0] : '');
      setValue('patientGender', patient.gender || '');
      setValue('patientEmail', patient.patientEmail || '');
      setValue('patientJob', patient.patientJob || '');
      setValue('patientContactName', patient.patientContactName || '');
      setValue('patientContactPhone', patient.patientContactPhone || '');
      setValue('patientAddress', patient.patientAddress || '');
    }

    if (selectedSpecify.genomeTest) {
      setValue('genomeTestId', selectedSpecify.genomeTestId || '');
      setValue('testName', selectedSpecify.genomeTest.testName || '');
      setValue('testContent', selectedSpecify.genomeTest.testDescription || '');
      setValue('testSample', selectedSpecify.genomeTest.testSample?.join(', ') || '');
    }

    setValue('samplingSite', selectedSpecify.samplingSite || '');
    setValue(
      'sampleCollectDate',
      selectedSpecify.sampleCollectDate
        ? new Date(selectedSpecify.sampleCollectDate).toISOString().slice(0, 16)
        : ''
    );
    setValue('embryoNumber', selectedSpecify.embryoNumber?.toString() || '');

    setValue('geneticTestResults', selectedSpecify.geneticTestResults || '');
    setValue(
      'geneticTestResultsRelationship',
      selectedSpecify.geneticTestResultsRelationship || ''
    );
  };
  const clearGenomeTestSelection = () => {
    setValue('genomeTestId', '');
    setValue('testName', '');
    setValue('testContent', '');
    setValue('testSample', '');
  };
  useEffect(() => {
    if (specifyId) _handleSpecifyChange(specifyId);
  }, [specifyId]);

  useEffect(() => {
    const currentId = String(genomeTestId || '').trim();
    if (!currentId) return;
    // When a specify is already linked (including quick-create), keep selected test id
    // even if filtered options have not finished syncing yet.
    if (String(specifyId || '').trim()) return;
    if (!filteredGenomeTests.length) return;
    const stillValid = filteredGenomeTests.some(t => String(t.testId) === currentId);
    if (stillValid) return;
    setValue('genomeTestId', '');
    setValue('testName', '');
    setValue('testContent', '');
    setValue('testSample', '');
  }, [filteredGenomeTests, genomeTestId, setValue, specifyId]);

  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Thông tin phiếu xét nghiệm
      </Text>

      <FormSelect
        name="specifyId"
        label="Mã phiếu xét nghiệm"
        options={specifyList}
        getLabel={s => s.specifyVoteID}
        getValue={s => s.specifyVoteID}
        placeholder="Lựa chọn phiếu"
        modalTitle="Chọn phiếu xét nghiệm"
        searchable
        onValueChange={(val: string | number | boolean) => _handleSpecifyChange(String(val || ''))}
        disabled={!canEdit('specifyId')}
      />
      <Text className="mt-2 text-[11px] font-semibold text-slate-500 leading-4">
        Chỉ hiển thị các mã phiếu chưa được gắn vào đơn hàng khác
      </Text>
      <View className="mt-4 pt-4 border-t border-slate-100">
        <Text className="text-[13px] font-bold text-slate-600 mb-3">
          Thông tin người làm xét nghiệm
        </Text>

        <FormFieldGroup>
          <View>
            <Text className="text-[13px] font-extrabold text-slate-700 mb-2">Số điện thoại</Text>
            <Controller
              control={control as any}
              name="patientPhone"
              render={({ field: { onChange, value } }) => (
                <View>
                  <View className="bg-white rounded-2xl border border-slate-200 flex-row items-center overflow-hidden">
                    <Text className="pl-4 pr-1 text-[14px] font-bold text-slate-600">+84</Text>
                    <TextInput
                      value={phoneSuffixForDisplay(String(value || ''))}
                      onChangeText={(v) => {
                        const stored = storedFromSuffixInput(v);
                        onChange(stored);
                        setValue('selectedPatientId', '');
                        setShowPhoneDropdown(true);
                      }}
                      onFocus={() => {
                        if (phoneBlurTimerRef.current) clearTimeout(phoneBlurTimerRef.current);
                        setShowPhoneDropdown(true);
                      }}
                      onBlur={() => {
                        phoneBlurTimerRef.current = setTimeout(() => setShowPhoneDropdown(false), 300);
                      }}
                      editable={canEdit('patientPhone')}
                      placeholder="912345678"
                      keyboardType="phone-pad"
                      maxLength={9}
                      className="flex-1 py-3.5 pr-4 text-[14px] font-bold text-slate-800"
                    />
                  </View>
                  {showPhoneDropdown ? (
                    <View
                      className="mt-2 rounded-2xl border border-slate-200 bg-white overflow-hidden"
                      style={{ maxHeight: SCREEN_HEIGHT * 0.45 }}
                    >
                      <ScrollView keyboardShouldPersistTaps="handled">
                        {patientPhoneSearchTerm.length < MIN_SEARCH_LENGTH && patientPhoneSearchTerm.length > 0 ? (
                          <Text className="p-3 text-slate-500">Nhập thêm số để tìm bệnh nhân</Text>
                        ) : null}
                        {isSearchingPatients ? (
                          <View className="p-4 items-center">
                            <ActivityIndicator />
                          </View>
                        ) : null}
                        {patientPhoneSearchTerm.length >= MIN_SEARCH_LENGTH && !isSearchingPatients
                          ? patientSearchResults.map((p: any) => (
                            <TouchableOpacity
                              key={String(p.patientId || p.id || p.patientPhone)}
                              onPress={() => {
                                if (phoneBlurTimerRef.current) clearTimeout(phoneBlurTimerRef.current);
                                fillPatientInfo(p);
                                setShowPhoneDropdown(false);
                                Keyboard.dismiss();
                              }}
                              className="p-3 border-b border-slate-100"
                            >
                              <Text className="font-semibold text-slate-800">{String(p.patientName || '—')}</Text>
                              <Text className="text-xs text-slate-500">{String(p.patientPhone || '')}</Text>
                            </TouchableOpacity>
                          ))
                          : null}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>
              )}
            />
          </View>
          <FormInput
            name="patientName"
            label="Họ tên"
            placeholder="Nhập họ và tên"
            editable={canEdit('patientName')}
          />
        </FormFieldGroup>

        <FormFieldGroup>
          <FormDatePicker
            name="patientDob"
            label="Ngày sinh"
            placeholder="Chọn ngày sinh"
            maximumDate={new Date()}
            disabled={!canEdit('patientDob')}
          />
          <FormSelect
            name="patientGender"
            label="Giới tính"
            options={genderOptions}
            getLabel={o => o.label}
            getValue={o => o.value}
            placeholder="Chọn"
            modalTitle="Chọn giới tính"
            disabled={!canEdit('patientGender')}
          />
        </FormFieldGroup>

        <FormInput
          name="patientEmail"
          label="Email"
          placeholder="Nhập email"
          keyboardType="email-address"
          editable={canEdit('patientEmail')}
        />

        <FormInput
          name="patientJob"
          label="Nghề nghiệp"
          placeholder="Nhập nghề nghiệp"
          editable={canEdit('patientJob')}
        />

        <FormFieldGroup>
          <FormInput
            name="patientContactName"
            label="Người liên hệ"
            placeholder="Nhập người liên hệ"
            editable={canEdit('patientContactName')}
          />
          <FormInput
            name="patientContactPhone"
            label="SĐT người liên hệ"
            placeholder="Nhập số điện thoại"
            keyboardType="phone-pad"
            editable={canEdit('patientContactPhone')}
            formatter={(v) => v.replace(/\D/g, "")}
          />
        </FormFieldGroup>

        <FormAddressPicker
          name="patientAddress"
          label="Địa chỉ"
          placeholder="Chọn tỉnh/thành phố, phường/xã"
          disabled={!canEdit('patientAddress')}
        />
      </View>

      <View className="mt-4 pt-4 border-t border-slate-100">
        <Text className="text-[13px] font-bold text-slate-600 mb-3">Thông tin xét nghiệm</Text>

        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <FormSelect
              name="genomeTestId"
              label="Mã xét nghiệm"
              options={filteredGenomeTests}
              getLabel={t => `${t.testId} - ${t.testName}`}
              getValue={t => t.testId}
              placeholder="Lựa chọn"
              modalTitle={
                filteredGenomeTests.length > 0
                  ? `Chọn xét nghiệm (${filteredGenomeTests.length} mục)`
                  : 'Không có xét nghiệm phù hợp với nhóm đã chọn'
              }
              searchable
              disabled={isEditMode && !canEdit('specifyId')}
            />
          </View>
          <TouchableOpacity
            onPress={clearGenomeTestSelection}
            disabled={String(genomeTestId || '').trim().length === 0 || (isEditMode && !canEdit('specifyId'))}
            activeOpacity={0.8}
            className={`mb-1 h-11 w-11 rounded-xl border items-center justify-center ${String(genomeTestId || '').trim().length === 0 || (isEditMode && !canEdit('specifyId'))
                ? 'border-slate-200 bg-slate-100'
                : 'border-rose-200 bg-rose-50'
              }`}
          >
            <Text
              className={`text-[18px] font-extrabold ${String(genomeTestId || '').trim().length === 0 || (isEditMode && !canEdit('specifyId'))
                  ? 'text-slate-400'
                  : 'text-rose-600'
                }`}
            >
              ×
            </Text>
          </TouchableOpacity>
        </View>
        {String(serviceType || '').trim() ? null : (
          <Text className="mt-2 text-[11px] font-semibold text-amber-700">
            Vui lòng chọn nhóm xét nghiệm ở bước 3 để lọc đúng mã xét nghiệm.
          </Text>
        )}

        <FormInput
          name="testName"
          label="Tên xét nghiệm"
          placeholder="Nhập tên xét nghiệm"
          editable={allowEdit}
        />

        <FormReadOnly
          label="Mẫu xét nghiệm"
          value={watch('testSample')}
          placeholder="Chưa có thông tin"
        />

        <FormInput
          name="testContent"
          label="Nội dung xét nghiệm"
          placeholder="Nhập nội dung"
          editable={allowEdit}
        />

        <FormInput
          name="samplingSite"
          label="Địa điểm thu mẫu"
          placeholder="Nhập địa điểm"
          editable={allowEdit}
        />

        <FormFieldGroup>
          <FormDatePicker
            name="sampleCollectDate"
            label="Ngày thu mẫu"
            placeholder="Chọn ngày"
            disabled={!allowEdit}
          />
          <FormSelect
            name="embryoNumber"
            label="Số lượng phôi"
            options={EMBRYO_NUMBER_OPTIONS}
            getLabel={o => o.label}
            getValue={o => o.value}
            placeholder="Chọn số phôi"
            modalTitle="Chọn số phôi"
            disabled={!allowEdit}
          />
        </FormFieldGroup>
      </View>
    </View>
  );
}
