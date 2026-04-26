import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useSheetBottomInset(min = 12): number {
  const { bottom } = useSafeAreaInsets();
  return Math.max(bottom, min);
}
