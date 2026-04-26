import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, ClipboardList, FileText } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PatientTestResultsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
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
            <Text className="text-slate-900 text-lg font-extrabold">Kết quả & luồng lab</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Phân tích và gửi chờ bác sĩ qua chi tiết đơn hàng
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-2xl border border-sky-100 bg-white p-4 mb-4">
          <View className="flex-row items-start gap-3">
            <View className="w-12 h-12 rounded-2xl bg-sky-100 items-center justify-center">
              <FileText size={26} color="#0284C7" />
            </View>
            <View className="flex-1">
              <Text className="text-slate-900 font-extrabold text-[15px] leading-5">
                Upload file Excel tổng hợp
              </Text>
              <Text className="text-slate-600 text-[13px] mt-2 leading-5">

              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/staff/orders')}
          className="rounded-2xl bg-sky-600 py-4 px-4 flex-row items-center justify-center gap-2 active:bg-sky-700"
          activeOpacity={0.88}
        >
          <ClipboardList size={20} color="#fff" />
          <Text className="text-white font-extrabold text-[15px]">Mở danh sách đơn hàng</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
