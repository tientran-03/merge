import { Search } from 'lucide-react-native';
import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Tìm kiếm...',
  onFocus,
  onBlur,
}: SearchBarProps) {
  return (
    <View
      className="flex-row items-center px-3.5 py-2.5 rounded-xl border gap-2.5"
      style={{
        backgroundColor: COLORS.card,
        borderColor: COLORS.border,
      }}
    >
      <Search size={18} color={COLORS.sub} />

      <TextInput
        className="flex-1 text-[15px] py-0.5"
        style={{ color: COLORS.text }}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType="search"
      />

      {!!value && (
        <TouchableOpacity
          className="w-5 h-5 rounded-full items-center justify-center"
          style={{ backgroundColor: COLORS.bg }}
          onPress={() => onChangeText('')}
          activeOpacity={0.8}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: COLORS.sub }}
          >
            ✕
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}