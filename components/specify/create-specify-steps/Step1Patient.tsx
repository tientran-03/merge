import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  FormAddressPicker,
  FormDatePicker,
  FormInput,
  FormSelect,
  FormTextarea,
} from '@/components/form';
import { normalizeVnMobileDigits } from '@/lib/schemas/patient-field-rules';
import type { SpecifyFormData } from '@/lib/schemas/specify-form-schema';
import {
  sanitizePatientNameInput,
  stripDiacriticsForEmail,
} from '@/lib/specify-patient-input-formatters';
import { getApiResponseData } from '@/lib/types/api-types';
import { patientService, type PatientResponse } from '@/services/patientService';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_LENGTH = 2;
const EMPTY_PATIENTS: PatientResponse[] = [];

const genderOptions = [
  { value: 'male' as const, label: 'Nam' },
  { value: 'female' as const, label: 'Nữ' },
];

function normalizePhoneDigits(phone?: string | null): string {
  return normalizeVnMobileDigits(phone || '');
}

function phoneSuffixForDisplay(stored: string): string {
  const s = normalizeVnMobileDigits(stored);
  if (s.startsWith('0') && s.length >= 2) return s.slice(1);
  return s.replace(/\D/g, '').replace(/^0/, '');
}
function storedFromSuffixInput(suffix: string): string {
  const rawDigits = suffix.replace(/\D/g, '');
  // User may type "0xx..." after +84; trim one leading 0 to keep canonical VN format.
  const digits = rawDigits.startsWith('0') ? rawDigits.slice(1) : rawDigits;
  const d = digits.slice(0, 9);
  if (!d) return '';
  return `0${d}`;
}

type PatientLike = PatientResponse & Record<string, unknown>;

function resolvePatientId(p: PatientResponse): string {
  const any = p as PatientLike;
  const raw =
    any.patientId ??
    any.patient_id ??
    any.id ??
    (typeof any.uuid === 'string' ? any.uuid : undefined) ??
    any.patientCode ??
    any.patient_code;
  return raw != null && raw !== '' ? String(raw).trim() : '';
}

function resolvePatientPhoneDigits(p: PatientResponse): string {
  const any = p as PatientLike;
  const raw =
    p.patientPhone ??
    (typeof any.phone === 'string' ? any.phone : undefined) ??
    (typeof any.patient_phone === 'string' ? any.patient_phone : undefined);
  return normalizeVnMobileDigits(raw || '');
}

interface Step1PatientProps {
  currentPatient?: (Omit<PatientResponse, 'gender'> & { gender?: string }) | null;
  onPatientSelect?: (patientId: string) => void | Promise<void>;
}

