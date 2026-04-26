import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Image, ImageBackground, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { ROOT_HREF } from '@/lib/router-href';

interface MenuItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  route?: string;
  badge?: number;
}

export default function AdminHomeScreen() {
  const router = useRouter();
  const { logout, user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user?.role) {
      if (user.role !== 'ROLE_ADMIN') {
        if (user.role === 'ROLE_STAFF') {
          router.replace('/staff');
        } else if (user.role === 'ROLE_CUSTOMER') {
          router.replace('/customer');
        } else {
          router.replace(ROOT_HREF);
        }
      }
    } else if (!isLoading && !user) {
      router.replace(ROOT_HREF);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);

  if (isLoading || !user || user.role !== 'ROLE_ADMIN') {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0891b2" />
      </SafeAreaView>
    );
  }

  const menuItems: MenuItem[] = [
    { id: '1', title: 'Quản lý\nngười dùng', icon: <Image source={require('@/assets/images/7.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/users' },
    { id: '2', title: 'Quản lý\ndịch vụ', icon: <Image source={require('@/assets/images/4.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/services' },
    { id: '3', title: 'Quản lý\nđơn hàng', icon: <Image source={require('@/assets/images/6.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/orders' },
    { id: '4', title: 'Thống kê\nnhanh', icon: <Image source={require('@/assets/images/5.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/dashboard' },
    { id: '14', title: 'Thống kê\nchi tiết', icon: <Image source={require('@/assets/images/5.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/statistics' },
    { id: '5', title: 'Cấu hình\ncơ bản', icon: <Image source={require('@/assets/images/3.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/config' },
    { id: '6', title: 'Phân quyền\n& vai trò', icon: <Image source={require('@/assets/images/7.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/permissions' },
    { id: '12', title: 'Quản lý\nphiếu xét nghiệm', icon: <Image source={require('@/assets/images/4.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/specifies' },
    { id: '13', title: 'Quản lý\nquyền hạn', icon: <Image source={require('@/assets/images/7.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/permissions-list' },
    { id: '16', title: 'Kết quả\nxét nghiệm', icon: <Image source={require('@/assets/images/4.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/test-results' },
    { id: '8', title: 'Giám sát\nhệ thống', icon: <Image source={require('@/assets/images/2.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/monitoring' },
    { id: '15', title: 'Quản lý\nlog hệ thống', icon: <Image source={require('@/assets/images/2.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/logs' },
    { id: '9', title: 'Quản lý\n tổ chức', icon: <Image source={require('@/assets/images/3.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/hospitals' },
    { id: '10', title: 'Thông tin\nngười dùng', icon: <Image source={require('@/assets/images/7.png')} className="w-16 h-16" resizeMode="contain" />, route: '/admin/profile' },
    { id: '11', title: 'Đăng xuất', icon: <Image source={require('@/assets/images/9.png')} className="w-16 h-16" resizeMode="contain" />, route: 'logout' },
  ];

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      if (item.route === 'logout') logout();
      else if (item.route) router.push(item.route as any);
    },
    [router, logout]
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('@/assets/images/bg.png')}
        className="pt-12 pb-6 px-6"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
        resizeMode="cover"
      >
        <View className="w-64 h-16 flex-row items-center justify-between">
          <View />
          <View className="bg-red-500 px-3 py-1 rounded-full">
            <Text className="text-white text-xs font-bold">ADMIN</Text>
          </View>
        </View>
      </ImageBackground>
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View className="flex-row flex-wrap -mx-2">
          {menuItems.map(item => (
            <View key={item.id} className="w-1/3 px-2 mb-4">
              <TouchableOpacity
                className="bg-white rounded-xl p-4 items-center border border-gray-100"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
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
                <Text className="text-[12px] h-8 font-bold text-sky-700 text-center leading-tight" style={{ lineHeight: 14 }}>
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
