import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Mail,
  Monitor,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  User as UserIcon,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/services/api";
import {
  deviceService,
  type ActiveSessionResponse,
  type TrustedDeviceResponse,
} from "@/services/deviceService";
import { uploadImageToCloudinary } from "@/utils/cloudinary";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUserProfile } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
  }>({});

  const [securityExpanded, setSecurityExpanded] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionResponse[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceResponse[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [isTrustingDevice, setIsTrustingDevice] = useState(false);
  const [loggingOutSessionId, setLoggingOutSessionId] = useState<string | null>(null);
  const [removingTrustedId, setRemovingTrustedId] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS === "android") {
      (UIManager as any).setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setDateOfBirth(user.dateOfBirth ?? "");
      setGender(user.gender ?? "");
    }
  }, [user]);

  if (!user) return null;

  const infoItems = useMemo(
    () => [
      { label: "Tên đăng nhập", value: user.email ?? "-", icon: Mail },
      { label: "Họ tên người dùng", value: user.name ?? "-", icon: BadgeCheck },
      { label: "Giới tính", value: user.gender ?? "-", icon: ShieldCheck },
      { label: "Bệnh viện", value: user.hospitalName ?? "-", icon: Building2 },
      { label: "Ngày sinh", value: user.dateOfBirth ?? "-", icon: Calendar },
    ],
    [user],
  );

  const onToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((v) => !v);
  };

  const loadDeviceSecurity = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const [sessionsRes, trustedRes] = await Promise.all([
        deviceService.getActiveSessions(),
        deviceService.getTrustedDevices(),
      ]);
      const nextTrusted =
        trustedRes.success && Array.isArray(trustedRes.data) ? trustedRes.data : [];
      setActiveSessions(
        sessionsRes.success && Array.isArray(sessionsRes.data) ? sessionsRes.data : [],
      );
      setTrustedDevices(nextTrusted);

      const stored = await apiClient.getTrustedDeviceToken();
      if (stored && !nextTrusted.some((d) => d.deviceToken === stored)) {
        await apiClient.setTrustedDeviceToken(null);
      }
    } catch (e) {
      console.error("loadDeviceSecurity", e);
    } finally {
      setSecurityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && securityExpanded) {
      loadDeviceSecurity();
    }
  }, [user, securityExpanded, loadDeviceSecurity]);

  const onToggleSecurity = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSecurityExpanded((v) => !v);
  };

  const formatSessionTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTrustedDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleTrustDevice = async (session: ActiveSessionResponse) => {
    if (isTrustingDevice) return;
    setIsTrustingDevice(true);
    try {
      const res = await deviceService.trustDevice({
        ipAddress: session.ipAddress,
        browser: session.browser,
        os: session.os,
        deviceType: session.deviceType,
        deviceName: session.deviceName,
        screen: session.screen,
      });
      if (res.success && res.data?.deviceToken) {
        await apiClient.setTrustedDeviceToken(res.data.deviceToken);
        Alert.alert("Thành công", "Đã thêm thiết bị vào danh sách tin cậy.");
        await loadDeviceSecurity();
      } else {
        Alert.alert("Thất bại", res.error || res.message || "Không thể tin cậy thiết bị.");
      }
    } finally {
      setIsTrustingDevice(false);
    }
  };

  const handleLogoutOtherSession = (session: ActiveSessionResponse) => {
    Alert.alert(
      "Đăng xuất thiết bị",
      `Đăng xuất phiên trên ${session.browser || "thiết bị"} — ${session.os || "không rõ"}? Phiên trên thiết bị đó sẽ kết thúc ngay.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đăng xuất",
          style: "destructive",
          onPress: async () => {
            setLoggingOutSessionId(session.sessionId);
            try {
              const res = await deviceService.logoutSession(session.sessionId);
              if (res.success) {
                Alert.alert("Thành công", "Đã đăng xuất phiên trên thiết bị đó.");
                await loadDeviceSecurity();
              } else {
                Alert.alert("Thất bại", res.error || res.message || "Không thể đăng xuất phiên.");
              }
            } finally {
              setLoggingOutSessionId(null);
            }
          },
        },
      ],
    );
  };

  const handleRemoveTrustedDevice = (device: TrustedDeviceResponse) => {
    Alert.alert(
      "Xoá thiết bị tin cậy",
      `Xoá ${device.browser || "thiết bị"} trên ${device.os || "không rõ"} khỏi danh sách tin cậy?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            setRemovingTrustedId(device.id);
            try {
              const res = await deviceService.removeTrustedDevice(device.id);
              if (res.success) {
                const tok = await apiClient.getTrustedDeviceToken();
                if (tok === device.deviceToken) {
                  await apiClient.setTrustedDeviceToken(null);
                }
                Alert.alert("Thành công", "Đã xoá thiết bị khỏi danh sách tin cậy.");
                await loadDeviceSecurity();
              } else {
                Alert.alert("Thất bại", res.error || res.message || "Không thể xoá thiết bị.");
              }
            } finally {
              setRemovingTrustedId(null);
            }
          },
        },
      ],
    );
  };

  const sessionDeviceIcon = (deviceType?: string) => {
    const t = deviceType?.toLowerCase();
    if (t === "mobile" || t === "tablet") {
      return <Smartphone size={18} color="#64748B" />;
    }
    return <Monitor size={18} color="#64748B" />;
  };

  const handleStartEdit = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFormErrors({});
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setDateOfBirth(user.dateOfBirth ?? "");
      setGender(user.gender ?? "");
    }
    setFormErrors({});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsEditing(false);
  };

  const parseDobInput = (raw: string): { ok: boolean; normalized?: string; error?: string } => {
    const value = raw.trim();
    if (!value || value === "Trống") return { ok: true };

    let day: number;
    let month: number;
    let year: number;

    const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const yyyymmdd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (ddmmyyyy) {
      day = Number(ddmmyyyy[1]);
      month = Number(ddmmyyyy[2]);
      year = Number(ddmmyyyy[3]);
    } else if (yyyymmdd) {
      day = Number(yyyymmdd[3]);
      month = Number(yyyymmdd[2]);
      year = Number(yyyymmdd[1]);
    } else {
      return { ok: false, error: "Ngày sinh phải theo định dạng dd/MM/yyyy." };
    }

    const date = new Date(year, month - 1, day);
    const isValidDate =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;

    if (!isValidDate) {
      return { ok: false, error: "Ngày sinh không hợp lệ." };
    }

    const now = new Date();
    if (date > now) {
      return { ok: false, error: "Ngày sinh không được lớn hơn ngày hiện tại." };
    }

    const minYear = now.getFullYear() - 120;
    if (year < minYear) {
      return { ok: false, error: "Ngày sinh không hợp lệ (quá xa hiện tại)." };
    }

    return {
      ok: true,
      normalized: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
    };
  };

  const validateForm = () => {
    const errors: { name?: string; phone?: string; dateOfBirth?: string; gender?: string } = {};

    const nameVal = name.trim();
    if (!nameVal) {
      errors.name = "Vui lòng nhập họ tên.";
    } else if (nameVal.length < 2) {
      errors.name = "Họ tên phải có ít nhất 2 ký tự.";
    }

    const phoneVal = phone.trim();
    if (phoneVal) {
      const phoneDigits = phoneVal.replace(/\s+/g, "");
      const vnPhoneRegex = /^(0\d{9,10}|\+84\d{9,10})$/;
      if (!vnPhoneRegex.test(phoneDigits)) {
        errors.phone = "Số điện thoại không hợp lệ (VD: 0901234567 hoặc +84901234567).";
      }
    }

    const dobResult = parseDobInput(dateOfBirth);
    if (!dobResult.ok) {
      errors.dateOfBirth = dobResult.error;
    }

    const genderVal = gender.trim();
    if (genderVal && genderVal !== "Trống") {
      const normalized = genderVal.toLowerCase();
      const isSupported =
        normalized === "nam" ||
        normalized === "male" ||
        normalized === "nữ" ||
        normalized === "nu" ||
        normalized === "female";
      if (!isSupported) {
        errors.gender = "Giới tính chỉ hỗ trợ Nam hoặc Nữ.";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!user || isSaving) return;
    if (!validateForm()) return;

    try {
      setIsSaving(true);
      const dobParsed = parseDobInput(dateOfBirth);
      const payload: any = {
        displayName: name.trim(),
      };

      const phoneVal = phone.trim();
      if (phoneVal) {
        payload.phone = phoneVal;
      }

      if (dobParsed.ok && dobParsed.normalized) {
        payload.dob = dobParsed.normalized;
      }

      const genderVal = gender.trim();
      if (genderVal && genderVal !== "Trống") {
        const normalized = genderVal.toLowerCase();
        let backendGender: string | undefined;

        // Backend enum: gender { male, female }
        if (normalized === "nam" || normalized === "male") {
          backendGender = "male";
        } else if (
          normalized === "nữ" ||
          normalized === "nu" ||
          normalized === "female"
        ) {
          backendGender = "female";
        }

        if (backendGender) {
          payload.gender = backendGender;
        }
      }

      const success = await updateUserProfile(payload);

      if (success) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsEditing(false);
        Alert.alert("Thành công", "Cập nhật hồ sơ thành công.");
      } else {
        Alert.alert(
          "Thất bại",
          "Không thể cập nhật hồ sơ. Vui lòng thử lại sau.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeAvatar = async () => {
    if (!user || isUploadingAvatar) return;



    if (Platform.OS === "web") {
      Alert.alert(
        "Thông báo",
        "Đổi ảnh đại diện hiện chỉ hỗ trợ trên mobile (iOS/Android). Vui lòng chạy trên thiết bị hoặc emulator.",
      );
      return;
    }

    try {
      setIsUploadingAvatar(true);

      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Quyền truy cập",
          "Ứng dụng cần quyền truy cập thư viện ảnh để chọn avatar.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || !result.assets[0]?.uri) {
        return;
      }

      const uri = result.assets[0].uri;

      // Upload lên Cloudinary
      const uploaded = await uploadImageToCloudinary(uri, {
        folder: "avatars",
      });

      if (!uploaded.secureUrl) {
        Alert.alert("Lỗi", "Không thể tải ảnh lên. Vui lòng thử lại.");
        return;
      }

      const success = await updateUserProfile({
        avatarUrl: uploaded.secureUrl,
      } as any);

      if (success) {
        Alert.alert("Thành công", "Cập nhật ảnh đại diện thành công.");
      } else {
        // Trường hợp backend chặn quyền (permission denied) hoặc lỗi nghiệp vụ
        Alert.alert(
          "Không có quyền",
          "Tài khoản của bạn hiện chưa được phép cập nhật ảnh đại diện. Vui lòng liên hệ quản trị hệ thống nếu cần hỗ trợ.",
        );
      }
    } catch (error) {
      console.error("Error changing avatar:", error);
      Alert.alert(
        "Lỗi",
        "Có lỗi xảy ra khi cập nhật ảnh đại diện. Vui lòng thử lại.",
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <View className="flex-1 bg-sky-50">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="pt-14 pb-3 px-4 bg-white border-b border-sky-100">
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
              Tài khoản
            </Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              Thông tin hồ sơ của bạn
            </Text>
          </View>

          <View className="px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-200">
            <Text className="text-xs font-extrabold text-sky-700">Profile</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      >
        <View className="bg-white rounded-2xl border border-sky-100 overflow-hidden">
          <View className="h-24 bg-sky-600" />

          <View className="px-4 pb-4 -mt-10">
            <View className="flex-row items-end justify-between">
              <View className="w-20 h-20 rounded-[40px] bg-white border border-sky-100 items-center justify-center">
                <View className="w-16 h-16 rounded-[32px] bg-sky-50 border border-sky-200 items-center justify-center overflow-hidden">
                  {user.avatarUrl ? (
                    <Image
                      source={{ uri: user.avatarUrl }}
                      className="w-16 h-16"
                      resizeMode="cover"
                    />
                  ) : (
                    <UserIcon size={34} color="#0284C7" />
                  )}
                </View>
                <TouchableOpacity
                  onPress={handleChangeAvatar}
                  activeOpacity={0.85}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-sky-600 border border-white items-center justify-center"
                >
                  {isUploadingAvatar ? (
                    <Text className="text-[9px] font-extrabold text-white">
                      ...
                    </Text>
                  ) : (
                    <Text className="text-[9px] font-extrabold text-white">
                      Sửa
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <View className="flex-row space-x-2">
                {isEditing ? (
                  <>
                    <TouchableOpacity
                      onPress={handleCancelEdit}
                      className="px-3 py-1.5 rounded-2xl bg-slate-100 border border-slate-200 flex-row items-center"
                      activeOpacity={0.85}
                    >
                      <X size={14} color="#0F172A" />
                      <Text className="ml-1 text-xs font-extrabold text-slate-800">
                        Hủy
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSave}
                      disabled={isSaving}
                      className={`px-3 py-1.5 rounded-2xl flex-row items-center border ${isSaving
                          ? "bg-sky-200 border-sky-200"
                          : "bg-sky-600 border-sky-600"
                        }`}
                      activeOpacity={0.85}
                    >
                      <Save size={14} color="#FFFFFF" />
                      <Text className="ml-1 text-xs font-extrabold text-white">
                        {isSaving ? "Đang lưu..." : "Lưu"}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={handleStartEdit}
                    className="px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-200 flex-row items-center"
                    activeOpacity={0.85}
                  >
                    <Text className="text-xs font-extrabold text-sky-700">
                      Chỉnh sửa
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Text
              className="mt-3 text-[16px] font-extrabold text-slate-900"
              numberOfLines={1}
            >
              {user.name ?? "-"}
            </Text>
            <View className="mt-2 flex-row items-center flex-wrap">
              <View className="flex-row items-center mr-3 mb-2">
                <Phone size={14} color="#64748B" />
                <Text className="ml-2 text-xs font-bold text-slate-600">
                  {user.phone ?? "-"}
                </Text>
              </View>

              <View className="flex-row items-center mb-2">
                <Mail size={14} color="#64748B" />
                <Text
                  className="ml-2 text-xs font-bold text-slate-600"
                  numberOfLines={1}
                >
                  {user.email ?? "-"}
                </Text>
              </View>
            </View>

            {!!user.hospitalName && (
              <View className="mt-2 bg-sky-50 border border-sky-200 rounded-2xl px-3 py-2 flex-row items-center">
                <Building2 size={16} color="#0284C7" />
                <Text
                  className="ml-2 text-xs font-extrabold text-sky-700"
                  numberOfLines={1}
                >
                  {user.hospitalName}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="mt-4 bg-white rounded-2xl border border-sky-100 overflow-hidden">
          <TouchableOpacity
            className="flex-row justify-between items-center p-4 border-b border-sky-100"
            onPress={onToggle}
            activeOpacity={0.85}
          >
            <View>
              <Text className="text-[15px] font-extrabold text-slate-900">
                Thông tin cơ bản
              </Text>
              <Text className="mt-0.5 text-xs font-bold text-slate-500">
                Chi tiết tài khoản của bạn
              </Text>
            </View>

            <View
              className={`w-9 h-9 rounded-xl items-center justify-center border ${isExpanded
                  ? "bg-sky-600 border-sky-600"
                  : "bg-sky-50 border-sky-200"
                }`}
            >
              {isExpanded ? (
                <ChevronUp
                  size={18}
                  color={isExpanded ? "#FFFFFF" : "#0284C7"}
                />
              ) : (
                <ChevronDown
                  size={18}
                  color={isExpanded ? "#FFFFFF" : "#0284C7"}
                />
              )}
            </View>
          </TouchableOpacity>

          {isExpanded && (
            <View className="p-4">
              {isEditing ? (
                <>
                  <View className="mb-3">
                    <Text className="text-[11px] font-extrabold text-slate-500 mb-1.5">
                      Họ tên người dùng
                    </Text>
                    <TextInput
                      value={name}
                      onChangeText={(v) => {
                        setName(v);
                        if (formErrors.name) {
                          setFormErrors((prev) => ({ ...prev, name: undefined }));
                        }
                      }}
                      placeholder="Nhập họ tên"
                      className={`rounded-2xl border px-3 py-2.5 text-[13px] text-slate-900 bg-white ${formErrors.name ? "border-red-300" : "border-sky-200"
                        }`}
                    />
                    {!!formErrors.name && (
                      <Text className="mt-1 text-[11px] font-bold text-red-500">
                        {formErrors.name}
                      </Text>
                    )}
                  </View>
                  <View className="mb-3">
                    <Text className="text-[11px] font-extrabold text-slate-500 mb-1.5">
                      Số điện thoại
                    </Text>
                    <TextInput
                      value={phone}
                      onChangeText={(v) => {
                        setPhone(v);
                        if (formErrors.phone) {
                          setFormErrors((prev) => ({ ...prev, phone: undefined }));
                        }
                      }}
                      placeholder="Nhập số điện thoại"
                      keyboardType="phone-pad"
                      className={`rounded-2xl border px-3 py-2.5 text-[13px] text-slate-900 bg-white ${formErrors.phone ? "border-red-300" : "border-sky-200"
                        }`}
                    />
                    {!!formErrors.phone && (
                      <Text className="mt-1 text-[11px] font-bold text-red-500">
                        {formErrors.phone}
                      </Text>
                    )}
                  </View>
                  <View className="mb-3">
                    <Text className="text-[11px] font-extrabold text-slate-500 mb-1.5">
                      Ngày sinh
                    </Text>
                    <TextInput
                      value={dateOfBirth}
                      onChangeText={(v) => {
                        setDateOfBirth(v);
                        if (formErrors.dateOfBirth) {
                          setFormErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
                        }
                      }}
                      placeholder="dd/MM/yyyy"
                      className={`rounded-2xl border px-3 py-2.5 text-[13px] text-slate-900 bg-white ${formErrors.dateOfBirth ? "border-red-300" : "border-sky-200"
                        }`}
                    />
                    {!!formErrors.dateOfBirth && (
                      <Text className="mt-1 text-[11px] font-bold text-red-500">
                        {formErrors.dateOfBirth}
                      </Text>
                    )}
                  </View>
                  <View className="mb-1">
                    <Text className="text-[11px] font-extrabold text-slate-500 mb-1.5">
                      Giới tính
                    </Text>
                    <TextInput
                      value={gender}
                      onChangeText={(v) => {
                        setGender(v);
                        if (formErrors.gender) {
                          setFormErrors((prev) => ({ ...prev, gender: undefined }));
                        }
                      }}
                      placeholder="Nam / Nữ / Khác"
                      className={`rounded-2xl border px-3 py-2.5 text-[13px] text-slate-900 bg-white ${formErrors.gender ? "border-red-300" : "border-sky-200"
                        }`}
                    />
                    {!!formErrors.gender && (
                      <Text className="mt-1 text-[11px] font-bold text-red-500">
                        {formErrors.gender}
                      </Text>
                    )}
                  </View>
                </>
              ) : (
                infoItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <View
                      key={`${item.label}-${index}`}
                      className={`flex-row items-start rounded-2xl border border-sky-100 p-3.5 ${index !== infoItems.length - 1 ? "mb-3" : ""
                        }`}
                    >
                      <View className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center">
                        <Icon size={18} color="#0284C7" />
                      </View>

                      <View className="ml-3 flex-1">
                        <Text className="text-[11px] font-extrabold text-slate-500">
                          {item.label}
                        </Text>
                        <Text
                          className="mt-1 text-[13px] font-extrabold text-slate-900"
                          numberOfLines={2}
                        >
                          {String(item.value ?? "-")}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>

        <View className="mt-4 bg-white rounded-2xl border border-sky-100 overflow-hidden">
          <TouchableOpacity
            className="flex-row justify-between items-center p-4 border-b border-sky-100"
            onPress={onToggleSecurity}
            activeOpacity={0.85}
          >
            <View className="flex-1 pr-2">
              <Text className="text-[15px] font-extrabold text-slate-900">
                Phiên đăng nhập & thiết bị tin cậy
              </Text>
              <Text className="mt-0.5 text-xs font-bold text-slate-500">
                Giống trên web: xem phiên hoạt động, tin cậy thiết bị này, đăng xuất phiên khác
              </Text>
            </View>

            <View
              className={`w-9 h-9 rounded-xl items-center justify-center border ${securityExpanded
                  ? "bg-sky-600 border-sky-600"
                  : "bg-sky-50 border-sky-200"
                }`}
            >
              {securityExpanded ? (
                <ChevronUp size={18} color="#FFFFFF" />
              ) : (
                <ChevronDown size={18} color="#0284C7" />
              )}
            </View>
          </TouchableOpacity>

          {securityExpanded && (
            <View className="p-4 pt-2">
              <View className="flex-row justify-end mb-3">
                <TouchableOpacity
                  onPress={loadDeviceSecurity}
                  disabled={securityLoading}
                  className="flex-row items-center px-3 py-2 rounded-2xl bg-sky-50 border border-sky-200"
                  activeOpacity={0.85}
                >
                  {securityLoading ? (
                    <ActivityIndicator size="small" color="#0284C7" />
                  ) : (
                    <RefreshCw size={14} color="#0284C7" />
                  )}
                  <Text className="ml-2 text-xs font-extrabold text-sky-700">Làm mới</Text>
                </TouchableOpacity>
              </View>

              {securityLoading && activeSessions.length === 0 && trustedDevices.length === 0 ? (
                <View className="py-10 items-center justify-center">
                  <ActivityIndicator size="large" color="#0284C7" />
                  <Text className="mt-3 text-xs font-bold text-slate-500">
                    Đang tải thông tin thiết bị...
                  </Text>
                </View>
              ) : (
                <>
                  <Text className="text-[13px] font-extrabold text-slate-900 mb-2">
                    Phiên đăng nhập đang hoạt động
                  </Text>
                  {activeSessions.length === 0 ? (
                    <Text className="text-xs font-bold text-slate-500 text-center py-4">
                      Không có phiên đăng nhập nào
                    </Text>
                  ) : (
                    <View className="mb-5">
                      {activeSessions.map((session) => (
                        <View
                          key={session.sessionId}
                          className={`rounded-2xl border p-3.5 mb-3 ${session.currentSession
                              ? "border-sky-300 bg-sky-50"
                              : "border-sky-100 bg-white"
                            }`}
                        >
                          <View className="flex-row items-start">
                            <View className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 items-center justify-center mt-0.5">
                              {sessionDeviceIcon(session.deviceType)}
                            </View>
                            <View className="ml-3 flex-1 min-w-0">
                              <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
                                <Text
                                  className="text-[13px] font-extrabold text-slate-900"
                                  numberOfLines={2}
                                >
                                  {session.browser || "Trình duyệt không xác định"}
                                </Text>
                                <Text className="text-[11px] font-bold text-slate-500">trên</Text>
                                <Text className="text-[13px] font-extrabold text-slate-800">
                                  {session.os || "Hệ điều hành không xác định"}
                                </Text>
                                {session.currentSession && (
                                  <View className="px-2 py-0.5 rounded-lg bg-sky-600">
                                    <Text className="text-[10px] font-extrabold text-white">
                                      Thiết bị này
                                    </Text>
                                  </View>
                                )}
                                {session.trusted && (
                                  <View className="px-2 py-0.5 rounded-lg bg-emerald-100 border border-emerald-200">
                                    <Text className="text-[10px] font-extrabold text-emerald-800">
                                      Tin cậy
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <View className="mt-1 flex-row flex-wrap gap-x-3">
                                {!!session.ipAddress && (
                                  <Text className="text-[11px] font-bold text-slate-500">
                                    IP: {session.ipAddress}
                                  </Text>
                                )}
                                {!!session.deviceName && (
                                  <Text className="text-[11px] font-bold text-slate-500">
                                    Thiết bị: {session.deviceName}
                                  </Text>
                                )}
                                {!!session.screen && (
                                  <Text className="text-[11px] font-bold text-slate-500">
                                    Màn hình: {session.screen}
                                  </Text>
                                )}
                              </View>
                              <Text className="mt-1 text-[11px] font-bold text-slate-400">
                                Đăng nhập: {formatSessionTimestamp(session.createdAt)}
                              </Text>
                            </View>
                          </View>

                          <View className="mt-3 flex-row flex-wrap gap-2 justify-end">
                            {session.currentSession && !session.trusted && (
                              <TouchableOpacity
                                onPress={() => handleTrustDevice(session)}
                                disabled={isTrustingDevice}
                                className={`px-3 py-2 rounded-2xl border ${isTrustingDevice
                                    ? "bg-slate-100 border-slate-200"
                                    : "bg-white border-sky-200"
                                  }`}
                                activeOpacity={0.85}
                              >
                                <Text className="text-xs font-extrabold text-sky-700">
                                  {isTrustingDevice ? "Đang xử lý..." : "Tin cậy"}
                                </Text>
                              </TouchableOpacity>
                            )}
                            {!session.currentSession && (
                              <TouchableOpacity
                                onPress={() => handleLogoutOtherSession(session)}
                                disabled={loggingOutSessionId === session.sessionId}
                                className={`px-3 py-2 rounded-2xl border ${loggingOutSessionId === session.sessionId
                                    ? "bg-slate-100 border-slate-200"
                                    : "bg-red-50 border-red-200"
                                  }`}
                                activeOpacity={0.85}
                              >
                                <Text className="text-xs font-extrabold text-red-700">
                                  {loggingOutSessionId === session.sessionId
                                    ? "Đang đăng xuất..."
                                    : "Đăng xuất"}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text className="text-[13px] font-extrabold text-slate-900 mb-2">
                    Thiết bị tin cậy
                  </Text>
                  {trustedDevices.length === 0 ? (
                    <Text className="text-xs font-bold text-slate-500 text-center py-3">
                      Chưa có thiết bị tin cậy
                    </Text>
                  ) : (
                    <View>
                      {trustedDevices.map((device) => (
                        <View
                          key={device.id}
                          className="flex-row items-start rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 mb-3"
                        >
                          <View className="w-10 h-10 rounded-xl bg-white border border-emerald-200 items-center justify-center">
                            {sessionDeviceIcon(device.deviceType)}
                          </View>
                          <View className="ml-3 flex-1 min-w-0">
                            <View className="flex-row flex-wrap items-center gap-x-2">
                              <Text
                                className="text-[13px] font-extrabold text-slate-900"
                                numberOfLines={2}
                              >
                                {device.browser || "Thiết bị"}
                              </Text>
                              <Text className="text-[11px] font-bold text-slate-500">trên</Text>
                              <Text className="text-[13px] font-extrabold text-slate-800">
                                {device.os || "—"}
                              </Text>
                            </View>
                            <View className="mt-1 flex-row flex-wrap gap-x-3">
                              {!!device.ipAddress && (
                                <Text className="text-[11px] font-bold text-slate-500">
                                  IP: {device.ipAddress}
                                </Text>
                              )}
                              {!!device.deviceName && (
                                <Text className="text-[11px] font-bold text-slate-500">
                                  Thiết bị: {device.deviceName}
                                </Text>
                              )}
                            </View>
                            <Text className="mt-1 text-[11px] font-bold text-slate-400">
                              Sử dụng lần cuối: {formatTrustedDate(device.lastUsed)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveTrustedDevice(device)}
                            disabled={removingTrustedId === device.id}
                            className="px-2 py-1"
                            activeOpacity={0.85}
                          >
                            <Text className="text-xs font-extrabold text-red-600">
                              {removingTrustedId === device.id ? "..." : "Xoá"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
