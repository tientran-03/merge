import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SPECIFY_STATUS_FILTER_OPTIONS } from '@/lib/specify-status';
import { MEDICAL } from '@/lib/theme/medical';

type Option = { value: string; label: string };

export function SpecifyStatusPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = useMemo(() => {
    return SPECIFY_STATUS_FILTER_OPTIONS.find(o => o.value === value)?.label ?? 'Tất cả';
  }, [value]);

  const filtered: Option[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...SPECIFY_STATUS_FILTER_OPTIONS];
    return SPECIFY_STATUS_FILTER_OPTIONS.filter(
      o =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    );
  }, [query]);

  const openPicker = () => {
    setQuery('');
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
    setQuery('');
  };

  const select = (item: Option) => {
    onChange(item.value);
    closePicker();
  };

  return (
    <>
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.85}
        className="mt-1 flex-row items-center justify-between rounded-2xl border border-sky-200 bg-white px-3.5 py-3"
      >
        <View className="min-w-0 flex-1 pr-2">
          <Text className="text-[10px] font-extrabold uppercase tracking-wide text-sky-600">
            Trạng thái
          </Text>
          <Text className="mt-0.5 text-[14px] font-extrabold text-sky-950" numberOfLines={1}>
            {selectedLabel}
          </Text>
        </View>
        <ChevronDown size={22} color={MEDICAL.primaryDark} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={closePicker}
      >
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="absolute inset-0 bg-black/45"
            activeOpacity={1}
            onPress={closePicker}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
          />
          <View
            className="rounded-t-3xl bg-white shadow-xl"
            style={{
              maxHeight: '88%',
              paddingBottom: Math.max(insets.bottom, 12),
            }}
          >
            <View className="flex-row items-center justify-between border-b border-sky-100 px-4 py-3">
              <Text className="text-base font-extrabold text-slate-900">Chọn trạng thái</Text>
              <TouchableOpacity
                onPress={closePicker}
                className="h-10 w-10 items-center justify-center rounded-xl bg-sky-50 border border-sky-200"
                hitSlop={12}
              >
                <X size={20} color={MEDICAL.primary} />
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center border-b border-sky-50 px-4 py-2.5 mx-4 mt-2 rounded-xl border border-sky-100 bg-sky-50/80">
              <Search size={18} color={MEDICAL.primaryDark} />
              <TextInput
                className="ml-2 flex-1 py-2 text-[14px] font-semibold text-slate-900"
                placeholder="Tìm theo tên hoặc mã (VD: completed, Khởi tạo)…"
                placeholderTextColor="#94A3B8"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={item => item.value}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View className="py-12 px-6">
                  <Text className="text-center text-sm font-semibold text-slate-500">
                    Không có trạng thái khớp “{query.trim()}”
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 }}
              renderItem={({ item }) => {
                const sel = value === item.value;
                return (
                  <TouchableOpacity
                    onPress={() => select(item)}
                    activeOpacity={0.75}
                    className={`mb-2 flex-row items-center justify-between rounded-2xl border px-3.5 py-3 ${sel
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-sky-100 bg-white'
                      }`}
                  >
                    <View className="min-w-0 flex-1 pr-2">
                      <Text
                        className={`text-[14px] font-extrabold leading-snug ${sel ? 'text-sky-900' : 'text-slate-900'
                          }`}
                      >
                        {item.label}
                      </Text>
                      {item.value !== 'all' ? (
                        <Text className="mt-0.5 font-mono text-[11px] font-semibold text-slate-500">
                          {item.value}
                        </Text>
                      ) : null}
                    </View>
                    {sel ? (
                      <Check size={22} color={MEDICAL.primary} strokeWidth={2.5} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
