import React, { forwardRef } from "react";
import { useFormContext, Controller, type FieldError } from "react-hook-form";
import { TextInput, View, Text } from "react-native";

import type { FormInputProps } from "./types";

export const FormInput = forwardRef<TextInput, FormInputProps>(
  (
    {
      name,
      label,
      required,
      helperText,
      icon,
      iconPosition = "left",
      formatter,
      className = "",
      placeholder,
      keyboardType = "default",
      autoCapitalize = "sentences",
      editable = true,
      containerClassName = "",
      containerStyle,
      ...props
    },
    ref
  ) => {
    const { control } = useFormContext();
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
          render={({ field: { onChange, onBlur, value }, fieldState }) => {
            const error = fieldState.error;
            const hasError = !!error;
            const borderColor = hasError ? "border-red-400" : !editable ? "border-slate-100" : "border-slate-200";
            return (
              <>
                <View
                  className={`bg-white rounded-2xl border px-4 py-3.5 flex-row items-center ${borderColor}`}
                >
                  {iconPosition === "left" && iconElement}
                  <TextInput
                    ref={ref}
                    className={`flex-1 text-[14px] font-bold text-slate-800 ${className}`}
                    placeholder={placeholder}
                    placeholderTextColor="#94A3B8"
                    value={value || ""}
                    onChangeText={(text) => {
                      const formatted = formatter ? formatter(text) : text;
                      onChange(formatted);
                    }}
                    onBlur={onBlur}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    editable={editable}
                    {...props}
                  />
                  {iconPosition === "right" && iconElement}
                </View>
                {error && (
                  <Text className="text-[11px] text-red-500 mt-1">
                    {(error as FieldError)?.message?.toString() || "Giá trị không hợp lệ"}
                  </Text>
                )}
                {helperText && !error && (
                  <Text className="mt-2 text-[11px] text-slate-500">{helperText}</Text>
                )}
              </>
            );
          }}
        />
      </View>
    );
  }
);

FormInput.displayName = "FormInput";
