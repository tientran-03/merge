import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  Search,
  X,
  SlidersHorizontal,
  User,
  Lock,
  LockOpen,
  Eye,
  Mail,
  Phone,
  Building2,
  Shield,
  AlertCircle,
  Home,
  Plus,
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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StandaloneDatePicker } from "@/components/form";
import { PaginationControls } from "@/components/PaginationControls";
import { isStaffLikeOperationalRole } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import {
  userService,
  UserResponse,
  CreateUserRequest,
} from "@/services/userService";
import { HospitalResponse, hospitalService } from "@/services/hospitalService";
import {
  customerService,
  CustomerResponse,
  CustomerRequest,
} from "@/services/customerService";
import { doctorService, DoctorResponse, DoctorRequest } from "@/services/doctorService";
import {
  hospitalStaffService,
  HospitalStaffResponse,
  HospitalStaffRequest,
} from "@/services/hospitalStaffService";
import { uploadImageToCloudinary } from "@/utils/cloudinary";

// Map role to display label
const getRoleLabel = (role?: string): string => {
  if (!role) return "N/A";
  const roleMap: Record<string, string> = {
    "ROLE_ADMIN": "Admin",
    "ROLE_STAFF": "Nhân viên",
    "ROLE_DOCTOR": "Bác sĩ",
    "ROLE_CUSTOMER": "Khách hàng",
    "ROLE_LAB_TECHNICIAN": "Kỹ thuật viên",
    "ROLE_SAMPLE_COLLECTOR": "Người thu mẫu",
  };
  return roleMap[role] || role;
};

const getGenderLabel = (gender?: string): string => {
  if (!gender) return "Chưa cập nhật";
  const normalized = gender.toLowerCase();
  if (normalized === "male") return "Nam";
  if (normalized === "female") return "Nữ";
  if (normalized === "other") return "Khác";
  return gender;
};

// Get status badge
const getStatusBadge = (user: UserResponse) => {
  if (!user.isActive) {
    return {
      label: "Đã khóa",
      bg: "bg-red-50",
      fg: "text-red-700",
      bd: "border-red-200",
    };
  }
  if (!user.enabled) {
    return {
      label: "Chờ kích hoạt",
      bg: "bg-orange-50",
      fg: "text-orange-700",
      bd: "border-orange-200",
    };
  }
  return {
    label: "Hoạt động",
    bg: "bg-emerald-50",
    fg: "text-emerald-700",
    bd: "border-emerald-200",
  };
};

const CREATE_USER_DEFAULT_PASSWORD = "123456";
const CREATE_USER_HTGENETIC_ID = 1;
const MAX_EMAIL_LENGTH = 255;
const MAX_NAME_LENGTH = 100;
const MAX_HOSPITAL_NAME_LENGTH = 255;
const MAX_AVATAR_URL_LENGTH = 255;
const MAX_BLOCK_REASON_LENGTH = 500;
const DOB_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_10_DIGITS_REGEX = /^\d{10}$/;
const PHONE_VN_REGEX = /^0\d{9}$/;
const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const NAME_ALLOWED_CHARS_REGEX = /[^a-zA-ZÀ-ỹ\s]/g;
const GMAIL_DOMAIN = "gmail.com";
type CreateFormField =
  | "name"
  | "email"
  | "phone"
  | "dob"
  | "gender"
  | "role"
  | "hospitalName"
  | "avatarUrl";
type CreateFormErrors = Partial<Record<CreateFormField, string>>;

const sanitizeCreateNameInput = (value: string): string => {
  return value
    .replace(NAME_ALLOWED_CHARS_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s+/g, "")
    .slice(0, MAX_NAME_LENGTH);
};

const normalizeEmailLocalPart = (value: string): string => {
  return value.replace(/[^a-z0-9._%+-]/g, "");
};

const sanitizeCreateEmailInput = (value: string): string => {
  const normalized = value.toLowerCase().replace(/\s+/g, "");
  if (!normalized) return "";

  const atIndex = normalized.indexOf("@");
  if (atIndex === -1) {
    return normalizeEmailLocalPart(normalized)
      .replace(/^\.+/g, "")
      .slice(0, MAX_EMAIL_LENGTH);
  }
  if (atIndex === 0) return "";

  const localPart = normalizeEmailLocalPart(normalized.slice(0, atIndex)).replace(
    /^\.+/g,
    "",
  );
  if (!localPart) return "";
  const domainCandidate = normalized
    .slice(atIndex + 1)
    .replace(/[^a-z.]/g, "");

  let constrainedDomain = "";
  for (let i = 0; i < domainCandidate.length && i < GMAIL_DOMAIN.length; i += 1) {
    if (domainCandidate[i] !== GMAIL_DOMAIN[i]) {
      break;
    }
    constrainedDomain += domainCandidate[i];
  }

  return `${localPart}@${constrainedDomain}`.slice(0, MAX_EMAIL_LENGTH);
};

const sanitizeNoLeadingSpaceInput = (value: string): string => {
  return value.replace(/^\s+/g, "");
};

