import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Filter,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaginationControls } from '@/components/PaginationControls';
import { useAuth } from '@/contexts/AuthContext';
import { patientGenderLabel, patientMatchesSearch } from '@/lib/patient-utils';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { MEDICAL } from '@/lib/theme/medical';
import { patientService, PatientResponse } from '@/services/patientService';

type GenderFilter = 'all' | 'male' | 'female';

export default function PatientsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const hospitalId = user?.hospitalId?.trim();

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [focusSearch, setFocusSearch] = useState(false);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput), 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedQuery, genderFilter, hospitalId]);

  const {
    data: listRes,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['patients', 'customer-list', hospitalId ?? 'no-hosp'],
    queryFn: async () => {
      if (hospitalId) {
        return patientService.getByHospitalId(hospitalId);
      }
      return patientService.getAll({ page: 0, size: 2000 });
    },
    enabled: !!user,
  });

  const allPatients: PatientResponse[] = useMemo(() => {
    if (!listRes?.success || !listRes.data) return [];
    const raw = listRes.data;
    return Array.isArray(raw) ? raw : [];
  }, [listRes]);

  const filtered = useMemo(() => {
    let rows = [...allPatients];
    const q = debouncedQuery.trim();
    if (q) {
      rows = rows.filter(p => patientMatchesSearch(p, q));
    }
    if (genderFilter !== 'all') {
      rows = rows.filter(p => {
        const g = String(p.gender ?? '')
          .toLowerCase()
          .trim();
        return g === genderFilter;
      });
    }
    return rows;
  }, [allPatients, debouncedQuery, genderFilter]);

  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const safePage = Math.min(currentPage, totalPages - 1);
  const patients = useMemo(() => {
    const start = safePage * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => patientService.delete(id),
    onSuccess: (res, id) => {
      if (!res.success) {
        presentFeedbackError({
          title: 'Lỗi',
          message: res.error || res.message || 'Không thể xóa bệnh nhân',
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      presentFeedbackSuccess({ title: 'Thành công', message: 'Đã xóa bệnh nhân.' });
    },
    onError: (e: any) => {
      presentFeedbackError({ title: 'Lỗi', message: e?.message || 'Không thể xóa bệnh nhân' });
    },
  });

  const confirmDelete = (p: PatientResponse) => {
    const name = p.patientName || p.name || p.patientId;
    Alert.alert(
      'Xác nhận xóa',
      `Xóa bệnh nhân "${name}"? Thao tác không hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(p.patientId),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <ActivityIndicator size="large" color={MEDICAL.primary} />
        <Text className="mt-3 text-sky-700 text-sm font-bold">Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
          <Text className="text-base font-extrabold text-sky-950 text-center mb-2">
            Không tải được dữ liệu
          </Text>
          <TouchableOpacity
            className="bg-sky-600 py-3 rounded-2xl items-center"
            onPress={() => refetch()}
            activeOpacity={0.85}
          >
            <Text className="text-white text-sm font-extrabold">Thử lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const filterActive = genderFilter !== 'all';

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <View className="pb-3 px-4 bg-white border-b border-sky-100 shadow-sm shadow-sky-900/5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mr-3"
              activeOpacity={0.8}
            >
              <ArrowLeft size={20} color={MEDICAL.primary} />
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-sky-950 text-lg font-extrabold">Bệnh nhân</Text>
              <Text className="mt-0.5 text-xs text-sky-700/80">
                {hospitalId ? 'Danh sách theo bệnh viện' : 'Tra cứu & quản lý'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowFilter(v => !v)}
              className={`w-10 h-10 rounded-xl items-center justify-center mr-2 border ${
                filterActive ? 'bg-amber-50 border-amber-200' : 'bg-sky-50 border-sky-200'
              }`}
              activeOpacity={0.8}
            >
              <Filter size={18} color={filterActive ? '#B45309' : MEDICAL.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/customer/create-patient')}
              className="w-10 h-10 rounded-xl bg-sky-600 border border-sky-700 items-center justify-center mr-2"
              activeOpacity={0.8}
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>

            <View className="px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-200">
              <Text className="text-sm font-extrabold text-sky-700">{totalElements}</Text>
            </View>
          </View>
        </View>

        {showFilter && (
          <View className="mt-3 flex-row flex-wrap gap-2">
            {(
              [
                { k: 'all' as const, label: 'Tất cả' },
                { k: 'male' as const, label: 'Nam' },
                { k: 'female' as const, label: 'Nữ' },
              ] as const
            ).map(({ k, label }) => (
              <TouchableOpacity
                key={k}
                onPress={() => setGenderFilter(k)}
                className={`px-3 py-2 rounded-xl border ${
                  genderFilter === k
                    ? 'bg-sky-600 border-sky-600'
                    : 'bg-white border-sky-200'
                }`}
                activeOpacity={0.85}
              >
                <Text
                  className={`text-xs font-extrabold ${
                    genderFilter === k ? 'text-white' : 'text-sky-900'
                  }`}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View
          className={`mt-3 flex-row items-center rounded-2xl px-3 bg-sky-50 border ${
            focusSearch ? 'border-sky-400 bg-white' : 'border-sky-100'
          }`}
          style={{ ...(Platform.OS === 'android' ? { elevation: 0 } : {}) }}
        >
          <Search size={18} color={MEDICAL.primaryDark} />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-sky-950 font-semibold"
            placeholder="Tìm theo tên, mã, SĐT, email…"
            placeholderTextColor="#94A3B8"
            value={searchInput}
            onChangeText={setSearchInput}
            onFocus={() => setFocusSearch(true)}
            onBlur={() => setFocusSearch(false)}
            returnKeyType="search"
          />
          {searchInput.trim() ? (
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center bg-white border border-sky-200"
              onPress={() => setSearchInput('')}
              activeOpacity={0.75}
            >
              <X size={16} color={MEDICAL.primaryDark} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-sky-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor={MEDICAL.primary} />
        }
      >
        {patients.length === 0 ? (
          <View className="pt-10 items-center px-6">
            <View className="w-14 h-14 rounded-2xl bg-sky-100 items-center justify-center border border-sky-200">
              <User size={26} color={MEDICAL.primary} />
            </View>
            <Text className="mt-4 text-base font-extrabold text-sky-950">
              {debouncedQuery.trim() || filterActive ? 'Không có kết quả' : 'Chưa có bệnh nhân'}
            </Text>
            {!debouncedQuery.trim() && !filterActive && (
              <TouchableOpacity
                onPress={() => router.push('/customer/create-patient')}
                className="mt-6 rounded-2xl bg-sky-600 px-6 py-3 flex-row items-center"
                activeOpacity={0.85}
              >
                <Plus size={18} color="#fff" />
                <Text className="ml-2 text-white font-extrabold">Thêm bệnh nhân</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          patients.map((p: PatientResponse) => {
            const code = p.patientCode || p.patientId || '';
            const name = p.patientName || p.name || 'Không có tên';
            const phone = p.patientPhone || p.phone || '';
            const email = p.patientEmail || p.email || '';
            const address = p.patientAddress || p.address || '';
            const gender = p.gender;

            return (
              <View
                key={p.patientId}
                className="bg-white rounded-2xl mb-3 border border-sky-100 overflow-hidden shadow-sm shadow-sky-900/5"
              >
                <View className="px-4 pt-3 pb-2 flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center flex-1 flex-wrap gap-2">
                    <View className="px-2.5 py-1.5 rounded-full bg-sky-50 border border-sky-200">
                      <Text className="text-xs font-extrabold text-sky-700">{code}</Text>
                    </View>
                    {gender ? (
                      <View className="px-2.5 py-1.5 rounded-full bg-sky-50 border border-sky-100">
                        <Text className="text-xs font-extrabold text-sky-800">
                          {patientGenderLabel(gender)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View className="flex-row items-center gap-1.5 shrink-0">
                    <TouchableOpacity
                      className="flex-row items-center px-2.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200"
                      onPress={() =>
                        router.push(`/customer/edit-patient?patientId=${encodeURIComponent(p.patientId)}`)
                      }
                      activeOpacity={0.85}
                      accessibilityLabel="Sửa bệnh nhân"
                    >
                      <Pencil size={15} color={MEDICAL.primary} />
                      <Text className="ml-1 text-xs font-extrabold text-sky-700">Sửa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-row items-center px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200"
                      onPress={() => confirmDelete(p)}
                      disabled={deleteMutation.isPending}
                      activeOpacity={0.85}
                      accessibilityLabel="Xóa bệnh nhân"
                    >
                      <Trash2 size={15} color="#DC2626" />
                      <Text className="ml-1 text-xs font-extrabold text-rose-700">Xóa</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  className="px-4 pb-4"
                  onPress={() => {
                    queryClient.prefetchQuery({
                      queryKey: ['patient', p.patientId],
                      queryFn: () => patientService.getById(p.patientId),
                      staleTime: 60 * 1000,
                    });
                    router.push(`/customer/patient-detail?id=${p.patientId}`);
                  }}
                >
                  <Text className="text-[15px] font-extrabold text-sky-950">{name}</Text>

                  <View className="mt-3 gap-2">
                    {!!phone && (
                      <View className="flex-row items-center">
                        <Phone size={14} color={MEDICAL.primaryDark} />
                        <Text className="ml-2 text-xs font-bold text-sky-800">{phone}</Text>
                      </View>
                    )}
                    {!!email && (
                      <View className="flex-row items-center">
                        <Mail size={14} color={MEDICAL.primaryDark} />
                        <Text className="ml-2 text-xs font-bold text-sky-800">{email}</Text>
                      </View>
                    )}
                    {!!address && (
                      <View className="flex-row items-center">
                        <MapPin size={14} color={MEDICAL.primaryDark} />
                        <Text className="ml-2 flex-1 text-xs font-bold text-sky-800" numberOfLines={2}>
                          {address}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {totalPages > 1 && (
        <PaginationControls
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalElements={totalElements}
          isLoading={isLoading}
        />
      )}
    </SafeAreaView>
  );
}
