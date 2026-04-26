import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';

interface OrderDetailHeaderProps {
  orderId?: string;
  onBack: () => void;
}

export function OrderDetailHeader({ orderId, onBack }: OrderDetailHeaderProps) {
  return (
    <View
      className="flex-row items-center px-4 py-3 border-b"
      style={{
        backgroundColor: COLORS.card,
        borderBottomColor: COLORS.border,
      }}
    >
      <TouchableOpacity className="p-2 mr-3" onPress={onBack} activeOpacity={0.8}>
        <ArrowLeft size={24} color={COLORS.text} />
      </TouchableOpacity>

      <View className="flex-1">
        <Text
          className="text-[18px] font-bold"
          style={{ color: COLORS.text }}
        >
          Chi tiết đơn hàng
        </Text>

        {orderId && (
          <Text
            className="text-xs mt-0.5"
            style={{ color: COLORS.muted }}
          >
            #{orderId}
          </Text>
        )}
      </View>
    </View>
  );
}