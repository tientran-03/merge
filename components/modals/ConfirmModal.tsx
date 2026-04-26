import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { AlertTriangle, CheckCircle2, X } from "lucide-react-native";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/55 px-5">
        <Pressable className="absolute inset-0" onPress={onCancel} />
        <View className="w-full max-w-[360px] overflow-hidden rounded-3xl bg-white shadow-2xl">
          <View className="items-center pt-3">
            <View className="h-1.5 w-12 rounded-full bg-slate-200" />
          </View>
          <View className="flex-row items-start px-5 pb-3 pt-4">
            <View
              className={[
                "mr-4 h-12 w-12 items-center justify-center rounded-2xl",
                destructive ? "bg-rose-500/15" : "bg-emerald-500/15",
              ].join(" ")}
            >
              {destructive ? (
                <AlertTriangle size={22} color="#F43F5E" />
              ) : (
                <CheckCircle2 size={22} color="#10B981" />
              )}
            </View>

            <View className="flex-1 pr-2">
              <Text className="text-[17px] font-extrabold text-slate-900">{title}</Text>
              <Text className="mt-1 text-[14px] leading-5 text-slate-500">{message}</Text>
            </View>
            <Pressable
              onPress={onCancel}
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
            >
              <X size={18} color="#0F172A" />
            </Pressable>
          </View>

          <View className="h-px bg-slate-100" />
          <View className="flex-row gap-3 px-5 py-4">
            <Pressable
              onPress={onCancel}
              className="flex-1 rounded-2xl bg-slate-100 py-3 active:opacity-80"
            >
              <Text className="text-center text-[15px] font-bold text-slate-700">
                {cancelText}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              className={[
                "flex-1 rounded-2xl py-3 active:opacity-80",
                destructive ? "bg-rose-600" : "bg-indigo-600",
              ].join(" ")}
            >
              <Text className="text-center text-[15px] font-bold text-white">{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
