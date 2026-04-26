import { Check, X } from 'lucide-react-native';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';

interface SampleFormSuccessModalProps {
  visible: boolean;
  sampleName?: string;
  onClose: () => void;
  onViewSample?: () => void;
}

export function SampleFormSuccessModal({
  visible,
  sampleName,
  onClose,
  onViewSample,
}: SampleFormSuccessModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <View style={styles.content}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <X size={20} color={COLORS.sub} />
            </TouchableOpacity>

            <View style={styles.iconContainer}>
              <Check size={32} color={COLORS.success} strokeWidth={3} />
            </View>

            <Text style={styles.title}>Thành công</Text>

            <Text style={styles.message}>
              {sampleName
                ? `Mẫu "${sampleName}" đã được tạo thành công!`
                : 'Mẫu xét nghiệm đã được tạo thành công!'}
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonSecondaryText}>Đóng</Text>
              </TouchableOpacity>

              {onViewSample && (
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={onViewSample}
                  activeOpacity={0.85}
                >
                  <Text style={styles.buttonPrimaryText}>Xem mẫu</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
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
  backdrop: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
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
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.sub,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
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
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
