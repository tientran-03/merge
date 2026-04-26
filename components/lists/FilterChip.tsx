import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';

interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  count?: number;
}

export function FilterChip({
  label,
  active = false,
  onPress,
  count,
}: FilterChipProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-3 py-1.5 rounded-full border gap-1.5"
      style={{
        backgroundColor: active ? COLORS.primarySoft : COLORS.bg,
        borderColor: active ? COLORS.primary : COLORS.border,
      }}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text
        className="text-[13px] font-semibold"
        style={{ color: active ? COLORS.primary : COLORS.sub }}
      >
        {label}
      </Text>

      {count !== undefined && (
        <View
          className="min-w-[18px] h-[18px] rounded-full items-center justify-center px-1"
          style={{
            backgroundColor: active ? COLORS.primary : COLORS.border,
          }}
        >
          <Text
            className="text-[10px] font-bold"
            style={{ color: active ? '#fff' : COLORS.sub }}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

interface StatusBadgeProps {
  status: string;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const getStatusMeta = () => {
    const s = status.toLowerCase();

    if (s === 'completed' || s === 'success')
      return {
        bg: 'rgba(34,197,94,0.12)',
        fg: COLORS.success,
        bd: 'rgba(34,197,94,0.22)',
      };

    if (s === 'pending' || s === 'processing' || s === 'in_progress')
      return {
        bg: 'rgba(249,115,22,0.12)',
        fg: COLORS.warning,
        bd: 'rgba(249,115,22,0.22)',
      };

    if (s === 'cancelled' || s === 'rejected' || s === 'failed' || s === 'error')
      return {
        bg: 'rgba(239,68,68,0.12)',
        fg: COLORS.danger,
        bd: 'rgba(239,68,68,0.22)',
      };

    return {
      bg: 'rgba(59,130,246,0.12)',
      fg: COLORS.info,
      bd: 'rgba(59,130,246,0.22)',
    };
  };

  const meta = getStatusMeta();

  return (
    <View
      className="flex-row items-center px-2.5 py-1 rounded-xl border"
      style={{ backgroundColor: meta.bg, borderColor: meta.bd }}
    >
      <Text className="text-xs font-semibold" style={{ color: meta.fg }}>
        {label}
      </Text>
    </View>
  );
}