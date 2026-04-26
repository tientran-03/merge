import { Calendar, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

const pad2 = (n: number) => String(n).padStart(2, "0");

const toYyyyMmDd = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatDisplay = (d: Date): string =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;

const parseValue = (value: string): Date | null => {
  const v = String(value || "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, day] = v.split("-").map(Number);
    const d = new Date(y, m - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (v.includes("T") || v.includes("-")) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parts = v.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const getDaysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

export type StandaloneDatePickerProps = {
  value: string;
  onChange: (yyyyMmDd: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  helperText?: string;
};

export function StandaloneDatePicker({
  value,
  onChange,
  label,
  required,
  placeholder = "Chọn ngày",
  error,
  disabled = false,
  minimumDate,
  maximumDate,
  helperText,
}: StandaloneDatePickerProps) {
  const maxD = maximumDate ?? new Date();
  const minD = minimumDate ?? new Date(maxD.getFullYear() - 120, maxD.getMonth(), maxD.getDate());

  const [visible, setVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => parseValue(value) || maxD);

  const displayLabel = useMemo(() => {
    if (!value?.trim()) return placeholder;
    const d = parseValue(value);
    return d ? formatDisplay(d) : placeholder;
  }, [value, placeholder]);

  const hasError = !!error;
  const borderColor = hasError
    ? "border-red-400"
    : disabled
      ? "border-slate-100"
      : "border-slate-200";

  const handleClose = () => setVisible(false);

  const changeMonth = (delta: number) => {
    setSelectedDate((prev) => {
      const n = new Date(prev);
      n.setMonth(n.getMonth() + delta);
      return n;
    });
  };

  const changeYear = (delta: number) => {
    setSelectedDate((prev) => {
      const n = new Date(prev);
      n.setFullYear(n.getFullYear() + delta);
      return n;
    });
  };

  const commitDate = (date: Date) => {
    onChange(toYyyyMmDd(date));
    handleClose();
  };

  const handleSelectDay = (day: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(day);
    commitDate(newDate);
  };

  const handleSelectMonth = (month: number) => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(month);
      const maxDay = getDaysInMonth(newDate.getFullYear(), month);
      if (newDate.getDate() > maxDay) newDate.setDate(maxDay);
      return newDate;
    });
  };

  const handleSelectYear = (year: number) => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setFullYear(year);
      const maxDay = getDaysInMonth(year, newDate.getMonth());
      if (newDate.getDate() > maxDay) newDate.setDate(maxDay);
      return newDate;
    });
  };

  const renderCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const today = new Date();
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

    const days: React.ReactNode[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<View key={`empty-${i}`} className="w-10" />);
    }

    const parsedCurrent = parseValue(value);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
      const isSelected =
        parsedCurrent?.getDate() === day &&
        parsedCurrent?.getMonth() === month &&
        parsedCurrent?.getFullYear() === year;
      const startMin = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate());
      const endMax = new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate());
      const isDisabled =
        (date < startMin && !isSelected) || (date > endMax && !isSelected);

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

  const months = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
  ];

  const yearStart = minD.getFullYear();
  const yearEnd = maxD.getFullYear();
  const years: number[] = [];
  for (let y = yearEnd; y >= yearStart; y -= 1) years.push(y);

  return (
    <View className="mb-3">
      {label ? (
        <Text className="text-xs font-bold text-slate-700 mb-1.5">
          {label} {required ? <Text className="text-red-500">*</Text> : null}
        </Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={disabled ? 1 : 0.75}
        onPress={() => {
          if (!disabled) {
            const d = parseValue(value) || maxD;
            setSelectedDate(d);
            setVisible(true);
          }
        }}
        className={`rounded-xl px-3 py-2.5 border flex-row items-center bg-white ${borderColor}`}
      >
        <Calendar size={16} color="#0284C7" />
        <Text
          className={`flex-1 ml-2 text-sm font-semibold ${
            !value?.trim() ? "text-slate-400" : "text-slate-900"
          }`}
        >
          {displayLabel}
        </Text>
      </TouchableOpacity>

      {error ? <Text className="mt-1 text-[11px] text-red-600">{error}</Text> : null}
      {helperText && !error ? (
        <Text className="mt-1 text-[11px] text-slate-500">{helperText}</Text>
      ) : null}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl overflow-hidden">
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
                {formatDisplay(selectedDate)}
              </Text>
              <TouchableOpacity onPress={() => changeYear(1)} className="p-2">
                <Text className="text-sky-600 font-semibold">»</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => changeMonth(1)} className="p-2">
                <Text className="text-sky-600 font-semibold">→</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-64 border-b border-slate-100">
              <View className="px-3 py-3 flex-row flex-wrap gap-2">
                {months.map((m, index) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => handleSelectMonth(index)}
                    className={`px-3 py-2 rounded-xl ${
                      selectedDate.getMonth() === index ? "bg-sky-600" : "bg-slate-100"
                    }`}
                    activeOpacity={0.75}
                  >
                    <Text
                      className={`text-[12px] font-semibold ${
                        selectedDate.getMonth() === index ? "text-white" : "text-slate-700"
                      }`}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <ScrollView className="max-h-36 border-b border-slate-100">
              <View className="flex-row flex-wrap gap-2 p-3">
                {years.map((y) => (
                  <TouchableOpacity
                    key={y}
                    onPress={() => handleSelectYear(y)}
                    className={`px-3 py-2 rounded-xl ${
                      selectedDate.getFullYear() === y ? "bg-sky-600" : "bg-slate-100"
                    }`}
                    activeOpacity={0.75}
                  >
                    <Text
                      className={`text-[12px] font-semibold ${
                        selectedDate.getFullYear() === y ? "text-white" : "text-slate-700"
                      }`}
                    >
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View className="p-4">{renderCalendar()}</View>

            <View className="px-4 pb-4">
              <TouchableOpacity
                onPress={() => commitDate(new Date())}
                className="py-3 rounded-xl bg-sky-600 items-center"
                activeOpacity={0.85}
              >
                <Text className="text-[14px] font-bold text-white">Hôm nay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
