import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "@/constants/colors";

interface OrderFormFooterProps {
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
  submitText?: string;
}

export function OrderFormFooter({
  onCancel,
  onSubmit,
  isPending,
  submitText = "Tạo đơn hàng",
}: OrderFormFooterProps) {
  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row gap-3 px-4 py-4"
      style={{
        backgroundColor: COLORS.card,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
      }}
    >
      <TouchableOpacity
        onPress={onCancel}
        activeOpacity={0.85}
        className="flex-1 items-center justify-center rounded-2xl h-[52px]"
        style={{
          backgroundColor: COLORS.card,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text className="text-[15px] font-extrabold" style={{ color: COLORS.sub }}>
          Huỷ
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onSubmit}
        activeOpacity={0.85}
        disabled={isPending}
        className={[
          "flex-1 items-center justify-center rounded-2xl h-[52px]",
          isPending ? "opacity-80" : "opacity-100",
        ].join(" ")}
        style={{
          backgroundColor: COLORS.primary,
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        {isPending ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator color="#fff" />
            <Text className="text-[14px] font-bold text-white">Đang xử lý...</Text>
          </View>
        ) : (
          <Text className="text-[15px] font-extrabold text-white">{submitText}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
