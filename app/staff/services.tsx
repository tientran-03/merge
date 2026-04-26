import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  FlaskConical,
  Layers,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { SERVICE_TYPE_MAPPER, SERVICE_TYPE_OPTIONS } from '@/lib/schemas/order-schemas';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { useSheetBottomInset } from '@/lib/useSheetBottomInset';
import { getApiResponseData } from '@/lib/types/api-types';
import { GenomeTestResponse, genomeTestService } from '@/services/genomeTestService';
import {
  SampleAddServiceCatalogRequest,
  SampleAddServiceCatalogResponse,
  sampleAddServiceCatalogService,
} from '@/services/sampleAddServiceCatalogService';
import { ServiceResponse, serviceService } from '@/services/serviceService';

type TabKey = 'groups' | 'genome' | 'sampleAdd';

const MIN_SAMPLE_ADD_PRICE = 10_000;

const parseTab = (t?: string): TabKey => {
  if (t === 'genome' || t === 'sampleAdd' || t === 'groups') return t;
  return 'groups';
};

const formatVnd = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  try {
    return `${new Intl.NumberFormat('vi-VN').format(value)} VNĐ`;
  } catch {
    return `${value} VNĐ`;
  }
};

const serviceNameLabel = (name: string | undefined) => {
  if (!name) return '—';
  const k = String(name).toLowerCase();
  return SERVICE_TYPE_MAPPER[k] || name;
};

