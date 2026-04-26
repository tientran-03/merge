import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  stepTitles: string[];
  onPrevious: () => void;
  onNext: () => void;
  canGoNext: boolean;
  isSubmitting?: boolean;
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  stepTitles,
  onPrevious,
  onNext,
  canGoNext,
  isSubmitting = false,
}: WizardNavigationProps) {
  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        <Text style={styles.stepText}>
          Bước {currentStep} / {totalSteps}
        </Text>
        <Text style={styles.stepTitle}>{stepTitles[currentStep - 1]}</Text>
      </View>

      {/* Navigation buttons */}
      <View style={styles.buttonContainer}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={onPrevious}
            disabled={isSubmitting}
          >
            <ChevronLeft size={20} color={COLORS.sub} />
            <Text style={styles.buttonSecondaryText}>Quay lại</Text>
          </TouchableOpacity>
        )}

        {currentStep < totalSteps ? (
          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonPrimary,
              !canGoNext && styles.buttonDisabled,
            ]}
            onPress={onNext}
            disabled={!canGoNext || isSubmitting}
          >
            <Text style={styles.buttonPrimaryText}>Tiếp tục</Text>
            <ChevronRight size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonPrimary,
              styles.buttonSubmit,
              !canGoNext && styles.buttonDisabled,
            ]}
            onPress={onNext}
            disabled={!canGoNext || isSubmitting}
          >
            <Text style={styles.buttonSubmitText}>Hoàn thành</Text>
            {isSubmitting ? (
              <Text style={styles.buttonSubmitText}>...</Text>
            ) : (
              <ChevronRight size={20} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            { width: `${(currentStep / totalSteps) * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
    paddingBottom: 24,
  },
  stepIndicator: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  buttonSecondary: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.sub,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    flex: 1,
  },
  buttonSubmit: {
    backgroundColor: COLORS.success,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  buttonSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLORS.bg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
});
