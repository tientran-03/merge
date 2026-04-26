import { ChevronDown, MapPin, X } from 'lucide-react-native';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Controller, useFormContext, type FieldError } from 'react-hook-form';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useSheetBottomInset } from '@/lib/useSheetBottomInset';

import { useDistricts, useProvinces, useWards } from '@/hooks/useAddressQueries';
import {
  buildAddress,
  type VNDistrictAPI,
  type VNProvinceAPI,
  type VNWardAPI,
} from '@/services/addressService';

export interface FormAddressPickerProps {
  name: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  containerClassName?: string;
  hideAddressDetail?: boolean;
}

function removeDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function filterProvincesLocal(provinces: VNProvinceAPI[], keyword: string): VNProvinceAPI[] {
  if (!keyword || keyword.trim() === '') return provinces;
  const normalized = removeDiacritics(keyword.toLowerCase().trim());
  return provinces.filter(p => removeDiacritics(p.name.toLowerCase()).includes(normalized));
}

function filterDistrictsLocal(districts: VNDistrictAPI[], keyword: string): VNDistrictAPI[] {
  if (!keyword || keyword.trim() === '') return districts;
  const normalized = removeDiacritics(keyword.toLowerCase().trim());
  return districts.filter(d => removeDiacritics(d.name.toLowerCase()).includes(normalized));
}

function filterWardsLocal(wards: VNWardAPI[], keyword: string): VNWardAPI[] {
  if (!keyword || keyword.trim() === '') return wards;
  const normalized = removeDiacritics(keyword.toLowerCase().trim());
  return wards.filter(w => removeDiacritics(w.name.toLowerCase()).includes(normalized));
}
function normalizeAddressPart(s: string): string {
  return removeDiacritics(
    s
      .replace(/^TP\.?\s*/i, '')
      .replace(/^Thành phố\s+/i, '')
      .replace(/^Tỉnh\s+/i, '')
      .toLowerCase()
      .trim()
  );
}

function matchProvinceFuzzy(
  provinceStr: string,
  provinces: VNProvinceAPI[]
): VNProvinceAPI | undefined {
  const norm = normalizeAddressPart(provinceStr);
  if (!norm) return undefined;
  return provinces.find(p => {
    const pNorm = normalizeAddressPart(p.name);
    return pNorm === norm || pNorm.includes(norm) || norm.includes(pNorm);
  });
}

function matchDistrictFuzzy(districtStr: string, list: VNDistrictAPI[]): VNDistrictAPI | undefined {
  const norm = normalizeAddressPart(districtStr);
  if (!norm) return undefined;
  return list.find(d => {
    const dNorm = normalizeAddressPart(d.name);
    return dNorm === norm || dNorm.includes(norm) || norm.includes(dNorm);
  });
}

function matchWardFuzzy(wardStr: string, list: VNWardAPI[]): VNWardAPI | undefined {
  const norm = normalizeAddressPart(wardStr);
  if (!norm) return undefined;
  return list.find(w => {
    const wNorm = normalizeAddressPart(w.name);
    return wNorm === norm || wNorm.includes(norm) || norm.includes(wNorm);
  });
}

function HideDetailAddressTextInput({
  value,
  onChangeText,
  disabled,
  borderColor,
}: {
  value: unknown;
  onChangeText: (text: string) => void;
  disabled: boolean;
  borderColor: string;
}) {
  const ref = useRef<TextInput>(null);
  const prevStrRef = useRef('');
  const str = value == null ? '' : String(value);

  useLayoutEffect(() => {
    const prev = prevStrRef.current;
    if (!str.trim()) {
      prevStrRef.current = str;
      return;
    }
    const bulk =
      !prev.trim() ||
      Math.abs(str.length - prev.length) > 1 ||
      (!str.startsWith(prev) && !prev.startsWith(str));
    prevStrRef.current = str;
    if (!bulk) return;
    ref.current?.setNativeProps({ text: str });
  }, [str]);

  return (
    <TextInput
      ref={ref}
      value={str}
      onChangeText={onChangeText}
      placeholder="Phường/xã, Quận/huyện, Tỉnh/thành — chọn ở trên sẽ tự điền; sửa/ghi ở đây sẽ cập nhật ô chọn"
      placeholderTextColor="#94A3B8"
      editable={!disabled}
      multiline
      textAlignVertical="top"
      className={`bg-white rounded-2xl border px-4 py-3.5 text-[14px] text-slate-900 min-h-[88px] mt-1 ${borderColor}`}
    />
  );
}

