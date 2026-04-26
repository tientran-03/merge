import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@htgen:trusted-device-token';

export async function getTrustedDeviceToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setTrustedDeviceToken(token: string): Promise<void> {
  if (!token) return;
  try {
    await AsyncStorage.setItem(KEY, token);
  } catch {}
}

export async function removeTrustedDeviceToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
