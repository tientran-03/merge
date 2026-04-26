import React from "react";
import { View } from "react-native";

import type { FormFieldGroupProps } from "./types";

export function FormFieldGroup({ children, gap = 12 }: FormFieldGroupProps) {
  const items = React.Children.toArray(children).filter(
    (c) => c != null && c !== false && c !== true
  );

  if (items.length !== 2) {
    console.warn("FormFieldGroup requires exactly 2 children, got", items.length);
    return <View className="gap-3">{children}</View>;
  }

  const [left, right] = items;

  return (
    <View className="flex-row" style={{ gap }}>
      <View className="min-w-0 flex-1">{left}</View>
      <View className="min-w-0 flex-1">{right}</View>
    </View>
  );
}
