import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  Search,
  X,
  SlidersHorizontal,
  Package,
  Plus,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  FlaskConical,
} from "lucide-react-native";
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SampleAddServicesPanel } from "@/components/admin/SampleAddServicesPanel";
import { PaginationControls } from "@/components/PaginationControls";
import { clampDecimalStringToMax } from "@/utils/numericClamp";
import { isStaffLikeOperationalRole } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import {
  serviceEntityService,
  ServiceEntityResponse,
  ServiceEntityRequest,
} from "@/services/serviceEntityService";
import {
  genomeTestService,
  GenomeTestResponse,
} from "@/services/genomeTestService";

// Valid service type enum values
const SERVICE_TYPES = [
  { value: "embryo", label: "Embryo" },
  { value: "disease", label: "Disease" },
  { value: "reproduction", label: "Reproduction" },
] as const;
const MIN_PRICE = 10000;
const MAX_PRICE = 1_000_000_000;
const MAX_TAX_RATE = 100;
const MAX_ID_LENGTH = 30;
const MAX_TEST_NAME_LENGTH = 255;
const MAX_SAMPLES_INPUT_LENGTH = 255;
const MAX_SAMPLE_ITEM_LENGTH = 50;
const MAX_SAMPLE_ITEMS = 10;
const MAX_SEARCH_LENGTH = 100;
const ID_INPUT_REGEX = /[^a-zA-Z0-9_-]/g;
const TAX_RATE_INPUT_REGEX = /[^0-9.,]/g;
type CreateFormField =
  | "testId"
  | "code"
  | "price"
  | "taxRate"
  | "testName"
  | "serviceGroup"
  | "samples";
type CreateFormErrors = Partial<Record<CreateFormField, string>>;
type EditFormErrors = Partial<Record<"serviceId" | "name", string>>;

const getServiceTypeLabel = (value: string): string => {
  const type = SERVICE_TYPES.find((t) => t.value === value);
  return type?.label || value;
};

