import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Mail, MapPin, Phone, Trash2, User } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getApiResponseData } from "@/lib/types/api-types";
import { CustomerResponse, customerService } from "@/services/customerService";
import { orderService } from "@/services/orderService";

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const queryClient = useQueryClient();

  const {
    data: customerResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => customerService.getById(customerId!),
    enabled: !!customerId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => customerService.delete(customerId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      Alert.alert("Thành công", "Khách hàng đã được xóa thành công", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error?.message || "Không thể xóa khách hàng. Vui lòng thử lại.");
    },
  });

  const handleDelete = () => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa khách hàng này? Hành động này không thể hoàn tác.",
      [
        {
          text: "Hủy",
          style: "cancel",
        },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error || !customerResponse?.success) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-slate-900 text-center mb-2">
            Không tải được dữ liệu
          </Text>
          <Text className="text-xs text-slate-500 text-center mb-4">
            {error?.message || "Không tìm thấy khách hàng"}
          </Text>
          <TouchableOpacity
            className="bg-sky-600 py-3 rounded-2xl items-center"
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text className="text-white text-sm font-extrabold">Quay lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const customer: CustomerResponse = customerResponse.data as CustomerResponse;

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color="#0284C7" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-slate-900 text-lg font-extrabold">Chi tiết khách hàng</Text>
              <Text className="mt-0.5 text-xs text-slate-500">{customer.customerId}</Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            {/* TODO: Implement edit-customer screen */}
            {/* <TouchableOpacity
              onPress={() => {
                if (customerId) {
                  router.push({
                    pathname: "/edit-customer",
                    params: { customerId },
                  });
                }
              }}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center"
              activeOpacity={0.8}
            >
              <Edit size={18} color="#0284C7" />
            </TouchableOpacity> */}
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 items-center justify-center"
              activeOpacity={0.8}
            >
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white rounded-2xl border border-sky-100 p-4">
          <Text className="text-slate-900 text-base font-extrabold mb-4">Thông tin khách hàng</Text>

          <View className="gap-3">
            <View className="flex-row items-start">
              <User size={18} color="#64748B" className="mt-0.5" />
              <View className="ml-3 flex-1">
                <Text className="text-xs text-slate-500 font-bold">Tên khách hàng</Text>
                <Text className="mt-1 text-sm font-extrabold text-slate-900">
                  {customer.customerName}
                </Text>
              </View>
            </View>

            {customer.customerPhone && (
              <View className="flex-row items-start">
                <Phone size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Số điện thoại</Text>
                  <Text className="mt-1 text-sm font-extrabold text-slate-900">
                    {customer.customerPhone}
                  </Text>
                </View>
              </View>
            )}

            {customer.customerEmail && (
              <View className="flex-row items-start">
                <Mail size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Email</Text>
                  <Text className="mt-1 text-sm font-extrabold text-slate-900">
                    {customer.customerEmail}
                  </Text>
                </View>
              </View>
            )}

            {customer.customerAddress && (
              <View className="flex-row items-start">
                <MapPin size={18} color="#64748B" className="mt-0.5" />
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-slate-500 font-bold">Địa chỉ</Text>
                  <Text className="mt-1 text-sm text-slate-900">{customer.customerAddress}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
