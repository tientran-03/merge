import React from "react";
import { View, useWindowDimensions } from "react-native";

import type { FormFieldGroupProps } from "./types";

export function FormFieldGroup({ children, gap = 12 }: FormFieldGroupProps) {
  const { width } = useWindowDimensions();
  const items = React.Children.toArray(children).filter(
    (c) => c != null && c !== false && c !== true
  );

  if (items.length !== 2) {
    console.warn("FormFieldGroup requires exactly 2 children, got", items.length);
    return <View className="gap-3">{children}</View>;
  }

  const [left, right] = items;

  // On narrow screens, force 1-column layout to avoid extreme text wrapping.
  if (width < 380) {
    return <View className="gap-3">{children}</View>;
  }

  return (
    <View className="flex-row" style={{ gap }}>
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}>{left}</View>
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}>{right}</View>
    </View>
  );
}
