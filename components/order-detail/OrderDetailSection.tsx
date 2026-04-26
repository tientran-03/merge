import React from 'react';
import { Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

interface OrderDetailSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function OrderDetailSection({ title, icon, children }: OrderDetailSectionProps) {
  return (
    <View
      className="rounded-2xl p-4 mb-3 border"
      style={{
        backgroundColor: COLORS.card,
        borderColor: COLORS.border,
      }}
    >
      <View className="flex-row items-center mb-3 gap-2">
        {icon && (
          <View
            className="w-7 h-7 rounded-md items-center justify-center"
            style={{ backgroundColor: COLORS.primarySoft }}
          >
            {icon}
          </View>
        )}
        <Text className="text-[15px] font-bold" style={{ color: COLORS.text }}>
          {title}
        </Text>
      </View>

      <View className="gap-2">{children}</View>
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
  if (value === null || value === undefined || value === '') return null;

  return (
    <View
      className={[
        'flex-row items-center justify-between py-1.5',
        highlight ? 'px-3 rounded-lg' : '',
      ].join(' ')}
      style={highlight ? { backgroundColor: COLORS.bg } : undefined}
    >
      <Text className="text-sm font-medium" style={{ color: COLORS.sub }}>
        {label}
      </Text>
      <Text
        className="text-sm font-semibold flex-1 text-right ml-3"
        style={{ color: valueColor ?? COLORS.text }}
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

export function OrderDetailStatusBadge({ status, type = 'order' }: OrderDetailStatusBadgeProps) {
  const getStatusColor = () => {
    const s = status.toLowerCase();
    if (type === 'payment') {
      const ps = status.toUpperCase();
      if (ps === 'COMPLETED') return COLORS.success;
      if (ps === 'PENDING') return COLORS.warning;
      if (ps === 'FAILED' || ps === 'UNPAID') return COLORS.danger;
    }
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
    <View
      className="flex-row items-center px-3 py-1.5 rounded-full self-start"
      style={{ backgroundColor: `${color}15` }}
    >
      <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: color }} />
      <Text className="text-[13px] font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
