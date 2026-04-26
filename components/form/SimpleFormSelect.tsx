import { ChevronDown } from 'lucide-react-native';
import React from 'react';
import { ControllerProps, useFormContext } from 'react-hook-form';
import { Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';

export interface SelectOption {
  label: string;
  value: string;
}
interface SimpleFormSelectProps {
  name: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  options: SelectOption[];
  displayValue?: string;
  control: ControllerProps<any, any>['control'];
  onPress: () => void;
}

export function SimpleFormSelect({
  name,
  label,
  required = false,
  placeholder = 'Chọn...',
  options,
  displayValue,
  control,
  onPress,
}: SimpleFormSelectProps) {
  const {
    formState: { errors },
  } = useFormContext();

  const error = errors[name];

  return (
    <View className="mb-1">
      {label && (
        <Text className="text-sm font-bold mb-2" style={{ color: COLORS.text }}>
          {label} {required && <Text style={{ color: COLORS.danger }}>*</Text>}
        </Text>
      )}

      <TouchableOpacity
        className="h-[50px] rounded-2xl px-4 flex-row items-center justify-between border"
        style={{
          backgroundColor: COLORS.card,
          borderColor: error ? COLORS.danger : COLORS.border,
        }}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text
          className="text-sm font-semibold flex-1"
          style={{ color: displayValue ? COLORS.text : COLORS.muted }}
          numberOfLines={1}
        >
          {displayValue || placeholder}
        </Text>

        <ChevronDown size={20} color={COLORS.sub} />
      </TouchableOpacity>

      {error && (
        <Text className="text-xs mt-1" style={{ color: COLORS.danger }}>
          {(error as { message?: string }).message || 'Giá trị không hợp lệ'}
        </Text>
      )}
    </View>
  );
}
