import { Link, Stack } from "expo-router";
import { AlertCircle, Home } from "lucide-react-native";
import { View, Text } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Không tìm thấy trang" }} />
      <View className="flex-1 bg-slate-50 p-4 justify-center">
        <View className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-lg items-center">
          <View className="w-21 h-21 rounded-[42px] bg-cyan-50 items-center justify-center border border-cyan-600/18">
            <AlertCircle size={48} color="#0891B2" />
          </View>

          <Text className="mt-3.5 text-xl font-extrabold text-slate-900">Không tìm thấy trang</Text>
          <Text className="mt-2 text-sm leading-5 text-slate-500 text-center px-2.5">
            Trang bạn tìm kiếm không tồn tại hoặc đã bị thay đổi đường dẫn.
          </Text>

          <Link href="/home" className="mt-4 w-full bg-cyan-600 rounded-xl py-3 px-3.5">
            <View className="flex-row items-center justify-center gap-2">
              <Home size={18} color="#fff" />
              <Text className="text-white text-[15px] font-bold">Quay về trang chủ</Text>
            </View>
          </Link>

          <Text className="mt-3.5 text-xs text-slate-400 text-center leading-4.5 px-2">
            Nếu bạn truy cập từ một liên kết cũ, hãy thử quay lại và mở lại trang.
          </Text>
        </View>
      </View>
    </>
  );
}
