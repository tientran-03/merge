import { Check } from "lucide-react-native";
import React from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "@/constants/colors";

interface OrderFormSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  onViewOrders: () => void;
}

export function OrderFormSuccessModal({
  visible,
  onClose,
  onViewOrders,
}: OrderFormSuccessModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/55 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View
          className="w-full max-w-[420px] overflow-hidden rounded-3xl bg-white shadow-2xl"
          style={{ backgroundColor: COLORS.card }}
        >
          <View className="items-center px-6 pb-5 pt-7">
            <View
              className="mb-5 h-[76px] w-[76px] items-center justify-center rounded-full"
              style={{
                backgroundColor: `${COLORS.success}1A`,
                borderWidth: 2,
                borderColor: `${COLORS.success}33`,
              }}
            >
              <Check size={34} color={COLORS.success} strokeWidth={3} />
            </View>

            <Text
              className="text-center text-[22px] font-extrabold"
              style={{ color: COLORS.text }}
            >
              Thành công
            </Text>

            <Text
              className="mt-2 text-center text-[16px] font-bold"
              style={{ color: COLORS.text }}
            >
              Đơn hàng đã được tạo thành công!
            </Text>

            <Text
              className="mt-2 text-center text-[14px] font-semibold leading-5"
              style={{ color: COLORS.sub }}
            >
              Bạn có thể xem đơn hàng trong danh sách đơn hàng.
            </Text>
          </View>
          <View className="h-px" style={{ backgroundColor: COLORS.border }} />
          <View className="flex-row gap-3 px-4 py-4">
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.85}
              className="flex-1 items-center justify-center rounded-2xl py-3.5"
              style={{
                backgroundColor: COLORS.bg,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text className="text-[15px] font-extrabold" style={{ color: COLORS.sub }}>
                Đóng
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onViewOrders}
              activeOpacity={0.85}
              className="flex-1 items-center justify-center rounded-2xl py-3.5"
              style={{
                backgroundColor: COLORS.primary,
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 10,
                elevation: 6,
              }}
            >
              <Text className="text-[15px] font-extrabold text-white">Xem danh sách</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
