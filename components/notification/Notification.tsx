import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react-native";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Pressable, StatusBar, Text, View } from "react-native";
import type { NotificationData } from "@/contexts/NotificationContext";

interface NotificationProps {
  notification: NotificationData;
  onHide: () => void;
}

type Tone = {
  accent: string;
  icon: string;
};

export const Notification: React.FC<NotificationProps> = ({ notification, onHide }) => {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnim, slideAnim]);

  const handleHide = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(onHide);
  };

  const tone: Tone = useMemo(() => {
    switch (notification.type) {
      case "success":
        return { accent: "#10B981", icon: "#10B981" };
      case "error":
        return { accent: "#EF4444", icon: "#EF4444" };
      case "warning":
        return { accent: "#F59E0B", icon: "#F59E0B" };
      case "info":
      default:
        return { accent: "#3B82F6", icon: "#3B82F6" };
    }
  }, [notification.type]);

  const icon = useMemo(() => {
    const size = 20;
    switch (notification.type) {
      case "success":
        return <CheckCircle2 size={size} color={tone.icon} />;
      case "error":
        return <XCircle size={size} color={tone.icon} />;
      case "warning":
        return <AlertTriangle size={size} color={tone.icon} />;
      case "info":
      default:
        return <Info size={size} color={tone.icon} />;
    }
  }, [notification.type, tone.icon]);

  const topPadding = Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 10 : 10;

  const accentBg = `${tone.accent}1A`;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        paddingTop: topPadding,
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
      }}
      className="absolute left-0 right-0 top-0 z-[9999] px-4"
    >
      <Pressable
        onPress={notification.onPress}
        onLongPress={handleHide}
        className="overflow-hidden rounded-3xl border border-black/10 bg-white/95 shadow-2xl"
        style={{ borderLeftWidth: 5, borderLeftColor: tone.accent }}
      >
        <View className="flex-row items-center px-3 py-3">
          <View
            className="mr-3 h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: accentBg }}
          >
            {icon}
          </View>
          <View className="flex-1 pr-2">
            <Text className="text-[14.5px] font-extrabold text-slate-900" numberOfLines={1}>
              {notification.title}
            </Text>

            {!!notification.message && (
              <Text
                className="mt-0.5 text-[13px] font-medium leading-5 text-slate-600"
                numberOfLines={2}
              >
                {notification.message}
              </Text>
            )}
          </View>
          <Pressable
            onPress={handleHide}
            hitSlop={10}
            className="h-9 w-9 items-center justify-center rounded-2xl bg-black/5 active:opacity-80"
          >
            <X size={18} color="#64748B" />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
};
