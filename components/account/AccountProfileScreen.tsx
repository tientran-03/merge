import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Calendar,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Image,
  LayoutAnimation,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeviceSecuritySection } from '@/components/account/DeviceSecuritySection';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { useAuth } from '@/contexts/AuthContext';
import { presentCenteredSuccess, presentFeedbackError } from '@/lib/centeredSuccessModal';
import { GENDER_OPTIONS, ProfileFormData, profileSchema } from '@/lib/schemas/profile-schema';
import { userService } from '@/services/userService';
import { uploadImageToCloudinary } from '@/utils/cloudinary';

export type AccountProfileScreenProps = {
  changePasswordPath: string;
};

function getRoleLabel(role?: string) {
  const roleLabels: Record<string, string> = {
    ROLE_ADMIN: 'Quản trị viên',
    ROLE_STAFF: 'Nhân viên',
    ROLE_LAB_TECHNICIAN: 'Kỹ thuật viên phòng thí nghiệm',
    ROLE_SAMPLE_COLLECTOR: 'Nhân viên lấy mẫu',
    ROLE_DOCTOR: 'Bác sĩ',
    ROLE_CUSTOMER: 'Khách hàng',
  };
  return roleLabels[role || ''] || role || 'Không xác định';
}

export function AccountProfileScreen({ changePasswordPath }: AccountProfileScreenProps) {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();

  const handleLoggedRemotely = async () => {
    await logout();
  };
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: '',
      phone: '',
      address: '',
      dob: '',
      gender: undefined,
    },
  });

  useEffect(() => {
    if (Platform.OS === 'android') {
      (UIManager as any).setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    if (user) {
      let genderValue: 'male' | 'female' | undefined = undefined;
      if (user.gender && user.gender !== 'Trống') {
        if (user.gender === 'Nam' || user.gender.toLowerCase() === 'male') {
          genderValue = 'male';
        } else if (user.gender === 'Nữ' || user.gender.toLowerCase() === 'female') {
          genderValue = 'female';
        }
      }

      form.reset({
        displayName: user.name || '',
        phone: user.phone || '',
        address: user.address?.trim() ? user.address : '',
        dob: user.dateOfBirth && user.dateOfBirth !== 'Trống' ? user.dateOfBirth : '',
        gender: genderValue,
      });
    }
  }, [user, form]);

  const infoItems = useMemo(() => {
    if (!user) {
      return [];
    }
    return [
      { label: 'Tên đăng nhập', value: user.email ?? '-', icon: Mail },
      { label: 'Họ tên người dùng', value: user.name ?? '-', icon: BadgeCheck },
      { label: 'Vai trò', value: getRoleLabel(user.role), icon: ShieldCheck },
      { label: 'Giới tính', value: user.gender ?? '-', icon: ShieldCheck },
      { label: 'Bệnh viện', value: user.hospitalName ?? '-', icon: Building2 },
      {
        label: 'Địa chỉ',
        value: user.address?.trim() ? user.address : 'Chưa cập nhật',
        icon: MapPin,
      },
      { label: 'Ngày sinh', value: user.dateOfBirth ?? '-', icon: Calendar },
    ];
  }, [user]);

  if (!user) return null;

  const handleAvatarClick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        presentFeedbackError({
          title: 'Quyền truy cập',
          message: 'Ứng dụng cần quyền truy cập thư viện ảnh để chọn hình ảnh.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        setIsUploadingAvatar(true);

        try {
          const uploadResult = await uploadImageToCloudinary(uri, { folder: 'avatar' });

          if (uploadResult.secureUrl && user?.id) {
            const response = await userService.updateProfile({
              userId: user.id,
              avatarUrl: uploadResult.secureUrl,
            });

            if (response.success && response.data) {
              updateUser({
                avatarUrl: response.data.avatarUrl || uploadResult.secureUrl,
              });
              presentCenteredSuccess({
                title: 'Đã cập nhật',
                message: 'Ảnh đại diện đã được lưu thành công.',
              });
            } else {
              presentFeedbackError({
                title: 'Lỗi',
                message: response.error || response.message || 'Không thể cập nhật ảnh đại diện',
              });
            }
          }
        } catch (error: any) {
          console.error('Error uploading avatar:', error);
          presentFeedbackError({
            title: 'Lỗi',
            message: error?.message || 'Không thể tải ảnh lên',
          });
        } finally {
          setIsUploadingAvatar(false);
        }
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      presentFeedbackError({
        title: 'Lỗi',
        message: 'Không thể chọn hình ảnh. Vui lòng thử lại.',
      });
      setIsUploadingAvatar(false);
    }
  };

  const onToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(v => !v);
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user?.id) {
      presentFeedbackError({ title: 'Lỗi', message: 'Không tìm thấy thông tin người dùng' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await userService.updateProfile({
        userId: user.id,
        displayName: data.displayName,
        phone: data.phone || undefined,
        address: data.address,
        dob: data.dob || undefined,
        gender: data.gender as 'male' | 'female' | undefined,
      });

      if (response.success && response.data) {
        const updatedUser = response.data;
        const g = updatedUser.gender?.toLowerCase();
        let genderDisplay = user.gender;
        if (g === 'male') {
          genderDisplay = 'Nam';
        } else if (g === 'female') {
          genderDisplay = 'Nữ';
        }

        const nextName = updatedUser.displayName ?? updatedUser.name ?? user.name;
        const nextDob =
          updatedUser.dob != null && String(updatedUser.dob).trim() !== ''
            ? String(updatedUser.dob)
            : user.dateOfBirth;

        updateUser({
          name: nextName,
          phone: updatedUser.phone ?? user.phone,
          dateOfBirth: nextDob,
          gender: genderDisplay,
          address: updatedUser.address ?? '',
        });
        presentCenteredSuccess({
          title: 'Cập nhật thành công',
          message: 'Thông tin tài khoản đã được lưu.',
        });
        setIsEditing(false);
      } else {
        presentFeedbackError({
          title: 'Lỗi',
          message: response.error || response.message || 'Không thể cập nhật thông tin',
        });
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      presentFeedbackError({
        title: 'Lỗi',
        message: error?.message || 'Có lỗi xảy ra khi cập nhật thông tin',
      });
    } finally {
      setIsLoading(false);
    }
  };

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
            <Text className="text-slate-900 text-lg font-extrabold">Tài khoản</Text>
            <Text className="mt-0.5 text-xs text-slate-500">Thông tin hồ sơ của bạn</Text>
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
              <TouchableOpacity
                onPress={handleAvatarClick}
                disabled={isUploadingAvatar}
                className="relative"
                activeOpacity={0.8}
              >
                <View className="w-20 h-20 rounded-[40px] bg-white border border-sky-100 items-center justify-center overflow-hidden">
                  {user.avatarUrl ? (
                    <Image
                      source={{ uri: user.avatarUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-16 h-16 rounded-[32px] bg-sky-50 border border-sky-200 items-center justify-center">
                      <UserIcon size={34} color="#0284C7" />
                    </View>
                  )}
                </View>
                <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-sky-600 border-2 border-white items-center justify-center">
                  {isUploadingAvatar ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Camera size={14} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            <Text className="mt-3 text-[16px] font-extrabold text-slate-900" numberOfLines={1}>
              {user.name ?? '-'}
            </Text>
            <View className="mt-2 flex-row items-center flex-wrap">
              <View className="flex-row items-center mr-3 mb-2">
                <Phone size={14} color="#64748B" />
                <Text className="ml-2 text-xs font-bold text-slate-600">{user.phone ?? '-'}</Text>
              </View>

              <View className="flex-row items-center mb-2">
                <Mail size={14} color="#64748B" />
                <Text className="ml-2 text-xs font-bold text-slate-600" numberOfLines={1}>
                  {user.email ?? '-'}
                </Text>
              </View>
            </View>

            {user.role && (
              <View className="mt-2 bg-sky-50 border border-sky-200 rounded-2xl px-3 py-2 flex-row items-center">
                <ShieldCheck size={16} color="#0284C7" />
                <Text className="ml-2 text-xs font-extrabold text-sky-700" numberOfLines={1}>
                  {getRoleLabel(user.role)}
                </Text>
              </View>
            )}

            {!!user.hospitalName && (
              <View className="mt-2 bg-sky-50 border border-sky-200 rounded-2xl px-3 py-2 flex-row items-center">
                <Building2 size={16} color="#0284C7" />
                <Text className="ml-2 text-xs font-extrabold text-sky-700" numberOfLines={1}>
                  {user.hospitalName}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="mt-4 bg-white rounded-2xl border border-sky-100 overflow-hidden">
          <View className="flex-row justify-between items-center p-4 border-b border-sky-100">
            <TouchableOpacity
              className="flex-1 flex-row justify-between items-center"
              onPress={onToggle}
              activeOpacity={0.85}
            >
              <View>
                <Text className="text-[15px] font-extrabold text-slate-900">
                  {isEditing ? 'Chỉnh sửa thông tin' : 'Thông tin cơ bản'}
                </Text>
                <Text className="mt-0.5 text-xs font-bold text-slate-500">
                  {isEditing ? 'Cập nhật thông tin của bạn' : 'Chi tiết tài khoản của bạn'}
                </Text>
              </View>

              <View
                className={`w-9 h-9 rounded-xl items-center justify-center border ${isExpanded ? 'bg-sky-600 border-sky-600' : 'bg-sky-50 border-sky-200'
                  }`}
              >
                {isExpanded ? (
                  <ChevronUp size={18} color={isExpanded ? '#FFFFFF' : '#0284C7'} />
                ) : (
                  <ChevronDown size={18} color={isExpanded ? '#FFFFFF' : '#0284C7'} />
                )}
              </View>
            </TouchableOpacity>

            {!isEditing && (
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                className="ml-3 px-3 py-2 rounded-xl bg-sky-600 flex-row items-center"
                activeOpacity={0.8}
              >
                <Edit size={16} color="#fff" />
                <Text className="ml-1 text-white text-xs font-extrabold">Sửa</Text>
              </TouchableOpacity>
            )}
          </View>

          {isExpanded && (
            <View className="p-4">
              {isEditing ? (
                <FormProvider {...form}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <FormInput
                      name="displayName"
                      label="Tên hiển thị"
                      placeholder="Nhập tên hiển thị"
                      required
                    />

                    <FormInput
                      name="phone"
                      label="Số điện thoại"
                      placeholder="Nhập số điện thoại"
                      keyboardType="phone-pad"
                    />

                    <FormInput
                      name="dob"
                      label="Ngày sinh (dd/MM/yyyy)"
                      placeholder="VD: 01/01/1990"
                    />

                    <FormSelect
                      name="gender"
                      label="Giới tính"
                      options={GENDER_OPTIONS}
                      getLabel={opt => opt.label}
                      getValue={opt => opt.value}
                      placeholder="Chọn giới tính"
                    />

                    <FormInput
                      name="address"
                      label="Địa chỉ"
                      placeholder="Nhập địa chỉ"
                      multiline
                      numberOfLines={3}
                    />

                    <View className="flex-row gap-3 mt-4">
                      <TouchableOpacity
                        onPress={() => {
                          setIsEditing(false);
                          let genderValue: 'male' | 'female' | undefined = undefined;
                          if (user.gender && user.gender !== 'Trống') {
                            if (user.gender === 'Nam' || user.gender.toLowerCase() === 'male') {
                              genderValue = 'male';
                            } else if (user.gender === 'Nữ' || user.gender.toLowerCase() === 'female') {
                              genderValue = 'female';
                            }
                          }
                          form.reset({
                            displayName: user.name || '',
                            phone: user.phone || '',
                            address: user.address?.trim() ? user.address : '',
                            dob:
                              user.dateOfBirth && user.dateOfBirth !== 'Trống' ? user.dateOfBirth : '',
                            gender: genderValue,
                          });
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 flex-row items-center justify-center"
                        activeOpacity={0.8}
                      >
                        <X size={18} color="#64748B" />
                        <Text className="ml-2 text-slate-700 font-extrabold">Hủy</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={form.handleSubmit(onSubmit)}
                        disabled={isLoading}
                        className="flex-1 px-4 py-3 rounded-xl bg-sky-600 flex-row items-center justify-center"
                        activeOpacity={0.8}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Save size={18} color="#fff" />
                            <Text className="ml-2 text-white font-extrabold">Lưu</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </FormProvider>
              ) : (
                infoItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <View
                      key={`${item.label}-${index}`}
                      className={`flex-row items-start rounded-2xl border border-sky-100 p-3.5 ${index !== infoItems.length - 1 ? 'mb-3' : ''
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
                          {String(item.value ?? '-')}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>

        <View className="mt-4 rounded-2xl border border-sky-100 bg-white overflow-hidden">
          <Text className="px-4 pt-4 text-[11px] font-extrabold uppercase tracking-wide text-sky-600">
            Bảo mật
          </Text>
          <TouchableOpacity
            onPress={() => router.push(changePasswordPath as any)}
            className="mt-2 flex-row items-center justify-between px-4 py-4 border-t border-sky-50"
            activeOpacity={0.85}
          >
            <View className="flex-row items-center flex-1 min-w-0 pr-2">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-sky-50 border border-sky-200">
                <KeyRound size={18} color="#0284C7" />
              </View>
              <View className="ml-3 flex-1 min-w-0">
                <Text className="text-[14px] font-extrabold text-slate-900">Đổi mật khẩu</Text>
                <Text className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  Cập nhật mật khẩu đăng nhập
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <DeviceSecuritySection onLoggedOutCurrentSession={handleLoggedRemotely} />
      </ScrollView>
    </SafeAreaView>
  );
}
