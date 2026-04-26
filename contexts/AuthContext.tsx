import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { isStaffSideRole } from "@/constants/roles";
import { ROOT_HREF } from "@/lib/router-href";
import { apiClient } from "@/services/api";
import { customerService } from "@/services/customerService";
import { User } from "@/types";

const isHTGenStaff = (hospitalUser: any): boolean => {
  if (!hospitalUser) {
    return false;
  }

  const role = hospitalUser.role?.toUpperCase();
  if (role === "ROLE_CUSTOMER") {
    return true;
  }
  if (!isStaffSideRole(role)) {
    return false;
  }
  if (role === "ROLE_ADMIN") {
    return true;
  }
  const hospitalId = hospitalUser.hospitalId;
  if (hospitalId == null || hospitalId === undefined) {
    return true;
  }
  if (hospitalId !== 1 && hospitalId !== "1") {
    return false;
  }
  return true;
};

const getHomeRouteForRole = (role?: string | null): string => {
  const r = role?.toUpperCase();
  if (r === "ROLE_CUSTOMER") return "/customer";
  if (r === "ROLE_ADMIN") return "/admin";
  if (r === "ROLE_DOCTOR") return "/doctor";
  if (r === "ROLE_LAB_TECHNICIAN") return "/lab-technician";
  if (r === "ROLE_SAMPLE_COLLECTOR") return "/sample-collector";
  if (r === "ROLE_STAFF") return "/staff";
  return "/staff";
};

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
    dateOfBirth:
      hospitalUser.dob != null && hospitalUser.dob !== ""
        ? String(hospitalUser.dob)
        : "Trống",
    hospitalId: hospitalUser.hospitalId ?? null,
    role: hospitalUser.role || null,
    avatarUrl: hospitalUser.avatarUrl || undefined,
    address: hospitalUser.address || "",
  };
};

