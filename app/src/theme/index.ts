export interface PriorityPalette {
  low: string;
  medium: string;
  high: string;
  urgent: string;
}

export interface Palette {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  bg: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  danger: string;
  success: string;
  warning: string;
  info: string;
  priority: PriorityPalette;
}

export const colors: Palette = {
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primaryLight: '#EEF2FF',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  info: '#3B82F6',
  priority: {
    low: '#94A3B8',
    medium: '#3B82F6',
    high: '#F59E0B',
    urgent: '#EF4444',
  },
};

export const darkColors: Palette = {
  primary: '#818CF8',
  primaryDark: '#6366F1',
  primaryLight: '#1E1B4B',
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  danger: '#F87171',
  success: '#4ADE80',
  warning: '#FBBF24',
  info: '#60A5FA',
  priority: {
    low: '#94A3B8',
    medium: '#60A5FA',
    high: '#FBBF24',
    urgent: '#F87171',
  },
};

export function paletteFor(
  scheme: 'light' | 'dark' | null | undefined,
): Palette {
  return scheme === 'dark' ? darkColors : colors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
} as const;
