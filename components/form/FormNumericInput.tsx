import React, { forwardRef } from "react";
import { useFormContext, Controller, type FieldError } from "react-hook-form";
import { TextInput, View, Text, TextInputProps } from "react-native";

import type { FormNumericInputProps, NumericFormatterType } from "./types";

const formatters: Record<NumericFormatterType, (value: string) => string> = {
  currency: (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    if (!cleaned) return "";
    const number = parseInt(cleaned, 10);
    return number.toLocaleString("vi-VN");
  },
  phone: (value: string) => {
    return value.replace(/[^0-9]/g, "");
  },
  decimal: (value: string) => {
    const parts = value.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    return value.replace(/[^0-9.]/g, "");
  },
  integer: (value: string) => {
    return value.replace(/[^0-9]/g, "");
  },
};

const getKeyboardsType: Record<NumericFormatterType, TextInputProps["keyboardType"]> = {
  currency: "numeric",
  phone: "phone-pad",
  decimal: "decimal-pad",
  integer: "number-pad",
};

export const FormNumericInput = forwardRef<TextInput, FormNumericInputProps>(
  (
    {
      name,
      type,
      label,
      required,
      helperText,
      icon,
      iconPosition = "left",
      placeholder,
      disabled = false,
      containerClassName = "",
      containerStyle,
    },
    ref
  ) => {
    const { control, formState: { errors } } = useFormContext();
    const error = errors[name];

    const formatter = formatters[type];
    const keyboardType = getKeyboardsType[type];

    const hasError = !!error;
    const borderColor = hasError ? "border-red-400" : "border-slate-200";
    const iconElement = icon && <View className="mr-3">{icon}</View>;

    return (
      <View className={`mb-4 ${containerClassName}`} style={containerStyle}>
        {label && (
          <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
            {label} {required ? <Text className="text-red-500">*</Text> : null}
          </Text>
        )}
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, onBlur, value } }) => (
            <View
              className={`bg-white rounded-2xl border px-4 py-3.5 flex-row items-center ${borderColor}`}
            >
              {iconPosition === "left" && iconElement}
              <TextInput
                ref={ref}
                className="flex-1 text-[14px] font-bold text-slate-800"
                placeholder={placeholder || "Nhập giá trị"}
                placeholderTextColor="#94A3B8"
                value={value || ""}
                onChangeText={(text) => {
                  const formatted = formatter ? formatter(text) : text;
                  onChange(formatted);
                }}
                onBlur={onBlur}
                keyboardType={keyboardType}
                editable={!disabled}
              />
              {iconPosition === "right" && iconElement}
            </View>
          )}
        />
        {error && (
          <Text className="text-[11px] text-red-500 mt-1">
            {(error as FieldError)?.message?.toString() || "Giá trị không hợp lệ"}
          </Text>
        )}
        {helperText && !error && (
          <Text className="mt-2 text-[11px] text-slate-500">{helperText}</Text>
        )}
      </View>
    );
  }
);

FormNumericInput.displayName = "FormNumericInput";
