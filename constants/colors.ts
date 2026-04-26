/**
 * Shared color constants for the application
 * Centralized to avoid duplication across components
 */

export const COLORS = {
  // Background colors
  bg: '#F6F7FB',
  bgBlue: '#F0F9FF',
  card: '#FFFFFF',

  // Text colors
  text: '#0F172A',
  sub: '#64748B',
  muted: '#94A3B8',

  // Border colors
  border: '#E2E8F0',
  borderBlue: '#E0F2FE',
  borderBlue2: '#BAE6FD',
  border2: '#BAE6FD',
  divider: '#F1F5F9',

  // Primary colors (blue theme)
  primary: '#0891B2',
  primaryDark: '#0369A1',
  primaryLighter: '#0284C7',
  primarySoft: 'rgba(8,145,178,0.12)',
  primarySoftBlue: '#E0F2FE',
  focusRing: 'rgba(8,145,178,0.22)',

  // Status colors
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F97316',
  info: '#3B82F6',

  // Special colors
  orange: '#F97316',
  red: '#EF4444',
  green: '#22C55E',
  blue: '#3B82F6',
} as const;

export type ColorKeys = keyof typeof COLORS;
