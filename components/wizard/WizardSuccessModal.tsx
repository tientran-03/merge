import { Check } from 'lucide-react-native';
import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';

interface WizardSuccessModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  onViewDetails?: () => void;
}

export function WizardSuccessModal({
  visible,
  title = 'Thành công',
  message = 'Đơn hàng đã được cập nhật thành công!',
  onClose,
  onViewDetails,
}: WizardSuccessModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Check size={32} color={COLORS.success} strokeWidth={3} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.actions}>
            {onViewDetails && (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={onViewDetails}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonSecondaryText}>Xem chi tiết</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonPrimaryText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    maxWidth: 400,
    width: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.25)",
      },
    }),
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 20,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.sub,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.sub,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.3)",
      },
    }),
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