export default function Step1Patient({ currentPatient, onPatientSelect }: Step1PatientProps) {
  const {
    control,
    watch,
    setValue,
    getValues,
    setError,
    clearErrors,
    trigger,
    formState: { errors },
  } = useFormContext<SpecifyFormData>();

  const patientPhone = watch('patientPhone', '');
  const patientEmailWatch = watch('patientEmail', '');
  const selectedPatientId = watch('selectedPatientId', '');
  const isNewPatient = useWatch({ control, name: 'isNewPatient', defaultValue: true });

  const [emailDuplicateMsg, setEmailDuplicateMsg] = useState<string | null>(null);

  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const searchTerm = normalizePhoneDigits(typeof patientPhone === 'string' ? patientPhone : String(patientPhone ?? ''));

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const EMAIL_DEBOUNCE_MS = 450;
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      const email = String(patientEmailWatch || '').trim();
      if (!email) {
        setEmailDuplicateMsg(null);
        return;
      }
      const okFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!okFormat) {
        setEmailDuplicateMsg(null);
        return;
      }
      void (async () => {
        try {
          const res = await patientService.getByEmail(email);
          if (cancelled) return;
          if (res.success && res.data) {
            const foundId = resolvePatientId(res.data as PatientResponse);
            const sel = String(selectedPatientId || '').trim();
            if (foundId && sel && foundId === sel) {
              setEmailDuplicateMsg(null);
              return;
            }
            if (foundId) {
              setEmailDuplicateMsg('Email đã được sử dụng trong hệ thống');
              return;
            }
          }
          setEmailDuplicateMsg(null);
        } catch {
          if (!cancelled) setEmailDuplicateMsg(null);
        }
      })();
    }, EMAIL_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [patientEmailWatch, selectedPatientId]);

  const { data: searchResponse, isLoading: isSearching } = useQuery({
    queryKey: ['patients', 'search', debouncedSearch],
    queryFn: () => patientService.search(debouncedSearch),
    enabled: debouncedSearch.length >= MIN_SEARCH_LENGTH,
    staleTime: 30000,
  });

  const rawResults = getApiResponseData<PatientResponse>(searchResponse);
  const searchResults = !rawResults || rawResults.length === 0 ? EMPTY_PATIENTS : rawResults;

  const displayPatients = React.useMemo(() => {
    if (!currentPatient) return searchResults;
    const currId = resolvePatientId(currentPatient as PatientResponse);
    if (!currId) return searchResults;
    const hasCurrent = searchResults.some(p => resolvePatientId(p) === currId);
    if (hasCurrent) return searchResults;
    return [currentPatient as PatientResponse, ...searchResults];
  }, [searchResults, currentPatient]);
  const prevDigitsRef = useRef<string | null>(null);

  const fillPatientInfo = (patient: PatientResponse) => {
    const id = resolvePatientId(patient);
    const phoneDigits = normalizeVnMobileDigits(resolvePatientPhoneDigits(patient));

    setValue('isNewPatient', false);
    setValue('selectedPatientId', id);

    setValue('patientName', sanitizePatientNameInput(patient.patientName || ''));
    setValue('patientPhone', phoneDigits);
    setValue('patientDob', patient.patientDob || '');
    const g = (patient.gender || '').toLowerCase();
    if (g === 'male' || g === 'female') {
      setValue('patientGender', g);
    } else {
      setValue('patientGender', undefined);
    }
    setValue('patientEmail', stripDiacriticsForEmail(patient.patientEmail || ''));
    setValue('patientJob', patient.patientJob || '');
    setValue('patientContactName', patient.patientContactName || '');
    setValue(
      'patientContactPhone',
      patient.patientContactPhone ? normalizeVnMobileDigits(patient.patientContactPhone) : ''
    );
    const pAny = patient as unknown as Record<string, unknown>;
    const addr =
      patient.patientAddress ||
      (typeof pAny.patient_address === 'string' ? pAny.patient_address : '') ||
      '';
    setValue('patientAddress', addr);
    setEmailDuplicateMsg(null);
    void trigger([
      'patientPhone',
      'patientName',
      'patientGender',
      'patientEmail',
      'patientContactName',
      'patientContactPhone',
    ]);
  };

  const clearPatientInfo = () => {
    setValue('isNewPatient', true);
    setValue('selectedPatientId', '');

    setValue('patientName', '');
    setValue('patientDob', '');
    setValue('patientGender', undefined);
    setValue('patientEmail', '');
    setValue('patientJob', '');
    setValue('patientContactName', '');
    setValue('patientContactPhone', '');
    setValue('patientAddress', '');
    setEmailDuplicateMsg(null);
  };

  useEffect(() => {
    if (selectedPatientId) return;

    if (prevDigitsRef.current === null) {
      prevDigitsRef.current = searchTerm;
      return;
    }

    if (!searchTerm) {
      if (prevDigitsRef.current !== '') {
        prevDigitsRef.current = '';
        clearPatientInfo();
      }
      return;
    }

    const exactMatch = displayPatients.find(p => resolvePatientPhoneDigits(p) === searchTerm);

    if (exactMatch) {
      const v = getValues();
      const treatAsNew = v.isNewPatient !== false;
      const hasAnyPatientDetail =
        !!String(v.patientName ?? '').trim() ||
        !!String(v.patientAddress ?? '').trim() ||
        !!String(v.patientDob ?? '').trim() ||
        !!String(v.patientEmail ?? '').trim() ||
        v.patientGender != null;
      const skipAutoLink =
        treatAsNew && !String(v.selectedPatientId ?? '').trim() && hasAnyPatientDetail;

      prevDigitsRef.current = searchTerm;
      if (!skipAutoLink) {
        fillPatientInfo(exactMatch);
        setShowDropdown(false);
        void onPatientSelect?.(resolvePatientId(exactMatch));
      }
      return;
    }

    if (prevDigitsRef.current !== searchTerm) {
      prevDigitsRef.current = searchTerm;
      clearPatientInfo();
    }
  }, [searchTerm, displayPatients, selectedPatientId, getValues]);

  const handlePhoneChange = (value: string) => {
    const normalized = normalizeVnMobileDigits(value);

    setValue('patientPhone', normalized);
    setValue('isNewPatient', true);
    setValue('selectedPatientId', '');
    setValue('patientAddress', '');

    setShowDropdown(true);
    void trigger('patientPhone');
  };

  const handleSelectPatient = async (patient: PatientResponse) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    fillPatientInfo(patient);
    setShowDropdown(false);
    Keyboard.dismiss();
    await onPatientSelect?.(resolvePatientId(patient));
  };

  const handleAddNew = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    clearPatientInfo();
    setShowDropdown(false);
    Keyboard.dismiss();
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => setShowDropdown(false), 300);
  };

  const handleFocus = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setShowDropdown(true);
  };

  const showSearchHint =
    showDropdown && searchTerm.length < MIN_SEARCH_LENGTH && searchTerm.length > 0;

  const showSearching = showDropdown && debouncedSearch.length >= MIN_SEARCH_LENGTH && isSearching;

  const showResults = showDropdown && debouncedSearch.length >= MIN_SEARCH_LENGTH && !isSearching;

  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">Thông tin bệnh nhân</Text>

      <View className="mb-4">
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
          Số điện thoại <Text className="text-red-500">*</Text>
        </Text>

        <Controller
          control={control}
          name="patientPhone"
          render={({ field: { onChange, value } }) => (
            <View>
              <View
                className={`bg-white rounded-2xl border flex-row items-center overflow-hidden ${errors.patientPhone ? 'border-red-400' : 'border-slate-200'
                  }`}
              >
                <Text className="pl-4 pr-1 text-[14px] font-bold text-slate-600">+84</Text>
                <TextInput
                  value={phoneSuffixForDisplay(String(value || ''))}
                  onChangeText={v => {
                    const rawDigits = v.replace(/\D/g, '');
                    if (rawDigits.startsWith('0')) {
                      setError('patientPhone', {
                        type: 'manual',
                        message: 'Sau +84 không nhập số 0 đầu. Ví dụ: +84 339258608',
                      });
                      return;
                    }
                    clearErrors('patientPhone');
                    const stored = storedFromSuffixInput(rawDigits);
                    onChange(stored);
                    handlePhoneChange(stored);
                  }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="912345678"
                  keyboardType="phone-pad"
                  maxLength={9}
                  className="flex-1 py-3.5 pr-4 text-[14px] font-bold text-slate-800"
                />
              </View>
              {errors.patientPhone?.message ? (
                <Text className="text-[11px] text-red-500 mt-1">
                  {String(errors.patientPhone.message)}
                </Text>
              ) : (
                <Text className="text-[11px] text-slate-500 mt-1">
                  Nhập 9 số sau +84 (đủ 10 số trong nước, đầu số di động 3/5/7/8/9). VD: +84 912345678.
                </Text>
              )}

              {showDropdown && (
                <View
                  className="mt-2 rounded-2xl border border-slate-200 bg-white overflow-hidden"
                  style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
                >
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {showSearchHint && (
                      <Text className="p-3 text-slate-500">Nhập thêm số để tìm</Text>
                    )}

                    {showSearching && (
                      <View className="p-4 items-center">
                        <ActivityIndicator />
                      </View>
                    )}

                    {showResults &&
                      displayPatients.map(patient => (
                        <TouchableOpacity
                          key={resolvePatientId(patient)}
                          onPress={() => handleSelectPatient(patient)}
                          className="p-3 border-b"
                        >
                          <Text>{patient.patientName}</Text>
                          <Text>{patient.patientPhone}</Text>
                        </TouchableOpacity>
                      ))}

                    {showResults && (
                      <TouchableOpacity onPress={handleAddNew} className="p-3 bg-sky-50">
                        <Text>+ Thêm bệnh nhân mới</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        />
      </View>

      <FormInput
        name="patientName"
        label="Họ tên"
        required
        placeholder="Nhập họ và tên (có thể dùng dấu . — không nhập số)"
        formatter={sanitizePatientNameInput}
        validateOnChange
      />
      <FormDatePicker
        name="patientDob"
        label="Ngày sinh"
        maximumDate={new Date()}
        validateOnChange
      />
      <FormSelect
        name="patientGender"
        label="Giới tính"
        required
        options={genderOptions}
        getLabel={o => o.label}
        getValue={o => o.value}
        placeholder="Chọn Nam hoặc Nữ"
        validateOnChange
      />
      <View className="mb-4">
        <FormInput
          name="patientEmail"
          label="Email"
          placeholder="Nhập email liên hệ (ví dụ: ten@gmail.com)"
          keyboardType="email-address"
          autoCapitalize="none"
          formatter={stripDiacriticsForEmail}
          validateOnChange
        />
        {emailDuplicateMsg && !errors.patientEmail?.message ? (
          <Text className="text-[11px] text-red-500 mt-1">Email đã được sử dụng trong hệ thống</Text>
        ) : null}
      </View>

      <FormInput name="patientJob" label="Nghề nghiệp" placeholder="Nhập nghề nghiệp (tùy chọn)" />

      <FormInput
        name="patientContactName"
        label="Người liên hệ"
        required
        placeholder="Nhập tên người liên hệ"
        validateOnChange
      />

      <View className="mb-4">
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
          Số điện thoại liên hệ
        </Text>
        <Controller
          control={control}
          name="patientContactPhone"
          render={({ field: { onChange, value } }) => (
            <View
              className={`bg-white rounded-2xl border flex-row items-center overflow-hidden ${
                errors.patientContactPhone ? 'border-red-400' : 'border-slate-200'
              }`}
            >
              <Text className="pl-4 pr-1 text-[14px] font-bold text-slate-600">+84</Text>
              <TextInput
                value={phoneSuffixForDisplay(String(value || ''))}
                onChangeText={v => {
                  const digits = v.replace(/\D/g, '');
                  if (digits.startsWith('0')) {
                    setError('patientContactPhone', {
                      type: 'manual',
                      message: 'Sau +84 không nhập số 0 đầu',
                    });
                    return;
                  }
                  clearErrors('patientContactPhone');
                  onChange(storedFromSuffixInput(digits));
                  void trigger('patientContactPhone');
                }}
                placeholder="(tùy chọn)"
                keyboardType="phone-pad"
                maxLength={9}
                className="flex-1 py-3.5 pr-4 text-[14px] font-bold text-slate-800"
              />
            </View>
          )}
        />
        {errors.patientContactPhone?.message ? (
          <Text className="text-[11px] text-red-500 mt-1">
            {String(errors.patientContactPhone.message)}
          </Text>
        ) : (
          <Text className="text-[11px] text-slate-500 mt-1">
            Để trống hoặc nhập 9 số sau +84, không nhập số 0 đầu.
          </Text>
        )}
      </View>

      {isNewPatient === false ? (
        <FormTextarea
          key={`addr-text-${selectedPatientId || 'existing'}`}
          name="patientAddress"
          label="Địa chỉ"
          required
          minHeight={96}
        />
      ) : (
        <FormAddressPicker
          key={`picker-new-${patientPhone || '0'}`}
          name="patientAddress"
          label="Địa chỉ"
          required
        />
      )}
    </View>
  );
}
