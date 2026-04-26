import Constants from "expo-constants";
import { Dimensions, Platform } from "react-native";

let cachedDeviceId: string | null = null;

/**
 * Giống web (X-Device-Id): "device|type|browser|os|screen" để backend parse hiển thị phiên đăng nhập.
 */
export function getMobileDeviceIdHeader(): string {
  if (cachedDeviceId) return cachedDeviceId;

  const { width, height } = Dimensions.get("window");
  const device =
    Constants.deviceName ??
    Constants.modelName ??
    (Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : Platform.OS);
  const type = "mobile";
  const version =
    Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "dev";
  const browser = `HTGen Mobile/${version}`;
  const os = `${Platform.OS} ${String(Platform.Version ?? "")}`.trim();
  const screen = `${Math.round(width)}x${Math.round(height)}`;

  cachedDeviceId = `${device}|${type}|${browser}|${os}|${screen}`;
  return cachedDeviceId;
}
