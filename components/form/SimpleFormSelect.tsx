import { ChevronDown } from 'lucide-react-native';
import React from 'react';
import { Controller, ControllerProps, useFormContext } from 'react-hook-form';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { getFieldError } from './error-utils';

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

  const error = getFieldError(errors, name);

  return (
    <View style={styles.field}>
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      )}
      <TouchableOpacity
        style={[styles.dropdown, error && styles.dropdownError]}
        onPress={onPress}
      >
        <Text
          style={[styles.dropdownText, !displayValue && styles.dropdownPlaceholder]}
        >
          {displayValue || placeholder}
        </Text>
        <ChevronDown size={20} color={COLORS.sub} />
      </TouchableOpacity>
      {error && (
        <Text style={styles.errorText}>
          {(error as { message?: string }).message || 'Giá trị không hợp lệ'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  required: { color: COLORS.danger },
  dropdown: {
    height: 50,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownError: {
    borderColor: COLORS.danger,
  },
  dropdownText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
  },
  dropdownPlaceholder: { color: COLORS.muted },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
  },
});
