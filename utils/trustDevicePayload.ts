import * as Device from "expo-device";
import { Dimensions, Platform } from "react-native";

import type { TrustDeviceRequest } from "@/services/deviceService";

export function buildMobileTrustDevicePayload(): TrustDeviceRequest {
  const { width, height } = Dimensions.get("window");
  const scale = Dimensions.get("screen").scale ?? 1;
  const os =
    Device.osName && Device.osVersion != null
      ? `${Device.osName} ${Device.osVersion}`
      : `${Platform.OS} ${String(Platform.Version)}`;
  const deviceName =
    Device.deviceName ||
    Device.modelName ||
    [Device.manufacturer, Device.modelId].filter(Boolean).join(" ") ||
    "Mobile";
  return {
    browser: "HTGen Mobile",
    deviceType: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : Platform.OS,
    deviceName,
    os,
    screen: `${Math.round(width * scale)}x${Math.round(height * scale)}`,
  };
}

export function buildMobileDeviceInfoHeader(): string {
  const p = buildMobileTrustDevicePayload();
  return `${p.deviceName}|${p.deviceType}|${p.browser}|${p.os}|${p.screen}`;
}
