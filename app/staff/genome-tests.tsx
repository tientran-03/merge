import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';


export default function StaffGenomeTestsLegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: '/staff/services', params: { tab: 'genome' } } as any);
  }, []);
  return (
    <View className="flex-1 bg-sky-50 items-center justify-center">
      <ActivityIndicator size="large" color="#0284C7" />
    </View>
  );
}
