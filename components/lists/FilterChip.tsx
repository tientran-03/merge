import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';

interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  count?: number;
}

export function FilterChip({ label, active = false, onPress, count }: FilterChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {count !== undefined && (
        <View style={[styles.countBadge, active && styles.countBadgeActive]}>
          <Text style={[styles.countText, active && styles.countTextActive]}>
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
      style={[
        styles.statusBadge,
        { backgroundColor: meta.bg, borderColor: meta.bd },
      ]}
    >
      <Text style={[styles.statusText, { color: meta.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  chipActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.sub,
  },
  chipTextActive: {
    color: COLORS.primary,
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.sub,
  },
  countTextActive: {
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
