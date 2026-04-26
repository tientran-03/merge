import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { View, Text, TouchableOpacity, Switch } from 'react-native';

import { FormInput, FormFieldGroup, FormDatePicker } from '@/components/form';
import { ServiceType } from '@/lib/schemas/order-form-schema';

interface Step6Props {
  isEditMode?: boolean;
  onManualServiceTypeSet?: () => void;
}

const serviceTypeOptions: { value: ServiceType; label: string }[] = [
  { value: ServiceType.REPRODUCTION, label: 'Nhóm sản' },
  { value: ServiceType.EMBRYO, label: 'Nhóm phôi' },
  { value: ServiceType.DISEASE, label: 'Nhóm bệnh lý' },
];

export default function Step6ServiceType({ isEditMode = false, onManualServiceTypeSet }: Step6Props) {
  const { control } = useFormContext();
  const readOnly = isEditMode;

  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Thông tin nhóm xét nghiệm
      </Text>
      <View className="mb-4">
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2">Loại xét nghiệm</Text>
        <Controller
          control={control}
          name="serviceType"
          render={({ field: { onChange, value } }) => {
            return (
              <>
                {!value && (
                  <Text className="text-[12px] text-slate-500 mb-3">
                    Vui lòng chọn loại xét nghiệm để tiếp tục
                  </Text>
                )}
                <View className="flex-row gap-2">
                  {serviceTypeOptions.map(option => {
                    const isSelected = value === option.value;
                    
                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => {
                          onChange(option.value);
                          onManualServiceTypeSet?.();
                        }}
                        className={`flex-1 py-3 px-3 rounded-xl border ${
                          isSelected
                            ? 'bg-cyan-50 border-cyan-400'
                            : 'bg-white border-slate-200'
                        } ${!value ? 'border-orange-200 bg-orange-50/30' : ''}`}
                        activeOpacity={readOnly ? 1 : 0.7}
                        disabled={readOnly}
                      >
                        <Text
                          className={`text-center text-[13px] font-bold ${
                            isSelected 
                              ? 'text-cyan-700' 
                              : !value 
                                ? 'text-orange-600' 
                                : 'text-slate-600'
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
                        editable={!readOnly}
                      />
                      <FormInput
                        name="fetusesDay"
                        label="Ngày thai"
                        placeholder="Nhập số"
                        keyboardType="numeric"
                        editable={!readOnly}
                      />
                    </FormFieldGroup>

                    <FormFieldGroup>
                      <FormInput
                        name="headRumpLength"
                        label="Chiều dài đầu mông (mm)"
                        placeholder="Nhập chiều cao"
                        keyboardType="numeric"
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
                      <Text className="text-[13px] text-orange-700 font-medium">
                        Vui lòng chọn loại xét nghiệm ở trên để tiếp tục
                      </Text>
                    </View>
                  </View>
                )}
              </>
            );
          }}
        />
      </View>

      {isEditMode && (
        <View className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <Text className="text-[11px] text-amber-700 font-medium">
            Lưu ý: Thông tin nhóm xét nghiệm chỉ có thể chỉnh sửa trên trang web.
          </Text>
        </View>
      )}
    </View>
  );
}
