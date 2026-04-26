import {
  Laptop,
  LogOut,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

import { getTrustedDeviceToken, removeTrustedDeviceToken } from "@/lib/trustedDeviceToken";
import {
  deviceService,
  type ActiveSessionResponse,
  type TrustedDeviceResponse,
} from "@/services/deviceService";
import { buildMobileTrustDevicePayload } from "@/utils/trustDevicePayload";

function formatSessionTime(epochMs: number): string {
  if (!epochMs) return "—";
  try {
    return new Date(epochMs).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

function formatTrustedDate(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toLocaleString("vi-VN");
  } catch {
  }
  return iso;
}

interface DeviceSecuritySectionProps {

  onLoggedOutCurrentSession?: () => Promise<void>;
}

export function DeviceSecuritySection({ onLoggedOutCurrentSession }: DeviceSecuritySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<ActiveSessionResponse[]>([]);
  const [trusted, setTrusted] = useState<TrustedDeviceResponse[]>([]);
  const [trustLoading, setTrustLoading] = useState(false);
  const [logoutId, setLogoutId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS === "android") {
      (UIManager as any).setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [sRes, tRes] = await Promise.all([
        deviceService.getActiveSessions(),
        deviceService.getTrustedDevices(),
      ]);
      if (sRes.success && Array.isArray(sRes.data)) setSessions(sRes.data);
      else setSessions([]);
      if (tRes.success && Array.isArray(tRes.data)) setTrusted(tRes.data);
      else setTrusted([]);
    } catch {
      setSessions([]);
      setTrusted([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleTrustCurrent = async () => {
    const current = sessions.find((s) => s.currentSession);
    if (!current) {
      Alert.alert("Thông báo", "Không tìm thấy phiên hiện tại.");
      return;
    }
    if (current.trusted) {
      Alert.alert("Thông báo", "Phiên này đã là thiết bị tin cậy.");
      return;
    }
    setTrustLoading(true);
    try {
      const fallback = buildMobileTrustDevicePayload();
      const res = await deviceService.trustDevice({
        ipAddress: current.ipAddress ?? fallback.ipAddress,
        browser: current.browser || fallback.browser,
        os: current.os || fallback.os,
        deviceType: current.deviceType || fallback.deviceType,
        deviceName: current.deviceName || fallback.deviceName,
        screen: current.screen || fallback.screen,
      });
      if (res.success) {
        Alert.alert("Thành công", "Đã thêm thiết bị này vào danh sách tin cậy.");
        await load();
      } else {
        Alert.alert("Lỗi", res.error || res.message || "Không thể tin cậy thiết bị.");
      }
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể tin cậy thiết bị.");
    } finally {
      setTrustLoading(false);
    }
  };

  const handleLogoutSession = (sessionId: string, isCurrent: boolean) => {
    const go = async () => {
      setLogoutId(sessionId);
      try {
        const res = await deviceService.logoutSession(sessionId);
        if (res.success) {
          if (isCurrent) {
            await onLoggedOutCurrentSession?.();
            return;
          }
          Alert.alert("Thành công", "Đã đăng xuất phiên trên thiết bị đó.");
          await load();
        } else {
          Alert.alert("Lỗi", res.error || res.message || "Không thể đăng xuất phiên.");
        }
      } catch (e: any) {
        Alert.alert("Lỗi", e?.message || "Không thể đăng xuất phiên.");
      } finally {
        setLogoutId(null);
      }
    };

    if (isCurrent) {
      Alert.alert(
        "Đăng xuất phiên này?",
        "Bạn sẽ bị đăng xuất khỏi ứng dụng trên thiết bị hiện tại.",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Đăng xuất", style: "destructive", onPress: go },
        ]
      );
    } else {
      go();
    }
  };

  const handleRemoveTrusted = (row: TrustedDeviceResponse) => {
    Alert.alert(
      "Xóa thiết bị tin cậy?",
      row.deviceName || row.browser || "Thiết bị này sẽ bị gỡ khỏi danh sách tin cậy.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            setRemoveId(row.id);
            try {
              const stored = await getTrustedDeviceToken();
              const res = await deviceService.removeTrustedDevice(row.id);
              if (res.success) {
                if (stored && row.deviceToken && stored === row.deviceToken) {
                  await removeTrustedDeviceToken();
                }
                Alert.alert("Thành công", "Đã xóa thiết bị khỏi danh sách tin cậy.");
                await load();
              } else {
                Alert.alert("Lỗi", res.error || res.message || "Không thể xóa.");
              }
            } catch (e: any) {
              Alert.alert("Lỗi", e?.message || "Không thể xóa.");
            } finally {
              setRemoveId(null);
            }
          },
        },
      ]
    );
  };

  const currentSession = sessions.find((s) => s.currentSession);
  const canTrustCurrent = currentSession && !currentSession.trusted;

  return (
    <View className="mt-4 bg-white rounded-2xl border border-sky-100 overflow-hidden">
      <View className="flex-row items-center justify-between p-4 border-b border-sky-100">
        <TouchableOpacity
          className="flex-1 flex-row items-center pr-2"
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded((e) => !e);
          }}
          activeOpacity={0.85}
        >
          <View className="flex-1">
            <Text className="text-[15px] font-extrabold text-slate-900">Phiên & thiết bị tin cậy</Text>
            <Text className="mt-0.5 text-xs font-bold text-slate-500">
              Phiên đăng nhập đang hoạt động và thiết bị tin cậy
            </Text>
          </View>
          <Text className="text-sky-700 font-extrabold">{expanded ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={refreshing}
          className="ml-2 w-9 h-9 rounded-xl items-center justify-center bg-sky-50 border border-sky-200"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#0284C7" />
          ) : (
            <RefreshCw size={16} color="#0284C7" />
          )}
        </TouchableOpacity>
      </View>

      {expanded && (
        <View className="p-4">
          {loading ? (
            <ActivityIndicator color="#0284C7" className="py-6" />
          ) : (
            <>
              <View className="flex-row items-center mb-2">
                <Laptop size={18} color="#0284C7" />
                <Text className="ml-2 text-[13px] font-extrabold text-slate-800">
                  Phiên đăng nhập đang hoạt động
                </Text>
              </View>

              {sessions.length === 0 ? (
                <Text className="text-xs text-slate-500 mb-4">Chưa có dữ liệu phiên.</Text>
              ) : (
                sessions.map((s) => (
                  <View
                    key={s.sessionId}
                    className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-2">
                        <Text className="text-[13px] font-extrabold text-slate-900" numberOfLines={2}>
                          {s.deviceName || s.browser || "Thiết bị"}
                          {s.currentSession ? " · Đang dùng" : ""}
                        </Text>
                        <Text className="mt-1 text-[11px] font-bold text-slate-600" numberOfLines={2}>
                          {[s.os, s.deviceType, s.ipAddress].filter(Boolean).join(" · ") || "—"}
                        </Text>
                        <Text className="mt-1 text-[10px] text-slate-500">
                          Bắt đầu: {formatSessionTime(s.createdAt)} · Hết hạn:{" "}
                          {formatSessionTime(s.expiresAt)}
                        </Text>
                        <View className="flex-row flex-wrap gap-2 mt-2">
                          {s.trusted && (
                            <View className="px-2 py-0.5 rounded-lg bg-emerald-100 border border-emerald-200">
                              <Text className="text-[10px] font-extrabold text-emerald-800">Tin cậy</Text>
                            </View>
                          )}
                          {s.currentSession && (
                            <View className="px-2 py-0.5 rounded-lg bg-sky-100 border border-sky-200">
                              <Text className="text-[10px] font-extrabold text-sky-800">Phiên hiện tại</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleLogoutSession(s.sessionId, s.currentSession)}
                        disabled={logoutId === s.sessionId}
                        className="px-2 py-2 rounded-xl bg-white border border-red-200"
                      >
                        {logoutId === s.sessionId ? (
                          <ActivityIndicator size="small" color="#dc2626" />
                        ) : (
                          <LogOut size={18} color="#dc2626" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              {canTrustCurrent && (
                <TouchableOpacity
                  onPress={handleTrustCurrent}
                  disabled={trustLoading}
                  className="mb-6 flex-row items-center justify-center py-3 rounded-2xl bg-emerald-600 border border-emerald-700"
                  activeOpacity={0.85}
                >
                  {trustLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <ShieldCheck size={18} color="#fff" />
                      <Text className="ml-2 text-white text-[13px] font-extrabold">
                        Tin cậy thiết bị này (phiên hiện tại)
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <View className="flex-row items-center mb-2 mt-2">
                <Smartphone size={18} color="#0284C7" />
                <Text className="ml-2 text-[13px] font-extrabold text-slate-800">
                  Thiết bị tin cậy
                </Text>
              </View>

              {trusted.length === 0 ? (
                <View className="flex-row items-center py-3 px-3 rounded-xl bg-slate-50 border border-slate-200">
                  <Shield size={16} color="#94a3b8" />
                  <Text className="ml-2 flex-1 text-xs text-slate-600">
                    Chưa có thiết bị tin cậy. Dùng nút trên để tin cậy máy đang dùng (sau khi đăng nhập có thể
                    bỏ OTP tùy cấu hình server).
                  </Text>
                </View>
              ) : (
                trusted.map((t) => (
                  <View
                    key={t.id}
                    className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 flex-row items-center"
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-[13px] font-extrabold text-slate-900" numberOfLines={2}>
                        {t.deviceName || t.browser || "Thiết bị"}
                      </Text>
                      <Text className="mt-1 text-[11px] font-bold text-slate-600" numberOfLines={2}>
                        {[t.os, t.deviceType, t.ipAddress].filter(Boolean).join(" · ") || "—"}
                      </Text>
                      <Text className="mt-1 text-[10px] text-slate-500">
                        Thêm: {formatTrustedDate(t.createdAt)} · Gần nhất: {formatTrustedDate(t.lastUsed)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveTrusted(t)}
                      disabled={removeId === t.id}
                      className="w-10 h-10 rounded-xl items-center justify-center bg-red-50 border border-red-200"
                    >
                      {removeId === t.id ? (
                        <ActivityIndicator size="small" color="#dc2626" />
                      ) : (
                        <Trash2 size={18} color="#dc2626" />
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}
