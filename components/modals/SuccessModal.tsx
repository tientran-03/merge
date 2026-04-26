import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";

type SuccessModalProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
  title?: string;
  buttonText?: string;
};

export function SuccessModal({
  visible,
  message,
  onClose,
  title = "Thành công",
  buttonText = "OK",
}: SuccessModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[360px] rounded-3xl bg-white px-6 pb-6 pt-7 shadow-2xl">
          <Pressable
            onPress={onClose}
            hitSlop={12}
            className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-black/5"
          >
            <X size={18} color="#111827" />
          </Pressable>
          <View className="items-center">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
              <Check size={34} color="#10B981" />
            </View>

            <Text className="mt-4 text-center text-lg font-extrabold text-slate-900">
              {title}
            </Text>

            <Text className="mt-2 text-center text-[14px] leading-5 text-slate-500">
              {message}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="mt-6 rounded-2xl bg-indigo-600 py-3.5 shadow"
          >
            <Text className="text-center text-[15px] font-bold text-white">
              {buttonText}
            </Text>
          </Pressable>
          <Text className="mt-3 text-center text-xs text-slate-400">
            Nhấn ra ngoài để đóng
          </Text>
        </View>
      </View>
    </Modal>
  );
}
