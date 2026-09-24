export const colors = {
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
} as const;

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
