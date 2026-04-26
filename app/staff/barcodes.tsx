import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  PackagePlus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MEDICAL } from "@/lib/theme/medical";
import { barcodeService, type BarcodeResponse } from "@/services/barcodeService";

const BARCODE_STATUS_LABEL: Record<string, string> = {
  created: "Đã tạo",
  not_printed: "Chưa in",
  printed: "Đã in",
};

const formatDate = (d?: string) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("vi-VN");
  } catch {
    return d;
  }
};

export default function StaffBarcodesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [batchModal, setBatchModal] = useState(false);
  const [batchQty, setBatchQty] = useState("10");
  const [creating, setCreating] = useState(false);

  const {
    data: res,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["staff-barcodes"],
    queryFn: () => barcodeService.getAll(),
  });

  const rows = useMemo(() => {
    const raw =
      res?.success && Array.isArray(res.data) ? (res.data as BarcodeResponse[]) : [];
    const newestFirst = [...raw].reverse();
    let list = newestFirst;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => String(b.barcode || "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      list = list.filter(
        (b) => String(b.status || "").toLowerCase() === statusFilter.toLowerCase()
      );
    }
    return list;
  }, [res, search, statusFilter]);

  const handleCreateOne = async () => {
    setCreating(true);
    try {
      const r = await barcodeService.create();
      if (!r.success) {
        Alert.alert("Lỗi", r.error || "Không tạo được barcode");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["staff-barcodes"] });
      await queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      Alert.alert("Thành công", "Đã tạo 1 barcode mới.");
    } catch (e) {
      Alert.alert("Lỗi", "Không tạo được barcode");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateBatch = async () => {
    const n = parseInt(batchQty, 10);
    if (Number.isNaN(n) || n < 1 || n > 1000) {
      Alert.alert("Lỗi", "Số lượng từ 1 đến 1000");
      return;
    }
    setCreating(true);
    try {
      const r = await barcodeService.createBatch({ quantity: n });
      if (!r.success) {
        Alert.alert("Lỗi", r.error || "Không tạo được lô barcode");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["staff-barcodes"] });
      await queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      setBatchModal(false);
      setBatchQty("10");
      Alert.alert("Thành công", `Đã tạo ${n} barcode.`);
    } catch {
      Alert.alert("Lỗi", "Không tạo được lô barcode");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (b: BarcodeResponse) => {
    Alert.alert("Xóa barcode", `Xóa ${b.barcode}?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          const r = await barcodeService.delete(b.barcode);
          if (!r.success) {
            Alert.alert("Lỗi", r.error || "Không xóa được");
            return;
          }
          await queryClient.invalidateQueries({ queryKey: ["staff-barcodes"] });
          await queryClient.invalidateQueries({ queryKey: ["barcodes"] });
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={MEDICAL.primary} />
        <Text className="mt-3 text-sky-700 font-semibold">Đang tải...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-sky-900 font-bold text-center mb-4">Không tải được dữ liệu</Text>
        <TouchableOpacity
          className="bg-sky-600 px-6 py-3 rounded-2xl"
          onPress={() => refetch()}
        >
          <Text className="text-white font-extrabold">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <View className="px-4 pt-2 pb-3 bg-white border-b border-sky-100">
        <View className="flex-row items-center mb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
          >
            <ArrowLeft size={20} color={MEDICAL.primary} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-sky-950">Quản lý barcode</Text>
            <Text className="text-xs text-sky-600">{rows.length} mã</Text>
          </View>
          <TouchableOpacity
            onPress={() => refetch()}
            className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center"
          >
            <RefreshCw size={18} color={MEDICAL.primary} />
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2 mb-3">
          <TouchableOpacity
            onPress={handleCreateOne}
            disabled={creating}
            className="flex-1 flex-row items-center justify-center bg-sky-600 py-3 rounded-2xl"
            style={{ opacity: creating ? 0.7 : 1 }}
          >
            <PackagePlus size={18} color="#fff" />
            <Text className="text-white font-extrabold ml-2">Tạo 1 mã</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setBatchModal(true)}
            disabled={creating}
            className="flex-1 flex-row items-center justify-center bg-white border border-sky-300 py-3 rounded-2xl"
            style={{ opacity: creating ? 0.7 : 1 }}
          >
            <Text className="text-sky-800 font-extrabold">Tạo lô</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100 mb-2">
          <Search size={18} color={MEDICAL.primaryDark} />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-sky-950 font-semibold"
            placeholder="Tìm mã barcode..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.trim() ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {["all", "created", "not_printed", "printed"].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-xl border ${
                  statusFilter === s ? "bg-sky-600 border-sky-600" : "bg-white border-sky-100"
                }`}
              >
                <Text
                  className={`text-xs font-extrabold ${
                    statusFilter === s ? "text-white" : "text-sky-800"
                  }`}
                >
                  {s === "all"
                    ? "Tất cả"
                    : BARCODE_STATUS_LABEL[s] || s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={MEDICAL.primary} />
        }
      >
        {rows.length === 0 ? (
          <View className="bg-white rounded-3xl p-8 items-center border border-sky-100">
            <Text className="text-sky-600 font-semibold text-center">Không có barcode phù hợp</Text>
          </View>
        ) : (
          rows.map((b) => {
            const st = String(b.status || "").toLowerCase();
            const label = BARCODE_STATUS_LABEL[st] || b.status || "—";
            return (
              <View
                key={b.barcode}
                className="bg-white rounded-2xl p-4 mb-3 border border-sky-100 flex-row items-center justify-between"
              >
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-extrabold text-sky-950" selectable>
                    {b.barcode}
                  </Text>
                  <Text className="text-xs text-sky-600 mt-1">
                    Trạng thái: <Text className="font-bold text-sky-900">{label}</Text>
                  </Text>
                  <Text className="text-[11px] text-sky-500 mt-1">
                    Tạo: {formatDate(b.createAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(b)}
                  className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 items-center justify-center"
                >
                  <Trash2 size={18} color="#b91c1c" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={batchModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-3xl p-5">
            <Text className="text-lg font-extrabold text-sky-950 mb-1">Tạo lô barcode</Text>
            <Text className="text-xs text-sky-600 mb-3">Số lượng từ 1 đến 1000</Text>
            <TextInput
              keyboardType="number-pad"
              value={batchQty}
              onChangeText={setBatchQty}
              className="border border-sky-200 rounded-2xl px-4 py-3 text-sky-950 font-bold mb-4"
            />
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setBatchModal(false)}
                className="flex-1 py-3 rounded-2xl bg-sky-50 border border-sky-200 items-center"
              >
                <Text className="font-extrabold text-sky-800">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateBatch}
                disabled={creating}
                className="flex-1 py-3 rounded-2xl bg-sky-600 items-center"
                style={{ opacity: creating ? 0.7 : 1 }}
              >
                <Text className="font-extrabold text-white">Tạo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
