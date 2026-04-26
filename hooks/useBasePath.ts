import { useSegments } from 'expo-router';
export function useBasePath(): string {
  const segments = useSegments();
  const first = segments[0];
  if (first === 'customer') return '/customer';
  if (first === 'staff') return '/staff';
  return '';
}