// Component để hiển thị service item với genomeTests
function ServiceItem({
  service,
  isExpanded,
  onToggleExpand,
  onEditGenomeTest,
  onDeleteGenomeTest,
  isPendingDeleteGenomeTest,
}: {
  service: ServiceEntityResponse;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditGenomeTest: (test: GenomeTestResponse) => void;
  onDeleteGenomeTest: (test: GenomeTestResponse) => void;
  isPendingDeleteGenomeTest: boolean;
}) {
  const { data: genomeTestsResponse, isLoading: loadingTests } = useQuery({
    queryKey: ["genome-tests-by-service", service.serviceId],
    queryFn: async () => {
      const response = await genomeTestService.getByServiceId(service.serviceId);
      return response;
    },
    enabled: isExpanded && !!service.serviceId,
  });

  const genomeTests = useMemo(() => {
    if (!genomeTestsResponse?.success || !genomeTestsResponse.data) return [];
    return Array.isArray(genomeTestsResponse.data) ? genomeTestsResponse.data : [];
  }, [genomeTestsResponse]);

  return (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-sky-100">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Package size={18} color="#0284C7" />
            <Text className="ml-2 text-xs font-bold text-sky-600">
              Mã: {service.serviceId}
            </Text>
          </View>
          <Text className="mt-1 text-base font-extrabold text-slate-900">
            {getServiceTypeLabel(service.name) || "Chưa có tên"}
          </Text>
        </View>
        
        <TouchableOpacity
          onPress={onToggleExpand}
          className="ml-2 p-2 rounded-xl bg-sky-50 border border-sky-200"
          activeOpacity={0.7}
        >
          {isExpanded ? (
            <ChevronUp size={18} color="#0284C7" />
          ) : (
            <ChevronDown size={18} color="#0284C7" />
          )}
        </TouchableOpacity>
      </View>

      {/* Genome Tests List */}
      {isExpanded && (
        <View className="mt-3 pt-3 border-t border-sky-100">
          {loadingTests ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#0284C7" />
              <Text className="mt-2 text-xs text-slate-500">Đang tải...</Text>
            </View>
          ) : genomeTests.length === 0 ? (
            <View className="py-4 items-center">
              <FlaskConical size={24} color="#94A3B8" />
              <Text className="mt-2 text-xs text-slate-500 text-center">
                Chưa có xét nghiệm nào
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              <Text className="text-xs font-bold text-slate-600 mb-2">
                Xét nghiệm ({genomeTests.length})
              </Text>
              {genomeTests.map((test: GenomeTestResponse) => (
                <View
                  key={test.testId}
                  className="bg-sky-50 rounded-xl p-3 border border-sky-100"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-sky-700 mb-1">
                        {test.testId}
                      </Text>
                      {!!test.code && (
                        <Text className="text-xs font-semibold text-violet-700 mb-1">
                          Code: {test.code}
                        </Text>
                      )}
                      <Text className="text-sm font-extrabold text-slate-900" numberOfLines={2}>
                        {test.testName}
                      </Text>
                      {test.testDescription && (
                        <Text className="mt-1 text-xs text-slate-600" numberOfLines={2}>
                          {test.testDescription}
                        </Text>
                      )}
                      {test.price && (
                        <Text className="mt-1 text-xs font-bold text-emerald-700">
                          {new Intl.NumberFormat("vi-VN").format(test.price)} VNĐ
                        </Text>
                      )}
                    </View>
                    <View className="ml-2">
                      <TouchableOpacity
                        className="px-2.5 py-1.5 rounded-lg bg-blue-100 border border-blue-200 mb-2"
                        onPress={() => onEditGenomeTest(test)}
                        activeOpacity={0.7}
                      >
                        <Text className="text-[11px] font-bold text-blue-700">Sửa mã</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          isPendingDeleteGenomeTest
                            ? "bg-slate-100 border-slate-200 opacity-50"
                            : "bg-red-50 border-red-200"
                        }`}
                        onPress={() => onDeleteGenomeTest(test)}
                        activeOpacity={0.7}
                        disabled={isPendingDeleteGenomeTest}
                      >
                        <Text
                          className={`text-[11px] font-bold ${
                            isPendingDeleteGenomeTest ? "text-slate-500" : "text-red-700"
                          }`}
                        >
                          Xóa mã
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

    </View>
  );
}

export default function AdminServicesScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterServiceId, setFilterServiceId] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceEntityResponse | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  /** Tab giống web: nhóm dịch vụ (service entity + genome tests) vs cấu hình giá dịch vụ thêm mẫu */
  const [mainTab, setMainTab] = useState<"groups" | "sample_add">("groups");
  
  // Form states
  const [formServiceId, setFormServiceId] = useState("");
  const [formName, setFormName] = useState("");
  const [createTestId, setCreateTestId] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createTaxRate, setCreateTaxRate] = useState("");
  const [createTestName, setCreateTestName] = useState("");
  const [createServiceGroupType, setCreateServiceGroupType] = useState("");
  const [createSamplesInput, setCreateSamplesInput] = useState("");
  const [createFieldErrors, setCreateFieldErrors] = useState<CreateFormErrors>({});
  const [editFieldErrors, setEditFieldErrors] = useState<EditFormErrors>({});

  // Guard: Chỉ ADMIN mới được vào màn hình này
  useEffect(() => {
    if (!authLoading && user && user.role !== "ROLE_ADMIN") {
      if (isStaffLikeOperationalRole(user.role)) {
        router.replace("/home");
      } else {
        router.replace("/");
      }
    }
  }, [user, authLoading, router]);

  // Fetch services with pagination
  const {
    data: servicesData,
    isLoading,
    error,
    refetch,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<ServiceEntityResponse>({
    queryKey: ["admin-services", searchQuery],
    queryFn: async (params) => await serviceEntityService.getAll(params),
    defaultPageSize: 20,
    enabled: user?.role === "ROLE_ADMIN",
  });

  // Extract services array from response
  const services = useMemo(() => {
    return servicesData || [];
  }, [servicesData]);

  const createGenomeMutation = useMutation({
    mutationFn: async (payload: any) => genomeTestService.create(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["genome-tests"] });
      queryClient.invalidateQueries({ queryKey: ["genome-tests-by-service"] });
      if (variables?.serviceId) {
        queryClient.invalidateQueries({
          queryKey: ["genome-tests-by-service", variables.serviceId],
        });
      }
      setShowCreateModal(false);
      resetForm();
      Alert.alert("Thành công", "Đã tạo dịch vụ xét nghiệm mới");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.message || error?.toString() || "Không thể tạo dịch vụ xét nghiệm";
      Alert.alert("Lỗi", errorMessage);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceEntityRequest }) => {
      console.log("Update mutation called:", { id, data });
      return serviceEntityService.update(id, data);
    },
    onSuccess: () => {
      console.log("Update success");
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setShowEditModal(false);
      setEditingService(null);
      resetForm();
      Alert.alert("Thành công", "Đã cập nhật dịch vụ");
    },
    onError: (error: any) => {
      console.error("Update error:", error);
      const errorMessage = error?.message || error?.toString() || "Không thể cập nhật dịch vụ";
      Alert.alert("Lỗi", errorMessage);
    },
  });

  const deleteGenomeTestMutation = useMutation({
    mutationFn: ({ testId }: { testId: string; serviceId: string }) =>
      genomeTestService.delete(testId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["genome-tests-by-service", variables.serviceId],
      });
      queryClient.invalidateQueries({ queryKey: ["genome-tests"] });
      Alert.alert("Thành công", "Đã xóa mã xét nghiệm");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.message || error?.toString() || "Không thể xóa mã xét nghiệm";
      Alert.alert("Lỗi", errorMessage);
    },
  });

  // Filter services
  const filteredServices = useMemo(() => {
    // Ensure services is always an array
    const servicesArray = Array.isArray(services) ? services : [];
    let result = [...servicesArray];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.serviceId?.toLowerCase().includes(query) ||
          s.name?.toLowerCase().includes(query)
      );
    }

    // Service ID filter
    if (filterServiceId.trim()) {
      const query = filterServiceId.toLowerCase().trim();
      result = result.filter((s) =>
        s.serviceId?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [services, searchQuery, filterServiceId]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterServiceId.trim()) count++;
    return count;
  }, [filterServiceId]);

  const selectedCreateGroupLabel = useMemo(() => {
    if (!createServiceGroupType) return "";
    return getServiceTypeLabel(createServiceGroupType);
  }, [createServiceGroupType]);

  const parsedCreatePrice = useMemo(() => {
    const cleaned = createPrice.replace(/[^\d]/g, "");
    return cleaned ? Number(cleaned) : 0;
  }, [createPrice]);

  const parsedCreateTaxRate = useMemo(() => {
    const cleaned = createTaxRate.replace(",", ".");
    return cleaned ? Number(cleaned) : 0;
  }, [createTaxRate]);

  const createdPriceAfterTax = useMemo(() => {
    if (!parsedCreatePrice || !Number.isFinite(parsedCreateTaxRate)) return null;
    return Math.round(parsedCreatePrice * (1 + parsedCreateTaxRate / 100));
  }, [parsedCreatePrice, parsedCreateTaxRate]);

  const resetForm = () => {
    setFormServiceId("");
    setFormName("");
    setCreateTestId("");
    setCreateCode("");
    setCreatePrice("");
    setCreateTaxRate("");
    setCreateTestName("");
    setCreateServiceGroupType("");
    setCreateSamplesInput("");
    setCreateFieldErrors({});
    setEditFieldErrors({});
  };

  const sanitizeIdInput = (value: string): string =>
    value.replace(ID_INPUT_REGEX, "").toUpperCase().slice(0, MAX_ID_LENGTH);

  const sanitizeTaxRateInput = (value: string): string =>
    value
      .replace(TAX_RATE_INPUT_REGEX, "")
      .replace(",", ".")
      .replace(/(\..*)\./g, "$1");

  const sanitizeNoLeadingSpace = (value: string): string => value.replace(/^\s+/g, "");

  const setCreateFieldError = (field: CreateFormField, error: string | null) => {
    setCreateFieldErrors((prev) => {
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const validateCreateField = (
    field: CreateFormField,
    overrides?: Partial<{
      testId: string;
      code: string;
      price: string;
      taxRate: string;
      testName: string;
      serviceGroup: string;
      samplesInput: string;
    }>,
  ): string | null => {
    const testId = (overrides?.testId ?? createTestId).trim();
    const code = (overrides?.code ?? createCode).trim();
    const price = (overrides?.price ?? createPrice).trim();
    const taxRate = (overrides?.taxRate ?? createTaxRate).trim();
    const testName = (overrides?.testName ?? createTestName).trim();
    const serviceGroup = (overrides?.serviceGroup ?? createServiceGroupType).trim();
    const samplesInput = (overrides?.samplesInput ?? createSamplesInput).trim();
    const normalizedPrice = Number(price.replace(/[^\d]/g, ""));
    const normalizedTaxRate = taxRate ? Number(taxRate.replace(",", ".")) : NaN;
    const samples = samplesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (field === "testId") {
      if (!testId) return "Mã xét nghiệm không được để trống.";
      if (testId.length > MAX_ID_LENGTH) {
        return `Mã xét nghiệm tối đa ${MAX_ID_LENGTH} ký tự.`;
      }
      return null;
    }
    if (field === "code") {
      if (!code) return "Mã code không được để trống.";
      if (code.length > MAX_ID_LENGTH) {
        return `Mã code tối đa ${MAX_ID_LENGTH} ký tự.`;
      }
      return null;
    }
    if (field === "price") {
      if (!price) return "Giá tiền là bắt buộc.";
      if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
        return "Giá tiền không hợp lệ.";
      }
      if (normalizedPrice < MIN_PRICE) {
        return "Giá tối thiểu là 10.000 đ.";
      }
      if (normalizedPrice > MAX_PRICE) {
        return "Giá tối đa là 1.000.000.000 đ.";
      }
      return null;
    }
    if (field === "taxRate") {
      if (!taxRate) return "Thuế suất là bắt buộc.";
      if (!Number.isFinite(normalizedTaxRate)) return "Thuế suất không hợp lệ.";
      if (normalizedTaxRate < 0 || normalizedTaxRate > MAX_TAX_RATE) {
        return "Thuế suất phải trong khoảng 0 - 100%.";
      }
      return null;
    }
    if (field === "testName") {
      if (!testName) return "Tên xét nghiệm không được để trống.";
      if (/^\d/.test(testName)) return "Tên xét nghiệm không được bắt đầu bằng số.";
      if (testName.length > MAX_TEST_NAME_LENGTH) {
        return "Tên xét nghiệm không được vượt quá 255 ký tự.";
      }
      return null;
    }
    if (field === "serviceGroup") {
      if (!serviceGroup) return "Vui lòng chọn nhóm dịch vụ.";
      return null;
    }
    if (field === "samples") {
      if (!samplesInput || samples.length === 0) {
        return "Mẫu xét nghiệm không được để trống.";
      }
      if (samplesInput.length > MAX_SAMPLES_INPUT_LENGTH) {
        return "Danh sách mẫu xét nghiệm không được vượt quá 255 ký tự.";
      }
      if (samples.length > MAX_SAMPLE_ITEMS) {
        return "Tối đa 10 mẫu xét nghiệm.";
      }
      if (samples.some((sample) => sample.length > MAX_SAMPLE_ITEM_LENGTH)) {
        return "Mỗi mẫu xét nghiệm tối đa 50 ký tự.";
      }
      return null;
    }

    return null;
  };

  const validateCreateForm = (): CreateFormErrors => {
    const fields: CreateFormField[] = [
      "testId",
      "code",
      "price",
      "taxRate",
      "testName",
      "serviceGroup",
      "samples",
    ];
    const nextErrors: CreateFormErrors = {};
    fields.forEach((field) => {
      const err = validateCreateField(field);
      if (err) nextErrors[field] = err;
    });
    return nextErrors;
  };

  const validateEditForm = (): EditFormErrors => {
    const errors: EditFormErrors = {};
    if (!formServiceId.trim()) {
      errors.serviceId = "Mã dịch vụ không được để trống.";
    }
    if (!formName.trim()) {
      errors.name = "Tên dịch vụ không được để trống.";
    } else if (!SERVICE_TYPES.some((t) => t.value === formName.trim())) {
      errors.name = `Tên dịch vụ phải là một trong: ${SERVICE_TYPES.map((t) => t.value).join(", ")}`;
    }
    return errors;
  };

  const handleCreate = () => {
    const normalizedPrice = parsedCreatePrice;
    const normalizedTaxRate = Number(createTaxRate.replace(",", "."));
    const matchingService = services.find((s) => s.name === createServiceGroupType);
    const samples = createSamplesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const nextErrors = validateCreateForm();
    setCreateFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      Alert.alert("Lỗi", "Vui lòng nhập đúng và đầy đủ các trường bắt buộc.");
      return;
    }

    if (!matchingService?.serviceId) {
      Alert.alert("Lỗi", "Không tìm thấy nhóm dịch vụ tương ứng");
      return;
    }

    createGenomeMutation.mutate({
      testId: createTestId.trim(),
      code: createCode.trim(),
      price: normalizedPrice,
      taxRate: normalizedTaxRate,
      testName: createTestName.trim(),
      serviceId: matchingService.serviceId,
      testSample: samples,
      testDescription: "",
    });
  };

  const handleCreatePriceChange = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, "");
    if (!cleaned) {
      setCreatePrice("");
      return;
    }
    const numeric = Number(cleaned);
    if (numeric > MAX_PRICE) {
      return;
    }
    setCreatePrice(new Intl.NumberFormat("vi-VN").format(numeric));
  };

  const handleEdit = (service: ServiceEntityResponse) => {
    setEditingService(service);
    setFormServiceId(service.serviceId);
    setFormName(service.name);
    setEditFieldErrors({});
    setShowEditModal(true);
  };

  const handleUpdate = () => {
    if (!editingService) {
      return;
    }

    const nextErrors = validateEditForm();
    setEditFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      Alert.alert("Lỗi", "Vui lòng nhập đúng thông tin.");
      return;
    }
    updateMutation.mutate({
      id: editingService.serviceId,
      data: {
        serviceId: formServiceId.trim(),
        name: formName.trim(),
      },
    });
  };

  const handleDeleteGenomeTest = (test: GenomeTestResponse, serviceId: string) => {
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc chắn muốn xóa mã xét nghiệm "${test.testId}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () =>
            deleteGenomeTestMutation.mutate({
              testId: test.testId,
              serviceId,
            }),
        },
      ]
    );
  };

  const handleEditGenomeTest = (test: GenomeTestResponse) => {
    router.push({
      pathname: "/edit-genome-test",
      params: {
        testId: test.testId,
        testName: test.testName || "",
        testDescription: test.testDescription || "",
        code: test.code || "",
        serviceId: test.service?.serviceId || "",
        price: typeof test.price === "number" ? String(test.price) : "",
        taxRate: typeof test.taxRate === "number" ? String(test.taxRate) : "",
        sampleInput: Array.isArray(test.testSample) ? test.testSample.join(", ") : "",
      },
    });
  };

  const handleClearFilters = () => {
    setFilterServiceId("");
    setSearchQuery("");
  };

  if (authLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#0284C7" />
        <Text className="mt-3 text-slate-500 text-sm font-bold">
          Đang tải dữ liệu...
        </Text>
      </View>
    );
  }

  if (!user || user.role !== "ROLE_ADMIN") {
    return null;
  }

  return (
    <SafeAreaView
      className="flex-1 bg-sky-50"
      edges={["top", "left", "right"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen
        options={{
          title: "Quản lý dịch vụ",
          headerStyle: { backgroundColor: "#0891b2" },
          headerTintColor: "#fff",
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.push("/admin-home")} 
              className="ml-2"
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Header: tab + (trên tab nhóm) search / filter / thêm xét nghiệm */}
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center mb-3">
          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">
              Quản lý dịch vụ
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {mainTab === "groups"
                ? `${filteredServices.length} nhóm dịch vụ`
                : "Cấu hình giá dịch vụ thêm mẫu"}
            </Text>
          </View>

          {mainTab === "groups" && (
            <>
              <TouchableOpacity
                onPress={() => setShowCreateModal(true)}
                className="w-10 h-10 rounded-xl bg-emerald-600 items-center justify-center mr-2"
                activeOpacity={0.85}
              >
                <Plus size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowFilters((v) => !v)}
                className={`w-10 h-10 rounded-xl border items-center justify-center relative ${
                  showFilters
                    ? "bg-sky-600 border-sky-600"
                    : "bg-sky-50 border-sky-200"
                }`}
                activeOpacity={0.85}
              >
                <SlidersHorizontal
                  size={18}
                  color={showFilters ? "#FFFFFF" : "#0284C7"}
                />
                {activeFilterCount > 0 && (
                  <View className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white items-center justify-center">
                    <Text className="text-[10px] font-bold text-white">
                      {activeFilterCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View className="flex-row gap-2 mb-3">
          <TouchableOpacity
            onPress={() => setMainTab("groups")}
            className={`flex-1 py-2.5 rounded-xl border items-center ${
              mainTab === "groups"
                ? "bg-sky-600 border-sky-600"
                : "bg-sky-50 border-sky-200"
            }`}
            activeOpacity={0.85}
          >
            <Text
              className={`text-xs font-extrabold ${
                mainTab === "groups" ? "text-white" : "text-sky-800"
              }`}
            >
              Nhóm dịch vụ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMainTab("sample_add")}
            className={`flex-1 py-2.5 rounded-xl border items-center ${
              mainTab === "sample_add"
                ? "bg-violet-600 border-violet-600"
                : "bg-violet-50 border-violet-200"
            }`}
            activeOpacity={0.85}
          >
            <Text
              className={`text-xs font-extrabold ${
                mainTab === "sample_add" ? "text-white" : "text-violet-900"
              }`}
            >
              Dịch vụ thêm mẫu
            </Text>
          </TouchableOpacity>
        </View>

        {mainTab === "groups" && (
          <>
            <View className="flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
              <Search size={18} color="#64748B" />
              <TextInput
                className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
                placeholder="Tìm theo mã hoặc tên dịch vụ..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={(value) =>
                  setSearchQuery(sanitizeNoLeadingSpace(value).slice(0, MAX_SEARCH_LENGTH))
                }
                returnKeyType="search"
              />
              {!!searchQuery.trim() && (
                <TouchableOpacity
                  className="w-9 h-9 rounded-xl items-center justify-center"
                  onPress={() => setSearchQuery("")}
                  activeOpacity={0.75}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            {showFilters && (
              <View className="mt-3 pt-3 border-t border-sky-100">
                <Text className="text-xs font-bold text-slate-600 mb-2">
                  Mã dịch vụ
                </Text>
                <TextInput
                  className="h-10 rounded-xl px-3 bg-white border border-sky-200 text-sm text-slate-900 font-semibold"
                  placeholder="Nhập mã dịch vụ"
                  placeholderTextColor="#94A3B8"
                  value={filterServiceId}
                  onChangeText={(value) => setFilterServiceId(sanitizeIdInput(value))}
                />

                {activeFilterCount > 0 && (
                  <TouchableOpacity
                    className="mt-3 py-2 rounded-xl bg-slate-100 items-center"
                    onPress={handleClearFilters}
                    activeOpacity={0.75}
                  >
                    <Text className="text-xs font-bold text-slate-700">
                      Xóa bộ lọc
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {mainTab === "groups" ? (
        isLoading ? (
          <View className="flex-1 justify-center items-center py-20">
            <ActivityIndicator size="large" color="#0284C7" />
            <Text className="mt-3 text-slate-500 text-sm font-bold">Đang tải dữ liệu...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center py-12 px-5">
            <View className="bg-white rounded-2xl p-4 border border-sky-100 w-full max-w-[420px]">
              <Text className="text-base font-extrabold text-slate-900 text-center mb-2">
                Không tải được dữ liệu
              </Text>
              <Text className="text-xs text-slate-500 text-center mb-4">
                Vui lòng kiểm tra kết nối mạng và thử lại.
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
        ) : (
          <>
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isLoading}
                  onRefresh={refetch}
                  tintColor="#0284C7"
                />
              }
            >
              {filteredServices.length === 0 ? (
                <View className="flex-1 justify-center items-center py-20 px-5">
                  <Package size={48} color="#94A3B8" />
                  <Text className="mt-4 text-base font-bold text-slate-700 text-center">
                    {searchQuery.trim() || filterServiceId.trim()
                      ? "Không tìm thấy dịch vụ phù hợp"
                      : "Chưa có dịch vụ nào"}
                  </Text>
                  <Text className="mt-2 text-xs text-slate-500 text-center">
                    {searchQuery.trim() || filterServiceId.trim()
                      ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
                      : "Nhấn nút + để thêm dịch vụ mới"}
                  </Text>
                </View>
              ) : (
                <View className="p-4">
                  {filteredServices.map((service) => {
                    const isExpanded = expandedServiceId === service.serviceId;

                    return (
                      <ServiceItem
                        key={service.serviceId}
                        service={service}
                        isExpanded={isExpanded}
                        onToggleExpand={() => {
                          setExpandedServiceId(isExpanded ? null : service.serviceId);
                        }}
                        onEditGenomeTest={handleEditGenomeTest}
                        onDeleteGenomeTest={(test) =>
                          handleDeleteGenomeTest(test, service.serviceId)
                        }
                        isPendingDeleteGenomeTest={deleteGenomeTestMutation.isPending}
                      />
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                pageSize={pageSize}
                totalElements={totalElements}
                isLoading={isLoading}
              />
            )}
          </>
        )
      ) : (
        <SampleAddServicesPanel />
      )}

      {/* Create Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
            className="w-full max-w-[400px]"
          >
          <View className="bg-white rounded-3xl p-6 w-full max-h-[88%]">
            <Text className="text-lg font-extrabold text-slate-900 mb-2">
              Thêm dịch vụ mới
            </Text>
            <Text className="text-xs text-slate-500 mb-4">
              Nhập thông tin để tạo dịch vụ xét nghiệm mới
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 mb-2">
                  Mã xét nghiệm
                </Text>
                <TextInput
                  className={`h-11 rounded-xl px-3 border text-sm text-slate-900 font-semibold ${
                    createFieldErrors.testId
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                  placeholder="Nhập mã xét nghiệm"
                  placeholderTextColor="#94A3B8"
                  value={createTestId}
                  onChangeText={(value) => {
                    const normalized = sanitizeIdInput(value);
                    setCreateTestId(normalized);
                    setCreateFieldError(
                      "testId",
                      validateCreateField("testId", { testId: normalized }),
                    );
                  }}
                  maxLength={MAX_ID_LENGTH}
                />
                {createFieldErrors.testId ? (
                  <Text className="mt-1 text-[11px] text-red-600">{createFieldErrors.testId}</Text>
                ) : null}
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 mb-2">
                  Mã code *
                </Text>
                <TextInput
                  className={`h-11 rounded-xl px-3 border text-sm text-slate-900 font-semibold ${
                    createFieldErrors.code
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                  placeholder="Nhập mã code"
                  placeholderTextColor="#94A3B8"
                  value={createCode}
                  onChangeText={(value) => {
                    const normalized = sanitizeIdInput(value);
                    setCreateCode(normalized);
                    setCreateFieldError("code", validateCreateField("code", { code: normalized }));
                  }}
                  maxLength={MAX_ID_LENGTH}
                />
                {createFieldErrors.code ? (
                  <Text className="mt-1 text-[11px] text-red-600">{createFieldErrors.code}</Text>
                ) : null}
              </View>

              <View className="mb-2">
                <Text className="text-xs font-bold text-slate-700 mb-2">
                  Giá tiền (VND) *
                </Text>
                <TextInput
                  className={`h-11 rounded-xl px-3 border text-sm text-slate-900 font-semibold ${
                    createFieldErrors.price
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                  placeholder="Nhập giá tiền (VD: 500.000)"
                  placeholderTextColor="#94A3B8"
                  value={createPrice}
                  onChangeText={(value) => {
                    handleCreatePriceChange(value);
                    setCreateFieldError(
                      "price",
                      validateCreateField("price", { price: value }),
                    );
                  }}
                  keyboardType="numeric"
                />
                {createFieldErrors.price ? (
                  <Text className="mt-1 text-[11px] text-red-600">{createFieldErrors.price}</Text>
                ) : null}
              </View>
              <Text className="text-[11px] text-slate-500 mb-3">Giá tối thiểu: 10.000 đ</Text>

              <View className="mb-2">
                <Text className="text-xs font-bold text-slate-700 mb-2">
                  Thuế suất (%) *
                </Text>
                <TextInput
                  className={`h-11 rounded-xl px-3 border text-sm text-slate-900 font-semibold ${
                    createFieldErrors.taxRate
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                  placeholder="Nhập thuế suất (VD: 10)"
                  placeholderTextColor="#94A3B8"
                  value={createTaxRate}
                  onChangeText={(value) => {
                    const normalized = sanitizeTaxRateInput(value);
                    const clamped = clampDecimalStringToMax(normalized, MAX_TAX_RATE);
                    setCreateTaxRate(clamped);
                    setCreateFieldError(
                      "taxRate",
                      validateCreateField("taxRate", { taxRate: clamped }),
                    );
                  }}
                  keyboardType="decimal-pad"
                  maxLength={6}
                />
                {createFieldErrors.taxRate ? (
                  <Text className="mt-1 text-[11px] text-red-600">{createFieldErrors.taxRate}</Text>
                ) : null}
              </View>
              <Text className="text-[11px] text-slate-500 mb-3">
                Giá sau thuế:{" "}
                {createdPriceAfterTax
                  ? `${new Intl.NumberFormat("vi-VN").format(createdPriceAfterTax)} đ`
                  : "—"}
              </Text>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 mb-2">
                  Tên xét nghiệm *
                </Text>
                <TextInput
                  className={`h-11 rounded-xl px-3 border text-sm text-slate-900 font-semibold ${
                    createFieldErrors.testName
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                  placeholder="Nhập tên xét nghiệm"
                  placeholderTextColor="#94A3B8"
                  value={createTestName}
                  onChangeText={(value) => {
                    const normalized = sanitizeNoLeadingSpace(value).slice(0, MAX_TEST_NAME_LENGTH);
                    if (normalized.length > 0 && /^\d/.test(normalized)) {
                      return;
                    }
                    setCreateTestName(normalized);
                    setCreateFieldError(
                      "testName",
                      validateCreateField("testName", { testName: normalized }),
                    );
                  }}
                  maxLength={MAX_TEST_NAME_LENGTH}
                />
                {createFieldErrors.testName ? (
                  <Text className="mt-1 text-[11px] text-red-600">{createFieldErrors.testName}</Text>
                ) : null}
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 mb-2">
                  Nhóm dịch vụ *
                </Text>
                <View className="flex-row gap-2">
                  {SERVICE_TYPES.map((type) => {
                    const selected = createServiceGroupType === type.value;
                    return (
                      <TouchableOpacity
                        key={type.value}
                        className={`flex-1 h-11 rounded-xl border items-center justify-center ${
                          selected
                            ? "bg-sky-600 border-sky-600"
                            : "bg-slate-50 border-slate-200"
                        }`}
                        onPress={() => {
                          setCreateServiceGroupType(type.value);
                          setCreateFieldError(
                            "serviceGroup",
                            validateCreateField("serviceGroup", { serviceGroup: type.value }),
                          );
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          className={`text-xs font-extrabold ${
                            selected ? "text-white" : "text-slate-700"
                          }`}
                        >
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {!selectedCreateGroupLabel && (
                  <Text className="text-[11px] text-slate-500 mt-1">
                    Chọn 1 trong 3 nhóm dịch vụ.
                  </Text>
                )}
                {createFieldErrors.serviceGroup ? (
                  <Text className="mt-1 text-[11px] text-red-600">
                    {createFieldErrors.serviceGroup}
                  </Text>
                ) : null}
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 mb-2">
                  Mẫu xét nghiệm *
                </Text>
                <TextInput
                  className={`h-11 rounded-xl px-3 border text-sm text-slate-900 font-semibold ${
                    createFieldErrors.samples
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                  placeholder="Nhập mẫu xét nghiệm (phân cách bằng dấu phẩy)"
                  placeholderTextColor="#94A3B8"
                  value={createSamplesInput}
                  onChangeText={(value) => {
                    const normalized = sanitizeNoLeadingSpace(value).slice(0, MAX_SAMPLES_INPUT_LENGTH);
                    setCreateSamplesInput(normalized);
                    setCreateFieldError(
                      "samples",
                      validateCreateField("samples", { samplesInput: normalized }),
                    );
                  }}
                  maxLength={MAX_SAMPLES_INPUT_LENGTH}
                />
                {createFieldErrors.samples ? (
                  <Text className="mt-1 text-[11px] text-red-600">{createFieldErrors.samples}</Text>
                ) : null}
                <Text className="mt-2 text-[11px] text-slate-500">
                  Ví dụ: Máu, Nước tiểu, Mô
                </Text>
              </View>
            </ScrollView>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-slate-100 items-center"
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                activeOpacity={0.85}
                disabled={createGenomeMutation.isPending}
              >
                <Text className="text-slate-700 text-sm font-extrabold">
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-emerald-600 items-center"
                onPress={handleCreate}
                activeOpacity={0.85}
                disabled={
                  createGenomeMutation.isPending ||
                  !createTestId.trim() ||
                  !createCode.trim() ||
                  !createPrice.trim() ||
                  !createTaxRate.trim() ||
                  !createTestName.trim() ||
                  !createServiceGroupType.trim() ||
                  !createSamplesInput.trim()
                }
              >
                {createGenomeMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-sm font-extrabold">
                    Tạo
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowEditModal(false);
          setEditingService(null);
          resetForm();
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
            className="w-full max-w-[400px]"
          >
          <View className="bg-white rounded-3xl p-6 w-full">
            <Text className="text-lg font-extrabold text-slate-900 mb-2">
              Chỉnh sửa dịch vụ
            </Text>
            <Text className="text-sm text-slate-600 mb-4">
              Mã: {editingService?.serviceId}
            </Text>

            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-700 mb-2">
                Mã dịch vụ *
              </Text>
              <TextInput
                className="h-11 rounded-xl px-3 bg-slate-50 border border-slate-200 text-sm text-slate-900 font-semibold"
                placeholder="Nhập mã dịch vụ"
                placeholderTextColor="#94A3B8"
                value={formServiceId}
                onChangeText={(value) => {
                  const normalized = sanitizeIdInput(value);
                  setFormServiceId(normalized);
                  setEditFieldErrors((prev) => ({ ...prev, serviceId: undefined }));
                }}
                editable={false}
              />
              {editFieldErrors.serviceId ? (
                <Text className="mt-1 text-[11px] text-red-600">{editFieldErrors.serviceId}</Text>
              ) : null}
            </View>

            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-700 mb-2">
                Tên dịch vụ *
              </Text>
              <View className="flex-row gap-2">
                {SERVICE_TYPES.map((type) => {
                  const selected = formName === type.value;
                  return (
                    <TouchableOpacity
                      key={type.value}
                      className={`flex-1 h-11 rounded-xl border items-center justify-center ${
                        selected
                          ? "bg-blue-600 border-blue-600"
                          : "bg-slate-50 border-slate-200"
                      }`}
                      onPress={() => setFormName(type.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        className={`text-xs font-extrabold ${
                          selected ? "text-white" : "text-slate-700"
                        }`}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {editFieldErrors.name ? (
                <Text className="mt-1 text-[11px] text-red-600">{editFieldErrors.name}</Text>
              ) : null}
            </View>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-slate-100 items-center"
                onPress={() => {
                  setShowEditModal(false);
                  setEditingService(null);
                  resetForm();
                }}
                activeOpacity={0.85}
                disabled={updateMutation.isPending}
              >
                <Text className="text-slate-700 text-sm font-extrabold">
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-blue-600 items-center"
                onPress={handleUpdate}
                activeOpacity={0.85}
                disabled={
                  updateMutation.isPending || !formServiceId.trim() || !formName.trim()
                }
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-sm font-extrabold">
                    Cập nhật
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
