import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { canAccessMobileApp, getDefaultHomeRoute } from "@/constants/roles";
import { apiClient, ApiResponse } from "@/services/api";
import { userService } from "@/services/userService";
import { User } from "@/types";

const navigateByRole = (role: string | undefined, router: any) => {
  router.replace(getDefaultHomeRoute(role));
};

// Nhận diện lỗi parse ngày sinh từ backend (SYSTEM_003 với message Text 'dd/MM/yyyy' could not be parsed ...)
const isDobParseError = (response: ApiResponse<any> | null | undefined): boolean => {
  if (!response) return false;
  const msg = response.error || response.message;
  if (!msg) return false;
  return (
    msg.includes("could not be parsed at index 0") ||
    msg.includes("Text '") ||
    msg.includes("SYSTEM_003")
  );
};

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  

  const checkAuth = useCallback(async () => {
    try {
      // Luôn gọi API để lấy role mới nhất từ backend (đảm bảo role luôn đúng)
      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.success && userResponse.data) {
        const hospitalUser = (userResponse.data as any).hospitalUser;
        if (hospitalUser) {
          if (!canAccessMobileApp(hospitalUser.role)) {
            await AsyncStorage.removeItem("user");
            await apiClient.logout();
            setUser(null);
            setIsLoading(false);
            return;
          }
          const userData = mapHospitalUserToUser(hospitalUser);
          await AsyncStorage.setItem("user", JSON.stringify(userData));
          setUser(userData);
          // Navigate ngay sau khi set user
          navigateByRole(userData.role, router);
        }
      } else if (isDobParseError(userResponse)) {
        // Trường hợp backend lỗi parse ngày sinh -> cố gắng fallback dùng dữ liệu đã lưu
        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          navigateByRole(parsedUser.role, router);
          setAuthError(null);
        } else {
          // Không có dữ liệu cũ để fallback
          setUser(null);
          setAuthError(
            "Không thể đọc thông tin người dùng do lỗi định dạng ngày sinh trên server. " +
              "Vui lòng chỉnh lại ngày sinh trên web admin hoặc liên hệ backend."
          );
        }
      } else {
        // Không có session hợp lệ, xóa dữ liệu cũ
        await AsyncStorage.removeItem("user");
        setUser(null);
        setAuthError(userResponse.error || null);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      // Nếu có lỗi, thử dùng dữ liệu trong AsyncStorage
      const storedUser = await AsyncStorage.getItem("user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        navigateByRole(parsedUser.role, router);
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const mapHospitalUserToUser = (hospitalUser: any): User => {
    return {
      id: hospitalUser.userId || "",
      accountCode: hospitalUser.userId || "",
      email: hospitalUser.email || "",
      name: hospitalUser.displayName || hospitalUser.username || "",
      phone: hospitalUser.phone || "",
      gender: hospitalUser.gender || "Trống",
      department: hospitalUser.hospitalId || "Trống",
      hospitalName: hospitalUser.hospitalName || "Trống",
      dateOfBirth: hospitalUser.dob || "Trống",
      hospitalId: hospitalUser.hospitalId || null,
      avatarUrl: hospitalUser.avatarUrl || undefined,
      role: hospitalUser.role || undefined,
    };
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setAuthError(null);
      const response = await apiClient.login(email, password);

      if (!response.success) {
        setAuthError(response.error || "Đăng nhập thất bại");
        return false;
      }

      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.success && userResponse.data) {
        const hospitalUser = (userResponse.data as any).hospitalUser;
        if (hospitalUser) {
          if (!canAccessMobileApp(hospitalUser.role)) {
            await apiClient.logout();
            setAuthError(
              "Bạn không có quyền truy cập ứng dụng mobile (vai trò được phép: Admin, Nhân viên, Bác sĩ, Kỹ thuật viên lab, Người thu mẫu)."
            );
            return false;
          }
          const userData = mapHospitalUserToUser(hospitalUser);
          await AsyncStorage.setItem("user", JSON.stringify(userData));
          // Set user vào state và navigate ngay lập tức
          setUser(userData);
          // Navigate ngay sau khi set user
          navigateByRole(userData.role, router);
          return true;
        }
      } else if (isDobParseError(userResponse)) {
        // Backend login OK nhưng /auth/me lỗi parse DOB -> fallback: tạo user tối thiểu từ email, assume ROLE_ADMIN
        const fallbackUser: User = {
          id: email,
          accountCode: email,
          email,
          name: email,
          phone: "",
          gender: "Trống",
          department: "Trống",
          hospitalName: "Trống",
          dateOfBirth: "Trống",
          hospitalId: "",
          avatarUrl: undefined,
          role: "ROLE_ADMIN",
        };
        await AsyncStorage.setItem("user", JSON.stringify(fallbackUser));
        setUser(fallbackUser);
        navigateByRole(fallbackUser.role, router);
        return true;
      } else {
        setAuthError(userResponse.error || "Không thể lấy thông tin người dùng");
      }

      return false;
    } catch (error) {
      console.error("Error logging in:", error);
      setAuthError("Có lỗi xảy ra khi đăng nhập");
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
      await AsyncStorage.removeItem("user");
      setUser(null);
      setAuthError(null);
      router.replace("/");
    } catch (error) {
      console.error("Error logging out:", error);
      await AsyncStorage.removeItem("user");
      setUser(null);
      setAuthError(null);
      router.replace("/");
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const updateUserProfile = async (
    payload: Partial<{ name?: string; phone?: string; dob?: string; gender?: string }>,
  ): Promise<boolean> => {
    try {
      setAuthError(null);

      if (!user?.id) {
        setAuthError("Không tìm thấy thông tin người dùng hiện tại");
        return false;
      }

      // TODO: Implement updateProfile API endpoint
      // const response = await userService.updateProfile({
      //   userId: user.id,
      //   ...payload,
      // });

      // For now, just update local state
      if (user) {
        const updatedUser = {
          ...user,
          ...(payload.name && { name: payload.name }),
          ...(payload.phone && { phone: payload.phone }),
          ...(payload.dob && { dateOfBirth: payload.dob }),
          ...(payload.gender && { gender: payload.gender }),
        };
        await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
        return true;
      }

      setAuthError("Không thể cập nhật hồ sơ");
      return false;
    } catch (error) {
      console.error("Error updating user profile:", error);
      setAuthError("Có lỗi xảy ra khi cập nhật hồ sơ");
      return false;
    }
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    user,
    isLoading,
    authError,
    login,
    logout,
    clearAuthError,
    updateUserProfile,
  };
});
