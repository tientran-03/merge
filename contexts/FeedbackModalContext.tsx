import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

import { ResultFeedbackModal } from '@/components/modals/ResultFeedbackModal';
import {
  registerFeedbackModalPresenter,
  unregisterFeedbackModalPresenter,
  type PresentFeedbackOptions,
} from '@/lib/feedbackModal';

export type { PresentFeedbackOptions };

type FeedbackModalContextValue = {
  presentFeedback: (options: PresentFeedbackOptions) => void;
  presentSuccess: (options: Omit<PresentFeedbackOptions, 'variant'>) => void;
  presentError: (options: Omit<PresentFeedbackOptions, 'variant'>) => void;
};

const FeedbackModalContext = createContext<FeedbackModalContextValue | null>(null);

export function FeedbackModalProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<
    Pick<PresentFeedbackOptions, 'variant' | 'title' | 'message' | 'confirmLabel'> | null
  >(null);
  const afterCloseRef = useRef<(() => void) | undefined>(undefined);

  const close = useCallback(() => {
    const cb = afterCloseRef.current;
    afterCloseRef.current = undefined;

    setVisible(false);

    InteractionManager.runAfterInteractions(() => {
      setPayload(null);

      if (cb) {
        requestAnimationFrame(() => {
          cb();
        });
      }
    });
  }, []);

  const presentFeedback = useCallback((options: PresentFeedbackOptions) => {
    afterCloseRef.current = options.onAfterClose;
    setPayload({
      variant: options.variant,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'OK',
    });
    setVisible(true);
  }, []);

  const presentSuccess = useCallback(
    (options: Omit<PresentFeedbackOptions, 'variant'>) => {
      presentFeedback({ ...options, variant: 'success' });
    },
    [presentFeedback],
  );

  const presentError = useCallback(
    (options: Omit<PresentFeedbackOptions, 'variant'>) => {
      presentFeedback({ ...options, variant: 'error' });
    },
    [presentFeedback],
  );

  useEffect(() => {
    registerFeedbackModalPresenter(presentFeedback);
    return () => unregisterFeedbackModalPresenter();
  }, [presentFeedback]);

  const value = React.useMemo(
    () => ({ presentFeedback, presentSuccess, presentError }),
    [presentFeedback, presentSuccess, presentError],
  );

  const open = visible && !!payload;

  return (
    <FeedbackModalContext.Provider value={value}>
      {children}
      <ResultFeedbackModal
        visible={open}
        variant={payload?.variant ?? 'success'}
        title={payload?.title ?? ''}
        message={payload?.message}
        buttonText={payload?.confirmLabel ?? 'OK'}
        onClose={close}
      />
    </FeedbackModalContext.Provider>
  );
}

export const CenteredSuccessModalProvider = FeedbackModalProvider;

export function useFeedbackModal(): FeedbackModalContextValue {
  const ctx = useContext(FeedbackModalContext);
  if (!ctx) {
    throw new Error('useFeedbackModal must be used within FeedbackModalProvider');
  }
  return ctx;
}