import { ChevronDown } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { FormFieldGroup } from '@/components/form';

interface SampleFormFieldProps {
  icon?: React.ReactNode;
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

export function SampleFormField({
  icon,
  label,
  required,
  children,
  hint,
}: SampleFormFieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      </View>
      {children}
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

interface SampleFormInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  onFocus?: () => void;
  focused?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
}

export function SampleFormInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  onFocus,
  focused,
  multiline = false,
  numberOfLines = 1,
}: SampleFormInputProps) {
  return (
    <TextInput
      style={[styles.input, focused && styles.inputFocused, multiline && styles.textArea]}
      placeholder={placeholder}
      placeholderTextColor={COLORS.muted}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      onFocus={onFocus}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

interface SampleFormDropdownProps {
  value: string;
  placeholder: string;
  onPress: () => void;
  displayValue: string;
  hasValue?: boolean;
}

export function SampleFormDropdown({
  placeholder,
  onPress,
  displayValue,
  hasValue = false,
}: SampleFormDropdownProps) {
  return (
    <TouchableOpacity style={styles.dropdown} onPress={onPress}>
      <Text
        style={[styles.dropdownText, !hasValue && styles.dropdownPlaceholder]}
      >
        {displayValue}
      </Text>
      <ChevronDown size={20} color={COLORS.sub} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  required: { color: COLORS.danger },
  hint: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },
  input: {
    height: 50,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
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
  dropdownText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
  },
  dropdownPlaceholder: { color: COLORS.muted },
});

// Re-export FormFieldGroup for convenience
export { FormFieldGroup };
