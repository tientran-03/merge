import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  sampleAddServiceConfigService,
  SampleAddServiceConfigResponse,
} from "@/services/sampleAddServiceConfigService";
import { clampDecimalStringToMax } from "@/utils/numericClamp";

const MIN_PRICE = 10000;
const MAX_PRICE = 1_000_000_000;
const MAX_TAX_RATE = 100;
const MAX_NAME_LENGTH = 255;
const MAX_SEARCH_LENGTH = 100;

function formatVndInput(value: string): string {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  if (n > MAX_PRICE) return new Intl.NumberFormat("vi-VN").format(MAX_PRICE);
  return new Intl.NumberFormat("vi-VN").format(n);
}

function parseVndInput(value: string): number {
  const cleaned = value.replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

function formatMoney(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(n))} đ`;
}

function formatDateVi(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN");
}

export function SampleAddServicesPanel() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SampleAddServiceConfigResponse | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; price?: string; tax?: string }>(
    {}
  );

  const query = useQuery({
    queryKey: ["admin-sample-add-services"],
    queryFn: async () => {
      const res = await sampleAddServiceConfigService.getAll();
      if (res.success && res.data) return res.data;
      throw new Error(res.error || res.message || "Không tải được danh sách");
    },
  });

  const rows = query.data ?? [];

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.sampleName?.toLowerCase().includes(q) ||
        r.id?.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-sample-add-services"] });

  const createMut = useMutation({
    mutationFn: async (payload: { sampleName: string; price: number; taxRate?: number }) => {
      const res = await sampleAddServiceConfigService.create(payload);
      if (res.success && res.data) return res.data;
      throw new Error(res.error || res.message || "Không tạo được");
    },
    onSuccess: () => {
      invalidate();
      closeModal();
      Alert.alert("Thành công", "Đã thêm dịch vụ thêm mẫu");
    },
    onError: (e: any) => Alert.alert("Lỗi", e?.message || "Không tạo được"),
  });

  const updateMut = useMutation({
    mutationFn: async (vars: {
      id: string;
      payload: { sampleName: string; price: number; taxRate?: number };
    }) => {
      const res = await sampleAddServiceConfigService.update(vars.id, vars.payload);
      if (res.success && res.data) return res.data;
      throw new Error(res.error || res.message || "Không cập nhật được");
    },
    onSuccess: () => {
      invalidate();
      closeModal();
      Alert.alert("Thành công", "Đã cập nhật dịch vụ thêm mẫu");
    },
    onError: (e: any) => Alert.alert("Lỗi", e?.message || "Không cập nhật được"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await sampleAddServiceConfigService.delete(id);
      if (res.success) return;
      throw new Error(res.error || res.message || "Không xóa được");
    },
    onSuccess: () => {
      invalidate();
      Alert.alert("Thành công", "Đã xóa dịch vụ thêm mẫu");
    },
    onError: (e: any) => Alert.alert("Lỗi", e?.message || "Không xóa được"),
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setPrice("");
    setTaxRate("");
    setFieldErrors({});
    setModalOpen(true);
  };

  const openEdit = (item: SampleAddServiceConfigResponse) => {
    setEditing(item);
    setName(item.sampleName || "");
    setPrice(item.price != null ? formatVndInput(String(Math.round(item.price))) : "");
    setTaxRate(
      item.taxRate != null && Number.isFinite(item.taxRate) ? String(item.taxRate) : ""
    );
    setFieldErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setName("");
    setPrice("");
    setTaxRate("");
    setFieldErrors({});
  };

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    const trimmed = name.trim();
    if (!trimmed) errors.name = "Tên mẫu không được để trống.";
    else if (trimmed.length > MAX_NAME_LENGTH) {
      errors.name = `Tên tối đa ${MAX_NAME_LENGTH} ký tự.`;
    }
    const p = parseVndInput(price);
    if (!price.trim()) errors.price = "Giá tiền là bắt buộc.";
    else if (p < MIN_PRICE) errors.price = "Giá tối thiểu là 10.000 đ.";
    else if (p > MAX_PRICE) errors.price = "Giá vượt quá giới hạn cho phép.";
    if (taxRate.trim()) {
      const t = Number(taxRate.replace(",", "."));
      if (!Number.isFinite(t) || t < 0 || t > MAX_TAX_RATE) {
        errors.tax = "Thuế suất phải từ 0 đến 100%.";
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = () => {
    if (!validate()) {
      Alert.alert("Lỗi", "Vui lòng kiểm tra lại thông tin nhập.");
      return;
    }
    const payload = {
      sampleName: name.trim(),
      price: parseVndInput(price),
      taxRate: taxRate.trim() ? Number(taxRate.replace(",", ".")) : undefined,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const confirmDelete = (item: SampleAddServiceConfigResponse) => {
    Alert.alert(
      "Xác nhận xóa",
      `Xóa dịch vụ thêm mẫu "${item.sampleName}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => deleteMut.mutate(item.id),
        },
      ]
    );
  };

  const onTaxChange = (v: string) => {
    const cleaned = v.replace(/[^\d.,]/g, "").replace(",", ".");
    if (!(cleaned === "" || /^\d*\.?\d*$/.test(cleaned))) return;
    const base = cleaned === "." ? "0." : cleaned;
    setTaxRate(clampDecimalStringToMax(base, MAX_TAX_RATE));
  };

  if (query.isLoading && !query.data) {
    return (
      <View className="flex-1 justify-center items-center py-16">
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dịch vụ thêm mẫu...</Text>
      </View>
    );
  }

  if (query.isError) {
    return (
      <View className="flex-1 justify-center items-center py-12 px-5">
        <Text className="text-base font-extrabold text-slate-900 text-center mb-2">
          Không tải được dữ liệu
        </Text>
        <Text className="text-xs text-slate-500 text-center mb-4">
          {(query.error as Error)?.message || "Lỗi không xác định"}
        </Text>
        <TouchableOpacity
          className="bg-sky-600 py-3 px-6 rounded-2xl"
          onPress={() => query.refetch()}
          activeOpacity={0.85}
        >
          <Text className="text-white text-sm font-extrabold">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="px-4 pb-3 flex-row items-center gap-2">
        <TouchableOpacity
          onPress={openCreate}
          className="h-10 px-3 rounded-xl bg-emerald-600 flex-row items-center"
          activeOpacity={0.85}
        >
          <Plus size={18} color="#fff" />
          <Text className="ml-1 text-white text-xs font-extrabold">Thêm mới</Text>
        </TouchableOpacity>
        <View className="flex-1 flex-row items-center rounded-2xl px-3 bg-white border border-sky-100">
          <Search size={16} color="#64748B" />
          <TextInput
            className="flex-1 h-10 ml-2 text-[13px] text-slate-900 font-semibold"
            placeholder="Tìm theo tên hoặc mã..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={(t) => setSearchQuery(t.replace(/^\s+/, "").slice(0, MAX_SEARCH_LENGTH))}
            returnKeyType="search"
          />
          {!!searchQuery.trim() && (
            <TouchableOpacity onPress={() => setSearchQuery("")} className="p-1">
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />
        }
      >
        {filtered.length === 0 ? (
          <View className="py-16 items-center">
            <Text className="text-slate-600 font-bold text-center">
              {searchQuery.trim() ? "Không có bản ghi phù hợp" : "Chưa có dịch vụ thêm mẫu"}
            </Text>
            <Text className="mt-2 text-xs text-slate-500 text-center px-6">
              Thêm cấu hình giá giống trang quản trị trên web.
            </Text>
          </View>
        ) : (
          filtered.map((item) => (
            <View
              key={item.id}
              className="bg-white rounded-2xl p-4 mb-3 border border-violet-100"
            >
              <Text className="text-[11px] font-bold text-violet-600 mb-1">ID: {item.id}</Text>
              <Text className="text-base font-extrabold text-slate-900">{item.sampleName}</Text>
              <View className="mt-2 gap-1">
                <Text className="text-xs text-slate-600">
                  Giá gốc: <Text className="font-bold text-slate-800">{formatMoney(item.price)}</Text>
                </Text>
                <Text className="text-xs text-slate-600">
                  Thuế:{" "}
                  <Text className="font-bold text-slate-800">
                    {item.taxRate != null ? `${item.taxRate}%` : "—"}
                  </Text>
                </Text>
                <Text className="text-xs text-slate-600">
                  Sau thuế:{" "}
                  <Text className="font-bold text-emerald-700">{formatMoney(item.finalPrice)}</Text>
                </Text>
                <Text className="text-xs text-slate-500">Ngày tạo: {formatDateVi(item.createdAt)}</Text>
              </View>
              <View className="flex-row mt-3 gap-2">
                <TouchableOpacity
                  onPress={() => openEdit(item)}
                  className="flex-1 flex-row items-center justify-center py-2 rounded-xl bg-sky-50 border border-sky-200"
                  activeOpacity={0.8}
                >
                  <Pencil size={14} color="#0369a1" />
                  <Text className="ml-1 text-xs font-extrabold text-sky-800">Sửa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  disabled={deleteMut.isPending}
                  className="flex-1 flex-row items-center justify-center py-2 rounded-xl bg-red-50 border border-red-200 opacity-95"
                  activeOpacity={0.8}
                >
                  <Trash2 size={14} color="#b91c1c" />
                  <Text className="ml-1 text-xs font-extrabold text-red-800">Xóa</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View className="h-6" />
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
            className="w-full max-w-[400px]"
          >
            <View className="bg-white rounded-3xl p-6 w-full">
              <Text className="text-lg font-extrabold text-slate-900 mb-1">
                {editing ? "Sửa dịch vụ thêm mẫu" : "Thêm dịch vụ thêm mẫu"}
              </Text>
              <Text className="text-xs text-slate-500 mb-4">
                Tên mẫu, giá (VNĐ) và thuế suất (%). Để trống thuế để dùng mặc định server (10%).
              </Text>

              <Text className="text-xs font-bold text-slate-700 mb-2">Tên mẫu *</Text>
              <TextInput
                className={`h-11 rounded-xl px-3 border text-sm text-slate-900 font-semibold mb-1 ${
                  fieldErrors.name ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"
                }`}
                placeholder="VD: Mẫu máu bổ sung"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={(t) => {
                  setName(t.slice(0, MAX_NAME_LENGTH));
                  if (fieldErrors.name) setFieldErrors((e) => ({ ...e, name: undefined }));
                }}
              />
              {fieldErrors.name ? (
                <Text className="text-[11px] text-red-600 mb-3">{fieldErrors.name}</Text>
              ) : (
                <View className="mb-3" />
              )}

              <Text className="text-xs font-bold text-slate-700 mb-2">Giá (VNĐ) *</Text>
              <TextInput
                className={`h-11 rounded-xl px-3 border text-sm text-slate-900 font-semibold mb-1 ${
                  fieldErrors.price ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"
                }`}
                placeholder="VD: 500.000"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={price}
                onChangeText={(t) => {
                  setPrice(formatVndInput(t));
                  if (fieldErrors.price) setFieldErrors((e) => ({ ...e, price: undefined }));
                }}
              />
              {fieldErrors.price ? (
                <Text className="text-[11px] text-red-600 mb-1">{fieldErrors.price}</Text>
              ) : (
                <Text className="text-[11px] text-slate-500 mb-3">Tối thiểu 10.000 đ</Text>
              )}

              <Text className="text-xs font-bold text-slate-700 mb-2">Thuế suất (%)</Text>
              <TextInput
                className={`h-11 rounded-xl px-3 border text-sm text-slate-900 font-semibold mb-1 ${
                  fieldErrors.tax ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"
                }`}
                placeholder="Để trống = mặc định"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                value={taxRate}
                onChangeText={(t) => {
                  onTaxChange(t);
                  if (fieldErrors.tax) setFieldErrors((e) => ({ ...e, tax: undefined }));
                }}
              />
              {fieldErrors.tax ? (
                <Text className="text-[11px] text-red-600 mb-3">{fieldErrors.tax}</Text>
              ) : (
                <View className="mb-3" />
              )}

              <View className="flex-row gap-3 mt-2">
                <TouchableOpacity
                  className="flex-1 py-3 rounded-2xl bg-slate-100 items-center"
                  onPress={closeModal}
                  disabled={createMut.isPending || updateMut.isPending}
                >
                  <Text className="text-slate-700 text-sm font-extrabold">Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 rounded-2xl bg-violet-600 items-center"
                  onPress={submit}
                  disabled={createMut.isPending || updateMut.isPending}
                >
                  {createMut.isPending || updateMut.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-sm font-extrabold">
                      {editing ? "Cập nhật" : "Tạo mới"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
