import { useSegments } from 'expo-router';
export function useStaffDoctorBasePath(): '/staff' | '/doctor' {
  const segments = useSegments();
  const root = segments[0];
  if (root === 'doctor') return '/doctor';
  return '/staff';
}
