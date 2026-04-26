import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ROLE_ADMIN, ROLE_CUSTOMER, ROLE_SAMPLE_COLLECTOR } from '@/constants/roles';
import { useAuth } from '@/contexts/AuthContext';
import { ROOT_HREF } from '@/lib/router-href';

interface MenuItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  route?: string;
  badge?: number;
}

export default function SampleCollectorHomeScreen() {
  const router = useRouter();
  const { logout, user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(ROOT_HREF);
      return;
    }
    if (!isLoading && user?.role) {
      if (user.role === ROLE_CUSTOMER) {
        router.replace('/customer');
      } else if (user.role === ROLE_ADMIN) {
        router.replace('/admin-home');
      } else if (user.role !== ROLE_SAMPLE_COLLECTOR) {
        router.replace('/staff');
      }
    }
  }, [user?.role, user, isLoading]);

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'orders',
        title: 'Danh sách\nđơn hàng',
        icon: <Image source={require('@/assets/images/6.png')} className="w-16 h-16" resizeMode="contain" />,
        route: '/staff/orders',
      },
      {
        id: 'additional-samples',
        title: 'Mẫu xét nghiệm\nbổ sung',
        icon: <Image source={require('@/assets/images/3.png')} className="w-16 h-16" resizeMode="contain" />,
        route: '/staff/additional-samples',
      },
      {
        id: 'patient-metadatas',
        title: 'Quản lý mẫu\nxét nghiệm',
        icon: <Image source={require('@/assets/images/3.png')} className="w-16 h-16" resizeMode="contain" />,
        route: '/staff/patient-metadatas',
      },
      {
        id: 'profile',
        title: 'Thông tin\n& bảo mật',
        icon: <Image source={require('@/assets/images/7.png')} className="w-16 h-16" resizeMode="contain" />,
        route: '/sample-collector/profile',
      },
      {
        id: 'logout',
        title: 'Đăng xuất',
        icon: <Image source={require('@/assets/images/9.png')} className="w-16 h-16" resizeMode="contain" />,
        route: 'logout',
      },
    ],
    []
  );

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      if (item.route === 'logout') {
        logout();
      } else if (item.route) {
        router.push(item.route as any);
      }
    },
    [router, logout]
  );

  if (isLoading || !user || user.role !== ROLE_SAMPLE_COLLECTOR) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0891b2" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('@/assets/images/bg.png')}
        className="pt-12 pb-6 px-6"
        style={Platform.select({
          ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
          android: { elevation: 3 },
          web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' },
        })}
        resizeMode="cover"
      >
        <View className="w-64 h-16 flex-row items-center justify-between">
          <View />
          <View className="bg-teal-600 px-3 py-1 rounded-full">
            <Text className="text-white text-xs font-bold">NGƯỜI THU MẪU</Text>
          </View>
        </View>
      </ImageBackground>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row flex-wrap -mx-2">
          {menuItems.map(item => (
            <View key={item.id} className="w-1/3 px-2 mb-4">
              <TouchableOpacity
                className="bg-white rounded-xl p-4 items-center border border-gray-100"
                style={Platform.select({
                  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
                  android: { elevation: 1 },
                  web: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' },
                })}
                activeOpacity={0.7}
                onPress={() => handleMenuPress(item)}
              >
                <View className="relative">
                  <View className="w-16 h-16 rounded-2xl items-center justify-center mb-2">{item.icon}</View>
                  {!!item.badge && (
                    <View className="absolute -top-1 -right-1 min-w-[24px] h-[24px] rounded-full bg-orange-500 items-center justify-center px-1.5 border-2 border-white">
                      <Text className="text-white text-[10px] font-bold">{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text
                  className="text-[12px] h-8 font-bold text-sky-700 text-center leading-tight"
                  style={{ lineHeight: 14 }}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
