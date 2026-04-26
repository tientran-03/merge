import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  FlaskConical,
  UserRound,
} from "lucide-react-native";
import React, { useEffect } from "react";
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";

type HubLink = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: React.ReactNode;
};

const LINKS: HubLink[] = [
  {
    id: "patients",
    title: "Hồ sơ bệnh nhân",
    subtitle: "Danh sách, tìm kiếm, tạo mới và sửa thông tin BN",
    route: "/patients",
    icon: <UserRound size={22} color="#0369a1" />,
  },
  {
    id: "metadata",
    title: "Mẫu & metadata",
    subtitle: "Trạng thái mẫu; phê duyệt đầu ra khi đang phân tích / chạy lại (giống web)",
    route: "/patient-metadatas",
    icon: <FlaskConical size={22} color="#0369a1" />,
  },
];

export default function AdminPatientDataHubScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user?.role && user.role !== "ROLE_ADMIN") {
      router.replace("/admin-home");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <View className="flex-1 bg-sky-50 items-center justify-center">
        <Text className="text-slate-500 text-sm font-medium">Đang tải...</Text>
      </View>
    );
  }

  if (user.role !== "ROLE_ADMIN") {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#0284C7" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">Quản lý dữ liệu bệnh nhân</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Trung tâm truy cập hồ sơ BN, mẫu, kết quả & phụ lục
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {LINKS.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.75}
            className="bg-white rounded-2xl border border-sky-100 px-4 py-4 mb-3 flex-row items-center"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <View className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 items-center justify-center mr-3">
              {item.icon}
            </View>
            <View className="flex-1 pr-2">
              <Text className="text-slate-900 font-extrabold text-base">{item.title}</Text>
              <Text className="text-slate-500 text-xs mt-1 leading-snug">{item.subtitle}</Text>
            </View>
            <ChevronRight size={20} color="#94a3b8" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
