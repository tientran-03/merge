import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSheetBottomInset } from '@/lib/useSheetBottomInset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RejectOrderModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function RejectOrderModal({
  visible,
  onClose,
  onConfirm,
  isLoading = false,
}: RejectOrderModalProps) {
  const insets = useSafeAreaInsets();
  const sheetBottomInset = useSheetBottomInset();
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    setReason('');
  };

  const handleClose = () => {
    if (!isLoading) {
      setReason('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={handleClose} />
          <View
            className="rounded-t-3xl bg-white pt-2"
            style={{ maxHeight: '88%', paddingBottom: sheetBottomInset }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            >
              <View className="h-1.5 w-12 self-center rounded-full bg-slate-200" />
              <Text className="text-lg font-bold text-slate-900 mt-4">Từ chối đơn hàng</Text>
              <Text className="text-sm text-slate-600 mt-1">
                Vui lòng nhập lý do từ chối (bắt buộc). Khách hàng sẽ nhận thông báo.
              </Text>
              <TextInput
                className="mt-3 min-h-[96px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
                placeholder="Nhập lý do từ chối..."
                placeholderTextColor="#94a3b8"
                value={reason}
                onChangeText={setReason}
                multiline
                textAlignVertical="top"
                editable={!isLoading}
              />
              <View className="flex-row gap-3 mt-4 pb-1">
                <TouchableOpacity
                  onPress={handleClose}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl bg-slate-100"
                >
                  <Text className="text-center font-semibold text-slate-700">Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirm}
                  disabled={isLoading || !reason.trim()}
                  className={`flex-1 py-3 rounded-xl ${reason.trim() && !isLoading ? 'bg-rose-600' : 'bg-slate-300'}`}
                >
                  <Text className="text-center font-semibold text-white">Từ chối đơn</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