export default function StaffServicesManagementScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabKey>(() => parseTab(typeof params.tab === 'string' ? params.tab : undefined));
  const sheetBottomInset = useSheetBottomInset();

  useEffect(() => {
    const t = typeof params.tab === 'string' ? params.tab : undefined;
    setTab(parseTab(t));
  }, [params.tab]);

  const setTabKey = useCallback((k: TabKey) => setTab(k), []);
  const [groupSearch, setGroupSearch] = useState('');
  const [filterServiceId, setFilterServiceId] = useState('');
  const [appliedGroupIdFilter, setAppliedGroupIdFilter] = useState('');
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServiceResponse | null>(null);
  const [draftServiceId, setDraftServiceId] = useState('');
  const [draftServiceNameEnum, setDraftServiceNameEnum] = useState<string>('reproduction');

  const groupsQuery = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceService.getAll(),
    enabled: tab === 'groups',
  });

  const groups: ServiceResponse[] = useMemo(
    () => getApiResponseData<ServiceResponse>(groupsQuery.data) || [],
    [groupsQuery.data]
  );

  const filteredGroups = useMemo(() => {
    let rows = [...groups];
    const q = groupSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(s => {
        const id = (s.serviceId || '').toLowerCase();
        const nl = serviceNameLabel(s.name).toLowerCase();
        const raw = String(s.name || '').toLowerCase();
        return id.includes(q) || nl.includes(q) || raw.includes(q);
      });
    }
    if (appliedGroupIdFilter.trim()) {
      const f = appliedGroupIdFilter.trim().toLowerCase();
      rows = rows.filter(s => (s.serviceId || '').toLowerCase().includes(f));
    }
    return rows;
  }, [groups, groupSearch, appliedGroupIdFilter]);

  const openCreateGroup = () => {
    setEditingGroup(null);
    setDraftServiceId('');
    setDraftServiceNameEnum('reproduction');
    setGroupModalOpen(true);
  };

  const openEditGroup = (s: ServiceResponse) => {
    setEditingGroup(s);
    setDraftServiceId(s.serviceId || '');
    const n = String(s.name || '').toLowerCase();
    const match = SERVICE_TYPE_OPTIONS.find(o => o.value === n);
    setDraftServiceNameEnum(match?.value || 'reproduction');
    setGroupModalOpen(true);
  };

  const saveGroupMutation = useMutation({
    mutationFn: async () => {
      const name = draftServiceNameEnum;
      if (!name) throw new Error('Chọn loại nhóm');
      if (editingGroup) {
        return serviceService.update(editingGroup.serviceId, {
          serviceId: editingGroup.serviceId,
          name,
        });
      }
      const sid = draftServiceId.trim();
      if (!sid) throw new Error('Nhập mã nhóm dịch vụ');
      return serviceService.create({ serviceId: sid, name });
    },
    onSuccess: res => {
      if (res.success) {
        setGroupModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['services'] });
        presentFeedbackSuccess({
          title: 'Thành công',
          message: editingGroup ? 'Đã cập nhật nhóm dịch vụ.' : 'Đã thêm nhóm dịch vụ.',
        });
      } else {
        presentFeedbackError({
          title: 'Không thành công',
          message: res.error || res.message || 'Thao tác thất bại.',
        });
      }
    },
    onError: (e: Error) =>
      presentFeedbackError({ title: 'Lỗi', message: e.message || 'Không thể lưu.' }),
  });

  const deleteGroup = (s: ServiceResponse) => {
    Alert.alert('Xóa nhóm dịch vụ?', `Mã: ${s.serviceId}\n${serviceNameLabel(s.name)}`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          const res = await serviceService.delete(s.serviceId);
          if (res.success) {
            queryClient.invalidateQueries({ queryKey: ['services'] });
            presentFeedbackSuccess({ title: 'Thành công', message: 'Đã xóa nhóm dịch vụ.' });
          } else {
            presentFeedbackError({
              title: 'Lỗi',
              message: res.error || res.message || 'Không xóa được.',
            });
          }
        },
      },
    ]);
  };
  const [qGenome, setQGenome] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const genomeGroupsQuery = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceService.getAll(),
    enabled: tab === 'genome',
  });

  const serviceList: ServiceResponse[] = useMemo(
    () => getApiResponseData<ServiceResponse>(genomeGroupsQuery.data) || [],
    [genomeGroupsQuery.data]
  );

  const groupIds = useMemo(() => {
    const byName = new Map<string, string>();
    serviceList.forEach(s => {
      if (s?.name && s?.serviceId) byName.set(String(s.name).toLowerCase(), String(s.serviceId));
    });
    return {
      embryo: byName.get('embryo') || 'EMBRYO',
      disease: byName.get('disease') || 'DISEASE',
      reproduction: byName.get('reproduction') || 'REPRODUCTION',
    };
  }, [serviceList]);

  const {
    data: tests,
    isLoading: genomeLoading,
    error: genomeError,
    refetch: refetchGenome,
    isFetching: genomeFetching,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<GenomeTestResponse>({
    queryKey: ['genome-tests', selectedServiceId ?? 'all'],
    queryFn: async params =>
      selectedServiceId
        ? await genomeTestService.getByServiceId(selectedServiceId, params)
        : await genomeTestService.getAll(params),
    defaultPageSize: 20,
    enabled: tab === 'genome',
  });

  const filteredGenome = useMemo(() => {
    const key = qGenome.trim().toLowerCase();
    if (!key) return tests;
    return tests.filter(t => {
      const testId = (t.testId || '').toLowerCase();
      const testName = (t.testName || '').toLowerCase();
      const code = ((t as { code?: string }).code || '').toString().toLowerCase();
      const serviceName = (t.service?.name || '').toLowerCase();
      const samples = (t.testSample || []).join(' ').toLowerCase();
      return (
        testId.includes(key) ||
        testName.includes(key) ||
        code.includes(key) ||
        serviceName.includes(key) ||
        samples.includes(key)
      );
    });
  }, [tests, qGenome]);
  const [sampleSearch, setSampleSearch] = useState('');
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [editingSample, setEditingSample] = useState<SampleAddServiceCatalogResponse | null>(null);
  const [sampleNameDraft, setSampleNameDraft] = useState('');
  const [samplePriceDraft, setSamplePriceDraft] = useState('');
  const [sampleTaxDraft, setSampleTaxDraft] = useState('');

  const sampleCatalogQuery = useQuery({
    queryKey: ['sample-add-services-catalog'],
    queryFn: () => sampleAddServiceCatalogService.getAll(),
    enabled: tab === 'sampleAdd',
  });

  const catalogRows: SampleAddServiceCatalogResponse[] = useMemo(
    () => getApiResponseData<SampleAddServiceCatalogResponse>(sampleCatalogQuery.data) || [],
    [sampleCatalogQuery.data]
  );

  const filteredCatalog = useMemo(() => {
    const k = sampleSearch.trim().toLowerCase();
    if (!k) return catalogRows;
    return catalogRows.filter(
      r => (r.sampleName || '').toLowerCase().includes(k) || (r.id || '').toLowerCase().includes(k)
    );
  }, [catalogRows, sampleSearch]);

  const openCreateSample = () => {
    setEditingSample(null);
    setSampleNameDraft('');
    setSamplePriceDraft('');
    setSampleTaxDraft('');
    setSampleModalOpen(true);
  };

  const openEditSample = (row: SampleAddServiceCatalogResponse) => {
    setEditingSample(row);
    setSampleNameDraft(row.sampleName || '');
    setSamplePriceDraft(row.price != null ? String(Math.round(row.price)) : '');
    setSampleTaxDraft(row.taxRate != null ? String(row.taxRate) : '');
    setSampleModalOpen(true);
  };

  const parsePrice = (s: string) => {
    const n = parseInt(s.replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? 0 : n;
  };

  const saveSampleMutation = useMutation({
    mutationFn: async () => {
      const name = sampleNameDraft.trim();
      if (!name) throw new Error('Nhập tên dịch vụ');
      const price = parsePrice(samplePriceDraft);
      if (!price || price < MIN_SAMPLE_ADD_PRICE) {
        throw new Error(`Giá tối thiểu ${MIN_SAMPLE_ADD_PRICE.toLocaleString('vi-VN')} đ`);
      }
      let tax: number | undefined;
      if (sampleTaxDraft.trim()) {
        const t = parseFloat(sampleTaxDraft.replace(',', '.'));
        if (Number.isNaN(t) || t < 0 || t > 100) throw new Error('Thuế suất 0–100%');
        tax = t;
      }
      const body: SampleAddServiceCatalogRequest = { sampleName: name, price, taxRate: tax };
      if (editingSample) {
        return sampleAddServiceCatalogService.update(editingSample.id, body);
      }
      return sampleAddServiceCatalogService.create(body);
    },
    onSuccess: res => {
      if (res.success) {
        setSampleModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['sample-add-services-catalog'] });
        presentFeedbackSuccess({
          title: 'Thành công',
          message: editingSample ? 'Đã cập nhật.' : 'Đã thêm dịch vụ thêm mẫu.',
        });
      } else {
        presentFeedbackError({
          title: 'Không thành công',
          message: res.error || res.message || 'Thao tác thất bại.',
        });
      }
    },
    onError: (e: Error) => presentFeedbackError({ title: 'Lỗi', message: e.message }),
  });

  const deleteSample = (row: SampleAddServiceCatalogResponse) => {
    Alert.alert('Xóa dịch vụ thêm mẫu?', row.sampleName || row.id, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          const res = await sampleAddServiceCatalogService.delete(row.id);
          if (res.success) {
            queryClient.invalidateQueries({ queryKey: ['sample-add-services-catalog'] });
            presentFeedbackSuccess({ title: 'Thành công', message: 'Đã xóa dịch vụ thêm mẫu.' });
          } else {
            presentFeedbackError({
              title: 'Lỗi',
              message: res.error || res.message || 'Không xóa được.',
            });
          }
        },
      },
    ]);
  };

  const tabLabel: Record<TabKey, string> = {
    groups: 'Nhóm DV',
    genome: 'Xét nghiệm',
    sampleAdd: 'Thêm mẫu',
  };

  const renderGroups = () => {
    if (groupsQuery.isLoading) {
      return (
        <View className="py-16 items-center">
          <ActivityIndicator color="#0284C7" />
        </View>
      );
    }
    if (groupsQuery.error || !groupsQuery.data?.success) {
      return (
        <View className="py-10 px-4">
          <Text className="text-center text-slate-700 font-bold">
            {(groupsQuery.data as { error?: string })?.error || 'Không tải được nhóm dịch vụ.'}
          </Text>
          <TouchableOpacity className="mt-4 self-center bg-sky-600 px-5 py-2.5 rounded-xl" onPress={() => groupsQuery.refetch()}>
            <Text className="text-white font-extrabold">Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <FlatList
        style={{ flex: 1 }}
        data={filteredGroups}
        keyExtractor={item => item.serviceId}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={groupsQuery.isFetching} onRefresh={() => groupsQuery.refetch()} tintColor="#0284C7" />
        }
        ListHeaderComponent={
          <View className="mb-3">
            {showGroupFilter && (
              <View className="mb-2 rounded-2xl border border-sky-100 bg-white p-3">
                <Text className="text-xs font-extrabold text-slate-500 mb-1">Lọc theo mã</Text>
                <TextInput
                  className="border border-sky-100 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                  placeholder="Mã dịch vụ"
                  value={filterServiceId}
                  onChangeText={setFilterServiceId}
                />
                <View className="flex-row gap-2 mt-2">
                  <TouchableOpacity
                    className="flex-1 py-2 rounded-xl bg-slate-100 border border-slate-200"
                    onPress={() => {
                      setFilterServiceId('');
                      setAppliedGroupIdFilter('');
                    }}
                  >
                    <Text className="text-center text-xs font-extrabold text-slate-700">Xóa lọc</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 py-2 rounded-xl bg-sky-600"
                    onPress={() => setAppliedGroupIdFilter(filterServiceId)}
                  >
                    <Text className="text-center text-xs font-extrabold text-white">Áp dụng</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text className="text-center text-slate-500 font-semibold py-8">Không có bản ghi phù hợp.</Text>
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => (
          <View className="rounded-2xl border border-sky-100 bg-white px-4 py-3 flex-row items-center">
            <View className="flex-1 pr-2">
              <Text className="text-xs font-extrabold text-sky-700">{item.serviceId}</Text>
              <Text className="mt-1 text-[15px] font-extrabold text-slate-900">{serviceNameLabel(item.name)}</Text>
              <Text className="mt-0.5 text-[10px] text-slate-400 font-semibold">({String(item.name || '')})</Text>
            </View>
            <TouchableOpacity onPress={() => openEditGroup(item)} className="p-2 rounded-xl bg-sky-50 border border-sky-100 mr-1">
              <Pencil size={18} color="#0284C7" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteGroup(item)} className="p-2 rounded-xl bg-red-50 border border-red-100">
              <Trash2 size={18} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      />
    );
  };

  const renderGenome = () => {
    if (genomeLoading) {
      return (
        <View className="py-16 items-center">
          <ActivityIndicator color="#0284C7" />
        </View>
      );
    }
    if (genomeError) {
      return (
        <View className="py-10 px-4 items-center">
          <Text className="text-slate-700 font-bold text-center">Không tải được danh sách xét nghiệm.</Text>
          <TouchableOpacity className="mt-4 bg-sky-600 px-5 py-2.5 rounded-xl" onPress={() => refetchGenome()}>
            <Text className="text-white font-extrabold">Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View className="flex-1">
        <View className="mb-3 flex-row gap-2 flex-wrap">
          <TouchableOpacity
            onPress={() => setSelectedServiceId(groupIds.reproduction)}
            className={`px-3 py-2 rounded-xl border ${selectedServiceId === groupIds.reproduction ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-200'
              }`}
          >
            <Text
              className={`text-xs font-extrabold ${selectedServiceId === groupIds.reproduction ? 'text-white' : 'text-sky-700'
                }`}
            >
              {SERVICE_TYPE_MAPPER['reproduction']}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedServiceId(groupIds.disease)}
            className={`px-3 py-2 rounded-xl border ${selectedServiceId === groupIds.disease ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-200'
              }`}
          >
            <Text
              className={`text-xs font-extrabold ${selectedServiceId === groupIds.disease ? 'text-white' : 'text-sky-700'}`}
            >
              {SERVICE_TYPE_MAPPER['disease']}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedServiceId(groupIds.embryo)}
            className={`px-3 py-2 rounded-xl border ${selectedServiceId === groupIds.embryo ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-200'
              }`}
          >
            <Text
              className={`text-xs font-extrabold ${selectedServiceId === groupIds.embryo ? 'text-white' : 'text-sky-700'}`}
            >
              {SERVICE_TYPE_MAPPER['embryo']}
            </Text>
          </TouchableOpacity>
          {selectedServiceId ? (
            <TouchableOpacity
              onPress={() => setSelectedServiceId(null)}
              className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200"
            >
              <Text className="text-xs font-extrabold text-slate-700">Tất cả</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          data={filteredGenome}
          keyExtractor={item => item.testId}
          contentContainerStyle={{ paddingBottom: totalPages > 1 ? 88 : 20 }}
          ItemSeparatorComponent={() => <View className="h-2.5" />}
          refreshControl={
            <RefreshControl refreshing={genomeFetching} onRefresh={() => refetchGenome()} tintColor="#0284C7" />
          }
          ListEmptyComponent={
            <View className="pt-10 items-center px-6">
              <Text className="text-base font-extrabold text-slate-900">
                {qGenome.trim() ? 'Không có kết quả' : 'Chưa có dữ liệu'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const code = ((item as { code?: string }).code || '').toString();
            const price = item.price;
            const taxRate = (item as { taxRate?: number }).taxRate;
            const finalPrice = (item as { finalPrice?: number }).finalPrice;
            const serviceLabel = item.service?.name
              ? SERVICE_TYPE_MAPPER[item.service.name] || item.service.name
              : '';

            return (
              <TouchableOpacity
                activeOpacity={0.85}
                className="bg-white rounded-2xl border border-sky-100 px-4 py-4"
                onPress={() =>
                  router.push({
                    pathname: '/staff/genome-test-detail',
                    params: { testId: item.testId },
                  })
                }
              >
                <View className="flex-row items-center justify-between">
                  <View className="px-2.5 py-1.5 rounded-full bg-sky-50 border border-sky-200">
                    <Text className="text-xs font-extrabold text-sky-700">{item.testId}</Text>
                  </View>
                  {!!serviceLabel && (
                    <View className="px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200">
                      <Text className="text-xs font-extrabold text-slate-600">{serviceLabel}</Text>
                    </View>
                  )}
                </View>
                <Text className="mt-3 text-[15px] font-extrabold text-slate-900" numberOfLines={2}>
                  {item.testName}
                </Text>
                {!!code && (
                  <View className="mt-2 flex-row items-center">
                    <Tag size={14} color="#64748B" />
                    <Text className="ml-2 text-xs font-bold text-slate-600">{code}</Text>
                  </View>
                )}
                {!!item.testDescription && (
                  <Text className="mt-2 text-xs text-slate-600" numberOfLines={2}>
                    {item.testDescription}
                  </Text>
                )}
                <View className="mt-3 flex-row items-end justify-between">
                  <View className="flex-1">
                    {!!price && <Text className="text-sm font-extrabold text-sky-700">{formatVnd(price)}</Text>}
                    {(typeof taxRate === 'number' || typeof finalPrice === 'number') && (
                      <Text className="mt-0.5 text-[11px] font-bold text-slate-500">
                        {typeof taxRate === 'number' ? `Thuế ${taxRate}%` : ''}
                        {typeof taxRate === 'number' && typeof finalPrice === 'number' ? ' • ' : ''}
                        {typeof finalPrice === 'number' ? `Sau thuế ${formatVnd(finalPrice)}` : ''}
                      </Text>
                    )}
                  </View>
                  {item.testSample && item.testSample.length > 0 ? (
                    <View className="ml-3 flex-row items-center flex-1 justify-end">
                      <FlaskConical size={14} color="#64748B" />
                      <Text className="ml-2 text-[11px] font-bold text-slate-500" numberOfLines={1}>
                        {item.testSample.join(', ')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
        />
        {totalPages > 1 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            pageSize={pageSize}
            totalElements={totalElements}
            isLoading={genomeLoading}
          />
        )}
      </View>
    );
  };

  const renderSampleAdd = () => {
    if (sampleCatalogQuery.isLoading) {
      return (
        <View className="py-16 items-center">
          <ActivityIndicator color="#0284C7" />
        </View>
      );
    }
    if (!sampleCatalogQuery.data?.success) {
      return (
        <View className="py-10 px-4 items-center">
          <Text className="text-slate-700 font-bold text-center">
            {sampleCatalogQuery.data?.error || 'Không tải được dịch vụ thêm mẫu.'}
          </Text>
          <TouchableOpacity className="mt-4 bg-sky-600 px-5 py-2.5 rounded-xl" onPress={() => sampleCatalogQuery.refetch()}>
            <Text className="text-white font-extrabold">Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <FlatList
        style={{ flex: 1 }}
        data={filteredCatalog}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={sampleCatalogQuery.isFetching}
            onRefresh={() => sampleCatalogQuery.refetch()}
            tintColor="#0284C7"
          />
        }
        ListEmptyComponent={
          <Text className="text-center text-slate-500 font-semibold py-8">Không có dịch vụ thêm mẫu.</Text>
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => (
          <View className="rounded-2xl border border-sky-100 bg-white px-4 py-3">
            <Text className="text-xs font-extrabold text-slate-400">{item.id}</Text>
            <Text className="mt-1 text-[15px] font-extrabold text-slate-900">{item.sampleName}</Text>
            <Text className="mt-2 text-sm font-bold text-sky-700">{formatVnd(item.price)}</Text>
            <Text className="mt-1 text-[11px] text-slate-600 font-semibold">
              Thuế {item.taxRate ?? 0}% • Sau thuế {formatVnd(item.finalPrice)}
            </Text>
            <View className="flex-row justify-end gap-2 mt-3">
              <TouchableOpacity
                onPress={() => openEditSample(item)}
                className="px-3 py-2 rounded-xl bg-sky-50 border border-sky-200"
              >
                <Text className="text-xs font-extrabold text-sky-700">Sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteSample(item)}
                className="px-3 py-2 rounded-xl bg-red-50 border border-red-200"
              >
                <Text className="text-xs font-extrabold text-red-700">Xóa</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen options={{ headerShown: false }} />

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
            <Text className="text-slate-900 text-lg font-extrabold">Quản lý dịch vụ</Text>
            <Text className="mt-0.5 text-xs text-slate-500">{tabLabel[tab]}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mx-1" contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
          {(
            [
              ['groups', 'Nhóm dịch vụ', Layers],
              ['genome', 'Danh sách DV', FlaskConical],
              ['sampleAdd', 'DV thêm mẫu', Tag],
            ] as const
          ).map(([key, label, Icon]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setTabKey(key)}
              className={`flex-row items-center px-3 py-2 rounded-xl border ${tab === key ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-200'
                }`}
            >
              <Icon size={16} color={tab === key ? '#fff' : '#0284C7'} />
              <Text className={`ml-1.5 text-xs font-extrabold ${tab === key ? 'text-white' : 'text-sky-800'}`}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {tab === 'groups' && (
          <View className="mt-3 flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
              <Search size={18} color="#64748B" />
              <TextInput
                className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
                placeholder="Tìm mã / tên nhóm…"
                placeholderTextColor="#94A3B8"
                value={groupSearch}
                onChangeText={setGroupSearch}
              />
              {!!groupSearch.trim() && (
                <TouchableOpacity onPress={() => setGroupSearch('')}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setShowGroupFilter(s => !s)}
              className={`px-3 h-11 rounded-xl border items-center justify-center ${showGroupFilter ? 'bg-sky-600 border-sky-600' : 'bg-white border-sky-200'}`}
            >
              <Text className={`text-xs font-extrabold ${showGroupFilter ? 'text-white' : 'text-sky-700'}`}>Lọc</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openCreateGroup} className="h-11 w-11 rounded-xl bg-sky-600 items-center justify-center">
              <Plus size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {tab === 'genome' && (
          <View className="mt-3 flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
              <Search size={18} color="#64748B" />
              <TextInput
                className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
                placeholder="Mã, tên, code, nhóm, mẫu…"
                placeholderTextColor="#94A3B8"
                value={qGenome}
                onChangeText={setQGenome}
              />
              {!!qGenome.trim() && (
                <TouchableOpacity onPress={() => setQGenome('')}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={() => router.push('/staff/create-genome-test')}
              className="flex-row items-center px-3 py-2 rounded-xl bg-sky-600 h-11"
            >
              <Plus size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {tab === 'sampleAdd' && (
          <View className="mt-3 flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
              <Search size={18} color="#64748B" />
              <TextInput
                className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
                placeholder="Tìm tên / mã…"
                placeholderTextColor="#94A3B8"
                value={sampleSearch}
                onChangeText={setSampleSearch}
              />
              {!!sampleSearch.trim() && (
                <TouchableOpacity onPress={() => setSampleSearch('')}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={openCreateSample} className="h-11 w-11 rounded-xl bg-sky-600 items-center justify-center">
              <Plus size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View className="flex-1 px-4 pt-3 relative">{tab === 'groups' ? renderGroups() : tab === 'genome' ? renderGenome() : renderSampleAdd()}</View>

      {/* Modal nhóm dịch vụ */}
      <Modal visible={groupModalOpen} animationType="slide" transparent onRequestClose={() => setGroupModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/40">
          <View
            className="bg-white rounded-t-3xl p-5 border-t border-sky-100"
            style={{ paddingBottom: sheetBottomInset }}
          >
            <Text className="text-lg font-extrabold text-slate-900">{editingGroup ? 'Sửa nhóm dịch vụ' : 'Thêm nhóm dịch vụ'}</Text>
            {!editingGroup ? (
              <TextInput
                className="mt-4 border border-sky-100 rounded-xl px-3 py-3 text-slate-900 font-semibold"
                placeholder="Mã dịch vụ (serviceId)"
                value={draftServiceId}
                onChangeText={setDraftServiceId}
                autoCapitalize="characters"
              />
            ) : (
              <Text className="mt-4 text-sm font-bold text-slate-600">Mã: {editingGroup.serviceId}</Text>
            )}
            <Text className="mt-4 text-xs font-extrabold text-slate-500">Loại nhóm (enum)</Text>
            <View className="flex-row flex-wrap gap-2 mt-2">
              {SERVICE_TYPE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setDraftServiceNameEnum(opt.value)}
                  className={`px-3 py-2 rounded-xl border ${draftServiceNameEnum === opt.value ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-200'
                    }`}
                >
                  <Text className={`text-xs font-extrabold ${draftServiceNameEnum === opt.value ? 'text-white' : 'text-sky-800'}`}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity className="flex-1 py-3 rounded-xl bg-slate-100 border border-slate-200" onPress={() => setGroupModalOpen(false)}>
                <Text className="text-center font-extrabold text-slate-700">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl bg-sky-600"
                disabled={saveGroupMutation.isPending}
                onPress={() => saveGroupMutation.mutate()}
              >
                {saveGroupMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-center font-extrabold text-white">Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={sampleModalOpen} animationType="slide" transparent onRequestClose={() => setSampleModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/40">
          <View
            className="bg-white rounded-t-3xl p-5 border-t border-sky-100"
            style={{ paddingBottom: sheetBottomInset }}
          >
            <Text className="text-lg font-extrabold text-slate-900">{editingSample ? 'Sửa dịch vụ thêm mẫu' : 'Thêm dịch vụ thêm mẫu'}</Text>
            <TextInput
              className="mt-4 border border-sky-100 rounded-xl px-3 py-3 text-slate-900 font-semibold"
              placeholder="Tên dịch vụ"
              value={sampleNameDraft}
              onChangeText={setSampleNameDraft}
            />
            <TextInput
              className="mt-3 border border-sky-100 rounded-xl px-3 py-3 text-slate-900 font-semibold"
              placeholder={`Giá (VNĐ, tối thiểu ${MIN_SAMPLE_ADD_PRICE.toLocaleString('vi-VN')})`}
              keyboardType="numeric"
              value={samplePriceDraft}
              onChangeText={setSamplePriceDraft}
            />
            <TextInput
              className="mt-3 border border-sky-100 rounded-xl px-3 py-3 text-slate-900 font-semibold"
              placeholder="Thuế suất % (tuỳ chọn)"
              keyboardType="decimal-pad"
              value={sampleTaxDraft}
              onChangeText={setSampleTaxDraft}
            />
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity className="flex-1 py-3 rounded-xl bg-slate-100 border border-slate-200" onPress={() => setSampleModalOpen(false)}>
                <Text className="text-center font-extrabold text-slate-700">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl bg-sky-600"
                disabled={saveSampleMutation.isPending}
                onPress={() => saveSampleMutation.mutate()}
              >
                {saveSampleMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-center font-extrabold text-white">Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
