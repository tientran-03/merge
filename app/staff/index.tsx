import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { ClipboardClock } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ensurePaidOrderPatientMetadataLikeWeb } from '@/lib/ensurePaidOrderPatientMetadataWebStyle';
import { fetchPendingApprovalOrders } from '@/lib/orders-pending';
import { ROOT_HREF } from '@/lib/router-href';
import { isSampleAddPendingApproval } from '@/lib/sample-add-pending';
import { getApiResponseData } from '@/lib/types/api-types';
import { OrderResponse, orderService } from '@/services/orderService';
import { SampleAddResponse, sampleAddService } from '@/services/sampleAddService';

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

export default function StaffHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout, user, isLoading } = useAuth();
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const staffHospitalId =
    user?.hospitalId != null && user.hospitalId !== '' ? String(user.hospitalId) : null;

  useFocusEffect(
    useCallback(() => {
      if (!user || user.role !== 'ROLE_STAFF' || !staffHospitalId) return;
      let cancelled = false;
      void (async () => {
        try {
          const r = await ensurePaidOrderPatientMetadataLikeWeb(staffHospitalId);
          if (cancelled) return;
          if (r.createdLabRows > 0) {
            void queryClient.invalidateQueries({ queryKey: ['patient-metadatas'] });
            void queryClient.invalidateQueries({ queryKey: ['orders'] });
          }
        } catch {
          // silent — không chặn vào màn staff
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id, user?.role, staffHospitalId, queryClient])
  );

  const { data: ordersResponse } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderService.getAll(),
    retry: false,
  });

  const { data: pendingApprovalOrders = [] } = useQuery({
    queryKey: ['orders-pending', 'forward_analysis', 'sample_addition'],
    queryFn: fetchPendingApprovalOrders,
    retry: false,
  });

  const { data: sampleAddsResponse } = useQuery({
    queryKey: ['sample-adds'],
    queryFn: () => sampleAddService.getAll(),
    retry: false,
    staleTime: 60_000,
  });

  const pendingSampleAddsCount = useMemo(() => {
    const list = getApiResponseData<SampleAddResponse>(sampleAddsResponse) || [];
    return list.filter(s => isSampleAddPendingApproval(s.status)).length;
  }, [sampleAddsResponse]);

  const initiationOrdersCount = useMemo(() => {
    if (!ordersResponse?.success || !ordersResponse.data) return 0;
    const orders = ordersResponse.data as OrderResponse[];
    return orders.filter(o => String(o.orderStatus).toLowerCase() === 'initiation').length;
  }, [ordersResponse]);

  const pendingApprovalCount = pendingApprovalOrders.length;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(ROOT_HREF);
      return;
    }
    if (!isLoading && user?.role) {
      if (user.role === 'ROLE_CUSTOMER') {
        router.replace('/customer');
      } else if (user.role === 'ROLE_ADMIN') {
        router.replace('/admin');
      } else if (user.role === 'ROLE_DOCTOR') {
        router.replace('/doctor');
      } else if (user.role === 'ROLE_LAB_TECHNICIAN') {
        router.replace('/lab-technician');
      } else if (user.role === 'ROLE_SAMPLE_COLLECTOR') {
        router.replace('/sample-collector');
      }
    }
  }, [user?.role, user, isLoading]);

  const menuItems = useMemo(() => {
    const allMenuItems: MenuItem[] = [
      { id: '1', title: 'Thêm nhanh\nđơn hàng', icon: <Image source={require('@/assets/staff/i01_them_nhanh_don_hang.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/quick-order' },
      { id: '2', title: 'Thêm mới\nđơn hàng', icon: <Image source={require('@/assets/staff/i02_them_moi_don_hang.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/create-order' },
      { id: '3', title: 'Danh sách\nbệnh nhân', icon: <Image source={require('@/assets/staff/i03_danh_sach_benh_nhan.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/patients' },
      { id: '4', title: 'Trả kết quả\nxét nghiệm', icon: <Image source={require('@/assets/staff/i08_quan_ly_phieu_xn.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/patient-results' },
      { id: '5', title: 'Quản lý\ndịch vụ', icon: <Image source={require('@/assets/staff/i04_quan_ly_dich_vu.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/services' },
      { id: '6', title: 'Báo cáo\nthống kê', icon: <Image source={require('@/assets/staff/i05_bao_cao_thong_ke.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/statistics' },
      { id: '7', title: 'Danh sách\nđơn hàng', icon: <Image source={require('@/assets/staff/i06_danh_sach_don_hang.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/orders', badge: initiationOrdersCount > 0 ? initiationOrdersCount : undefined },
      {
        id: '7a',
        title: 'Đơn hàng chờ\nduyệt',
        icon: <Image source={require('@/assets/staff/i09_don_hang_dang_phan_tich.png')} className="w-16 h-16" resizeMode="contain" />,
        route: '/staff/orders-pending',
        badge: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
      },
      { id: '8', title: 'Thông tin\nngười dùng', icon: <Image source={require('@/assets/staff/i07_thong_tin_nguoi_dung.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/profile' },
      { id: '9', title: 'Quản lý\nphiếu XN', icon: <Image source={require('@/assets/staff/i08_quan_ly_phieu_xn.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/prescription-slips' },
      { id: '12', title: 'Đơn hàng đang\nphân tích', icon: <Image source={require('@/assets/staff/i09_don_hang_dang_phan_tich.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/orders' },
      { id: '13', title: 'Quản lý mẫu\nxét nghiệm', icon: <Image source={require('@/assets/staff/i10_quan_ly_mau_xet_nghiem.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/patient-metadatas' },
      { id: '14', title: 'Mẫu xét nghiệm\nbổ sung', icon: <Image source={require('@/assets/staff/i11_mau_xet_nghiem_bo_sung.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/additional-samples' },
      {
        id: '14b',
        title: 'Mẫu BS\nchờ duyệt',
        icon: (
          <View className="h-16 w-16 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
            <ClipboardClock size={32} color="#d97706" strokeWidth={2.2} />
          </View>
        ),
        route: '/staff/sample-adds-pending',
        badge: pendingSampleAddsCount > 0 ? pendingSampleAddsCount : undefined,
      },
      { id: '17', title: 'Tạo hóa\nđơn', icon: <Image source={require('@/assets/staff/i13_tao_hoa_don.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/invoice-creation' },
      { id: '18', title: 'Quản lý\nbarcode', icon: <Image source={require('@/assets/staff/i14_quan_ly_barcode.png')} className="w-16 h-16" resizeMode="contain" />, route: '/staff/barcodes' },
      { id: '16', title: 'Đăng xuất', icon: <Image source={require('@/assets/staff/13_dang_xuat.png')} className="w-16 h-16" resizeMode="contain" />, route: 'logout' },
    ];
    return allMenuItems;
  }, [initiationOrdersCount, pendingApprovalCount, pendingSampleAddsCount]);

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      if (item.route === 'logout') logout();
      else if (item.route) router.push(item.route as any);
    },
    [router, logout]
  );

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-pending'] }),
        queryClient.invalidateQueries({ queryKey: ['sample-adds'] }),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [queryClient]);

  if (
    isLoading ||
    !user ||
    user.role === 'ROLE_CUSTOMER' ||
    user.role === 'ROLE_ADMIN' ||
    user.role === 'ROLE_DOCTOR' ||
    user.role === 'ROLE_LAB_TECHNICIAN' ||
    user.role === 'ROLE_SAMPLE_COLLECTOR'
  ) {
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
          <View className="bg-sky-600 px-3 py-1 rounded-full">
            <Text className="text-white text-xs font-bold">NHÂN VIÊN</Text>
          </View>
        </View>
      </ImageBackground>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => void handlePullRefresh()}
            tintColor="#0891b2"
            colors={['#0891b2']}
          />
        }
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
