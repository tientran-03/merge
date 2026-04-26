import React from "react";
import { View, Text } from "react-native";

import type { FormReadOnlyProps } from "./types";

export function FormReadOnly({
  label,
  value,
  required,
  helperText,
  icon,
  iconPosition = "left",
  placeholder = "-",
  containerClassName = "",
  containerStyle,
}: FormReadOnlyProps) {
  const displayValue = value || placeholder;
  const iconElement = icon && <View className="mr-3">{icon}</View>;

  return (
    <View className={`mb-4 ${containerClassName}`} style={containerStyle}>
      {label && (
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
          {label} {required ? <Text className="text-red-500">*</Text> : null}
        </Text>
      )}
      <View className="bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3.5 flex-row items-center">
        {iconPosition === "left" && iconElement}
        <Text
          className={`flex-1 text-[14px] font-semibold ${
            value ? "text-slate-900" : "text-slate-400"
          }`}
          numberOfLines={1}
        >
          {displayValue}
        </Text>
        {iconPosition === "right" && iconElement}
      </View>
      {helperText && (
        <Text className="mt-2 text-[11px] text-slate-500">{helperText}</Text>
      )}
    </View>
  );
}
