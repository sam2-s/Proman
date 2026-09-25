import { Platform } from 'react-native';

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
  /** Box-drawing / hairline color (same family as border, exposed for TUI lines). */
  line: string;
  /** Highlight background for selected rows / active items. */
  selection: string;
  /** Background for the bottom status bar strip. */
  statusBar: string;
  priority: PriorityPalette;
}

/**
 * Dark terminal palette — near-black panels, phosphor green accent, amber warn.
 * Terminal apps (btop, lazygit) are dark-first; this is the default theme.
 */
export const terminalColors: Palette = {
  primary: '#4FD675',
  primaryDark: '#3BB95E',
  primaryLight: '#123020',
  bg: '#0D1117',
  card: '#131820',
  border: '#262D3A',
  text: '#D7DCE5',
  textSecondary: '#8B94A7',
  textMuted: '#5A6272',
  danger: '#F85149',
  success: '#4FD675',
  warning: '#E3B341',
  info: '#58A6FF',
  line: '#262D3A',
  selection: '#1C2431',
  statusBar: '#090B0F',
  priority: {
    low: '#8B94A7',
    medium: '#58A6FF',
    high: '#E3B341',
    urgent: '#F85149',
  },
};

/**
 * Light paper palette — off-white stock, ink text, green/amber accents.
 * Same mono typography as the terminal theme, just inverted surfaces.
 */
export const paperColors: Palette = {
  primary: '#137A3F',
  primaryDark: '#0F5C31',
  primaryLight: '#E6F4EA',
  bg: '#F4F1E8',
  card: '#FBF9F2',
  border: '#D6D0BF',
  text: '#1C1B17',
  textSecondary: '#57544B',
  textMuted: '#8A867A',
  danger: '#C62828',
  success: '#137A3F',
  warning: '#B26B00',
  info: '#1565C0',
  line: '#D6D0BF',
  selection: '#E6F4EA',
  statusBar: '#EAE6DA',
  priority: {
    low: '#8A867A',
    medium: '#1565C0',
    high: '#B26B00',
    urgent: '#C62828',
  },
};

/** @deprecated legacy names kept so existing imports compile during the redesign */
export const colors = paperColors;
/** @deprecated legacy name for the dark palette */
export const darkColors = terminalColors;

export function paletteFor(scheme: 'light' | 'dark' | null | undefined): Palette {
  return scheme === 'dark' ? terminalColors : paperColors;
}

/**
 * Monospace stack for the whole app — the core of the TUI look.
 * Menlo on iOS, system monospace on Android, ui-monospace on web.
 */
export const font = {
  mono:
    Platform.OS === 'ios'
      ? 'Menlo'
      : Platform.OS === 'android'
        ? 'monospace'
        : 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** TUI = sharp corners everywhere. */
export const radius = {
  sm: 0,
  md: 0,
  lg: 0,
  full: 0,
} as const;

/** TUI = flat surfaces, no soft elevation. */
export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;
