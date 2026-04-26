import { useState, useCallback } from 'react';

export interface WizardStep {
  id: string;
  title: string;
  validate?: () => boolean;
}

interface UseWizardNavigationOptions {
  steps: WizardStep[];
  initialStep?: number;
  onNext?: (currentStep: number, nextStep: number) => void;
  onPrevious?: (currentStep: number, prevStep: number) => void;
  onStepChange?: (step: number) => void;
}

interface UseWizardNavigationResult {
  currentStep: number;
  currentStepData: WizardStep;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToStep: (step: number) => void;
  goToNextStep: () => boolean;
  goToPreviousStep: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  totalSteps: number;
  progress: number;
}

/**
 * Hook for managing wizard/multi-step form navigation
 */
export function useWizardNavigation({
  steps,
  initialStep = 0,
  onNext,
  onPrevious,
  onStepChange,
}: UseWizardNavigationOptions): UseWizardNavigationResult {
  const [currentStep, setCurrentStep] = useState(initialStep);

  const currentStepData = steps[currentStep] || { id: '', title: '' };
  const totalSteps = steps.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const canGoPrevious = !isFirstStep;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setCurrentStep(step);
        onStepChange?.(step);
      }
    },
    [totalSteps, onStepChange],
  );

  const goToNextStep = useCallback(() => {
    // Validate current step if validation function is provided
    if (currentStepData.validate && !currentStepData.validate()) {
      return false;
    }

    if (!isLastStep) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onNext?.(currentStep, nextStep);
      onStepChange?.(nextStep);
      return true;
    }
    return false;
  }, [currentStep, isLastStep, currentStepData, onNext, onStepChange]);

  const goToPreviousStep = useCallback(() => {
    if (!isFirstStep) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onPrevious?.(currentStep, prevStep);
      onStepChange?.(prevStep);
    }
  }, [currentStep, isFirstStep, onPrevious, onStepChange]);

  // Check if we can proceed to next step
  const canGoNext = !isLastStep && (!currentStepData.validate || currentStepData.validate());

  return {
    currentStep,
    currentStepData,
    isFirstStep,
    isLastStep,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    canGoNext,
    canGoPrevious,
    totalSteps,
    progress,
  };
}
