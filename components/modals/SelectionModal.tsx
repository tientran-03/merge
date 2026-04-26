import { Check, Search, Trash2, X } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

export interface SelectionOption {
  value: string;
  label: string;
}

interface SelectionModalProps {
  visible: boolean;
  title: string;
  options: SelectionOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  placeholderSearch?: string;
  onClear?: () => void;
}

export function SelectionModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  placeholderSearch = "Tìm kiếm...",
  onClear,
}: SelectionModalProps) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (visible) setQ("");
  }, [visible]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter((x) => x.label.toLowerCase().includes(query));
  }, [q, options]);

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="slide" 
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="max-h-[82%] rounded-t-3xl bg-white shadow-2xl" style={{ zIndex: 9999 }}>
          <View className="items-center pt-3">
            <View className="h-1.5 w-12 rounded-full bg-slate-200" />
          </View>
          <View className="flex-row items-center px-5 pb-3 pt-4">
            <View className="flex-1">
              <Text className="text-[16px] font-extrabold text-slate-900">{title}</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                {options.length} mục • {filtered.length} hiển thị
              </Text>
            </View>

            {onClear && !!selectedValue && (
              <Pressable
                onPress={() => {
                  onClear();
                  onClose();
                }}
                hitSlop={10}
                className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
              >
                <Trash2 size={18} color="#64748B" />
              </Pressable>
            )}

            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
            >
              <X size={18} color="#0F172A" />
            </Pressable>
          </View>
          <View className="px-5 pb-3">
            <View className="flex-row items-center rounded-2xl bg-slate-100 px-4 py-3">
              <Search size={18} color="#64748B" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={placeholderSearch}
                placeholderTextColor="#94A3B8"
                className="ml-3 flex-1 text-[15px] text-slate-900"
                returnKeyType="search"
              />
              {!!q && (
                <Pressable
                  onPress={() => setQ("")}
                  hitSlop={10}
                  className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-white"
                >
                  <X size={16} color="#64748B" />
                </Pressable>
              )}
            </View>
          </View>
          <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <View className="items-center py-10">
                <Text className="text-[15px] font-semibold text-slate-900">Không tìm thấy</Text>
                <Text className="mt-1 text-[13px] text-slate-500">Thử từ khóa khác nhé.</Text>
              </View>
            ) : (
              filtered.map((item) => {
                const isSelected = item.value === selectedValue;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => {
                      onSelect(item.value);
                      onClose();
                    }}
                    className={[
                      "mb-2 flex-row items-center justify-between rounded-2xl px-4 py-3",
                      isSelected ? "bg-indigo-600/10" : "bg-white",
                    ].join(" ")}
                  >
                    <Text
                      className={[
                        "flex-1 text-[15px]",
                        isSelected ? "font-bold text-indigo-700" : "text-slate-900",
                      ].join(" ")}
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>

                    {isSelected ? (
                      <View className="ml-3 h-6 w-6 items-center justify-center rounded-full bg-indigo-600">
                        <Check size={16} color="#fff" />
                      </View>
                    ) : (
                      <View className="ml-3 h-2 w-2 rounded-full bg-slate-300" />
                    )}
                  </Pressable>
                );
              })
            )}

            <View className="h-6" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
