import { ChevronLeft, ChevronRight } from "lucide-react-native";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

import { MEDICAL } from "@/lib/theme/medical";

export interface PaginationControlsProps {
  currentPage: number; // 0-based
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalElements: number;
  isLoading?: boolean;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalElements,
  isLoading = false,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalElements);
  const displayPage = currentPage + 1; // Convert to 1-based for display

  const canGoPrevious = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  return (
    <View className="bg-white border-t border-sky-100 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-slate-600 font-semibold">
            {totalElements > 0 ? `${startItem}-${endItem}` : "0"} / {totalElements}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => onPageChange(currentPage - 1)}
            disabled={!canGoPrevious || isLoading}
            className={`px-3 py-2 rounded-xl border ${
              canGoPrevious && !isLoading
                ? "bg-white border-sky-200"
                : "bg-sky-50/80 border-sky-100"
            }`}
            activeOpacity={0.7}
          >
            <ChevronLeft
              size={18}
              color={canGoPrevious && !isLoading ? MEDICAL.primary : "#94A3B8"}
            />
          </TouchableOpacity>

          <View className="px-3 py-2 rounded-xl bg-sky-50 border border-sky-200">
            <Text className="text-xs font-extrabold text-sky-700">
              {displayPage} / {totalPages}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext || isLoading}
            className={`px-3 py-2 rounded-xl border ${
              canGoNext && !isLoading
                ? "bg-white border-sky-200"
                : "bg-sky-50/80 border-sky-100"
            }`}
            activeOpacity={0.7}
          >
            <ChevronRight
              size={18}
              color={canGoNext && !isLoading ? MEDICAL.primary : "#94A3B8"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
