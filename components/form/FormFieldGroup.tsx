import React from "react";
import { View } from "react-native";

import type { FormFieldGroupProps } from "./types";

export function FormFieldGroup({ children, gap = 12 }: FormFieldGroupProps) {
  if (!children || children.length !== 2) {
    console.warn("FormFieldGroup requires exactly 2 children");
    return <>{children}</>;
  }

  const [left, right] = children;

  return (
    <View className="flex-row gap-3">
      <View className="flex-1">{left}</View>
      <View className="flex-1">{right}</View>
    </View>
  );
}
