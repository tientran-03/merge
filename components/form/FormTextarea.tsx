import React, { forwardRef } from "react";
import { useFormContext, Controller, type FieldError } from "react-hook-form";
import { Text, TextInput, View } from "react-native";

import type { FormTextareaProps } from "./types";

export const FormTextarea = forwardRef<TextInput, FormTextareaProps>(
  (
    {
      name,
      label,
      required,
      helperText,
      placeholder,
      minHeight = 80,
      maxLength,
      disabled = false,
      autoCapitalize = "sentences",
      validateOnChange,
      containerClassName = "",
      containerStyle,
    },
    ref
  ) => {
    const { control, formState: { errors }, trigger } = useFormContext();
    const error = errors[name];

    const hasError = !!error;
    const borderColor = hasError ? "border-red-400" : "border-slate-200";
    const textStyle = minHeight ? { minHeight } : undefined;

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
            <>
              <View
                className={`bg-white rounded-2xl border px-4 py-3.5 ${borderColor}`}
              >
                <TextInput
                  ref={ref}
                  className="text-[14px] font-bold text-slate-800"
                  style={textStyle}
                  placeholder={placeholder || "Nhập nội dung"}
                  placeholderTextColor="#94A3B8"
                  value={value || ""}
                  onChangeText={(t) => {
                    onChange(t);
                    if (validateOnChange) void trigger(name);
                  }}
                  onBlur={onBlur}
                  multiline
                  editable={!disabled}
                  maxLength={maxLength}
                  autoCapitalize={autoCapitalize}
                  textAlignVertical="top"
                />
              </View>
              {maxLength && (
                <Text className="text-[10px] text-slate-400 mt-1 text-right">
                  {value?.length || 0}/{maxLength}
                </Text>
              )}
            </>
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

FormTextarea.displayName = "FormTextarea";
