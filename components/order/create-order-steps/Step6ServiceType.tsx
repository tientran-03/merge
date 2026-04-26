import React from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { ActivityIndicator, Switch, Text, TouchableOpacity, View } from 'react-native';

import { FormDatePicker, FormFieldGroup, FormInput } from '@/components/form';
import { ServiceType } from '@/lib/schemas/order-form-schema';

interface Step6Props {
  isEditMode?: boolean;
  onManualServiceTypeSet?: () => void;
  onQuickCreateSpecify?: () => Promise<void> | void;
  creatingSpecify?: boolean;
}

const serviceTypeOptions: { value: ServiceType; label: string }[] = [
  { value: ServiceType.REPRODUCTION, label: 'Nhóm sản' },
  { value: ServiceType.EMBRYO, label: 'Nhóm phôi' },
  { value: ServiceType.DISEASE, label: 'Nhóm bệnh lý' },
];

export default function Step6ServiceType({
  isEditMode = false,
  onManualServiceTypeSet,
  onQuickCreateSpecify,
  creatingSpecify = false,
}: Step6Props) {
  const { control } = useFormContext();
  const genomeTestIdValue = useWatch({ control, name: 'genomeTestId' });
  const testNameValue = useWatch({ control, name: 'testName' });
  const testContentValue = useWatch({ control, name: 'testContent' });
  const testSampleValue = useWatch({ control, name: 'testSample' });

  const hasExistingServiceData =
    Boolean(String(genomeTestIdValue || '').trim()) ||
    Boolean(String(testNameValue || '').trim()) ||
    Boolean(String(testContentValue || '').trim()) ||
    Boolean(String(testSampleValue || '').trim());

  const readOnly = Boolean(isEditMode && hasExistingServiceData);
  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Thông tin nhóm xét nghiệm
      </Text>
      {onQuickCreateSpecify ? (
        <TouchableOpacity
          onPress={() => void onQuickCreateSpecify()}
          disabled={creatingSpecify}
          activeOpacity={0.85}
          className={`mb-4 rounded-xl px-3 py-3 items-center justify-center border ${creatingSpecify ? 'bg-slate-100 border-slate-200' : 'bg-cyan-50 border-cyan-200'
            }`}
        >
          {creatingSpecify ? (
            <ActivityIndicator color="#0891b2" />
          ) : (
            <Text className="text-[13px] font-extrabold text-cyan-700">Tạo nhanh phiếu xét nghiệm</Text>
          )}
        </TouchableOpacity>
      ) : null}
      <View className="mb-4">
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2">Loại xét nghiệm</Text>
        <Controller
          control={control}
          name="serviceType"
          render={({ field: { onChange, value } }) => {
            return (
              <>
                <Text className="text-[12px] text-slate-500 mb-3">
                  Chọn một nhóm dịch vụ để hiển thị đúng trường thông tin.
                </Text>
                <View className="flex-row gap-2">
                  {serviceTypeOptions.map(option => {
                    const isSelected = value === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => {
                          if (readOnly) return;
                          onChange(option.value);
                          onManualServiceTypeSet?.();
                        }}
                        disabled={readOnly}
                        activeOpacity={0.85}
                        className={`flex-1 rounded-xl px-3 py-3 border ${isSelected
                          ? 'bg-cyan-50 border-cyan-300'
                          : 'bg-white border-slate-200'
                          } ${readOnly ? 'opacity-60' : ''}`}
                      >
                        <Text
                          className={`text-[13px] font-extrabold text-center ${isSelected ? 'text-cyan-700' : 'text-slate-700'
                            }`}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {value === ServiceType.REPRODUCTION && (
                  <View className="pt-4 border-t border-slate-100 mt-4">
                    <Text className="text-[13px] font-bold text-slate-600 mb-3">
                      Thông tin xét nghiệm sản
                    </Text>

                    <FormFieldGroup>
                      <FormInput
                        name="fetusesWeek"
                        label="Tuần thai"
                        placeholder="0"
                        keyboardType="numeric"
                        formatter={v => v.replace(/\D/g, '')}
                        validateOnChange
                        editable={!readOnly}
                      />
                      <FormInput
                        name="fetusesDay"
                        label="Ngày thai"
                        placeholder="Nhập số"
                        keyboardType="numeric"
                        formatter={v => v.replace(/\D/g, '')}
                        validateOnChange
                        editable={!readOnly}
                      />
                    </FormFieldGroup>

                    <FormFieldGroup>
                      <FormInput
                        name="headRumpLength"
                        label="Chiều dài đầu mông (mm)"
                        placeholder="Nhập chiều cao"
                        keyboardType="numeric"
                        validateOnChange
                        editable={!readOnly}
                      />
                      <FormDatePicker
                        name="ultrasoundDay"
                        label="Ngày siêu âm"
                        placeholder="Chọn ngày"
                        disabled={readOnly}
                      />
                    </FormFieldGroup>

                    <FormFieldGroup>
                      <FormInput
                        name="fetusesNumber"
                        label="Số lượng thai"
                        placeholder="Nhập số lượng thai"
                        keyboardType="numeric"
                        editable={!readOnly}
                      />
                      <FormInput
                        name="neckLength"
                        label="Độ mờ da gáy"
                        placeholder="Nhập độ mờ da gáy"
                        keyboardType="numeric"
                        validateOnChange
                        editable={!readOnly}
                      />
                    </FormFieldGroup>

                    <FormInput
                      name="combinedTestResult"
                      label="Kết quả nguy cơ của combined test"
                      placeholder="Nhập kết quả"
                      editable={!readOnly}
                    />

                    <FormInput
                      name="ultrasoundResult"
                      label="Kết quả siêu âm"
                      placeholder="Nhập kết quả siêu âm"
                      editable={!readOnly}
                    />
                  </View>
                )}

                {value === ServiceType.EMBRYO && (
                  <View className="pt-4 border-t border-slate-100 mt-4">
                    <Text className="text-[13px] font-bold text-slate-600 mb-3">
                      Thông tin xét nghiệm phôi
                    </Text>

                    <FormFieldGroup>
                      <FormInput
                        name="biospy"
                        label="Sinh thiết"
                        placeholder="Nhập thông tin sinh thiết"
                        editable={!readOnly}
                      />
                      <FormDatePicker
                        name="biospyDate"
                        label="Ngày sinh thiết"
                        placeholder="Chọn ngày"
                        disabled={readOnly}
                      />
                    </FormFieldGroup>

                    <FormFieldGroup>
                      <FormInput
                        name="cellContainingSolution"
                        label="Dung dịch chứa tế bào"
                        placeholder="Nhập dung dịch"
                        editable={!readOnly}
                      />
                      <FormInput
                        name="embryoCreate"
                        label="Số phôi tạo"
                        placeholder="Nhập số"
                        keyboardType="numeric"
                        editable={!readOnly}
                      />
                    </FormFieldGroup>

                    <FormFieldGroup>
                      <FormInput
                        name="embryoStatus"
                        label="Trạng thái phôi"
                        placeholder="Nhập trạng thái"
                        editable={!readOnly}
                      />
                      <FormInput
                        name="morphologicalAssessment"
                        label="Đánh giá hình thái"
                        placeholder="Nhập đánh giá"
                        editable={!readOnly}
                      />
                    </FormFieldGroup>

                    <View className="mb-4">
                      <Text className="text-[13px] font-extrabold text-slate-700 mb-2">Nhân tế bào</Text>
                      <Controller
                        control={control}
                        name="cellNucleus"
                        render={({ field: { onChange: onCellNucleusChange, value: cellNucleusValue } }) => (
                          <View className="flex-row items-center bg-white rounded-2xl border border-slate-200 px-4 py-3">
                            <Switch
                              value={cellNucleusValue || false}
                              onValueChange={onCellNucleusChange}
                              disabled={readOnly}
                              trackColor={{ false: '#E2E8F0', true: '#22D3EE' }}
                              thumbColor={cellNucleusValue ? '#fff' : '#fff'}
                            />
                            <Text className="ml-3 text-[14px] font-semibold text-slate-700">
                              {cellNucleusValue ? 'Có' : 'Không'}
                            </Text>
                          </View>
                        )}
                      />
                    </View>

                    <FormInput
                      name="negativeControl"
                      label="Đối chứng âm"
                      placeholder="Nhập đối chứng âm"
                      editable={!readOnly}
                    />
                  </View>
                )}

                {value === ServiceType.DISEASE && (
                  <View className="pt-4 border-t border-slate-100 mt-4">
                    <Text className="text-[13px] font-bold text-slate-600 mb-3">
                      Thông tin xét nghiệm bệnh lý
                    </Text>

                    <FormFieldGroup>
                      <FormInput
                        name="symptom"
                        label="Triệu chứng"
                        placeholder="Nhập triệu chứng"
                        editable={!readOnly}
                      />
                      <FormInput
                        name="diagnose"
                        label="Chẩn đoán"
                        placeholder="Nhập chẩn đoán"
                        editable={!readOnly}
                      />
                    </FormFieldGroup>

                    <FormFieldGroup>
                      <FormInput
                        name="testRelated"
                        label="Xét nghiệm liên quan"
                        placeholder="Nhập xét nghiệm liên quan"
                        editable={!readOnly}
                      />
                      <FormInput
                        name="treatmentMethods"
                        label="Phương pháp điều trị"
                        placeholder="Nhập phương pháp điều trị"
                        editable={!readOnly}
                      />
                    </FormFieldGroup>

                    <FormFieldGroup>
                      <FormInput
                        name="treatmentTimeDay"
                        label="Số ngày điều trị"
                        placeholder="Nhập số ngày"
                        keyboardType="numeric"
                        editable={!readOnly}
                      />
                      <FormInput
                        name="drugResistance"
                        label="Kháng thuốc"
                        placeholder="Nhập thông tin kháng thuốc"
                        editable={!readOnly}
                      />
                    </FormFieldGroup>

                    <FormInput
                      name="relapse"
                      label="Tái phát"
                      placeholder="Nhập thông tin tái phát"
                      editable={!readOnly}
                    />
                  </View>
                )}

                {!value && (
                  <View className="p-4 bg-orange-50 rounded-xl border border-orange-200 mt-4">
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 bg-orange-500 rounded-full mr-2" />
                    </View>
                  </View>
                )}
              </>
            );
          }}
        />
      </View>

      {isEditMode ? (
        readOnly ? (
          <View className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <Text className="text-[11px] text-amber-700 font-medium">
              Đã có dữ liệu xét nghiệm, không cho đổi nhóm dịch vụ.
            </Text>
          </View>
        ) : (
          <View className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <Text className="text-[11px] text-emerald-700 font-medium">
              Chưa có dữ liệu, có thể đổi nhóm dịch vụ.
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}
