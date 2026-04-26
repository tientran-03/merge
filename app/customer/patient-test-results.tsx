import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, FileText, Upload } from 'lucide-react-native';
import React from 'react';
import { Alert, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PatientTestResultsScreen() {
  const router = useRouter();

  const handleUpload = () => {
    Alert.alert(
      'Tính năng đang phát triển',
      'Chức năng upload kết quả xét nghiệm sẽ được triển khai trong phiên bản tiếp theo.',
      [{ text: 'Đóng' }]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
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
            <Text className="text-slate-900 text-lg font-extrabold">Kết quả xét nghiệm</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Upload và quản lý kết quả xét nghiệm
            </Text>
          </View>
        </View>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 items-center justify-center py-20">
          <View className="w-24 h-24 rounded-full bg-sky-100 items-center justify-center mb-6">
            <FileText size={48} color="#0284C7" />
          </View>
          <Text className="text-slate-900 text-xl font-extrabold mb-2 text-center">
            Kết quả xét nghiệm
          </Text>
          <Text className="text-slate-500 text-sm text-center mb-8 px-4">
            Tính năng này cho phép bạn upload và quản lý kết quả xét nghiệm từ file Excel. Tính năng
            đang được phát triển và sẽ sớm có mặt.
          </Text>

          <TouchableOpacity
            onPress={handleUpload}
            className="px-6 py-3 bg-sky-600 rounded-xl flex-row items-center"
            activeOpacity={0.8}
          >
            <Upload size={18} color="#fff" />
            <Text className="ml-2 text-white font-extrabold">Upload Excel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
