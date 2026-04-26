import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { ROOT_HREF } from '@/lib/router-href';
import { MEDICAL } from '@/lib/theme/medical';
import { OrderResponse, orderService } from '@/services/orderService';

interface MenuItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  route?: string;
  badge?: number;
}

const isPendingStatus = (status: string): boolean => {
  const s = status.toLowerCase();
  return s === 'initiation' || s === 'accepted' || s === 'in_progress' || s === 'forward_analysis';
};

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { logout, user, isLoading } = useAuth();

  const { data: ordersResponse, refetch: refetchOrders, isRefetching: refetchingOrders } = useQuery({
    queryKey: ['orders', 'customer', user?.id],
    queryFn: () => orderService.getByCustomerId(user!.id, {}),
    retry: false,
    enabled: !!user?.id,
  });

  const handleHomeRefresh = useCallback(() => {
    if (user?.id) return refetchOrders();
    return Promise.resolve();
  }, [user?.id, refetchOrders]);

  const initiationOrdersCount = useMemo(() => {
    if (!ordersResponse?.success || !ordersResponse.data) return 0;
    const orders = ordersResponse.data as OrderResponse[];
    return orders.filter(o => String(o.orderStatus).toLowerCase() === 'initiation').length;
  }, [ordersResponse]);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role !== 'ROLE_CUSTOMER') {
        const r = user.role?.toUpperCase();
        if (r === 'ROLE_ADMIN') router.replace('/admin-home');
        else if (r === 'ROLE_DOCTOR') router.replace('/doctor');
        else if (r === 'ROLE_LAB_TECHNICIAN') router.replace('/lab-technician');
        else if (r === 'ROLE_SAMPLE_COLLECTOR') router.replace('/sample-collector');
        else if (r === 'ROLE_STAFF') router.replace('/staff');
        else router.replace('/staff');
      }
    } else if (!isLoading && !user) {
      router.replace(ROOT_HREF);
    }
  }, [user, isLoading]);

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'specifies',
        title: 'Quản lý phiếu\nxét nghiệm',
        icon: (
          <Image
            source={require('@/assets/customer/01_quan_ly_phieu_xet_nghiem.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/specifies',
      },
      {
        id: 'create-specify',
        title: 'Tạo phiếu\nxét nghiệm',
        icon: (
          <Image
            source={require('@/assets/customer/08_them_mau.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/create-specify',
      },
      {
        id: 'orders',
        title: 'Đơn hàng\ncủa tôi',
        icon: (
          <Image
            source={require('@/assets/customer/02_don_hang_cua_toi.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/orders',
        badge: initiationOrdersCount > 0 ? initiationOrdersCount : undefined,
      },
      {
        id: 'sample-adds',
        title: 'Bổ sung mẫu',
        icon: (
          <Image
            source={require('@/assets/customer/03_bo_sung_mau.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/sample-adds',
      },
      {
        id: 'patients',
        title: 'Thông tin\nbệnh nhân',
        icon: (
          <Image
            source={require('@/assets/customer/04_thong_tin_benh_nhan.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/patients',
      },
      {
        id: 'patient-metadatas',
        title: 'Quản lý dữ liệu\ngen',
        icon: (
          <Image
            source={require('@/assets/customer/05_quan_ly_du_lieu_gen.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/patient-metadatas',
      },
      {
        id: 'patient-results',
        title: 'Trả kết quả',
        icon: (
          <Image
            source={require('@/assets/customer/06_tra_ket_qua.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/patient-results',
      },
      {
        id: 'services',
        title: 'Dịch vụ\nxét nghiệm',
        icon: (
          <Image
            source={require('@/assets/customer/07_dich_vu_xet_nghiem.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/services',
      },
      {
        id: 'sample-add-services',
        title: 'Thêm mẫu',
        icon: (
          <Image
            source={require('@/assets/customer/08_them_mau.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/sample-add-services',
      },
      {
        id: 'statistics',
        title: 'Thống kê',
        icon: (
          <Image
            source={require('@/assets/customer/09_thong_ke.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/statistics',
      },
      {
        id: 'profile',
        title: 'Thông tin\ntài khoản',
        icon: (
          <Image
            source={require('@/assets/customer/10_thong_tin_tai_khoan.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: '/customer/profile',
      },
      {
        id: 'logout',
        title: 'Đăng xuất',
        icon: (
          <Image
            source={require('@/assets/customer/12_dang_xuat.png')}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: 'logout',
      },
    ],
    [initiationOrdersCount]
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

  if (isLoading || !user || user.role !== 'ROLE_CUSTOMER') {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50">
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('@/assets/images/bg.png')}
        className="pt-12 pb-6 px-6"
        style={Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          android: { elevation: 3 },
          web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' },
        })}
        resizeMode="cover"
      >
        <View className="w-64 h-16 flex-row items-center justify-between">
          <View />
          <View className="bg-sky-600 px-3 py-1 rounded-full border border-sky-700">
            <Text className="text-white text-xs font-bold">KHÁCH HÀNG</Text>
          </View>
        </View>
      </ImageBackground>
      <ScrollView
        className="flex-1 bg-sky-50"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refetchingOrders}
            onRefresh={handleHomeRefresh}
            tintColor={MEDICAL.primary}
            colors={[MEDICAL.primary]}
          />
        }
      >
        <View className="flex-row flex-wrap -mx-2">
          {menuItems.map(item => (
            <View key={item.id} className="w-1/3 px-2 mb-4">
              <TouchableOpacity
                className="bg-white rounded-2xl p-4 items-center border border-sky-100 shadow-sm shadow-sky-900/5"
                style={Platform.select({
                  ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                  },
                  android: { elevation: 1 },
                  web: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' },
                })}
                activeOpacity={0.7}
                onPress={() => handleMenuPress(item)}
              >
                <View className="relative">
                  <View className="w-16 h-16 rounded-2xl items-center justify-center mb-2">
                    {item.icon}
                  </View>
                  {!!item.badge && (
                    <View className="absolute -top-1 -right-1 min-w-[24px] h-[24px] rounded-full bg-orange-500 items-center justify-center px-1.5 border-2 border-white">
                      <Text className="text-white text-[10px] font-bold">{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text
                  className="text-[12px] h-8 font-bold text-sky-900 text-center leading-tight"
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
