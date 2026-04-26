import React from 'react';
import { StatusBar, Platform, StyleSheet, ViewStyle, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, Edge } from 'react-native-safe-area-context';

interface ScreenWrapperProps {
  children: React.ReactNode;
  /** Background color of the screen */
  backgroundColor?: string;
  /** Whether to include top safe area padding (default: true) */
  safeTop?: boolean;
  /** Whether to include bottom safe area padding (default: true) */
  safeBottom?: boolean;
  /** Custom style for the container */
  style?: ViewStyle;
  /** Status bar style: 'light-content' | 'dark-content' */
  statusBarStyle?: 'light-content' | 'dark-content';
  /** Whether to show status bar (default: true) */
  showStatusBar?: boolean;
  /** Additional edges to apply safe area insets */
  edges?: Edge[];
  /** Use View instead of SafeAreaView (for screens that handle their own safe area) */
  useView?: boolean;
}

/**
 * ScreenWrapper component that provides consistent safe area handling
 * across all screens for both Android and iOS devices.
 * 
 * Handles:
 * - Status bar on Android
 * - Notch/Dynamic Island on iOS
 * - Bottom home indicator on iOS
 * - Navigation bar on Android
 * 
 * Usage:
 * ```tsx
 * <ScreenWrapper backgroundColor="#fff" safeTop safeBottom>
 *   <YourContent />
 * </ScreenWrapper>
 * ```
 */
export default function ScreenWrapper({
  children,
  backgroundColor = '#F8FAFC', // slate-50
  safeTop = true,
  safeBottom = true,
  style,
  statusBarStyle = 'dark-content',
  showStatusBar = true,
  edges,
  useView = false,
}: ScreenWrapperProps) {
  const insets = useSafeAreaInsets();

  // Build edges array based on props
  const safeEdges: Edge[] = edges || [
    ...(safeTop ? ['top' as Edge] : []),
    ...(safeBottom ? ['bottom' as Edge] : []),
    'left' as Edge,
    'right' as Edge,
  ];

  const Container = useView ? View : SafeAreaView;

  return (
    <>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={backgroundColor}
        hidden={!showStatusBar}
        translucent={Platform.OS === 'android'}
      />
      <Container
        style={[
          styles.container,
          { backgroundColor },
          // Add extra padding for Android status bar if translucent and using View
          Platform.OS === 'android' && useView && safeTop && {
            paddingTop: insets.top,
          },
          Platform.OS === 'android' && useView && safeBottom && {
            paddingBottom: insets.bottom,
          },
          style,
        ]}
        {...(!useView && { edges: safeEdges })}
      >
        {children}
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

/**
 * Hook to get safe area insets for custom layouts
 * 
 * Usage:
 * ```tsx
 * const insets = useSafeAreaInsets();
 * <View style={{ paddingTop: insets.top }}>
 *   <Content />
 * </View>
 * ```
 */
export { useSafeAreaInsets };

/**
 * Custom hook for keyboard-aware safe area
 * Returns the bottom inset considering keyboard visibility
 */
export function useKeyboardSafeArea() {
  const insets = useSafeAreaInsets();
  return {
    ...insets,
    // Minimum bottom padding for buttons/inputs
    bottomPadding: Math.max(insets.bottom, 16),
  };
}
