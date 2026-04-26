import { Calendar, X } from "lucide-react-native";
import React, { useState } from "react";
import { useFormContext, Controller, type FieldError } from "react-hook-form";
import { View, Text, Modal, TouchableOpacity, ScrollView } from "react-native";

import { useSheetBottomInset } from "@/lib/useSheetBottomInset";

import type { FormDatePickerProps } from "./types";

const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDate = (value: string): Date | null => {
  if (!value) return null;
  if (value.includes("T") || value.includes("-")) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  const parts = value.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

export function FormDatePicker({
  name,
  label,
  required,
  helperText,
  placeholder = "Chọn ngày",
  disabled = false,
  minimumDate,
  maximumDate,
  validateOnChange,
  containerClassName = "",
  containerStyle,
}: FormDatePickerProps) {
  const { control, formState: { errors }, trigger } = useFormContext();
  const sheetBottomInset = useSheetBottomInset();
  const error = errors[name];

  const [visible, setVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const hasError = !!error;
  const borderColor = hasError ? "border-red-400" : disabled ? "border-slate-100" : "border-slate-200";

  const handleClose = () => {
    setVisible(false);
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setSelectedDate(newDate);
  };

  const changeYear = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(newDate.getFullYear() + delta);
    setSelectedDate(newDate);
  };

  return (
    <View className={`mb-4 ${containerClassName}`} style={containerStyle}>
      {label && (
        <Text className="text-[13px] font-extrabold text-slate-700 mb-2">
          {label} {required ? <Text className="text-red-500">*</Text> : null}
        </Text>
      )}

      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => {
          const displayValue = React.useMemo(() => {
            if (!value) return placeholder;
            const date = parseDate(value);
            return date ? formatDate(date) : placeholder;
          }, [value]);

          const handleOpen = () => {
            if (!disabled) {
              const date = parseDate(value) || new Date();
              setSelectedDate(date);
              setVisible(true);
            }
          };

          const handleSelectDate = (date: Date) => {
            setSelectedDate(date);
            onChange(date.toISOString());
            if (validateOnChange) void trigger(name);
            handleClose();
          };

          const handleSelectDay = (day: number) => {
            const newDate = new Date(selectedDate);
            newDate.setDate(day);
            handleSelectDate(newDate);
          };

          const handleSelectMonth = (month: number) => {
            const newDate = new Date(selectedDate);
            newDate.setMonth(month);
            const maxDay = getDaysInMonth(newDate.getFullYear(), month);
            if (newDate.getDate() > maxDay) {
              newDate.setDate(maxDay);
            }
            handleSelectDate(newDate);
          };

          const handleSelectYear = (year: number) => {
            const newDate = new Date(selectedDate);
            newDate.setFullYear(year);
            handleSelectDate(newDate);
          };

          const renderCalendar = () => {
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth();
            const daysInMonth = getDaysInMonth(year, month);
            const firstDayOfWeek = new Date(year, month, 1).getDay();
            const today = new Date();

            const days = [];
            const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

            const header = (
              <View className="flex-row mb-2">
                {dayNames.map((name, i) => (
                  <View key={i} className="w-10 items-center">
                    <Text className="text-[11px] font-bold text-slate-500">{name}</Text>
                  </View>
                ))}
              </View>
            );

            for (let i = 0; i < firstDayOfWeek; i++) {
              days.push(<View key={`empty-${i}`} className="w-10" />);
            }

            for (let day = 1; day <= daysInMonth; day++) {
              const date = new Date(year, month, day);
              const isToday =
                date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear();
              const isSelected =
                parseDate(value)?.getDate() === day &&
                parseDate(value)?.getMonth() === month &&
                parseDate(value)?.getFullYear() === year;
              const isDisabled =
                (minimumDate && date < minimumDate && !isSelected) ||
                (maximumDate && date > maximumDate && !isSelected);

              days.push(
                <TouchableOpacity
                  key={day}
                  onPress={() => !isDisabled && handleSelectDay(day)}
                  disabled={isDisabled}
                  className={`w-10 h-10 items-center justify-center rounded-full ${
                    isSelected ? "bg-sky-600" : isDisabled ? "opacity-30" : ""
                  }`}
                  activeOpacity={0.75}
                >
                  <Text
                    className={`text-[14px] font-semibold ${
                      isSelected ? "text-white" : isToday ? "text-sky-700" : "text-slate-900"
                    }`}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            }

            return (
              <View>
                {header}
                <View className="flex-row flex-wrap">{days}</View>
              </View>
            );
          };

          const renderMonthSelector = () => {
            const months = [
              "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
              "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
            ];
            const currentMonth = selectedDate.getMonth();

            return (
              <View className="flex-row flex-wrap gap-2">
                {months.map((month, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleSelectMonth(index)}
                    className={`px-4 py-2 rounded-xl ${
                      currentMonth === index ? "bg-sky-600" : "bg-slate-100"
                    }`}
                    activeOpacity={0.75}
                  >
                    <Text
                      className={`text-[13px] font-semibold ${
                        currentMonth === index ? "text-white" : "text-slate-700"
                      }`}
                    >
                      {month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          };

          const renderYearSelector = () => {
            const currentYear = new Date().getFullYear();
            const selectedYear = selectedDate.getFullYear();
            const years = [];
            for (let i = currentYear - 10; i <= currentYear + 10; i++) {
              years.push(i);
            }

            return (
              <ScrollView className="max-h-48">
                <View className="flex-row flex-wrap gap-2 p-2">
                  {years.map((year) => (
                    <TouchableOpacity
                      key={year}
                      onPress={() => handleSelectYear(year)}
                      className={`px-4 py-2 rounded-xl ${
                        selectedYear === year ? "bg-sky-600" : "bg-slate-100"
                      }`}
                      activeOpacity={0.75}
                    >
                      <Text
                        className={`text-[13px] font-semibold ${
                          selectedYear === year ? "text-white" : "text-slate-700"
                        }`}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            );
          };

          return (
            <>
              <TouchableOpacity
                activeOpacity={disabled ? 1 : 0.75}
                onPress={handleOpen}
                className={`bg-white rounded-2xl border px-4 py-3.5 flex-row items-center ${borderColor}`}
              >
                <Calendar size={18} color="#0284C7" />
                <Text
                  className={`flex-1 ml-3 text-[14px] font-semibold ${
                    !value ? "text-slate-400" : "text-slate-900"
                  }`}
                >
                  {displayValue}
                </Text>
              </TouchableOpacity>

              <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
                <View className="flex-1 bg-black/60 justify-end">
                  <View
                    className="bg-white rounded-t-3xl overflow-hidden"
                    style={{ paddingBottom: sheetBottomInset }}
                  >
                    <View className="px-5 pt-4 pb-3 border-b border-slate-200 flex-row items-center justify-between">
                      <Text className="text-[13px] font-extrabold text-slate-700">Chọn ngày</Text>
                      <TouchableOpacity
                        onPress={handleClose}
                        className="w-10 h-10 rounded-2xl bg-slate-100 items-center justify-center"
                        activeOpacity={0.8}
                      >
                        <X size={20} color="#334155" />
                      </TouchableOpacity>
                    </View>

                    <View className="px-4 py-3 flex-row items-center justify-between border-b border-slate-100">
                      <TouchableOpacity onPress={() => changeMonth(-1)} className="p-2">
                        <Text className="text-sky-600 font-semibold">←</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => changeYear(-1)} className="p-2">
                        <Text className="text-sky-600 font-semibold">«</Text>
                      </TouchableOpacity>
                      <Text className="text-[15px] font-bold text-slate-900">
                        {formatDate(selectedDate)}
                      </Text>
                      <TouchableOpacity onPress={() => changeYear(1)} className="p-2">
                        <Text className="text-sky-600 font-semibold">»</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => changeMonth(1)} className="p-2">
                        <Text className="text-sky-600 font-semibold">→</Text>
                      </TouchableOpacity>
                    </View>

                    <View className="flex-row border-b border-slate-100">
                      <TouchableOpacity
                        className={`flex-1 py-3 items-center border-b-2 ${
                          true ? "border-sky-600" : "border-transparent"
                        }`}
                        activeOpacity={0.75}
                      >
                        <Text className="text-[13px] font-semibold text-sky-700">Ngày</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 py-3 items-center border-b-2 border-transparent"
                        activeOpacity={0.75}
                      >
                        <Text className="text-[13px] font-semibold text-slate-500">Tháng</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 py-3 items-center border-b-2 border-transparent"
                        activeOpacity={0.75}
                      >
                        <Text className="text-[13px] font-semibold text-slate-500">Năm</Text>
                      </TouchableOpacity>
                    </View>

                    <View className="p-4">
                      {renderCalendar()}
                    </View>

                    <View className="px-4 pb-4">
                      <TouchableOpacity
                        onPress={() => handleSelectDate(new Date())}
                        className="py-3 rounded-xl bg-sky-600 items-center"
                        activeOpacity={0.85}
                      >
                        <Text className="text-[14px] font-bold text-white">Hôm nay</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
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
