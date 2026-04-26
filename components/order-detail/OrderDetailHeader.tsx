import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';

interface OrderDetailHeaderProps {
  orderId?: string;
  onBack: () => void;
}

export function OrderDetailHeader({ orderId, onBack }: OrderDetailHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ArrowLeft size={24} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Chi tiết đơn hàng</Text>
        {orderId && <Text style={styles.subtitle}>#{orderId}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
});
