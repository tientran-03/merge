import { Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";

import type { FormInfoBoxProps, LucideIcon } from "./types";

const variantConfig = {
  info: {
    container: "bg-sky-50 border-sky-200",
    icon: Info,
    iconColor: "#0284C7",
    textColor: "text-slate-700",
  },
  success: {
    container: "bg-green-50 border-green-200",
    icon: CheckCircle,
    iconColor: "#16A34A",
    textColor: "text-slate-700",
  },
  warning: {
    container: "bg-amber-50 border-amber-200",
    icon: AlertTriangle,
    iconColor: "#D97706",
    textColor: "text-slate-700",
  },
  error: {
    container: "bg-red-50 border-red-200",
    icon: XCircle,
    iconColor: "#DC2626",
    textColor: "text-slate-700",
  },
};

export function FormInfoBox({
  variant = "info",
  children,
  icon,
  containerClassName = "",
}: FormInfoBoxProps) {
  const config = variantConfig[variant];
  const IconComponent = icon || config.icon;

  return (
    <View
      className={`mt-4 border rounded-2xl p-3 flex-row ${config.container} ${containerClassName}`}
    >
      <View className="mt-0.5 mr-2">
        {React.createElement(IconComponent as LucideIcon, { size: 16, color: config.iconColor as any })}
      </View>
      <Text className={`flex-1 text-xs leading-5 ${config.textColor}`}>{children}</Text>
    </View>
  );
}
