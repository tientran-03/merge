import { Check, X } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { FeedbackVariant } from '@/lib/feedbackModal';

export type ResultFeedbackModalProps = {
  visible: boolean;
  variant: FeedbackVariant;
  title: string;
  message?: string;
  buttonText?: string;
  onClose: () => void;
};

const TOKENS = {
  success: {
    accent: '#198754',
    ring: '#198754',
    title: '#198754',
    ringBg: 'rgba(25, 135, 84, 0.08)',
  },
  error: {
    accent: '#dc3545',
    ring: '#dc3545',
    title: '#dc3545',
    ringBg: 'rgba(220, 53, 69, 0.08)',
  },
} as const;

export function ResultFeedbackModal({
  visible,
  variant,
  title,
  message,
  buttonText = 'OK',
  onClose,
}: ResultFeedbackModalProps) {
  const t = TOKENS[variant];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View
            style={[
              styles.iconRing,
              { borderColor: t.ring, backgroundColor: t.ringBg },
            ]}>
            {variant === 'success' ? (
              <Check size={40} color={t.accent} strokeWidth={2.8} />
            ) : (
              <X size={40} color={t.accent} strokeWidth={2.8} />
            )}
          </View>

          <Text style={[styles.title, { color: t.title }]}>{title}</Text>

          {message ? (
            <Text style={styles.message}>{message}</Text>
          ) : null}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: t.accent, opacity: pressed ? 0.88 : 1 },
            ]}>
            <Text style={styles.buttonText}>{buttonText}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(73, 80, 87, 0.55)',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 22,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '400',
    color: '#212529',
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: 28,
    alignSelf: 'stretch',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
