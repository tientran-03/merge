import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, KeyRound } from 'lucide-react-native';
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/form/FormInput';
import { useAuth } from '@/contexts/AuthContext';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { ChangePasswordFormData, changePasswordSchema } from '@/lib/schemas/change-password-schema';
import { MEDICAL } from '@/lib/theme/medical';
import { userService } from '@/services/userService';

export function ChangePasswordScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handleLogoutAfterSuccess = async () => {
    try {
      await logout();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Không thể đăng xuất sau khi đổi mật khẩu.';

      presentFeedbackError({
        title: 'Lỗi đăng xuất',
        message,
      });
    }
  };

  const onSubmit = async (data: ChangePasswordFormData) => {
    if (submitting) return;

    setSubmitting(true);
    try {
      const res = await userService.changePassword({
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });

      if (!res.success) {
        presentFeedbackError({
          title: 'Không thành công',
          message: res.error || 'Không thể đổi mật khẩu.',
        });
        return;
      }

      form.reset();

      presentFeedbackSuccess({
        title: 'Đổi mật khẩu thành công',
        message: 'Vui lòng đăng nhập lại bằng mật khẩu mới.',
        confirmLabel: 'Đăng nhập lại',
        onAfterClose: () => {
          requestAnimationFrame(() => {
            void handleLogoutAfterSuccess();
          });
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Có lỗi xảy ra';
      presentFeedbackError({
        title: 'Lỗi',
        message: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-sky-50" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <View className="border-b border-sky-100 bg-white px-4 pb-3 pt-2">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => {
              if (!submitting) router.back();
            }}
            disabled={submitting}
            className="mr-3 h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50"
            activeOpacity={0.85}
          >
            <ArrowLeft size={20} color={MEDICAL.primary} />
          </TouchableOpacity>

          <View className="min-w-0 flex-1">
            <Text className="text-lg font-extrabold text-slate-900">Đổi mật khẩu</Text>
            <Text className="mt-0.5 text-xs font-semibold text-slate-500">
              Mật khẩu mới: tối thiểu 8 ký tự, có chữ hoa, chữ thường và số
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4 flex-row items-center rounded-2xl border border-sky-100 bg-white px-4 py-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
            <KeyRound size={20} color={MEDICAL.primaryDark} />
          </View>
          <Text className="ml-3 flex-1 text-xs font-semibold leading-snug text-slate-600">
            Sau khi đổi mật khẩu thành công, bạn sẽ được đăng xuất và cần đăng nhập lại bằng mật khẩu mới.
          </Text>
        </View>

        <FormProvider {...form}>
          <View className="rounded-2xl border border-sky-100 bg-white p-4">
            <FormInput
              name="oldPassword"
              label="Mật khẩu hiện tại"
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              required
            />

            <FormInput
              name="newPassword"
              label="Mật khẩu mới"
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              required
            />

            <FormInput
              name="confirmPassword"
              label="Xác nhận mật khẩu mới"
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              required
            />

            <TouchableOpacity
              onPress={form.handleSubmit(onSubmit)}
              disabled={submitting}
              className="mt-2 items-center justify-center rounded-xl bg-sky-600 py-3.5"
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-extrabold text-white">Cập nhật mật khẩu</Text>
              )}
            </TouchableOpacity>
          </View>
        </FormProvider>
      </ScrollView>
    </SafeAreaView>
  );
}