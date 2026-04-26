import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [focusField, setFocusField] = useState<"email" | "password" | null>(null);

  const { login, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Không cần useEffect redirect ở đây vì navigation đã được xử lý trong login() function

  const emailTrim = useMemo(() => email.trim(), [email]);

  const handleLogin = async () => {
    if (!emailTrim || !password.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập email và mật khẩu");
      return;
    }

    setIsLoading(true);
    const success = await login(emailTrim, password);
    setIsLoading(false);

    if (!success) {
      Alert.alert(
        "Lỗi đăng nhập",
        "Email hoặc mật khẩu không đúng, hoặc tài khoản này không được phép sử dụng ứng dụng mobile.\n\nChỉ tài khoản được cấu quyền vận hành (admin, nhân viên, bác sĩ, lab, thu mẫu) mới đăng nhập được."
      );
    }
  };

  const inputWrap = (key: "email" | "password") =>
    `h-14 rounded-2xl flex-row items-center px-4 border ${
      focusField === key ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-slate-50"
    }`;

  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-sky-900">
        <StatusBar barStyle="light-content" backgroundColor="#0C4A6E" />
        <ActivityIndicator size="large" color="#fff" />
        <Text className="mt-3 text-white/80 text-xs font-bold">Đang khởi tạo...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-sky-900" edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0C4A6E" />
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={["#0C4A6E", "#075985", "#0E7490"]}
        style={{ flex: 1 }}
      >
        <View className="absolute -top-24 -left-20 w-[240px] h-[240px] rounded-full bg-white/10" />
        <View className="absolute top-28 -right-20 w-[210px] h-[210px] rounded-full bg-white/8" />
        <View className="absolute -bottom-28 -right-24 w-[280px] h-[280px] rounded-full bg-white/10" />

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="flex-1 justify-center px-4">
            <View className="items-center mb-5">
              <View className="w-[92px] h-[92px] rounded-[46px] bg-white/14 items-center justify-center border border-white/20">
                <View className="w-[70px] h-[70px] rounded-[35px] bg-white/10 items-center justify-center border border-white/15">
                  <Text className="text-[28px] font-extrabold text-white tracking-wider">HT</Text>
                </View>
              </View>

              <Text className="mt-3 text-[18px] font-extrabold text-white tracking-wide">
                HIGH TECH GENETICS
              </Text>
              <Text className="mt-1 text-xs text-white/80 font-semibold">
                HT Viet Nam Co., Ltd
              </Text>
            </View>

            <View className="bg-white rounded-3xl p-6 border border-white/20 shadow-2xl shadow-black/20">
              <Text className="text-[22px] font-extrabold text-slate-900 text-center">
                Đăng nhập
              </Text>
              <Text className="mt-1 mb-6 text-sm text-slate-500 text-center">
                Nhập thông tin để tiếp tục
              </Text>

              <View className={inputWrap("email")}>
                <View className="w-10 h-10 rounded-xl bg-sky-100 items-center justify-center mr-3">
                  <Mail size={20} color="#075985" />
                </View>
                <TextInput
                  className="flex-1 text-[15px] text-slate-900 font-semibold"
                  placeholder="Email"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onFocus={() => setFocusField("email")}
                  onBlur={() => setFocusField(null)}
                  returnKeyType="next"
                />
              </View>

              <View className={`mt-3 ${inputWrap("password")}`}>
                <View className="w-10 h-10 rounded-xl bg-sky-100 items-center justify-center mr-3">
                  <Lock size={20} color="#075985" />
                </View>
                <TextInput
                  className="flex-1 text-[15px] text-slate-900 font-semibold"
                  placeholder="Mật khẩu"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  onFocus={() => setFocusField("password")}
                  onBlur={() => setFocusField(null)}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  onPress={() => setShowPassword((v) => !v)}
                  activeOpacity={0.75}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#64748B" />
                  ) : (
                    <Eye size={20} color="#64748B" />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity className="self-end mt-3" activeOpacity={0.75}>
                <Text className="text-sky-700 text-sm font-extrabold">
                  Quên mật khẩu?
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
                className={`mt-5 h-14 rounded-2xl overflow-hidden ${
                  isLoading ? "opacity-80" : ""
                }`}
              >
                <LinearGradient
                  colors={["#075985", "#0E7490"]}
                  style={{flex: 1, alignItems: "center", justifyContent: "center"}}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-[15px] font-extrabold tracking-wide">
                      Đăng nhập
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View className="mt-4 flex-row items-center justify-center gap-3">
                <View className="h-px flex-1 bg-slate-200" />
                <Text className="text-[11px] text-slate-400 font-extrabold tracking-widest">
                  HTG MOBILE
                </Text>
                <View className="h-px flex-1 bg-slate-200" />
              </View>
            </View>

            <View className="h-8" />
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}
