import Toast from 'react-native-toast-message';

const VISIBLE_MS = 2800;

export function toastSuccess(title: string, message?: string) {
  Toast.show({
    type: 'success',
    text1: title,
    text2: message,
    visibilityTime: VISIBLE_MS,
    position: 'top',
    topOffset: 56,
  });
}

export function toastError(title: string, message?: string) {
  Toast.show({
    type: 'error',
    text1: title,
    text2: message,
    visibilityTime: VISIBLE_MS,
    position: 'top',
    topOffset: 56,
  });
}
