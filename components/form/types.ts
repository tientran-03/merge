import type { LucideIcon } from "lucide-react-native";
import type { ControllerProps } from "react-hook-form";
import type { TextInputProps, ViewStyle } from "react-native";

export interface BaseFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  containerStyle?: ViewStyle;
}

export interface IconProps {
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export interface SelectOption {
  label: string;
  value: string | number | boolean;
}

export type FormFieldRef<T = unknown> = React.RefObject<T>;

export interface FormInputProps extends TextInputProps, BaseFieldProps, IconProps {
  name: string;
  formatter?: (value: string) => string;
}

export type NumericFormatterType = "currency" | "phone" | "decimal" | "integer";

export interface FormNumericInputProps extends BaseFieldProps, IconProps {
  name: string;
  type: NumericFormatterType;
  placeholder?: string;
  disabled?: boolean;
  /** Khi có (vd 100 cho thuế %): không cho nhập số vượt quá — giữ giá trị cũ như web */
  numericMax?: number;
}

export interface FormTextareaProps extends BaseFieldProps {
  name: string;
  placeholder?: string;
  minHeight?: number;
  maxLength?: number;
  disabled?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}

export interface FormReadOnlyProps extends BaseFieldProps, IconProps {
  value: string;
  placeholder?: string;
}

export interface FormFieldGroupProps {
  children: [React.ReactNode, React.ReactNode];
  gap?: number;
}

export type InfoBoxVariant = "info" | "success" | "warning" | "error";

export interface FormInfoBoxProps {
  variant?: InfoBoxVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  containerClassName?: string;
}

export interface FormSelectProps<T = unknown> extends BaseFieldProps {
  name: string;
  options: readonly T[] | T[];
  getLabel: (item: T) => string;
  getValue: (item: T) => string | number | boolean;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  modalTitle?: string;
  emptyMessage?: string;
  renderOption?: (item: T, isSelected: boolean, onSelect: () => void) => React.ReactNode;
}

export interface FormDatePickerProps extends BaseFieldProps {
  name: string;
  placeholder?: string;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  mode?: "date" | "time" | "datetime";
}

export type { LucideIcon };

export type ControllerFieldState = ControllerProps extends { fieldState: infer S } ? S : never;