export function FormAddressPicker({
  name,
  label,
  required,
  placeholder = 'Chọn tỉnh/thành phố, quận/huyện, phường/xã',
  disabled = false,
  containerClassName = '',
  hideAddressDetail = false,
}: FormAddressPickerProps) {
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();
  const sheetBottomInset = useSheetBottomInset();
  const error = errors[name];
  const formValue = watch(name);

  const [selectedProvince, setSelectedProvince] = useState<VNProvinceAPI | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<VNDistrictAPI | null>(null);
  const [selectedWard, setSelectedWard] = useState<VNWardAPI | null>(null);
  const [addressDetail, setAddressDetail] = useState('');

  const { data: provinces = [], isLoading: loadingProvinces } = useProvinces();
  const { data: districts = [], isLoading: loadingDistricts } = useDistricts(
    selectedProvince?.code ?? null
  );
  const { data: wards = [], isLoading: loadingWards } = useWards(selectedDistrict?.code ?? null);
  const [provinceModalVisible, setProvinceModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [wardModalVisible, setWardModalVisible] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');
  const hasInitializedFromValue = useRef(false);
  const lastFormValue = useRef<string | null>(null);
  const pendingAdminParseRef = useRef(false);
  const isBuildingAddress = useRef(false);

  const selectedProvinceRef = useRef(selectedProvince);
  const selectedDistrictRef = useRef(selectedDistrict);
  const selectedWardRef = useRef(selectedWard);
  const addressDetailRef = useRef(addressDetail);
  selectedProvinceRef.current = selectedProvince;
  selectedDistrictRef.current = selectedDistrict;
  selectedWardRef.current = selectedWard;
  addressDetailRef.current = addressDetail;

  useEffect(() => {
    if (hideAddressDetail) setAddressDetail('');
  }, [hideAddressDetail]);

  useEffect(() => {
    const runParse = () => {
      const formValueStr =
        formValue == null || typeof formValue !== 'string' ? '' : formValue.trim();
      if (!formValueStr) {
        hasInitializedFromValue.current = false;
        lastFormValue.current = null;
        pendingAdminParseRef.current = false;
        setSelectedProvince(null);
        setSelectedDistrict(null);
        setSelectedWard(null);
        setAddressDetail('');
        return;
      }

      if (lastFormValue.current !== formValueStr) {
        lastFormValue.current = formValueStr;
        hasInitializedFromValue.current = false;
        pendingAdminParseRef.current = false;
      }
      if (provinces.length === 0) return;
      if (hasInitializedFromValue.current && !pendingAdminParseRef.current) return;

      const parts = formValueStr
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
      if (parts.length === 0) return;

      const provinceStr = parts[parts.length - 1] || '';
      const matchedProvince =
        provinces.find(p => p.name.toLowerCase() === provinceStr.toLowerCase()) ??
        matchProvinceFuzzy(provinceStr, provinces);

      const syncCanonicalHideDetail = (
        ward: VNWardAPI | null | undefined,
        district: VNDistrictAPI | null | undefined,
        province: VNProvinceAPI | null | undefined
      ) => {
        if (!hideAddressDetail || !province) return;
        const canonical = buildAddress(
          '',
          ward?.name ?? '',
          district?.name ?? '',
          province.name
        );
        if (!canonical || canonical === formValueStr) return;
        isBuildingAddress.current = true;
        setValue(name, canonical, { shouldValidate: false });
        lastFormValue.current = canonical;
        queueMicrotask(() => {
          isBuildingAddress.current = false;
        });
      };

      const finishAdminParse = (
        ward: VNWardAPI | null | undefined,
        district: VNDistrictAPI | null | undefined,
        province: VNProvinceAPI,
        detailParts: string[]
      ) => {
        setAddressDetail(detailParts.join(', '));
        pendingAdminParseRef.current = false;
        hasInitializedFromValue.current = true;
        syncCanonicalHideDetail(ward, district, province);
      };

      if (matchedProvince) {
        setSelectedProvince(matchedProvince);
        if (parts.length >= 2 && districts.length > 0) {
          const districtStr = parts[parts.length - 2] || '';
          const matchedDistrict =
            districts.find(d => d.name.toLowerCase() === districtStr.toLowerCase()) ??
            matchDistrictFuzzy(districtStr, districts);
          if (matchedDistrict) {
            setSelectedDistrict(matchedDistrict);
            if (parts.length >= 3) {
              if (wards.length > 0) {
                const wardStr = parts[parts.length - 3] || '';
                const matchedWard =
                  wards.find(w => w.name.toLowerCase() === wardStr.toLowerCase()) ??
                  matchWardFuzzy(wardStr, wards);
                if (matchedWard) setSelectedWard(matchedWard);
                else setSelectedWard(null);
                const detailParts = parts.slice(0, Math.max(parts.length - 3, 0));
                finishAdminParse(matchedWard ?? null, matchedDistrict, matchedProvince, detailParts);
              } else {
                pendingAdminParseRef.current = true;
              }
            } else {
              const detailParts = parts.slice(0, Math.max(parts.length - 2, 0));
              finishAdminParse(null, matchedDistrict, matchedProvince, detailParts);
            }
          } else {
            const detailParts = parts.slice(0, Math.max(parts.length - 2, 0));
            finishAdminParse(null, null, matchedProvince, detailParts);
          }
        } else if (parts.length >= 2 && districts.length === 0) {
          pendingAdminParseRef.current = true;
        } else if (parts.length === 1) {
          setAddressDetail('');
          pendingAdminParseRef.current = false;
          hasInitializedFromValue.current = true;
          syncCanonicalHideDetail(null, null, matchedProvince);
        }
      } else if (parts.length === 1) {
        pendingAdminParseRef.current = false;
        hasInitializedFromValue.current = true;
        setAddressDetail(formValueStr);
      } else {
        pendingAdminParseRef.current = false;
        hasInitializedFromValue.current = true;
        setAddressDetail(formValueStr);
      }
    };

    runParse();
  }, [formValue, provinces, districts, wards, hideAddressDetail, name, setValue]);

  const hasError = !!error;
  const borderColor = hasError
    ? 'border-red-400'
    : disabled
      ? 'border-slate-100'
      : 'border-slate-200';

  const filteredProvinces = React.useMemo(
    () => filterProvincesLocal(provinces, provinceSearch),
    [provinces, provinceSearch]
  );
  const filteredDistricts = React.useMemo(
    () => filterDistrictsLocal(districts, districtSearch),
    [districts, districtSearch]
  );
  const filteredWards = React.useMemo(
    () => filterWardsLocal(wards, wardSearch),
    [wards, wardSearch]
  );

  return (
    <View className={`mb-4 ${containerClassName}`}>
      {label && (
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
          {label} {required ? <Text className="text-red-500">*</Text> : null}
        </Text>
      )}

      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => {
          const detailSegment = (d: string) => (hideAddressDetail ? '' : d);

          const updateAddress = (
            detail: string,
            ward: VNWardAPI | null,
            district: VNDistrictAPI | null,
            province: VNProvinceAPI | null
          ) => {
            isBuildingAddress.current = true;
            const combined = buildAddress(
              detailSegment(detail),
              ward?.name || '',
              district?.name || '',
              province?.name || ''
            );
            onChange(combined);
            queueMicrotask(() => {
              isBuildingAddress.current = false;
            });
          };

          const handleSelectProvince = (p: VNProvinceAPI) => {
            setSelectedProvince(p);
            setSelectedDistrict(null);
            setSelectedWard(null);
            setProvinceModalVisible(false);
            setProvinceSearch('');
            updateAddress(addressDetailRef.current ?? '', null, null, p);
          };

          const handleSelectDistrict = (d: VNDistrictAPI) => {
            setSelectedDistrict(d);
            setSelectedWard(null);
            setDistrictModalVisible(false);
            setDistrictSearch('');
            updateAddress(addressDetailRef.current ?? '', null, d, selectedProvinceRef.current);
          };

          const handleSelectWard = (w: VNWardAPI) => {
            setSelectedWard(w);
            setWardModalVisible(false);
            setWardSearch('');
            updateAddress(
              addressDetailRef.current ?? '',
              w,
              selectedDistrictRef.current,
              selectedProvinceRef.current
            );
          };

          const handleDetailChange = (text: string) => {
            if (hideAddressDetail) return;
            setAddressDetail(text);
            updateAddress(
              text,
              selectedWardRef.current,
              selectedDistrictRef.current,
              selectedProvinceRef.current
            );
          };

          const handleClearProvince = () => {
            setSelectedProvince(null);
            setSelectedDistrict(null);
            setSelectedWard(null);
            setProvinceSearch('');
            setDistrictSearch('');
            setWardSearch('');
            updateAddress(addressDetailRef.current ?? '', null, null, null);
          };

          const handleClearDistrict = () => {
            setSelectedDistrict(null);
            setSelectedWard(null);
            setDistrictSearch('');
            setWardSearch('');
            updateAddress(addressDetailRef.current ?? '', null, null, selectedProvinceRef.current);
          };

          const handleClearWard = () => {
            setSelectedWard(null);
            setWardSearch('');
            updateAddress(
              addressDetailRef.current ?? '',
              null,
              selectedDistrictRef.current,
              selectedProvinceRef.current
            );
          };

          return (
            <View>
              <TouchableOpacity
                activeOpacity={disabled ? 1 : 0.75}
                onPress={() => !disabled && setProvinceModalVisible(true)}
                className={`bg-white rounded-2xl border px-4 py-3.5 flex-row items-center mb-3 ${borderColor}`}
              >
                <MapPin size={18} color="#0284C7" />
                <Text
                  className={`flex-1 ml-3 text-[14px] font-semibold ${!selectedProvince ? 'text-slate-400' : 'text-slate-900'
                    }`}
                  numberOfLines={1}
                >
                  {selectedProvince?.name || 'Chọn tỉnh/thành phố'}
                </Text>
                {selectedProvince && (
                  <TouchableOpacity
                    onPress={e => {
                      e.stopPropagation();
                      handleClearProvince();
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={18} color="#64748B" />
                  </TouchableOpacity>
                )}
                {!selectedProvince && <ChevronDown size={18} color="#94A3B8" />}
              </TouchableOpacity>

              {selectedProvince && (
                <TouchableOpacity
                  activeOpacity={disabled ? 1 : 0.75}
                  onPress={() => !disabled && setDistrictModalVisible(true)}
                  className={`bg-white rounded-2xl border px-4 py-3.5 flex-row items-center mb-3 ${borderColor}`}
                >
                  <MapPin size={18} color="#0284C7" />
                  <Text
                    className={`flex-1 ml-3 text-[14px] font-semibold ${!selectedDistrict ? 'text-slate-400' : 'text-slate-900'
                      }`}
                    numberOfLines={1}
                  >
                    {loadingDistricts ? 'Đang tải...' : selectedDistrict?.name || 'Chọn quận/huyện'}
                  </Text>
                  {selectedDistrict && (
                    <TouchableOpacity
                      onPress={e => {
                        e.stopPropagation();
                        handleClearDistrict();
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={18} color="#64748B" />
                    </TouchableOpacity>
                  )}
                  {!selectedDistrict && !loadingDistricts && (
                    <ChevronDown size={18} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              )}

              {selectedDistrict && (
                <TouchableOpacity
                  activeOpacity={disabled ? 1 : 0.75}
                  onPress={() => !disabled && setWardModalVisible(true)}
                  className={`bg-white rounded-2xl border px-4 py-3.5 flex-row items-center mb-3 ${borderColor}`}
                >
                  <MapPin size={18} color="#0284C7" />
                  <Text
                    className={`flex-1 ml-3 text-[14px] font-semibold ${!selectedWard ? 'text-slate-400' : 'text-slate-900'
                      }`}
                    numberOfLines={1}
                  >
                    {loadingWards ? 'Đang tải...' : selectedWard?.name || 'Chọn phường/xã'}
                  </Text>
                  {selectedWard && (
                    <TouchableOpacity
                      onPress={e => {
                        e.stopPropagation();
                        handleClearWard();
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={18} color="#64748B" />
                    </TouchableOpacity>
                  )}
                  {!selectedWard && !loadingWards && <ChevronDown size={18} color="#94A3B8" />}
                </TouchableOpacity>
              )}

              {hideAddressDetail && (
                <HideDetailAddressTextInput
                  value={value}
                  onChangeText={text => {
                    lastFormValue.current = null;
                    hasInitializedFromValue.current = false;
                    onChange(text);
                  }}
                  disabled={!!disabled}
                  borderColor={borderColor}
                />
              )}
              {!hideAddressDetail && (
                <TextInput
                  value={addressDetail}
                  onChangeText={handleDetailChange}
                  placeholder="Số nhà, đường, ngõ..."
                  placeholderTextColor="#94A3B8"
                  editable={!disabled}
                  className={`bg-white rounded-2xl border px-4 py-3.5 text-[14px] text-slate-900 ${borderColor}`}
                />
              )}
              <Modal
                visible={provinceModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setProvinceModalVisible(false)}
              >
                <View className="flex-1 bg-black/60 justify-end">
                  <View
                    className="bg-white rounded-t-3xl max-h-[80%]"
                    style={{ paddingBottom: sheetBottomInset }}
                  >
                    <View className="px-5 pt-4 pb-3 border-b border-slate-200 flex-row items-center justify-between">
                      <Text className="text-[15px] font-extrabold text-slate-700">
                        Chọn tỉnh/thành phố
                      </Text>
                      <TouchableOpacity
                        onPress={() => setProvinceModalVisible(false)}
                        className="w-10 h-10 rounded-2xl bg-slate-100 items-center justify-center"
                      >
                        <X size={20} color="#334155" />
                      </TouchableOpacity>
                    </View>
                    <View className="px-4 py-3 border-b border-slate-100">
                      <TextInput
                        placeholder="Tìm tỉnh/thành phố..."
                        placeholderTextColor="#94A3B8"
                        value={provinceSearch}
                        onChangeText={setProvinceSearch}
                        className="bg-slate-100 rounded-xl px-4 py-3 text-[14px] text-slate-900"
                      />
                    </View>
                    <ScrollView className="max-h-96" keyboardShouldPersistTaps="handled">
                      {loadingProvinces ? (
                        <View className="py-12 items-center">
                          <ActivityIndicator size="small" color="#0284C7" />
                          <Text className="mt-2 text-slate-500">Đang tải...</Text>
                        </View>
                      ) : filteredProvinces.length === 0 ? (
                        <View className="py-12 items-center">
                          <Text className="text-slate-500">Không tìm thấy</Text>
                        </View>
                      ) : (
                        filteredProvinces.map(p => (
                          <TouchableOpacity
                            key={p.code}
                            onPress={() => handleSelectProvince(p)}
                            className="px-5 py-3.5 border-b border-slate-50"
                            activeOpacity={0.75}
                          >
                            <Text className="text-[14px] font-medium text-slate-900">{p.name}</Text>
                            <Text className="text-[12px] text-slate-500 mt-0.5">
                              {p.division_type}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <Modal
                visible={districtModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setDistrictModalVisible(false)}
              >
                <View className="flex-1 bg-black/60 justify-end">
                  <View
                    className="bg-white rounded-t-3xl max-h-[80%]"
                    style={{ paddingBottom: sheetBottomInset }}
                  >
                    <View className="px-5 pt-4 pb-3 border-b border-slate-200 flex-row items-center justify-between">
                      <Text className="text-[15px] font-extrabold text-slate-700">
                        Chọn quận/huyện
                      </Text>
                      <TouchableOpacity
                        onPress={() => setDistrictModalVisible(false)}
                        className="w-10 h-10 rounded-2xl bg-slate-100 items-center justify-center"
                      >
                        <X size={20} color="#334155" />
                      </TouchableOpacity>
                    </View>
                    <View className="px-4 py-3 border-b border-slate-100">
                      <TextInput
                        placeholder="Tìm quận/huyện..."
                        placeholderTextColor="#94A3B8"
                        value={districtSearch}
                        onChangeText={setDistrictSearch}
                        className="bg-slate-100 rounded-xl px-4 py-3 text-[14px] text-slate-900"
                      />
                    </View>
                    <ScrollView className="max-h-96" keyboardShouldPersistTaps="handled">
                      {loadingDistricts ? (
                        <View className="py-12 items-center">
                          <ActivityIndicator size="small" color="#0284C7" />
                          <Text className="mt-2 text-slate-500">Đang tải...</Text>
                        </View>
                      ) : filteredDistricts.length === 0 ? (
                        <View className="py-12 items-center">
                          <Text className="text-slate-500">
                            {districts.length === 0 ? 'Đang tải quận/huyện...' : 'Không tìm thấy'}
                          </Text>
                        </View>
                      ) : (
                        filteredDistricts.map(d => (
                          <TouchableOpacity
                            key={d.code}
                            onPress={() => handleSelectDistrict(d)}
                            className="px-5 py-3.5 border-b border-slate-50"
                            activeOpacity={0.75}
                          >
                            <Text className="text-[14px] font-medium text-slate-900">{d.name}</Text>
                            <Text className="text-[12px] text-slate-500 mt-0.5">
                              {d.division_type}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <Modal
                visible={wardModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setWardModalVisible(false)}
              >
                <View className="flex-1 bg-black/60 justify-end">
                  <View
                    className="bg-white rounded-t-3xl max-h-[80%]"
                    style={{ paddingBottom: sheetBottomInset }}
                  >
                    <View className="px-5 pt-4 pb-3 border-b border-slate-200 flex-row items-center justify-between">
                      <Text className="text-[15px] font-extrabold text-slate-700">
                        Chọn phường/xã
                      </Text>
                      <TouchableOpacity
                        onPress={() => setWardModalVisible(false)}
                        className="w-10 h-10 rounded-2xl bg-slate-100 items-center justify-center"
                      >
                        <X size={20} color="#334155" />
                      </TouchableOpacity>
                    </View>
                    <View className="px-4 py-3 border-b border-slate-100">
                      <TextInput
                        placeholder="Tìm phường/xã..."
                        placeholderTextColor="#94A3B8"
                        value={wardSearch}
                        onChangeText={setWardSearch}
                        className="bg-slate-100 rounded-xl px-4 py-3 text-[14px] text-slate-900"
                      />
                    </View>
                    <ScrollView className="max-h-96" keyboardShouldPersistTaps="handled">
                      {filteredWards.length === 0 ? (
                        <View className="py-12 items-center">
                          <Text className="text-slate-500">
                            {wards.length === 0 ? 'Đang tải phường/xã...' : 'Không tìm thấy'}
                          </Text>
                        </View>
                      ) : (
                        filteredWards.map(w => (
                          <TouchableOpacity
                            key={w.code}
                            onPress={() => handleSelectWard(w)}
                            className="px-5 py-3.5 border-b border-slate-50"
                            activeOpacity={0.75}
                          >
                            <Text className="text-[14px] font-medium text-slate-900">{w.name}</Text>
                            <Text className="text-[12px] text-slate-500 mt-0.5">
                              {w.division_type}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            </View>
          );
        }}
      />

      {error && (
        <Text className="text-[11px] text-red-500 mt-1">
          {(error as FieldError)?.message?.toString() || 'Vui lòng nhập địa chỉ'}
        </Text>
      )}
    </View>
  );
}
