import 'react-native-gesture-handler';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import '../global.css';

import { AuthProvider } from '@/contexts/AuthContext';
import { FeedbackModalProvider } from '@/contexts/FeedbackModalContext';

SplashScreen.preventAutoHideAsync();

const STALE_TIME = 60 * 1000;

function logGlobalAuthError(error: unknown) {
  const err = error as {
    response?: { status?: number };
    error?: string;
    message?: string;
  };
  const msg = String(err?.error ?? err?.message ?? '');
  if (
    err?.response?.status === 401 ||
    msg.includes('401') ||
    msg.includes('hết hạn')
  ) {
    console.warn('Global 401 handler: Session expired');
  }
}

const createQueryClient = () => {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: logGlobalAuthError,
    }),
    mutationCache: new MutationCache({
      onError: logGlobalAuthError,
    }),
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME,
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
          const err = error as {
            response?: { status?: number };
            error?: string;
            message?: string;
          };
          const msg = String(err?.error ?? err?.message ?? '');
          if (
            err?.response?.status === 401 ||
            msg.includes('401') ||
            msg.includes('hết hạn')
          ) {
            return false;
          }
          return failureCount < 3;
        },
      },
    },
  });
};

const queryClient = createQueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Quay lại' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="customer" options={{ headerShown: false }} />
      <Stack.Screen name="staff" options={{ headerShown: false }} />
      <Stack.Screen name="doctor" options={{ headerShown: false }} />
      <Stack.Screen name="lab-technician" options={{ headerShown: false }} />
      <Stack.Screen name="sample-collector" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: "#0C4A6E" }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <FeedbackModalProvider>
              <AuthProvider>
                <RootLayoutNav />
                <Toast />
              </AuthProvider>
            </FeedbackModalProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}
