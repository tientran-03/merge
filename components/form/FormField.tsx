import React from "react";
import { View, Text, ViewStyle } from "react-native";

import type { BaseFieldProps } from "./types";

export interface FormFieldProps extends BaseFieldProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function FormField({
  label,
  required,
  error,
  helperText,
  children,
  style,
  containerClassName = "",
  containerStyle,
}: FormFieldProps) {
  return (
    <View className={`mb-4 ${containerClassName}`} style={containerStyle || style}>
      {label && (
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
          {label} {required ? <Text className="text-red-500">*</Text> : null}
        </Text>
      )}
      {children}
      {error && (
        <Text className="text-[11px] text-red-500 mt-1">{error}</Text>
      )}
      {helperText && !error && (
        <Text className="mt-2 text-[11px] text-slate-500">{helperText}</Text>
      )}
    </View>
  );
}
