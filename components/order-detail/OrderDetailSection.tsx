import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

interface OrderDetailSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function OrderDetailSection({
  title,
  icon,
  children,
}: OrderDetailSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon && <View style={styles.sectionIcon}>{icon}</View>}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

interface OrderDetailRowProps {
  label: string;
  value?: string | number | null;
  valueColor?: string;
  highlight?: boolean;
}

export function OrderDetailRow({
  label,
  value,
  valueColor,
  highlight = false,
}: OrderDetailRowProps) {
  if (!value && value !== 0) return null;

  return (
    <View style={[styles.row, highlight && styles.rowHighlight]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, valueColor && { color: valueColor }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

interface OrderDetailStatusBadgeProps {
  status: string;
  type?: 'order' | 'payment';
}

export function OrderDetailStatusBadge({
  status,
  type = 'order',
}: OrderDetailStatusBadgeProps) {
  const getStatusColor = () => {
    const s = status.toLowerCase();
    if (type === 'payment') {
      const ps = status.toUpperCase();
      if (ps === 'COMPLETED') return COLORS.success;
      if (ps === 'PENDING') return COLORS.warning;
      if (ps === 'FAILED' || ps === 'UNPAID') return COLORS.danger;
    }
    // Order status colors
    if (s === 'completed') return COLORS.success;
    if (s === 'in_progress' || s === 'forward_analysis') return COLORS.primary;
    if (s === 'rejected' || s === 'sample_error') return COLORS.danger;
    if (s === 'accepted') return COLORS.info;
    return COLORS.sub;
  };

  const getStatusLabel = (): string => {
    const s = status.toLowerCase();
    if (type === 'payment') {
      const ps = status.toUpperCase();
      const statusMap: Record<string, string> = {
        PENDING: 'Chờ thanh toán',
        COMPLETED: 'Đã thanh toán',
        FAILED: 'Thất bại',
        UNPAID: 'Chưa thanh toán',
      };
      return statusMap[ps] || status;
    }
    // Order status labels
    const statusMap: Record<string, string> = {
      initiation: 'Khởi tạo',
      forward_analysis: 'Chuyển tiếp phân tích',
      accepted: 'Chấp nhận',
      rejected: 'Từ chối',
      in_progress: 'Đang xử lý',
      sample_error: 'Mẫu lỗi',
      rerun_testing: 'Chạy lại',
      completed: 'Hoàn thành',
      sample_addition: 'Thêm mẫu',
    };
    return statusMap[s] || status;
  };

  const color = getStatusColor();
  const label = getStatusLabel();

  return (
    <View style={[styles.badge, { backgroundColor: `${color}15` }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionContent: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowHighlight: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  rowLabel: {
    fontSize: 14,
    color: COLORS.sub,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
