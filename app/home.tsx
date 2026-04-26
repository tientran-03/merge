import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { Image, ImageBackground, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ROLE_DOCTOR, ROLE_LAB_TECHNICIAN, ROLE_STAFF } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { OrderResponse, orderService } from "@/services/orderService";

interface MenuItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  route?: string;
  badge?: number;
}

const isPendingStatus = (status: string): boolean => {
  const s = status.toLowerCase();
  return (
    s === "initiation" ||
    s === "accepted" ||
    s === "in_progress" ||
    s === "forward_analysis"
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const { data: ordersResponse } = useQuery({
    queryKey: ["orders"],
    queryFn: () => orderService.getAll(),
    retry: false,
  });

  const pendingOrdersCount = useMemo(() => {
    if (!ordersResponse?.success || !ordersResponse.data) return 0;
    const orders = ordersResponse.data as OrderResponse[];
    return orders.filter((o) => isPendingStatus(o.orderStatus)).length;
  }, [ordersResponse]);

  const showTestResultsDelivery = useMemo(() => {
    const r = user?.role;
    return r === ROLE_DOCTOR || r === ROLE_LAB_TECHNICIAN || r === ROLE_STAFF;
  }, [user?.role]);

  const menuItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [
    {
      id: "1",
      title: "Thêm nhanh\nđơn hàng",
      icon: <Image
            source={require("@/assets/images/1.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/quick-order",
    },
    {
      id: "2",
      title: "Thêm mới\nđơn hàng",
      icon: <Image
            source={require("@/assets/images/1.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/create-order",
    },
    {
      id: "3",
      title: "Thêm mẫu bổ\nsung",
      icon: <Image
            source={require("@/assets/images/2.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/additional-samples",
    },
    {
      id: "4",
      title: "Danh sách\nbệnh nhân",
      icon: <Image
            source={require("@/assets/images/3.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/patients",
    },
    {
      id: "5",
      title: "Danh sách\ndịch vụ",
      icon: <Image
            source={require("@/assets/images/4.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/services",
    },
    {
      id: "6",
      title: "Báo cáo\nthống kê",
      icon: <Image
            source={require("@/assets/images/5.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/statistics",
    },
    {
      id: "7",
      title: "Danh sách\nđơn hàng",
      icon: <Image
            source={require("@/assets/images/6.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/orders",
    },
    ];
    if (showTestResultsDelivery) {
      items.push({
        id: "7-tr",
        title: "Trả kết quả\nxét nghiệm",
        icon: (
          <Image
            source={require("@/assets/images/4.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />
        ),
        route: "/admin/test-results",
      });
    }
    items.push(
    {
      id: "8",
      title: "Thông tin\nngười dùng",
      icon: <Image
            source={require("@/assets/images/7.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/profile",
    },
    {
      id: "9",
      title: "Phiếu chỉ\nđịnh",
      icon: <Image
            source={require("@/assets/images/6.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/prescription-slips",
    },
    {
      id: "10",
      title: "Phiếu chỉ\nđịnh đã có k...",
      icon: <Image
            source={require("@/assets/images/8.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/prescription-slips",
    },
    {
      id: "11",
      title: "Đơn hàng chờ\ncập nhật",
      icon: <Image
            source={require("@/assets/images/6.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "/pending-orders",
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
    },
    {
      id: "12",
      title: "Đăng xuất",
      icon: <Image
            source={require("@/assets/images/9.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />,
      route: "logout",
    },
    );
    return items;
  }, [showTestResultsDelivery, pendingOrdersCount]);

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      if (item.route === "logout") {
        logout();
      } else if (item.route) {
        router.push(item.route as any);
      }
    },
    [router, logout],
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header with background image */}
      <ImageBackground
        source={require("@/assets/images/bg.png")}
        className="pt-12 pb-6 px-6"
        style={{ 
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
        resizeMode="cover"
      >
        <View className="w-64 h-16">
          {/* <Image
            source={require("@/assets/images/bg.png")}
            className="w-64 h-16"
            resizeMode="contain"
          /> */}
        </View>
      </ImageBackground>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row flex-wrap -mx-2">
          {menuItems.map((item) => (
            <View key={item.id} className="w-1/3 px-2 mb-4">
              <TouchableOpacity
                className="bg-white rounded-xl p-4 items-center border border-gray-100"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
                activeOpacity={0.7}
                onPress={() => handleMenuPress(item)}
              >
                <View className="relative">
                  <View className="w-16 h-16 rounded-2xl items-center justify-center mb-2">
                    {item.icon}
                  </View>

                  {!!item.badge && (
                    <View className="absolute -top-1 -right-1 min-w-[24px] h-[24px] rounded-full bg-orange-500 items-center justify-center px-1.5 border-2 border-white">
                      <Text className="text-white text-[10px] font-bold">
                        {item.badge}
                      </Text>
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
