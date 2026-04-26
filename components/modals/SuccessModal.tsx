import React from 'react';

import { ResultFeedbackModal } from '@/components/modals/ResultFeedbackModal';

type SuccessModalProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
  title?: string;
  buttonText?: string;
};
export function SuccessModal({
  visible,
  message,
  onClose,
  title = 'Thành công',
  buttonText = 'OK',
}: SuccessModalProps) {
  return (
    <ResultFeedbackModal
      visible={visible}
      variant="success"
      title={title}
      message={message}
      buttonText={buttonText}
      onClose={onClose}
    />
  );
}
