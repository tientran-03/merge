import React, { useMemo } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Switch, Text, View } from "react-native";

import { FormDatePicker, FormFieldGroup, FormInput, FormSelect, FormTextarea } from "@/components/form";
import { ServiceType } from "@/lib/schemas/order-form-schema";
import { FETUS_NUMBER_OPTIONS } from "@/lib/schemas/order-schemas";
import type { SpecifyFormData } from "@/lib/schemas/specify-form-schema";
import type { ServiceEntityResponse } from "@/services/serviceEntityService";

function deriveTypeFromService(svc: { name?: string } | null): string | undefined {
  if (!svc) return undefined;
  const name = (svc.name || "").toLowerCase();
  if (name.includes("sinh sản") || name.includes("reproduction")) return "reproduction";
  if (name.includes("phôi") || name.includes("embryo")) return "embryo";
  if (name.includes("bệnh lý") || name.includes("disease")) return "disease";
  return undefined;
}

interface Step5ServiceTypeProps {
  services?: ServiceEntityResponse[];
}

function Step5ServiceTypeInner({ services = [] }: Step5ServiceTypeProps) {
  const { watch, control } = useFormContext<SpecifyFormData>();
  const serviceId = watch("serviceId");
  const formServiceType = watch("serviceType");
  const derivedType = useMemo(
    () =>
      serviceId && services.length
        ? deriveTypeFromService(services.find((s) => s.serviceId === serviceId) ?? null)
        : undefined,
    [serviceId, services]
  );
  const serviceType = derivedType ?? formServiceType;

  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Thông tin nhóm xét nghiệm
      </Text>

      {serviceType === ServiceType.REPRODUCTION && (
        <>
          <FormSelect
            name="fetusesNumber"
            label="Số thai"
            options={FETUS_NUMBER_OPTIONS}
            getLabel={(o) => o.label}
            getValue={(o) => o.value}
            placeholder="Chọn số thai"
            modalTitle="Chọn số thai"
            validateOnChange
          />
          <FormFieldGroup>
            <FormInput
              name="fetusesWeek"
              label="Tuần thai"
              placeholder="0–40"
              keyboardType="numeric"
              helperText="Từ 0 đến 40 tuần"
              formatter={(t) => t.replace(/\D/g, "")}
              validateOnChange
            />
            <FormInput
              name="fetusesDay"
              label="Ngày thai"
              placeholder="0–30"
              keyboardType="numeric"
              helperText="Từ 0 đến 30 ngày"
              formatter={(t) => t.replace(/\D/g, "")}
              validateOnChange
            />
          </FormFieldGroup>
          <FormDatePicker
            name="ultrasoundDay"
            label="Ngày siêu âm"
            placeholder="Chọn ngày"
          />
          <View className="mb-4 flex-row gap-3">
            <View className="min-w-0 flex-1">
              <FormInput
                name="headRumpLength"
                label="CRL (mm)"
                placeholder="Nhập CRL"
                keyboardType="decimal-pad"
                helperText="Chiều dài đầu mông · 0–100 mm"
                formatter={(t) => t.replace(/[^\d.,]/g, "").replace(",", ".")}
                validateOnChange
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
            <View className="min-w-0 flex-1">
              <FormInput
                name="neckLength"
                label="NT (mm)"
                placeholder="Nhập NT"
                keyboardType="decimal-pad"
                helperText="Độ mờ da gáy · 0–5 mm"
                formatter={(t) => t.replace(/[^\d.,]/g, "").replace(",", ".")}
                validateOnChange
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
          </View>
          <FormTextarea
            name="combinedTestResult"
            label="Kết quả combined test"
            placeholder="Mô tả kết quả combined test"
            minHeight={80}
            validateOnChange
          />
          <FormTextarea
            name="ultrasoundResult"
            label="Kết quả siêu âm"
            placeholder="Mô tả kết quả siêu âm"
            minHeight={80}
            validateOnChange
          />
        </>
      )}

      {serviceType === ServiceType.EMBRYO && (
        <>
          <FormFieldGroup>
            <FormInput name="biospy" label="Sinh thiết" placeholder="Loại sinh thiết" validateOnChange />
            <FormDatePicker name="biospyDate" label="Ngày sinh thiết" placeholder="Chọn ngày" validateOnChange />
          </FormFieldGroup>
          <FormFieldGroup>
            <FormInput
              name="cellContainingSolution"
              label="Dung dịch chứa tế bào"
              placeholder="Loại dung dịch"
              validateOnChange
            />
            <FormInput
              name="embryoCreate"
              label="Số phôi tạo"
              placeholder="Nhập số"
              keyboardType="numeric"
              formatter={(t) => t.replace(/\D/g, "")}
              validateOnChange
            />
          </FormFieldGroup>
          <FormInput name="embryoStatus" label="Tình trạng phôi" placeholder="Mô tả tình trạng phôi" validateOnChange />
          <FormTextarea
            name="morphologicalAssessment"
            label="Đánh giá hình thái"
            placeholder="Mô tả đánh giá hình thái"
            minHeight={80}
            validateOnChange
          />
          <View className="mb-4 flex-row items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
            <Text className="text-[13px] font-extrabold text-slate-700 flex-1 pr-3">Có nhân tế bào</Text>
            <Controller
              control={control}
              name="cellNucleus"
              render={({ field: { value, onChange } }) => (
                <Switch value={!!value} onValueChange={onChange} />
              )}
            />
          </View>
          <FormInput
            name="negativeControl"
            label="Đối chứng âm"
            placeholder="Thông tin đối chứng âm"
            validateOnChange
          />
        </>
      )}

      {serviceType === ServiceType.DISEASE && (
        <>
          <FormTextarea name="symptom" label="Triệu chứng" placeholder="Mô tả triệu chứng" minHeight={80} validateOnChange />
          <FormTextarea name="diagnose" label="Chẩn đoán" placeholder="Mô tả chẩn đoán" minHeight={80} validateOnChange />
          <FormInput
            name="diagnoseImage"
            label="Hình ảnh chẩn đoán (URL)"
            placeholder="URL hình ảnh chẩn đoán"
            validateOnChange
          />
          <FormTextarea
            name="testRelated"
            label="Xét nghiệm liên quan"
            placeholder="Mô tả xét nghiệm liên quan"
            minHeight={80}
            validateOnChange
          />
          <FormTextarea
            name="treatmentMethods"
            label="Phương pháp điều trị"
            placeholder="Mô tả phương pháp điều trị"
            minHeight={80}
            validateOnChange
          />
          <FormInput
            name="treatmentTimeDay"
            label="Thời gian điều trị (ngày)"
            placeholder="Số ngày"
            keyboardType="numeric"
            formatter={(t) => t.replace(/\D/g, "")}
            validateOnChange
          />
          <FormTextarea
            name="drugResistance"
            label="Kháng thuốc"
            placeholder="Mô tả tình trạng kháng thuốc"
            minHeight={80}
            validateOnChange
          />
          <FormTextarea
            name="relapse"
            label="Tái phát"
            placeholder="Mô tả tình trạng tái phát"
            minHeight={80}
            validateOnChange
          />
        </>
      )}

      {!serviceType && (
        <Text className="text-sm text-slate-500">
          Chọn loại dịch vụ ở bước trước để hiển thị thông tin chi tiết
        </Text>
      )}
    </View>
  );
}

export default Step5ServiceTypeInner;
