import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { X } from "lucide-react-native";

interface FormModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  subtitle?: string;
  maxWidth?: number;
}
export function FormModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = 420,
}: FormModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/55 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View
          style={{ maxWidth }}
          className="w-full overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          <View className="items-center pt-3">
            <View className="h-1.5 w-12 rounded-full bg-slate-200" />
          </View>
          <View className="flex-row items-start justify-between px-5 pb-4 pt-4">
            <View className="flex-1 pr-3">
              <Text className="text-[17px] font-extrabold text-slate-900">{title}</Text>
              {!!subtitle && (
                <Text className="mt-1 text-[13px] leading-5 text-slate-500">{subtitle}</Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
            >
              <X size={18} color="#0F172A" />
            </Pressable>
          </View>
          <View className="h-px bg-slate-100" />
          <ScrollView
            className="px-5 py-4"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-2"
          >
            {children}
          </ScrollView>
          {footer ? (
            <>
              <View className="h-px bg-slate-100" />
              <View className="px-5 py-4">{footer}</View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