export type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updatedUserData: Partial<User>) => Promise<void>;
  clearAuthError: () => void;
  canCreatePrescriptionSlip: () => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const checkAuth = useCallback(async () => {
    try {
      const storedUser = await AsyncStorage.getItem("user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (
          parsedUser.role === "ROLE_CUSTOMER" ||
          isHTGenStaff({ role: parsedUser.role })
        ) {
          setUser(parsedUser);
          router.replace(getHomeRouteForRole(parsedUser.role) as any);
        } else {
          await AsyncStorage.removeItem("user");
          await apiClient.logout();
          setUser(null);
        }
      } else {
        let userResponse = await apiClient.getCurrentUser();
        if (!userResponse.success && userResponse.error) {
          const errorMessage = userResponse.error.toLowerCase();
          const isCustomerNotFoundError =
            errorMessage.includes("customer") &&
            (errorMessage.includes("not found") ||
              errorMessage.includes("không tìm thấy") ||
              errorMessage.includes("illegalargument"));

          if (isCustomerNotFoundError) {
            try {
              const userInfoResponse = await apiClient.get("/api/v1/user/info");
              if (userInfoResponse.success && userInfoResponse.data) {
                const userInfo = userInfoResponse.data as any;
                const userRole = userInfo.role || "";

                if (userRole.toUpperCase() === "ROLE_CUSTOMER") {
                  const minimalUser: User = {
                    id: userInfo.userId || userInfo.id || "",
                    accountCode: userInfo.userId || userInfo.id || "",
                    email: userInfo.email || "",
                    name: userInfo.name || "",
                    phone: userInfo.phone || "",
                    gender: userInfo.gender || "Trống",
                    department: "Trống",
                    hospitalName: userInfo.hospitalName || "Trống",
                    dateOfBirth: userInfo.dob || userInfo.dateOfBirth || "Trống",
                    hospitalId: userInfo.hospitalId || null,
                    role: "ROLE_CUSTOMER",
                    avatarUrl: userInfo.avatarUrl || undefined,
                    address: userInfo.address || "",
                  };
                  await AsyncStorage.setItem("user", JSON.stringify(minimalUser));
                  setUser(minimalUser);
                  router.replace("/customer" as any);
                  setIsLoading(false);
                  return;
                }
              }
            } catch (fallbackError) {
              console.error(
                "[AuthContext] Error in checkAuth fallback:",
                fallbackError,
              );
            }
          }
        }

        if (userResponse.success && userResponse.data) {
          const hospitalUser = (userResponse.data as any).hospitalUser;
          if (hospitalUser) {
            if (!isHTGenStaff(hospitalUser)) {
              await AsyncStorage.removeItem("user");
              await apiClient.logout();
              setUser(null);
              setIsLoading(false);
              return;
            }
            const userData = mapHospitalUserToUser(hospitalUser);
            await AsyncStorage.setItem("user", JSON.stringify(userData));
            setUser(userData);
            router.replace(getHomeRouteForRole(userData.role) as any);
          }
        } else if (userResponse.error) {
          setAuthError(userResponse.error);
          await AsyncStorage.removeItem("user");
          await apiClient.logout();
        }
      }
    } catch (error) {
      console.error("Error checking auth:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setAuthError(null);
      console.log("[AuthContext] Starting login for:", email);

      const response = await apiClient.login(email, password);
      console.log(
        "[AuthContext] Login response:",
        response.success ? "Success" : "Failed",
        response.error,
      );

      if (!response.success) {
        setAuthError(response.error || "Đăng nhập thất bại");
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log("[AuthContext] Getting current user...");
      let userResponse = await apiClient.getCurrentUser();
      console.log(
        "[AuthContext] GetCurrentUser response:",
        userResponse.success ? "Success" : "Failed",
        userResponse.error,
      );
      if (!userResponse.success && userResponse.error) {
        const errorMessage = userResponse.error.toLowerCase();
        const isCustomerNotFoundError =
          errorMessage.includes("customer") &&
          (errorMessage.includes("not found") ||
            errorMessage.includes("không tìm thấy") ||
            errorMessage.includes("illegalargument"));

        if (isCustomerNotFoundError) {
          console.log(
            "[AuthContext] Customer-related error detected, attempting to create customer record...",
          );
          try {
            const userInfoResponse = await apiClient.get("/api/v1/user/info");
            if (userInfoResponse.success && userInfoResponse.data) {
              const userInfo = userInfoResponse.data as any;
              const userId = userInfo.userId || userInfo.id;
              const userRole = userInfo.role || "";
              if (userId && userRole.toUpperCase() === "ROLE_CUSTOMER") {
                const createCustomerResponse = await customerService.create({
                  userId: userId,
                  customerName: userInfo.name || email.split("@")[0],
                  customerEmail: email,
                });

                if (createCustomerResponse.success) {
                  console.log(
                    "[AuthContext] Customer record created, retrying getCurrentUser...",
                  );
                  userResponse = await apiClient.getCurrentUser();
                } else {
                  console.warn(
                    "[AuthContext] Failed to create customer record:",
                    createCustomerResponse.error,
                  );
                }
              } else {
                console.log(
                  "[AuthContext] User is not ROLE_CUSTOMER, skipping customer creation",
                );
              }
            }
          } catch (createError: any) {
            console.error(
              "[AuthContext] Error creating customer record:",
              createError,
            );
          }
        }
      }

      if (userResponse.success && userResponse.data) {
        const hospitalUser = (userResponse.data as any).hospitalUser;
        if (hospitalUser) {
          if (!isHTGenStaff(hospitalUser)) {
            console.log("[AuthContext] User is not HTGen staff");
            await apiClient.logout();
            setAuthError("Bạn không có quyền truy cập");
            return false;
          }
          const userData = mapHospitalUserToUser(hospitalUser);
          await AsyncStorage.setItem("user", JSON.stringify(userData));
          setUser(userData);
          queryClient.invalidateQueries({ queryKey: ["patients"] });
          queryClient.invalidateQueries({ queryKey: ["services"] });
          queryClient.invalidateQueries({ queryKey: ["doctors"] });
          queryClient.invalidateQueries({ queryKey: ["genome-tests"] });
          router.replace(getHomeRouteForRole(userData.role) as any);
          return true;
        } else {
          console.log("[AuthContext] No hospitalUser in response");
        }
      } else {
        const errorMessage = userResponse.error?.toLowerCase() || "";
        const isCustomerNotFoundError =
          errorMessage.includes("customer") &&
          (errorMessage.includes("not found") ||
            errorMessage.includes("không tìm thấy") ||
            errorMessage.includes("illegalargument"));

        if (isCustomerNotFoundError) {
          console.log(
            "[AuthContext] Customer error persists, attempting fallback login for ROLE_CUSTOMER",
          );
          try {
            const userInfoResponse = await apiClient.get("/api/v1/user/info");
            if (userInfoResponse.success && userInfoResponse.data) {
              const userInfo = userInfoResponse.data as any;
              const userRole = userInfo.role || "";
              if (userRole.toUpperCase() === "ROLE_CUSTOMER") {
                console.log(
                  "[AuthContext] Allowing login with minimal user data for ROLE_CUSTOMER",
                );
                const minimalUser: User = {
                  id: userInfo.userId || userInfo.id || email,
                  accountCode: userInfo.userId || userInfo.id || email,
                  email: email,
                  name: userInfo.name || email.split("@")[0],
                  phone: userInfo.phone || "",
                  gender: userInfo.gender || "Trống",
                  department: "Trống",
                  hospitalName: userInfo.hospitalName || "Trống",
                  dateOfBirth: userInfo.dob || userInfo.dateOfBirth || "Trống",
                  hospitalId: userInfo.hospitalId || null,
                  role: "ROLE_CUSTOMER",
                  avatarUrl: userInfo.avatarUrl || undefined,
                  address: userInfo.address || "",
                };
                await AsyncStorage.setItem("user", JSON.stringify(minimalUser));
                setUser(minimalUser);
                queryClient.invalidateQueries({ queryKey: ["patients"] });
                queryClient.invalidateQueries({ queryKey: ["services"] });
                queryClient.invalidateQueries({ queryKey: ["doctors"] });
                queryClient.invalidateQueries({ queryKey: ["genome-tests"] });
                router.replace("/customer" as any);
                return true;
              }
            }
          } catch (fallbackError) {
            console.error("[AuthContext] Error in fallback login:", fallbackError);
          }
        }

        console.error(
          "[AuthContext] Failed to get current user:",
          userResponse.error,
        );
        setAuthError(userResponse.error || "Không thể lấy thông tin người dùng");
      }

      return false;
    } catch (error: any) {
      console.error("[AuthContext] Error logging in:", error);
      if (
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("Network")
      ) {
        setAuthError(
          "Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và đảm bảo backend server đang chạy.",
        );
      } else {
        setAuthError("Có lỗi xảy ra khi đăng nhập");
      }
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
      await AsyncStorage.removeItem("user");
      setUser(null);
      setAuthError(null);
      router.replace(ROOT_HREF);
    } catch (error) {
      console.error("Error logging out:", error);
      await AsyncStorage.removeItem("user");
      setUser(null);
      setAuthError(null);
      router.replace(ROOT_HREF);
    }
  };

  const updateUser = useCallback(async (updatedUserData: Partial<User>) => {
    try {
      const currentUser = user;
      if (!currentUser) return;

      const updatedUser: User = {
        ...currentUser,
        ...updatedUserData,
      };

      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  }, [user]);

  const clearAuthError = () => {
    setAuthError(null);
  };

  const canCreatePrescriptionSlip = useCallback((): boolean => {
    if (!user?.role) return false;
    const role = user.role.toUpperCase();
    const allowedRoles = [
      "ROLE_DOCTOR",
      "ROLE_CUSTOMER",
      "ROLE_STAFF",
      "ROLE_ADMIN",
      "ROLE_ADMIN_HOSPITAL",
    ];
    return allowedRoles.includes(role);
  }, [user]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value: AuthContextValue = {
    user,
    isLoading,
    authError,
    login,
    logout,
    updateUser,
    clearAuthError,
    canCreatePrescriptionSlip,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx == null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