const normalizeBinaryGender = (value?: string): "male" | "female" => {
  return value?.toLowerCase() === "female" ? "female" : "male";
};

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-2 rounded-full border ${
        active ? "bg-sky-600 border-sky-600" : "bg-white border-slate-200"
      }`}
      activeOpacity={0.7}
    >
      <Text
        className={`text-xs font-bold ${
          active ? "text-white" : "text-slate-700"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createDob, setCreateDob] = useState("");
  const [createGender, setCreateGender] = useState<"male" | "female">("male");
  const [createRole, setCreateRole] = useState<
    | "ROLE_CUSTOMER"
    | "ROLE_DOCTOR"
    | "ROLE_STAFF"
    | "ROLE_LAB_TECHNICIAN"
    | "ROLE_ADMIN"
  >("ROLE_CUSTOMER");
  const [hospitalNameInput, setHospitalNameInput] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const [hospitalDropdownOpen, setHospitalDropdownOpen] = useState(false);
  const [hospitals, setHospitals] = useState<HospitalResponse[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [createAvatarUrl, setCreateAvatarUrl] = useState("");
  const [createAvatarPreview, setCreateAvatarPreview] = useState("");
  const [uploadingCreateAvatar, setUploadingCreateAvatar] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<CreateFormErrors>({});
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailCustomerData, setDetailCustomerData] = useState<CustomerResponse | null>(null);
  const [detailDoctorData, setDetailDoctorData] = useState<DoctorResponse | null>(null);
  const [detailStaffData, setDetailStaffData] = useState<HospitalStaffResponse | null>(null);
  const [detailEditName, setDetailEditName] = useState("");
  const [detailEditEmail, setDetailEditEmail] = useState("");
  const [detailEditPhone, setDetailEditPhone] = useState("");
  const [detailEditDob, setDetailEditDob] = useState("");
  const [detailEditGender, setDetailEditGender] = useState<"male" | "female">("male");
  const [detailEditAddress, setDetailEditAddress] = useState("");
  const [detailHospitalNameInput, setDetailHospitalNameInput] = useState("");
  const [detailSelectedHospitalId, setDetailSelectedHospitalId] = useState<number | null>(null);
  const [detailHospitalDropdownOpen, setDetailHospitalDropdownOpen] = useState(false);
  const [detailEditError, setDetailEditError] = useState<string | null>(null);

  const isHTGENETIC = selectedHospitalId === CREATE_USER_HTGENETIC_ID;

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

  const resetCreateForm = () => {
    setCreateName("");
    setCreateEmail("");
    setCreatePhone("");
    setCreateDob("");
    setCreateGender("male");
    setCreateRole("ROLE_CUSTOMER");
    setHospitalNameInput("");
    setSelectedHospitalId(null);
    setHospitalDropdownOpen(false);
    setCreateAvatarUrl("");
    setCreateAvatarPreview("");
    setUploadingCreateAvatar(false);
    setCreateError(null);
    setCreateFieldErrors({});
  };

  useEffect(() => {
    if (!showCreateModal && !(showDetailModal && isEditingDetail)) return;

    const loadHospitals = async () => {
      try {
        setLoadingHospitals(true);
        const response = await hospitalService.getAll({ page: 0, size: 500 });
        if (!response.success) {
          setHospitals([]);
          return;
        }

        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          setHospitals(responseData);
          return;
        }
        if (responseData?.content && Array.isArray(responseData.content)) {
          setHospitals(responseData.content);
          return;
        }
        setHospitals([]);
      } catch (error) {
        setHospitals([]);
      } finally {
        setLoadingHospitals(false);
      }
    };

    loadHospitals();
  }, [showCreateModal, showDetailModal, isEditingDetail]);

  useEffect(() => {
    if (isHTGENETIC) {
      if (createRole === "ROLE_CUSTOMER") {
        setCreateRole("ROLE_DOCTOR");
      }
      return;
    }
    setCreateRole("ROLE_CUSTOMER");
  }, [isHTGENETIC]);

  useEffect(() => {
    setCreateFieldError("role", validateCreateField("role"));
  }, [createRole, selectedHospitalId]);

  const filteredHospitals = useMemo(() => {
    if (!hospitalNameInput.trim()) return hospitals;
    const query = hospitalNameInput.toLowerCase();
    return hospitals.filter((h) =>
      h.hospitalName.toLowerCase().includes(query),
    );
  }, [hospitals, hospitalNameInput]);

  const filteredDetailHospitals = useMemo(() => {
    if (!detailHospitalNameInput.trim()) return hospitals;
    const query = detailHospitalNameInput.toLowerCase();
    return hospitals.filter((h) =>
      h.hospitalName.toLowerCase().includes(query),
    );
  }, [hospitals, detailHospitalNameInput]);

  const setCreateFieldError = (field: CreateFormField, error: string | null) => {
    setCreateFieldErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const validateCreateField = (
    field: CreateFormField,
    overrides?: Partial<{
      name: string;
      email: string;
      phone: string;
      dob: string;
      gender: "male" | "female";
      role: typeof createRole;
      hospitalName: string;
      avatarUrl: string;
      selectedHospitalId: number | null;
    }>,
  ): string | null => {
    const name = (overrides?.name ?? createName).trim();
    const email = (overrides?.email ?? createEmail).trim().toLowerCase();
    const phone = (overrides?.phone ?? createPhone).replace(/\D/g, "");
    const dob = (overrides?.dob ?? createDob).trim();
    const gender = overrides?.gender ?? createGender;
    const role = overrides?.role ?? createRole;
    const hospitalName = (overrides?.hospitalName ?? hospitalNameInput).trim();
    const avatarUrl = (overrides?.avatarUrl ?? createAvatarUrl).trim();
    const effectiveHospitalId = overrides?.selectedHospitalId ?? selectedHospitalId;
    const htGeneticSelected = effectiveHospitalId === CREATE_USER_HTGENETIC_ID;

    if (field === "name") {
      if (!name) return "Họ và tên không được để trống.";
      if (name.length > MAX_NAME_LENGTH) {
        return "Họ và tên không được vượt quá 100 ký tự.";
      }
      const compactName = name.replace(/\s+/g, "");
      if (/^\d+$/.test(compactName)) {
        return "Họ và tên không được nhập toàn số.";
      }
      return null;
    }

    if (field === "email") {
      if (!email) return "Email không được để trống.";
      if (email.length > MAX_EMAIL_LENGTH) {
        return "Email không được vượt quá 255 ký tự.";
      }
      if (!GMAIL_REGEX.test(email)) {
        return "Email phải đúng định dạng Gmail (ví dụ: abc@gmail.com).";
      }
      return null;
    }

    if (field === "phone") {
      if (!phone) return "Số điện thoại không được để trống.";
      if (!PHONE_10_DIGITS_REGEX.test(phone)) {
        return "Số điện thoại bắt buộc là số và đúng 10 chữ số.";
      }
      if (!PHONE_VN_REGEX.test(phone)) {
        return "Số điện thoại phải bắt đầu bằng số 0.";
      }
      return null;
    }

    if (field === "dob") {
      if (!dob) return "Ngày sinh không được để trống.";
      if (!DOB_FORMAT_REGEX.test(dob)) {
        return "Ngày sinh phải đúng định dạng yyyy-MM-dd.";
      }
      const dobDate = new Date(`${dob}T00:00:00`);
      if (Number.isNaN(dobDate.getTime())) {
        return "Ngày sinh không hợp lệ.";
      }
      const [year, month, day] = dob.split("-").map(Number);
      const isExactDate =
        dobDate.getFullYear() === year &&
        dobDate.getMonth() + 1 === month &&
        dobDate.getDate() === day;
      if (!isExactDate) {
        return "Ngày sinh không hợp lệ.";
      }
      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      if (dobDate > todayStart) {
        return "Ngày sinh không được lớn hơn ngày hiện tại.";
      }
      const oldestAllowedDob = new Date(
        todayStart.getFullYear() - 120,
        todayStart.getMonth(),
        todayStart.getDate(),
      );
      if (dobDate < oldestAllowedDob) {
        return "Ngày sinh không hợp lệ (tuổi vượt quá giới hạn cho phép).";
      }
      return null;
    }

    if (field === "gender") {
      if (!gender) return "Giới tính không được để trống.";
      return null;
    }

    if (field === "role") {
      if (!role) return "Vai trò không được để trống.";
      if (
        htGeneticSelected &&
        ![
          "ROLE_DOCTOR",
          "ROLE_LAB_TECHNICIAN",
          "ROLE_SAMPLE_COLLECTOR",
          "ROLE_STAFF",
          "ROLE_ADMIN",
        ].includes(role)
      ) {
        return "Vai trò không hợp lệ với tổ chức HTGENETIC.";
      }
      if (!htGeneticSelected && role !== "ROLE_CUSTOMER") {
        return "Vai trò phải là Khách hàng khi không thuộc HTGENETIC.";
      }
      return null;
    }

    if (field === "hospitalName") {
      if (hospitalName.length > MAX_HOSPITAL_NAME_LENGTH) {
        return "Tên tổ chức không được vượt quá 255 ký tự.";
      }
      return null;
    }

    if (field === "avatarUrl") {
      if (avatarUrl && avatarUrl.length > MAX_AVATAR_URL_LENGTH) {
        return "Đường dẫn ảnh đại diện không được vượt quá 255 ký tự.";
      }
      return null;
    }

    return null;
  };

  const handleHospitalInputChange = (value: string) => {
    setHospitalNameInput(value);
    if (createError) setCreateError(null);
    const matchedHospital = hospitals.find(
      (h) => h.hospitalName.toLowerCase() === value.toLowerCase(),
    );
    const nextHospitalId = matchedHospital?.hospitalId ?? null;
    setSelectedHospitalId(nextHospitalId);
    setCreateFieldError(
      "hospitalName",
      validateCreateField("hospitalName", { hospitalName: value }),
    );
    setCreateFieldError(
      "role",
      validateCreateField("role", {
        hospitalName: value,
        selectedHospitalId: nextHospitalId,
      }),
    );
    if (!hospitalDropdownOpen) {
      setHospitalDropdownOpen(true);
    }
  };

  const handleSelectHospital = (hospital: HospitalResponse) => {
    setHospitalNameInput(hospital.hospitalName);
    setSelectedHospitalId(hospital.hospitalId);
    if (createError) setCreateError(null);
    setCreateFieldError("hospitalName", null);
    setCreateFieldError(
      "role",
      validateCreateField("role", {
        hospitalName: hospital.hospitalName,
        selectedHospitalId: hospital.hospitalId,
      }),
    );
    setHospitalDropdownOpen(false);
  };

  const handleDetailHospitalInputChange = (value: string) => {
    setDetailHospitalNameInput(value);
    if (detailEditError) {
      setDetailEditError(null);
    }
    const matchedHospital = hospitals.find(
      (h) => h.hospitalName.toLowerCase() === value.toLowerCase(),
    );
    setDetailSelectedHospitalId(matchedHospital?.hospitalId ?? null);
    if (!detailHospitalDropdownOpen) {
      setDetailHospitalDropdownOpen(true);
    }
  };

  const handleSelectDetailHospital = (hospital: HospitalResponse) => {
    setDetailHospitalNameInput(hospital.hospitalName);
    setDetailSelectedHospitalId(hospital.hospitalId);
    setDetailHospitalDropdownOpen(false);
  };

  const handlePickCreateAvatar = async () => {
    if (uploadingCreateAvatar) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện ảnh để chọn avatar.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const uri = result.assets[0].uri;
      setCreateAvatarPreview(uri);
      setCreateError(null);
      setUploadingCreateAvatar(true);
      const uploaded = await uploadImageToCloudinary(uri, { folder: "user-avatars" });
      const finalUrl = uploaded.secureUrl || uploaded.url;
      if (!finalUrl) {
        throw new Error("Không lấy được URL ảnh sau khi upload");
      }
      setCreateAvatarUrl(finalUrl);
      setCreateFieldError(
        "avatarUrl",
        validateCreateField("avatarUrl", { avatarUrl: finalUrl }),
      );
    } catch (error: any) {
      setCreateAvatarPreview("");
      setCreateAvatarUrl("");
      setCreateFieldError("avatarUrl", null);
      setCreateError(error?.message || "Không thể upload ảnh đại diện");
    } finally {
      setUploadingCreateAvatar(false);
    }
  };

  const handleOpenCreateModal = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    resetCreateForm();
  };

  useEffect(() => {
    if (!showDetailModal || !selectedUser) return;
    const loadDetailData = async () => {
      setDetailLoading(true);
      setIsEditingDetail(false);
      setDetailEditError(null);
      setDetailCustomerData(null);
      setDetailDoctorData(null);
      setDetailStaffData(null);

      let email = selectedUser.email || "";
      let phone = selectedUser.phone || "";
      let name = selectedUser.name || "";
      let dob = selectedUser.dob || "";
      let gender: "male" | "female" = normalizeBinaryGender(selectedUser.gender);
      let address = selectedUser.address || "";
      let hospitalName = selectedUser.hospitalName || "";
      let hospitalId: number | null = null;

      try {
        if (selectedUser.role === "ROLE_CUSTOMER") {
          const response = await customerService.getByUserId(selectedUser.userId);
          if (response.success && response.data) {
            const data = response.data;
            setDetailCustomerData(data);
            email = data.customerEmail || email;
            phone = data.customerPhone || phone;
            name = data.customerName || name;
            dob = data.customerDob || dob;
            gender = normalizeBinaryGender(data.customerGender);
            address = data.customerAddress || address;
            hospitalName = data.hospitalName || hospitalName;
            hospitalId = data.hospitalId ? Number(data.hospitalId) : hospitalId;
          }
        } else if (selectedUser.role === "ROLE_DOCTOR") {
          const [doctorRes, staffRes] = await Promise.all([
            doctorService.getByUserId(selectedUser.userId),
            hospitalStaffService.getByUserId(selectedUser.userId),
          ]);
          if (doctorRes.success && doctorRes.data) {
            const data = doctorRes.data;
            setDetailDoctorData(data);
            email = data.doctorEmail || email;
            phone = data.doctorPhone || phone;
            name = data.doctorName || name;
            dob = data.doctorDob || dob;
            gender = normalizeBinaryGender(data.doctorGender);
            address = data.doctorAddress || address;
            hospitalName = data.hospitalName || hospitalName;
            hospitalId = data.hospitalId ? Number(data.hospitalId) : hospitalId;
          }
          if (staffRes.success && staffRes.data) {
            setDetailStaffData(staffRes.data);
          }
        } else {
          const staffRes = await hospitalStaffService.getByUserId(selectedUser.userId);
          if (staffRes.success && staffRes.data) {
            const data = staffRes.data;
            setDetailStaffData(data);
            email = data.staffEmail || email;
            phone = data.staffPhone || phone;
            name = data.staffName || name;
            dob = data.staffDob || dob;
            gender = normalizeBinaryGender(data.staffGender);
            address = data.staffAddress || address;
            hospitalName = data.hospitalName || hospitalName;
            hospitalId = data.hospitalId ? Number(data.hospitalId) : hospitalId;
          }
        }
      } catch (error) {
        // Keep list data as fallback if role-detail API fails.
      } finally {
        setDetailEditName(name);
        setDetailEditEmail(email);
        setDetailEditPhone(phone);
        setDetailEditDob(dob);
        setDetailEditGender(gender);
        setDetailEditAddress(address);
        setDetailHospitalNameInput(hospitalName);
        setDetailSelectedHospitalId(hospitalId);
        setDetailHospitalDropdownOpen(false);
        setDetailLoading(false);
      }
    };

    loadDetailData();
  }, [showDetailModal, selectedUser]);

  const resetDetailEditFields = () => {
    if (!selectedUser) return;

    const fallbackName = selectedUser.name || "";
    const fallbackEmail = selectedUser.email || "";
    const fallbackPhone = selectedUser.phone || "";
    const fallbackDob = selectedUser.dob || "";
    const fallbackGender = normalizeBinaryGender(selectedUser.gender);
    const fallbackAddress = selectedUser.address || "";
    const fallbackHospitalName = selectedUser.hospitalName || "";

    setDetailEditName(
      detailCustomerData?.customerName ||
        detailDoctorData?.doctorName ||
        detailStaffData?.staffName ||
        fallbackName,
    );
    setDetailEditEmail(
      detailCustomerData?.customerEmail ||
        detailDoctorData?.doctorEmail ||
        detailStaffData?.staffEmail ||
        fallbackEmail,
    );
    setDetailEditPhone(
      detailCustomerData?.customerPhone ||
        detailDoctorData?.doctorPhone ||
        detailStaffData?.staffPhone ||
        fallbackPhone,
    );
    setDetailEditDob(
      detailCustomerData?.customerDob ||
        detailDoctorData?.doctorDob ||
        detailStaffData?.staffDob ||
        fallbackDob,
    );
    setDetailEditGender(
      (detailCustomerData?.customerGender
        ? normalizeBinaryGender(detailCustomerData.customerGender)
        : undefined) ||
        (detailDoctorData?.doctorGender
          ? normalizeBinaryGender(detailDoctorData.doctorGender)
          : undefined) ||
        (detailStaffData?.staffGender
          ? normalizeBinaryGender(detailStaffData.staffGender)
          : undefined) ||
        fallbackGender,
    );
    setDetailEditAddress(
      detailCustomerData?.customerAddress ||
        detailDoctorData?.doctorAddress ||
        detailStaffData?.staffAddress ||
        fallbackAddress,
    );
    setDetailHospitalNameInput(
      detailCustomerData?.hospitalName ||
        detailDoctorData?.hospitalName ||
        detailStaffData?.hospitalName ||
        fallbackHospitalName,
    );
    setDetailSelectedHospitalId(
      detailCustomerData?.hospitalId
        ? Number(detailCustomerData.hospitalId)
        : detailDoctorData?.hospitalId
          ? Number(detailDoctorData.hospitalId)
          : detailStaffData?.hospitalId
            ? Number(detailStaffData.hospitalId)
            : null,
    );
    setDetailHospitalDropdownOpen(false);
  };

  // Fetch users
  const {
    data: usersData,
    isLoading,
    error,
    refetch,
    currentPage,
    totalPages,
    totalElements,
    pageSize,
    goToPage,
  } = usePaginatedQuery<UserResponse>({
    queryKey: ["users", filterRole, filterStatus],
    queryFn: async (params) => {
      const response = await userService.getAll(params);
      return response;
    },
    defaultPageSize: 20,
    enabled: user?.role === "ROLE_ADMIN",
  });

  // Extract users array from response
  const users = useMemo(() => {
    return usersData || [];
  }, [usersData]);

  // Block user mutation
  const blockMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      userService.block(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowBlockModal(false);
      setSelectedUser(null);
      setBlockReason("");
      Alert.alert("Thành công", "Đã khóa tài khoản người dùng");
    },
    onError: (error: any) => {
      Alert.alert("Lỗi", error.message || "Không thể khóa tài khoản");
    },
  });

  // Unblock user mutation
  const unblockMutation = useMutation({
    mutationFn: (userId: string) => {
      console.log("🔓 Attempting to unblock user:", userId);
      return userService.unblock(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowDetailModal(false);
      Alert.alert("Thành công", "Đã mở khóa tài khoản người dùng");
    },
    onError: (error: any) => {
      console.error("❌ Unblock error:", error);
      Alert.alert(
        "Lỗi",
        error.message || "Không thể mở khóa tài khoản. Vui lòng thử lại."
      );
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (payload: CreateUserRequest) => userService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      handleCloseCreateModal();
      Alert.alert(
        "Thành công",
        `Đã tạo người dùng mới. Mật khẩu mặc định: ${CREATE_USER_DEFAULT_PASSWORD}`,
      );
    },
    onError: (error: any) => {
      setCreateError(error?.message || "Không thể tạo người dùng");
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) {
        throw new Error("Không tìm thấy người dùng cần cập nhật.");
      }

      const normalizedEmail = detailEditEmail.trim().toLowerCase();
      const normalizedPhone = detailEditPhone.replace(/\D/g, "");
      const normalizedName = detailEditName.trim();
      const normalizedDob = detailEditDob.trim();
      const normalizedAddress = detailEditAddress.trim();
      const normalizedHospitalName = detailHospitalNameInput.trim();

      if (selectedUser.role === "ROLE_CUSTOMER" && detailCustomerData) {
        const customerPayload: CustomerRequest = {
          customerName: normalizedName,
          customerGender: detailEditGender,
          customerDob: normalizedDob || undefined,
          customerEmail: normalizedEmail,
          customerPhone: normalizedPhone,
          customerAddress: normalizedAddress || undefined,
          hospitalId: detailSelectedHospitalId ? String(detailSelectedHospitalId) : undefined,
          userId: selectedUser.userId,
        };
        const response = await customerService.update(
          detailCustomerData.customerId,
          customerPayload,
        );
        if (!response.success) {
          throw new Error(response.error || "Không thể cập nhật thông tin khách hàng.");
        }
      } else if (selectedUser.role === "ROLE_DOCTOR" && detailDoctorData) {
        const doctorPayload: DoctorRequest = {
          doctorName: normalizedName,
          doctorGender: detailEditGender,
          doctorDob: normalizedDob || undefined,
          doctorEmail: normalizedEmail,
          doctorPhone: normalizedPhone,
          doctorAddress: normalizedAddress || undefined,
          hospitalId: detailSelectedHospitalId
            ? String(detailSelectedHospitalId)
            : detailDoctorData.hospitalId || "1",
          doctorDegree: detailDoctorData.doctorDegree,
          doctorSpecialized: detailDoctorData.doctorSpecialized,
          userId: selectedUser.userId,
        };
        const response = await doctorService.update(detailDoctorData.doctorId, doctorPayload);
        if (!response.success) {
          throw new Error(response.error || "Không thể cập nhật thông tin bác sĩ.");
        }
      } else if (detailStaffData) {
        const staffPayload: HospitalStaffRequest = {
          staffName: normalizedName,
          staffGender: detailEditGender,
          staffDob: normalizedDob || undefined,
          staffEmail: normalizedEmail,
          staffPhone: normalizedPhone,
          staffAddress: normalizedAddress || undefined,
          hospitalId: detailSelectedHospitalId
            ? String(detailSelectedHospitalId)
            : detailStaffData.hospitalId || "1",
          staffPosition: detailStaffData.staffPosition || "staff",
          userId: selectedUser.userId,
        };
        const response = await hospitalStaffService.update(
          detailStaffData.staffId,
          staffPayload,
        );
        if (!response.success) {
          throw new Error(response.error || "Không thể cập nhật thông tin nhân viên.");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsEditingDetail(false);
      setDetailEditError(null);
      setSelectedUser((prev) =>
        prev
          ? {
              ...prev,
              name: detailEditName.trim() || prev.name,
              email: detailEditEmail.trim().toLowerCase(),
              phone: detailEditPhone.trim(),
              dob: detailEditDob.trim() || prev.dob,
              gender: detailEditGender,
              address: detailEditAddress.trim() || prev.address,
              hospitalName: detailHospitalNameInput.trim() || prev.hospitalName,
            }
          : prev,
      );
      Alert.alert("Thành công", "Đã cập nhật đầy đủ thông tin người dùng.");
    },
    onError: (error: any) => {
      setDetailEditError(
        error?.message || "Không thể cập nhật thông tin người dùng.",
      );
    },
  });

  // Filter users
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query) ||
          u.phone?.toLowerCase().includes(query) ||
          u.role?.toLowerCase().includes(query) ||
          u.hospitalName?.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (filterRole !== "all") {
      result = result.filter((u) => u.role === filterRole);
    }

    // Status filter
    if (filterStatus === "active") {
      result = result.filter((u) => u.isActive === true && u.enabled === true);
    } else if (filterStatus === "inactive") {
      result = result.filter((u) => u.isActive === false);
    } else if (filterStatus === "pending") {
      result = result.filter((u) => u.enabled === false);
    }

    return result;
  }, [users, searchQuery, filterRole, filterStatus]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterRole !== "all") count++;
    if (filterStatus !== "all") count++;
    return count;
  }, [filterRole, filterStatus]);

  const handleBlockUser = () => {
    if (!selectedUser) return;
    if (!blockReason.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập lý do khóa tài khoản");
      return;
    }
    if (blockReason.trim().length > MAX_BLOCK_REASON_LENGTH) {
      Alert.alert("Lỗi", "Lý do khóa không được vượt quá 500 ký tự.");
      return;
    }
    blockMutation.mutate({
      userId: selectedUser.userId,
      reason: blockReason.trim(),
    });
  };

  const handleUnblockUser = (userId: string) => {
    Alert.alert(
      "Xác nhận",
      "Bạn có chắc chắn muốn mở khóa tài khoản này?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Mở khóa",
          style: "destructive",
          onPress: () => unblockMutation.mutate(userId),
        },
      ]
    );
  };

  const handleClearFilters = () => {
    setFilterRole("all");
    setFilterStatus("all");
    setSearchQuery("");
  };

  const validateCreateUserForm = (): CreateFormErrors => {
    const fields: CreateFormField[] = [
      "name",
      "email",
      "phone",
      "dob",
      "gender",
      "role",
      "hospitalName",
      "avatarUrl",
    ];
    const nextErrors: CreateFormErrors = {};
    fields.forEach((field) => {
      const error = validateCreateField(field);
      if (error) {
        nextErrors[field] = error;
      }
    });
    return nextErrors;
  };

  const handleCreateUser = () => {
    if (createUserMutation.isPending) return;

    const nextErrors = validateCreateUserForm();
    setCreateFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setCreateError("Vui lòng nhập lại các trường đang báo lỗi.");
      return;
    }

    setCreateError(null);
    const normalizedPhone = createPhone.replace(/\D/g, "");
    const payload: CreateUserRequest = {
      name: createName.trim(),
      email: createEmail.trim().toLowerCase(),
      phone: normalizedPhone,
      dob: createDob.trim(),
      gender: createGender,
      role: createRole,
      hospitalName: hospitalNameInput.trim() || undefined,
      password: CREATE_USER_DEFAULT_PASSWORD,
      avatarUrl: createAvatarUrl || undefined,
    };
    createUserMutation.mutate(payload);
  };

  const validateDetailEditForm = (): string | null => {
    const name = detailEditName.trim();
    const email = detailEditEmail.trim().toLowerCase();
    const phone = detailEditPhone.replace(/\D/g, "");
    const dob = detailEditDob.trim();
    const hospitalName = detailHospitalNameInput.trim();

    if (!name) {
      return "Họ và tên không được để trống.";
    }
    if (name.length > MAX_NAME_LENGTH) {
      return "Họ và tên không được vượt quá 100 ký tự.";
    }
    const compactName = name.replace(/\s+/g, "");
    if (/^\d+$/.test(compactName)) {
      return "Họ và tên không được nhập toàn số.";
    }

    if (!email) {
      return "Email không được để trống.";
    }
    if (email.length > MAX_EMAIL_LENGTH) {
      return "Email không được vượt quá 255 ký tự.";
    }
    if (!GMAIL_REGEX.test(email)) {
      return "Email phải đúng định dạng Gmail (ví dụ: abc@gmail.com).";
    }

    if (!phone) {
      return "Số điện thoại không được để trống.";
    }
    if (!PHONE_10_DIGITS_REGEX.test(phone)) {
      return "Số điện thoại bắt buộc là số và đúng 10 chữ số.";
    }
    if (!PHONE_VN_REGEX.test(phone)) {
      return "Số điện thoại phải bắt đầu bằng số 0.";
    }

    if (dob) {
      if (!DOB_FORMAT_REGEX.test(dob)) {
        return "Ngày sinh phải đúng định dạng yyyy-MM-dd.";
      }
      const dobDate = new Date(`${dob}T00:00:00`);
      if (Number.isNaN(dobDate.getTime())) {
        return "Ngày sinh không hợp lệ.";
      }
      const [year, month, day] = dob.split("-").map(Number);
      const isExactDate =
        dobDate.getFullYear() === year &&
        dobDate.getMonth() + 1 === month &&
        dobDate.getDate() === day;
      if (!isExactDate) {
        return "Ngày sinh không hợp lệ.";
      }
      if (dobDate > new Date()) {
        return "Ngày sinh không được lớn hơn ngày hiện tại.";
      }
    }

    if (hospitalName.length > MAX_HOSPITAL_NAME_LENGTH) {
      return "Tên tổ chức không được vượt quá 255 ký tự.";
    }

    return null;
  };

  const handleSaveDetailEdit = () => {
    if (!selectedUser || updateUserMutation.isPending) return;

    const validationError = validateDetailEditForm();
    if (validationError) {
      setDetailEditError(validationError);
      return;
    }

    setDetailEditError(null);
    updateUserMutation.mutate();
  };

  // Available roles for filter
  const availableRoles = [
    { value: "all", label: "Tất cả" },
    { value: "ROLE_ADMIN", label: "Admin" },
    { value: "ROLE_STAFF", label: "Nhân viên" },
    { value: "ROLE_DOCTOR", label: "Bác sĩ" },
    { value: "ROLE_CUSTOMER", label: "Khách hàng" },
    { value: "ROLE_LAB_TECHNICIAN", label: "Kỹ thuật viên" },
    { value: "ROLE_SAMPLE_COLLECTOR", label: "Người thu mẫu" },
  ];

  if (authLoading || isLoading) {
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

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-sky-50 p-5">
        <Stack.Screen options={{ headerShown: false }} />
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
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-sky-50"
      edges={["top", "left", "right"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <Stack.Screen
        options={{
          title: "Quản lý người dùng",
          headerStyle: { backgroundColor: "#0891b2" },
          headerTintColor: "#fff",
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.push("/admin-home")} 
              className="ml-2"
              activeOpacity={0.7}
            >
              <Home size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Header với search và filter */}
      <View className="pb-3 px-4 bg-white border-b border-sky-100">
        <View className="flex-row items-center mb-3">
          <View className="flex-1">
            <Text className="text-slate-900 text-lg font-extrabold">
              Quản lý người dùng
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {filteredUsers.length} người dùng
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleOpenCreateModal}
            className="w-10 h-10 rounded-xl border items-center justify-center bg-emerald-50 border-emerald-200 mr-2"
            activeOpacity={0.85}
          >
            <Plus size={18} color="#059669" />
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
        </View>

        {/* Search bar */}
        <View className="flex-row items-center rounded-2xl px-3 bg-sky-50 border border-sky-100">
          <Search size={18} color="#64748B" />
          <TextInput
            className="flex-1 h-11 ml-2 text-[14px] text-slate-900 font-semibold"
            placeholder="Tìm theo tên, email, SĐT, vai trò..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
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

        {/* Filter panel */}
        {showFilters && (
          <View className="mt-3 pt-3 border-t border-sky-100">
            <Text className="text-xs font-bold text-slate-600 mb-2">Vai trò</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-3"
            >
              <View className="flex-row gap-2">
                {availableRoles.map((role) => (
                  <FilterPill
                    key={role.value}
                    label={role.label}
                    active={filterRole === role.value}
                    onPress={() => setFilterRole(role.value)}
                  />
                ))}
              </View>
            </ScrollView>

            <Text className="text-xs font-bold text-slate-600 mb-2">Trạng thái</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-3"
            >
              <View className="flex-row gap-2">
                <FilterPill
                  label="Tất cả"
                  active={filterStatus === "all"}
                  onPress={() => setFilterStatus("all")}
                />
                <FilterPill
                  label="Hoạt động"
                  active={filterStatus === "active"}
                  onPress={() => setFilterStatus("active")}
                />
                <FilterPill
                  label="Đã khóa"
                  active={filterStatus === "inactive"}
                  onPress={() => setFilterStatus("inactive")}
                />
                <FilterPill
                  label="Chờ kích hoạt"
                  active={filterStatus === "pending"}
                  onPress={() => setFilterStatus("pending")}
                />
              </View>
            </ScrollView>

            {activeFilterCount > 0 && (
              <TouchableOpacity
                className="py-2 rounded-xl bg-slate-100 items-center"
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
      </View>

      {/* User list */}
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
        {filteredUsers.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20 px-5">
            <User size={48} color="#94A3B8" />
            <Text className="mt-4 text-base font-bold text-slate-700 text-center">
              {searchQuery.trim() || filterRole !== "all" || filterStatus !== "all"
                ? "Không tìm thấy người dùng phù hợp"
                : "Chưa có người dùng nào"}
            </Text>
            <Text className="mt-2 text-xs text-slate-500 text-center">
              {searchQuery.trim() || filterRole !== "all" || filterStatus !== "all"
                ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"
                : "Danh sách người dùng sẽ hiển thị tại đây"}
            </Text>
          </View>
        ) : (
          <View className="p-4">
            {filteredUsers.map((userItem, index) => {
              const statusBadge = getStatusBadge(userItem);
              return (
                <View
                  key={userItem.userId}
                  className={`bg-white rounded-2xl p-4 mb-3 border border-sky-100 ${
                    index === 0 ? "" : ""
                  }`}
                >
                  {/* User header */}
                  <View className="flex-row items-start mb-3">
                    {userItem.avatarUrl ? (
                      <Image
                        source={{ uri: userItem.avatarUrl }}
                        className="w-12 h-12 rounded-xl"
                      />
                    ) : (
                      <View className="w-12 h-12 rounded-xl bg-sky-100 border border-sky-200 items-center justify-center">
                        <Text className="text-base font-bold text-sky-700">
                          {userItem.name?.charAt(0)?.toUpperCase() || "U"}
                        </Text>
                      </View>
                    )}

                    <View className="flex-1 ml-3">
                      <Text className="text-base font-extrabold text-slate-900">
                        {userItem.name || "N/A"}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Shield size={12} color="#64748B" />
                        <Text className="ml-1 text-xs text-slate-500">
                          {getRoleLabel(userItem.role)}
                        </Text>
                      </View>
                    </View>

                    <View
                      className={`px-2.5 py-1 rounded-lg border ${statusBadge.bg} ${statusBadge.bd}`}
                    >
                      <Text className={`text-[10px] font-bold ${statusBadge.fg}`}>
                        {statusBadge.label}
                      </Text>
                    </View>
                  </View>

                  {/* User info */}
                  <View className="mb-3 space-y-2">
                    <View className="flex-row items-center">
                      <Mail size={14} color="#64748B" />
                      <Text className="ml-2 text-xs text-slate-600 flex-1">
                        {userItem.email || "N/A"}
                      </Text>
                    </View>
                    {userItem.phone && (
                      <View className="flex-row items-center">
                        <Phone size={14} color="#64748B" />
                        <Text className="ml-2 text-xs text-slate-600">
                          {userItem.phone}
                        </Text>
                      </View>
                    )}
                    {userItem.hospitalName && (
                      <View className="flex-row items-center">
                        <Building2 size={14} color="#64748B" />
                        <Text className="ml-2 text-xs text-slate-600">
                          {userItem.hospitalName}
                        </Text>
                      </View>
                    )}
                    {userItem.blockReason && (
                      <View className="flex-row items-start">
                        <AlertCircle size={14} color="#EF4444" />
                        <Text className="ml-2 text-xs text-red-600 flex-1">
                          Lý do: {userItem.blockReason}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Actions */}
                  <View className="flex-row gap-2 pt-3 border-t border-sky-100">
                    <TouchableOpacity
                      className="flex-1 py-2.5 px-3 rounded-xl bg-sky-50 border border-sky-200 items-center"
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedUser(userItem);
                        setShowDetailModal(true);
                      }}
                    >
                      <Eye size={16} color="#0284C7" />
                      <Text className="mt-1 text-xs font-bold text-sky-700">
                        Chi tiết
                      </Text>
                    </TouchableOpacity>

                    {userItem.isActive ? (
                      <TouchableOpacity
                        className="flex-1 py-2.5 px-3 rounded-xl bg-red-50 border border-red-200 items-center"
                        onPress={() => {
                          setSelectedUser(userItem);
                          setShowBlockModal(true);
                        }}
                        activeOpacity={0.7}
                        disabled={
                          blockMutation.isPending || unblockMutation.isPending
                        }
                      >
                        <Lock size={16} color="#DC2626" />
                        <Text className="mt-1 text-xs font-bold text-red-700">
                          Khóa
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 items-center"
                        onPress={() => handleUnblockUser(userItem.userId)}
                        activeOpacity={0.7}
                        disabled={
                          blockMutation.isPending || unblockMutation.isPending
                        }
                      >
                        <LockOpen size={16} color="#16A34A" />
                        <Text className="mt-1 text-xs font-bold text-emerald-700">
                          Mở khóa
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
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

      {/* Create user modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={handleCloseCreateModal}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-extrabold text-slate-900">Thêm người dùng mới</Text>
              <TouchableOpacity onPress={handleCloseCreateModal} disabled={createUserMutation.isPending}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-slate-500 mb-4">
              Mật khẩu mặc định: {CREATE_USER_DEFAULT_PASSWORD}. Người dùng cần xác thực email và đổi mật khẩu khi đăng nhập lần đầu.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {createError && (
                <View className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200">
                  <Text className="text-xs text-red-700">{createError}</Text>
                </View>
              )}

              <View className="mb-3">
                <Text className="text-xs font-bold text-slate-700 mb-1.5">Họ và tên *</Text>
                <TextInput
                  value={createName}
                  onChangeText={(value) => {
                    const normalizedName = sanitizeCreateNameInput(value);
                    setCreateName(normalizedName);
                    if (createError) setCreateError(null);
                    setCreateFieldError(
                      "name",
                      validateCreateField("name", { name: normalizedName }),
                    );
                  }}
                  onBlur={() =>
                    setCreateFieldError("name", validateCreateField("name"))
                  }
                  placeholder="Nhập họ và tên"
                  className={`rounded-xl px-3 py-2.5 border text-sm text-slate-900 ${
                    createFieldErrors.name
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                />
                {createFieldErrors.name ? (
                  <Text className="mt-1 text-[11px] text-red-600">
                    {createFieldErrors.name}
                  </Text>
                ) : null}
              </View>

              <View className="mb-3">
                <Text className="text-xs font-bold text-slate-700 mb-1.5">Email *</Text>
                <TextInput
                  value={createEmail}
                  onChangeText={(value) => {
                    const normalizedEmail = sanitizeCreateEmailInput(value);
                    setCreateEmail(normalizedEmail);
                    if (createError) setCreateError(null);
                    setCreateFieldError(
                      "email",
                      validateCreateField("email", { email: normalizedEmail }),
                    );
                  }}
                  onBlur={() =>
                    setCreateFieldError("email", validateCreateField("email"))
                  }
                  autoCapitalize="none"
                  keyboardType="email-address"
                  maxLength={MAX_EMAIL_LENGTH}
                  placeholder="Nhập email Gmail (abc@gmail.com)"
                  className={`rounded-xl px-3 py-2.5 border text-sm text-slate-900 ${
                    createFieldErrors.email
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                />
                {createFieldErrors.email ? (
                  <Text className="mt-1 text-[11px] text-red-600">
                    {createFieldErrors.email}
                  </Text>
                ) : null}
              </View>

              <View className="mb-3">
                <Text className="text-xs font-bold text-slate-700 mb-1.5">Số điện thoại *</Text>
                <TextInput
                  value={createPhone}
                  onChangeText={(value) => {
                    const digitsOnly = value.replace(/\D/g, "");
                    const normalizedPhone = digitsOnly.slice(0, 10);
                    setCreatePhone(normalizedPhone);
                    if (createError) setCreateError(null);
                    setCreateFieldError(
                      "phone",
                      validateCreateField("phone", { phone: normalizedPhone }),
                    );
                  }}
                  onBlur={() =>
                    setCreateFieldError("phone", validateCreateField("phone"))
                  }
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="Nhập số điện thoại"
                  className={`rounded-xl px-3 py-2.5 border text-sm text-slate-900 ${
                    createFieldErrors.phone
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                />
                {createFieldErrors.phone ? (
                  <Text className="mt-1 text-[11px] text-red-600">
                    {createFieldErrors.phone}
                  </Text>
                ) : null}
              </View>

              <StandaloneDatePicker
                label="Ngày sinh"
                required
                value={createDob}
                onChange={(yyyyMmDd) => {
                  setCreateDob(yyyyMmDd);
                  if (createError) setCreateError(null);
                  setCreateFieldError("dob", validateCreateField("dob", { dob: yyyyMmDd }));
                }}
                error={createFieldErrors.dob}
                maximumDate={new Date()}
                helperText="Bấm để chọn ngày trên lịch (yyyy-MM-dd)"
              />

              <View className="mb-3">
                <Text className="text-xs font-bold text-slate-700 mb-1.5">Giới tính *</Text>
                <View className="flex-row gap-2">
                  {[
                    { value: "male", label: "Nam" },
                    { value: "female", label: "Nữ" },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.value}
                      onPress={() => {
                        setCreateGender(item.value as "male" | "female");
                        if (createError) setCreateError(null);
                        setCreateFieldError(
                          "gender",
                          validateCreateField("gender", {
                            gender: item.value as "male" | "female",
                          }),
                        );
                      }}
                      className={`px-3 py-2 rounded-xl border ${
                        createGender === item.value
                          ? "bg-sky-600 border-sky-600"
                          : "bg-white border-slate-200"
                      }`}
                      activeOpacity={0.8}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          createGender === item.value ? "text-white" : "text-slate-700"
                        }`}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {createFieldErrors.gender ? (
                  <Text className="mt-1 text-[11px] text-red-600">
                    {createFieldErrors.gender}
                  </Text>
                ) : null}
              </View>

              <View className="mb-3">
                <Text className="text-xs font-bold text-slate-700 mb-1.5">Tổ chức</Text>
                <TextInput
                  value={hospitalNameInput}
                  onChangeText={handleHospitalInputChange}
                  onFocus={() => setHospitalDropdownOpen(true)}
                  onBlur={() =>
                    setCreateFieldError("hospitalName", validateCreateField("hospitalName"))
                  }
                  maxLength={MAX_HOSPITAL_NAME_LENGTH}
                  placeholder={loadingHospitals ? "Đang tải danh sách..." : "Nhập hoặc chọn tổ chức"}
                  className={`rounded-xl px-3 py-2.5 border text-sm text-slate-900 ${
                    createFieldErrors.hospitalName
                      ? "bg-red-50 border-red-300"
                      : "bg-slate-50 border-slate-200"
                  }`}
                />
                {createFieldErrors.hospitalName ? (
                  <Text className="mt-1 text-[11px] text-red-600">
                    {createFieldErrors.hospitalName}
                  </Text>
                ) : null}
                {hospitalDropdownOpen && (
                  <View className="mt-2 rounded-xl border border-slate-200 max-h-40 bg-white">
                    <ScrollView nestedScrollEnabled>
                      {filteredHospitals.length === 0 ? (
                        <Text className="text-xs text-slate-500 p-3">Không tìm thấy tổ chức</Text>
                      ) : (
                        filteredHospitals.map((hospital) => (
                          <TouchableOpacity
                            key={hospital.hospitalId}
                            onPress={() => handleSelectHospital(hospital)}
                            className={`px-3 py-2 border-b border-slate-100 ${
                              selectedHospitalId === hospital.hospitalId ? "bg-sky-50" : "bg-white"
                            }`}
                          >
                            <Text className="text-sm text-slate-800">{hospital.hospitalName}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                )}
                {selectedHospitalId === CREATE_USER_HTGENETIC_ID && (
                  <Text className="text-[11px] text-blue-600 mt-1">
                    HTGENETIC: Có thể chọn vai trò nội bộ (Bác sĩ, KTV, Nhân viên, Admin)
                  </Text>
                )}
                {!hospitalNameInput.trim() && (
                  <Text className="text-[11px] text-slate-500 mt-1">
                    Để trống nếu không thuộc tổ chức nào
                  </Text>
                )}
              </View>

              <View className="mb-3">
                <Text className="text-xs font-bold text-slate-700 mb-1.5">Vai trò *</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(isHTGENETIC
                    ? [
                        { value: "ROLE_DOCTOR", label: "Bác sĩ" },
                        { value: "ROLE_LAB_TECHNICIAN", label: "Kỹ thuật viên" },
                        { value: "ROLE_STAFF", label: "Nhân viên" },
                        { value: "ROLE_ADMIN", label: "Admin" },
                      ]
                    : [{ value: "ROLE_CUSTOMER", label: "Khách hàng" }]
                  ).map((item) => (
                    <TouchableOpacity
                      key={item.value}
                      onPress={() => {
                        if (!isHTGENETIC) return;
                        const nextRole = item.value as typeof createRole;
                        setCreateRole(nextRole);
                        if (createError) setCreateError(null);
                        setCreateFieldError(
                          "role",
                          validateCreateField("role", { role: nextRole }),
                        );
                      }}
                      className={`px-3 py-2 rounded-xl border ${
                        createRole === item.value
                          ? "bg-sky-600 border-sky-600"
                          : "bg-white border-slate-200"
                      }`}
                      activeOpacity={0.8}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          createRole === item.value ? "text-white" : "text-slate-700"
                        }`}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {createFieldErrors.role ? (
                  <Text className="mt-1 text-[11px] text-red-600">
                    {createFieldErrors.role}
                  </Text>
                ) : null}
              </View>

              <View className="mb-2">
                <Text className="text-xs font-bold text-slate-700 mb-1.5">Ảnh đại diện</Text>
                <View className="flex-row items-center gap-3">
                  {createAvatarPreview ? (
                    <Image source={{ uri: createAvatarPreview }} className="w-14 h-14 rounded-xl" />
                  ) : (
                    <View className="w-14 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-50 items-center justify-center">
                      <Text className="text-[10px] text-slate-400">Chưa có</Text>
                    </View>
                  )}
                  <View className="flex-1 flex-row gap-2">
                    <TouchableOpacity
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 border border-slate-200 items-center"
                      onPress={handlePickCreateAvatar}
                      disabled={uploadingCreateAvatar || createUserMutation.isPending}
                      activeOpacity={0.8}
                    >
                      <Text className="text-xs font-bold text-slate-700">
                        {uploadingCreateAvatar ? "Đang upload..." : "Chọn ảnh"}
                      </Text>
                    </TouchableOpacity>
                    {createAvatarPreview ? (
                      <TouchableOpacity
                        className="py-2.5 px-3 rounded-xl bg-red-50 border border-red-200 items-center"
                        onPress={() => {
                          setCreateAvatarPreview("");
                          setCreateAvatarUrl("");
                          setCreateFieldError("avatarUrl", null);
                          if (createError) setCreateError(null);
                        }}
                        disabled={uploadingCreateAvatar || createUserMutation.isPending}
                        activeOpacity={0.8}
                      >
                        <Text className="text-xs font-bold text-red-700">Xóa</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                {createFieldErrors.avatarUrl ? (
                  <Text className="mt-1 text-[11px] text-red-600">
                    {createFieldErrors.avatarUrl}
                  </Text>
                ) : null}
              </View>
            </ScrollView>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl bg-slate-100 items-center"
                onPress={handleCloseCreateModal}
                activeOpacity={0.85}
                disabled={createUserMutation.isPending}
              >
                <Text className="text-sm font-extrabold text-slate-700">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl bg-sky-600 items-center"
                onPress={handleCreateUser}
                activeOpacity={0.85}
                disabled={createUserMutation.isPending || uploadingCreateAvatar}
              >
                {createUserMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-extrabold text-white">Tạo người dùng</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* User detail modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowDetailModal(false);
          setSelectedUser(null);
          setIsEditingDetail(false);
          setDetailHospitalDropdownOpen(false);
          setDetailEditError(null);
        }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-extrabold text-slate-900">Chi tiết người dùng</Text>
              <View className="flex-row items-center gap-2">
                {selectedUser && (
                  <TouchableOpacity
                    className={`px-3 py-1.5 rounded-lg border ${
                      isEditingDetail
                        ? "bg-slate-100 border-slate-200"
                        : "bg-sky-50 border-sky-200"
                    }`}
                    onPress={() => {
                      if (isEditingDetail) {
                        setIsEditingDetail(false);
                        setDetailEditError(null);
                        resetDetailEditFields();
                        return;
                      }
                      setIsEditingDetail(true);
                    }}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isEditingDetail ? "text-slate-700" : "text-sky-700"
                      }`}
                    >
                      {isEditingDetail ? "Hủy sửa" : "Chỉnh sửa"}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setShowDetailModal(false);
                    setSelectedUser(null);
                    setIsEditingDetail(false);
                    setDetailHospitalDropdownOpen(false);
                    setDetailEditError(null);
                  }}
                >
                  <X size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedUser && (
              detailLoading ? (
                <View className="py-12 items-center justify-center">
                  <ActivityIndicator size="large" color="#0284C7" />
                  <Text className="mt-3 text-sm text-slate-500 font-semibold">
                    Đang tải chi tiết người dùng...
                  </Text>
                </View>
              ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="gap-4">
                  {/* Avatar and Name */}
                  <View className="items-center mb-4">
                    {selectedUser.avatarUrl ? (
                      <Image
                        source={{ uri: selectedUser.avatarUrl }}
                        className="w-20 h-20 rounded-2xl border-2 border-sky-200"
                      />
                    ) : (
                      <View className="w-20 h-20 rounded-2xl bg-sky-100 border-2 border-sky-200 items-center justify-center">
                        <Text className="text-2xl font-bold text-sky-700">
                          {selectedUser.name?.charAt(0)?.toUpperCase() || "U"}
                        </Text>
                      </View>
                    )}
                    <Text className="text-xl font-extrabold text-slate-900 mt-3">
                      {detailEditName || selectedUser.name || "N/A"}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <Shield size={14} color="#64748B" />
                      <Text className="text-sm text-slate-500">
                        {getRoleLabel(selectedUser.role)}
                      </Text>
                    </View>
                    <View
                      className={`px-3 py-1.5 rounded-lg border mt-2 ${getStatusBadge(selectedUser).bg} ${getStatusBadge(selectedUser).bd}`}
                    >
                      <Text className={`text-xs font-bold ${getStatusBadge(selectedUser).fg}`}>
                        {getStatusBadge(selectedUser).label}
                      </Text>
                    </View>
                  </View>

                  {/* Basic Information */}
                  <View className="bg-sky-50 rounded-2xl p-4 border border-sky-200">
                    <Text className="text-sm font-extrabold text-slate-900 mb-3">Thông tin chung</Text>
                    <View className="gap-3">
                      <View>
                        <Text className="text-xs font-bold text-slate-500 mb-1">Họ và tên</Text>
                        {isEditingDetail ? (
                          <TextInput
                            value={detailEditName}
                            onChangeText={(value) => {
                              setDetailEditName(sanitizeCreateNameInput(value));
                              if (detailEditError) setDetailEditError(null);
                            }}
                            placeholder="Nhập họ và tên"
                            className="rounded-xl px-3 py-2 bg-white border border-sky-200 text-sm text-slate-900"
                          />
                        ) : (
                          <Text className="text-sm text-slate-700">
                            {detailEditName || "Chưa cập nhật"}
                          </Text>
                        )}
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-slate-500 mb-1">Email</Text>
                        {isEditingDetail ? (
                          <TextInput
                            value={detailEditEmail}
                            onChangeText={(value) => {
                              setDetailEditEmail(sanitizeCreateEmailInput(value));
                              if (detailEditError) setDetailEditError(null);
                            }}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            maxLength={MAX_EMAIL_LENGTH}
                            placeholder="Nhập email"
                            className="rounded-xl px-3 py-2 bg-white border border-sky-200 text-sm text-slate-900"
                          />
                        ) : (
                          <View className="flex-row items-center gap-2">
                            <Mail size={14} color="#64748B" />
                            <Text className="text-sm text-slate-700 flex-1">
                              {detailEditEmail || "N/A"}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-slate-500 mb-1">Số điện thoại</Text>
                        {isEditingDetail ? (
                          <TextInput
                            value={detailEditPhone}
                            onChangeText={(value) => {
                              const digitsOnly = value.replace(/\D/g, "");
                              setDetailEditPhone(digitsOnly.slice(0, 10));
                              if (detailEditError) setDetailEditError(null);
                            }}
                            keyboardType="phone-pad"
                            maxLength={10}
                            placeholder="Nhập số điện thoại"
                            className="rounded-xl px-3 py-2 bg-white border border-sky-200 text-sm text-slate-900"
                          />
                        ) : (
                          <View className="flex-row items-center gap-2">
                            <Phone size={14} color="#64748B" />
                            <Text className="text-sm text-slate-700">{detailEditPhone || "N/A"}</Text>
                          </View>
                        )}
                      </View>
                      <View>
                        {isEditingDetail ? (
                          <StandaloneDatePicker
                            label="Ngày sinh"
                            value={detailEditDob}
                            onChange={(yyyyMmDd) => {
                              setDetailEditDob(yyyyMmDd);
                              if (detailEditError) setDetailEditError(null);
                            }}
                            maximumDate={new Date()}
                            helperText="Bấm để chọn ngày trên lịch"
                          />
                        ) : (
                          <>
                            <Text className="text-xs font-bold text-slate-500 mb-1">Ngày sinh</Text>
                            <Text className="text-sm text-slate-700">
                              {detailEditDob || "Chưa cập nhật"}
                            </Text>
                          </>
                        )}
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-slate-500 mb-1">Giới tính</Text>
                        {isEditingDetail ? (
                          <View className="flex-row gap-2">
                            {[
                              { value: "male", label: "Nam" },
                              { value: "female", label: "Nữ" },
                            ].map((item) => (
                              <TouchableOpacity
                                key={item.value}
                                onPress={() => {
                                  setDetailEditGender(item.value as "male" | "female");
                                  if (detailEditError) setDetailEditError(null);
                                }}
                                className={`px-3 py-2 rounded-xl border ${
                                  detailEditGender === item.value
                                    ? "bg-sky-600 border-sky-600"
                                    : "bg-white border-slate-200"
                                }`}
                                activeOpacity={0.8}
                              >
                                <Text
                                  className={`text-xs font-bold ${
                                    detailEditGender === item.value ? "text-white" : "text-slate-700"
                                  }`}
                                >
                                  {item.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : (
                          <Text className="text-sm text-slate-700">
                            {getGenderLabel(detailEditGender)}
                          </Text>
                        )}
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-slate-500 mb-1">Địa chỉ</Text>
                        {isEditingDetail ? (
                          <TextInput
                            value={detailEditAddress}
                            onChangeText={(value) => {
                              setDetailEditAddress(sanitizeNoLeadingSpaceInput(value));
                              if (detailEditError) setDetailEditError(null);
                            }}
                            placeholder="Nhập địa chỉ"
                            className="rounded-xl px-3 py-2 bg-white border border-sky-200 text-sm text-slate-900"
                          />
                        ) : (
                          <Text className="text-sm text-slate-700">
                            {detailEditAddress || "Chưa cập nhật"}
                          </Text>
                        )}
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-slate-500 mb-1">Tổ chức / Bệnh viện</Text>
                        {isEditingDetail ? (
                          <View>
                            <TextInput
                              value={detailHospitalNameInput}
                              onChangeText={(value) =>
                                handleDetailHospitalInputChange(
                                  sanitizeNoLeadingSpaceInput(value),
                                )
                              }
                              onFocus={() => setDetailHospitalDropdownOpen(true)}
                              maxLength={MAX_HOSPITAL_NAME_LENGTH}
                              placeholder={loadingHospitals ? "Đang tải danh sách..." : "Nhập hoặc chọn tổ chức"}
                              className="rounded-xl px-3 py-2 bg-white border border-sky-200 text-sm text-slate-900"
                            />
                            {detailHospitalDropdownOpen && (
                              <View className="mt-2 rounded-xl border border-slate-200 max-h-36 bg-white">
                                <ScrollView nestedScrollEnabled>
                                  {filteredDetailHospitals.length === 0 ? (
                                    <Text className="text-xs text-slate-500 p-3">Không tìm thấy tổ chức</Text>
                                  ) : (
                                    filteredDetailHospitals.map((hospital) => (
                                      <TouchableOpacity
                                        key={hospital.hospitalId}
                                        onPress={() => handleSelectDetailHospital(hospital)}
                                        className={`px-3 py-2 border-b border-slate-100 ${
                                          detailSelectedHospitalId === hospital.hospitalId
                                            ? "bg-sky-50"
                                            : "bg-white"
                                        }`}
                                      >
                                        <Text className="text-sm text-slate-800">{hospital.hospitalName}</Text>
                                      </TouchableOpacity>
                                    ))
                                  )}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                        ) : (
                          <Text className="text-sm text-slate-700">
                            {detailHospitalNameInput || "Chưa cập nhật"}
                          </Text>
                        )}
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-slate-500 mb-1">Vai trò</Text>
                        <View className="flex-row items-center gap-2">
                          <Shield size={14} color="#64748B" />
                          <Text className="text-sm text-slate-700">
                            {getRoleLabel(selectedUser.role)}
                          </Text>
                        </View>
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-slate-500 mb-1">Mã người dùng</Text>
                        <Text className="text-sm font-bold text-slate-900">{selectedUser.userId}</Text>
                      </View>
                    </View>
                    {detailEditError && isEditingDetail && (
                      <View className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
                        <Text className="text-xs text-red-700">{detailEditError}</Text>
                      </View>
                    )}
                  </View>

                  {/* Status Information */}
                  <View className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <Text className="text-sm font-extrabold text-slate-900 mb-3">Trạng thái tài khoản</Text>
                    <View className="gap-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-slate-600">Kích hoạt:</Text>
                        <View
                          className={`px-2 py-1 rounded ${
                            selectedUser.enabled
                              ? "bg-emerald-50 border border-emerald-200"
                              : "bg-orange-50 border border-orange-200"
                          }`}
                        >
                          <Text
                            className={`text-[10px] font-bold ${
                              selectedUser.enabled ? "text-emerald-700" : "text-orange-700"
                            }`}
                          >
                            {selectedUser.enabled ? "Đã kích hoạt" : "Chưa kích hoạt"}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-slate-600">Hoạt động:</Text>
                        <View
                          className={`px-2 py-1 rounded ${
                            selectedUser.isActive
                              ? "bg-emerald-50 border border-emerald-200"
                              : "bg-red-50 border border-red-200"
                          }`}
                        >
                          <Text
                            className={`text-[10px] font-bold ${
                              selectedUser.isActive ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {selectedUser.isActive ? "Đang hoạt động" : "Đã khóa"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Block Reason */}
                  {selectedUser.blockReason && (
                    <View className="bg-red-50 rounded-2xl p-4 border border-red-200">
                      <Text className="text-sm font-extrabold text-slate-900 mb-2">Lý do khóa</Text>
                      <View className="flex-row items-start gap-2">
                        <AlertCircle size={16} color="#DC2626" />
                        <Text className="text-sm text-red-700 flex-1">
                          {selectedUser.blockReason}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Actions */}
                  <View className="flex-row gap-3 pt-2">
                    {isEditingDetail ? (
                      <TouchableOpacity
                        className="flex-1 py-3 rounded-xl bg-sky-600 items-center"
                        onPress={handleSaveDetailEdit}
                        activeOpacity={0.85}
                        disabled={updateUserMutation.isPending}
                      >
                        {updateUserMutation.isPending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text className="text-xs font-bold text-white">Lưu thay đổi</Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                    {selectedUser.isActive ? (
                      <TouchableOpacity
                        className="flex-1 py-3 rounded-xl bg-red-50 border border-red-200 items-center"
                        onPress={() => {
                          setShowDetailModal(false);
                          setSelectedUser(selectedUser);
                          setShowBlockModal(true);
                        }}
                        activeOpacity={0.85}
                        disabled={updateUserMutation.isPending}
                      >
                        <Lock size={18} color="#DC2626" />
                        <Text className="mt-1 text-xs font-bold text-red-700">Khóa tài khoản</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        className="flex-1 py-3 rounded-xl bg-emerald-50 border border-emerald-200 items-center"
                        onPress={() => {
                          setShowDetailModal(false);
                          handleUnblockUser(selectedUser.userId);
                        }}
                        activeOpacity={0.85}
                        disabled={unblockMutation.isPending || updateUserMutation.isPending}
                      >
                        {unblockMutation.isPending ? (
                          <ActivityIndicator size="small" color="#16A34A" />
                        ) : (
                          <>
                            <LockOpen size={18} color="#16A34A" />
                            <Text className="mt-1 text-xs font-bold text-emerald-700">Mở khóa</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </ScrollView>
              )
            )}
          </View>
        </View>
      </Modal>

      {/* Block user modal */}
      <Modal
        visible={showBlockModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowBlockModal(false);
          setSelectedUser(null);
          setBlockReason("");
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-3xl p-6 w-full max-w-[400px]">
            <Text className="text-lg font-extrabold text-slate-900 mb-2">
              Khóa tài khoản
            </Text>
            <Text className="text-sm text-slate-600 mb-4">
              Người dùng: {selectedUser?.name || selectedUser?.email}
            </Text>

            <Text className="text-xs font-bold text-slate-700 mb-2">
              Lý do khóa *
            </Text>
            <TextInput
              className="h-24 rounded-xl px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-900 font-semibold"
              placeholder="Nhập lý do khóa tài khoản..."
              placeholderTextColor="#94A3B8"
              value={blockReason}
              onChangeText={(value) =>
                setBlockReason(sanitizeNoLeadingSpaceInput(value).slice(0, MAX_BLOCK_REASON_LENGTH))
              }
              maxLength={MAX_BLOCK_REASON_LENGTH}
              multiline
              textAlignVertical="top"
            />

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-slate-100 items-center"
                onPress={() => {
                  setShowBlockModal(false);
                  setSelectedUser(null);
                  setBlockReason("");
                }}
                activeOpacity={0.85}
                disabled={blockMutation.isPending}
              >
                <Text className="text-slate-700 text-sm font-extrabold">
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl bg-red-600 items-center"
                onPress={handleBlockUser}
                activeOpacity={0.85}
                disabled={blockMutation.isPending || !blockReason.trim()}
              >
                {blockMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-sm font-extrabold">
                    Khóa
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
