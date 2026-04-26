import { ChevronDown, X, Search, Check } from "lucide-react-native";
import React, { useState, useMemo } from "react";
import { useFormContext, Controller, type FieldError } from "react-hook-form";
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
} from "react-native";

import { useSheetBottomInset } from "@/lib/useSheetBottomInset";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { FormSelectProps } from "./types";

export function FormSelect<T = any>({
  name,
  label,
  required,
  helperText,
  options,
  getLabel,
  getValue,
  placeholder = "Lựa chọn",
  searchable = false,
  disabled = false,
  modalTitle = label || "Chọn giá trị",
  emptyMessage = "Không có dữ liệu",
  renderOption,
  onValueChange,
  validateOnChange,
  containerClassName = "",
  containerStyle,
}: FormSelectProps<T>) {
  const { control, formState: { errors }, trigger } = useFormContext();
  const sheetBottomInset = useSheetBottomInset();
  const safeInsets = useSafeAreaInsets();
  const error = errors[name];

  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const hasError = !!error;
  const borderColor = hasError ? "border-red-400" : disabled ? "border-slate-100" : "border-slate-200";
  const safeOptions = useMemo(() => {
    if (!options || !Array.isArray(options)) return [];
    if (typeof getLabel !== 'function' || typeof getValue !== 'function') return [];
    return options.filter((opt) => opt != null);
  }, [options, getLabel, getValue]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery || !searchable) return safeOptions;
    const query = searchQuery.toLowerCase();
    return safeOptions.filter((opt) => {
      if (!opt) return false;
      try {
        const label = getLabel(opt);
        return label && typeof label === 'string' && label.toLowerCase().includes(query);
      } catch {
        return false;
      }
    });
  }, [safeOptions, searchQuery, searchable, getLabel]);

  return (
    <View
      className={`mb-4 ${containerClassName}`}
      style={[{ alignSelf: "stretch", width: "100%" }, containerStyle]}
    >
      {label && (
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
          {label} {required ? <Text className="text-red-500">*</Text> : null}
        </Text>
      )}

      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => {
          let selectedLabel = placeholder;
          if (value !== undefined && value !== null && value !== '') {
            try {
              const selected = safeOptions.find(opt => {
                if (!opt) return false;
                try {
                  return getValue(opt) === value;
                } catch {
                  return false;
                }
              });
              if (selected) {
                try {
                  const lab = getLabel(selected);
                  if (lab) selectedLabel = lab;
                } catch {
                  /* keep placeholder */
                }
              }
            } catch {
              /* keep placeholder */
            }
          }

          const handleSelect = (item: T) => {
            if (!item) return;
            try {
              const itemValue = getValue(item);
              const previousValue = value;
              let proceed = true;
              if (onValueChange) {
                const r = onValueChange(itemValue, item, previousValue);
                if (r === false) proceed = false;
              }
              if (proceed) {
                onChange(itemValue);
                if (validateOnChange) void trigger(name);
              }
              setVisible(false);
              setSearchQuery("");
            } catch (error) {
              console.error('[FormSelect] Error in handleSelect:', error);
            }
          };

          const handleOpen = () => {
            if (!disabled) setVisible(true);
          };

          const handleClose = () => {
            setVisible(false);
            setSearchQuery("");
          };

          const isSelected = (item: T) => {
            if (!item) return false;
            try {
              return getValue(item) === value;
            } catch {
              return false;
            }
          };

          return (
            <>
              <TouchableOpacity
                activeOpacity={disabled ? 1 : 0.75}
                onPress={handleOpen}
                className={`w-full bg-white rounded-2xl border px-4 py-3.5 flex-row items-center justify-between ${borderColor}`}
              >
                <Text
                  className={`flex-1 min-w-0 text-[14px] font-semibold ${
                    value === undefined || value === null || value === ''
                      ? "text-slate-400"
                      : "text-slate-900"
                  }`}
                  numberOfLines={1}
                >
                  {selectedLabel}
                </Text>
                {!disabled && <ChevronDown size={18} color="#94A3B8" />}
              </TouchableOpacity>

              <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={handleClose}
              >
                <KeyboardAvoidingView
                  className="flex-1"
                  behavior={Platform.OS === "ios" ? "padding" : "height"}
                  keyboardVerticalOffset={Platform.OS === "ios" ? safeInsets.top : 0}
                  style={{ flex: 1 }}
                >
                  <View className="flex-1 justify-end">
                    <Pressable
                      className="absolute inset-0 bg-black/60"
                      onPress={handleClose}
                      accessibilityRole="button"
                      accessibilityLabel="Đóng"
                    />
                    <View
                      className="bg-white rounded-t-3xl overflow-hidden w-full max-h-[92%]"
                      style={{ paddingBottom: sheetBottomInset }}
                    >
                      <View className="px-5 pt-4 pb-3 border-b border-slate-200 flex-row items-center justify-between">
                        <Text className="text-[13px] font-extrabold text-slate-700">{modalTitle}</Text>
                        <TouchableOpacity
                          onPress={handleClose}
                          className="w-10 h-10 rounded-2xl bg-slate-100 items-center justify-center"
                          activeOpacity={0.8}
                        >
                          <X size={20} color="#334155" />
                        </TouchableOpacity>
                      </View>

                      {searchable && (
                        <View className="px-4 py-3 border-b border-slate-100">
                          <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2.5">
                            <Search size={16} color="#64748B" />
                            <TextInput
                              className="flex-1 ml-2 text-[14px] text-slate-900"
                              placeholder="Tìm kiếm..."
                              placeholderTextColor="#94A3B8"
                              value={searchQuery}
                              onChangeText={setSearchQuery}
                              autoCapitalize="none"
                              returnKeyType="search"
                            />
                          </View>
                        </View>
                      )}

                      <ScrollView
                        className="max-h-80"
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        nestedScrollEnabled
                      >
                      {filteredOptions.length === 0 ? (
                        <View className="py-8 items-center">
                          <Text className="text-[13px] text-slate-400">{emptyMessage}</Text>
                        </View>
                      ) : (
                        filteredOptions.map((item, index) => {
                          if (!item) return null;
                          let itemLabel: string;
                          let itemValue: string | number | undefined;
                          let uniqueKey: string | number;
                          try {
                            itemLabel = getLabel(item) || '';
                            const maybeValue = getValue(item);
                            itemValue =
                              typeof maybeValue === "string" || typeof maybeValue === "number"
                                ? maybeValue
                                : undefined;
                            const rawKey =
                              (item as any)?.uniqueKey ??
                              (item as any)?.serviceId ??
                              `option-${index}-${String(itemValue ?? "")}`;
                            uniqueKey =
                              typeof rawKey === "string" || typeof rawKey === "number"
                                ? rawKey
                                : `option-${index}`;
                          } catch {
                            return null;
                          }
                          const selected = isSelected(item);
                          if (renderOption) {
                            return (
                              <View key={uniqueKey}>
                                {renderOption(item, selected, () => handleSelect(item))}
                              </View>
                            );
                          }
                          return (
                            <TouchableOpacity
                              key={uniqueKey}
                              onPress={() => handleSelect(item)}
                              className={`px-5 py-3.5 flex-row items-center justify-between border-b border-slate-50 ${
                                selected ? "bg-sky-50" : ""
                              }`}
                              activeOpacity={0.75}
                            >
                              <Text
                                className={`text-[14px] font-medium ${
                                  selected ? "text-sky-700" : "text-slate-900"
                                }`}
                              >
                                {itemLabel}
                              </Text>
                              {selected && <Check size={18} color="#0284C7" />}
                            </TouchableOpacity>
                          );
                        })
                      )}
                      </ScrollView>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </Modal>
            </>
          );
        }}
      />
      {error && (
        <Text className="text-[11px] text-red-500 mt-1">
          {(error as FieldError)?.message?.toString() || "Giá trị không hợp lệ"}
        </Text>
      )}
      {helperText && !error && (
        <Text className="mt-2 text-[11px] text-slate-500">{helperText}</Text>
      )}
    </View>
  );
}
