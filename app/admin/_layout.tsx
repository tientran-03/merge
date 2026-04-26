import { Stack } from 'expo-router';

const adminHeader = {
  headerStyle: { backgroundColor: '#0891b2' },
  headerTintColor: '#fff' as const,
};

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Quay lại',
        ...adminHeader,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ headerShown: false }} />
      <Stack.Screen name="orders" options={{ title: 'Quản lý đơn hàng' }} />
      <Stack.Screen name="hospitals" options={{ title: 'Quản lý bệnh viện' }} />
      <Stack.Screen name="users" options={{ title: 'Quản lý người dùng' }} />
      <Stack.Screen name="services" options={{ title: 'Quản lý dịch vụ' }} />
      <Stack.Screen name="permissions" options={{ title: 'Quyền hạn' }} />
      <Stack.Screen name="config" options={{ title: 'Cấu hình' }} />
      <Stack.Screen name="logs" options={{ title: 'Nhật ký' }} />
      <Stack.Screen name="specifies" options={{ title: 'Phiếu chỉ định' }} />
      <Stack.Screen name="test-results" options={{ title: 'Kết quả xét nghiệm' }} />
    </Stack>
  );
}
