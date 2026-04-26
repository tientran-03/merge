import React from 'react';
import { View, Text } from 'react-native';

import { FormTextarea } from '@/components/form';

export default function Step7OrderNote() {
  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">Ghi chú đơn hàng</Text>

      <FormTextarea
        name="orderNote"
        label="Ghi chú"
        placeholder="Nhập ghi chú cho đơn hàng (nếu có)"
        minHeight={120}
        maxLength={500}
      />

      <View className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
        <Text className="text-[11px] text-slate-500 font-medium">
          Ghi chú sẽ được hiển thị trong chi tiết đơn hàng và có thể được cập nhật sau.
        </Text>
      </View>
    </View>
  );
}
