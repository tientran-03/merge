import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Download, FileText } from "lucide-react-native";
import React from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEMPLATES = [
  { id: "reproduction", label: "Phiếu chỉ định - Sinh sản", serviceType: "reproduction" },
  { id: "embryo", label: "Phiếu chỉ định - Phôi thai", serviceType: "embryo" },
  { id: "disease", label: "Phiếu chỉ định - Bệnh lý di truyền", serviceType: "disease" },
];

export default function SpecifyTemplatesScreen() {
  const router = useRouter();

  const handleDownload = (type: string) => {
    Alert.alert(
      "Tải phiếu chỉ định",
      `Tính năng tải phiếu mẫu "${type}" đang phát triển trên phiên bản mobile`,
      [{ text: "Đóng" }]
    );
  };

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
            <Text className="text-slate-900 text-lg font-extrabold">
              Tải phiếu chỉ định
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Tải phiếu mẫu trống theo loại dịch vụ
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white rounded-2xl p-4 mb-4 border border-sky-100">
          <Text className="text-sm text-slate-600 mb-4">
            Chọn loại phiếu chỉ định để tải phiếu mẫu trống (PDF/DOC). Phiếu chỉ định dùng để điền thông tin bệnh nhân và xét nghiệm trước khi gửi đến lab.
          </Text>
        </View>

        {TEMPLATES.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => handleDownload(t.label)}
            className="bg-white rounded-2xl p-4 mb-3 border border-sky-100 flex-row items-center"
            activeOpacity={0.85}
          >
            <View className="w-12 h-12 rounded-xl bg-sky-50 items-center justify-center mr-4">
              <FileText size={24} color="#0284C7" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-extrabold text-slate-900">
                {t.label}
              </Text>
              <Text className="text-xs text-slate-500 mt-0.5">
                Phiếu mẫu trống
              </Text>
            </View>
            <View className="w-10 h-10 rounded-xl bg-sky-100 items-center justify-center">
              <Download size={20} color="#0284C7" />
            </View>
          </TouchableOpacity>
        ))}

        <View className="mt-4 bg-amber-50 rounded-xl p-4 border border-amber-200">
          <Text className="text-xs text-amber-800 font-semibold mb-1">
            Lưu ý
          </Text>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
