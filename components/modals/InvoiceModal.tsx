import * as WebBrowser from "expo-web-browser";
import { FileText, X } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

interface InvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  invoiceLink: string | null;
  orderId: string;
}

function pathOnly(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.toLowerCase();
  } catch {
    return url.split("?")[0].toLowerCase();
  }
}

function isLikelyImageUrl(url: string): boolean {
  if (/\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(pathOnly(url))) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const p = u.pathname.toLowerCase();
    if ((host.includes("res.cloudinary.com") || host.endsWith("cloudinary.com")) && p.includes("/image/upload/")) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function isLikelyPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(pathOnly(url));
}

function webViewSourceUri(url: string): string {
  if (isLikelyPdfUrl(url)) {
    return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function InvoiceModal({
  visible,
  onClose,
  invoiceLink,
  orderId,
}: InvoiceModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [imageFailed, setImageFailed] = useState(false);
  const [webLoading, setWebLoading] = useState(true);
  const [webError, setWebError] = useState(false);

  const isImage = invoiceLink ? isLikelyImageUrl(invoiceLink) : false;
  const webUri = invoiceLink ? webViewSourceUri(invoiceLink) : "";

  React.useEffect(() => {
    if (visible) {
      setImageFailed(false);
      setWebLoading(true);
      setWebError(false);
    }
  }, [visible, invoiceLink]);

  const handleOpenInBrowser = useCallback(() => {
    if (invoiceLink) {
      WebBrowser.openBrowserAsync(invoiceLink);
    }
  }, [invoiceLink]);

  const showImage = Boolean(invoiceLink && isImage && !imageFailed);
  const showWeb = Boolean(invoiceLink && (!showImage || imageFailed));

  const webViewKey = useMemo(() => `${webUri.slice(0, 120)}`, [webUri]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === "android"}
      hardwareAccelerated={Platform.OS === "android"}
    >
      {/* Khung full kích thước cửa sổ — Android không có presentationStyle, cần ép width/height */}
      <View
        style={{
          width: windowWidth,
          height: windowHeight,
          flex: 1,
          backgroundColor: "#ffffff",
        }}
      >
        <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200">
            <View className="flex-row items-center gap-2 flex-1 pr-2">
              <FileText size={22} color="#0284c7" />
              <View className="flex-1">
                <Text className="text-base font-extrabold text-slate-800" numberOfLines={1}>
                  Hóa đơn thanh toán
                </Text>
                <Text className="text-sm text-slate-500 mt-0.5">Mã đơn: {orderId}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-11 h-11 rounded-2xl bg-slate-100 items-center justify-center"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={22} color="#334155" />
            </TouchableOpacity>
          </View>
          <View className="flex-1 min-h-0 bg-slate-50">
            {!invoiceLink ? (
              <View className="flex-1 justify-center items-center px-6">
                <Text className="text-slate-500">Không có hóa đơn</Text>
              </View>
            ) : showImage ? (
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                showsVerticalScrollIndicator
                bounces
              >
                <View className="bg-white rounded-xl p-2 border border-slate-100">
                  <Image
                    source={{ uri: invoiceLink }}
                    style={{ width: "100%", aspectRatio: 0.72, borderRadius: 8 }}
                    resizeMode="contain"
                    onError={() => setImageFailed(true)}
                  />
                </View>
              </ScrollView>
            ) : showWeb ? (
              <View className="flex-1 min-h-0 mx-3 my-2 rounded-xl overflow-hidden border border-slate-200 bg-white">
                {webLoading && !webError && (
                  <View className="absolute inset-0 z-10 items-center justify-center bg-slate-50">
                    <ActivityIndicator size="large" color="#0284c7" />
                    <Text className="text-slate-500 text-sm mt-3">Đang tải hóa đơn...</Text>
                  </View>
                )}
                {webError ? (
                  <View className="flex-1 items-center justify-center p-6">
                    <Text className="text-slate-600 text-center mb-4">
                      Không thể hiển thị trong ứng dụng. Bạn có thể mở bằng trình duyệt.
                    </Text>
                    <TouchableOpacity
                      onPress={handleOpenInBrowser}
                      className="bg-sky-600 px-6 py-3 rounded-xl"
                    >
                      <Text className="text-white font-extrabold">Mở trong trình duyệt</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <WebView
                    key={webViewKey}
                    source={{ uri: webUri }}
                    style={{ flex: 1 }}
                    onLoadEnd={() => setWebLoading(false)}
                    onError={() => {
                      setWebLoading(false);
                      setWebError(true);
                    }}
                    onHttpError={() => {
                      setWebLoading(false);
                      setWebError(true);
                    }}
                    startInLoadingState={false}
                    scalesPageToFit
                    setSupportMultipleWindows={false}
                    originWhitelist={["*"]}
                    nestedScrollEnabled
                  />
                )}
              </View>
            ) : null}
          </View>

          <SafeAreaView edges={["bottom"]} className="border-t border-slate-200 bg-white px-4 pt-3">
            <TouchableOpacity
              onPress={onClose}
              className="py-3.5 rounded-xl bg-sky-600 items-center mb-2"
            >
              <Text className="font-extrabold text-white">Đóng</Text>
            </TouchableOpacity>
            {invoiceLink ? (
              <Pressable onPress={handleOpenInBrowser} className="py-2 items-center mb-1">
                <Text className="text-sm text-sky-600 font-semibold">
                  Mở trong trình duyệt (tuỳ chọn)
                </Text>
              </Pressable>
            ) : null}
          </SafeAreaView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
