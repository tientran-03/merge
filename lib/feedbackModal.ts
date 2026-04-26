export type FeedbackVariant = 'success' | 'error';

export type PresentFeedbackOptions = {
  variant: FeedbackVariant;
  title: string;
  message?: string;
  confirmLabel?: string;
  onAfterClose?: () => void;
};

type Presenter = (options: PresentFeedbackOptions) => void;

let presenter: Presenter | null = null;

export function registerFeedbackModalPresenter(fn: Presenter) {
  presenter = fn;
}

export function unregisterFeedbackModalPresenter() {
  presenter = null;
}

export function presentFeedback(options: PresentFeedbackOptions) {
  if (!presenter) {
    console.warn('[feedbackModal] Chưa gắn provider — bỏ qua thông báo.');
    return;
  }
  presenter(options);
}

export function presentFeedbackSuccess(options: Omit<PresentFeedbackOptions, 'variant'>) {
  presentFeedback({ ...options, variant: 'success' });
}

export function presentFeedbackError(options: Omit<PresentFeedbackOptions, 'variant'>) {
  presentFeedback({ ...options, variant: 'error' });
}
