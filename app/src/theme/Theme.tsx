import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import {
  paperColors,
  terminalColors,
  type Palette,
} from './index';

export type ThemePref = 'dark' | 'light' | 'system';

const THEME_KEY = 'proman_theme';

interface ThemeState {
  palette: Palette;
  pref: ThemePref;
  /** Explicit pick: 'dark' | 'light'. 'system' follows the OS. */
  setPref: (pref: ThemePref) => void;
  /** Flip between the two TUI palettes (dark terminal <-> light paper). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState>({
  palette: terminalColors,
  pref: 'dark',
  setPref: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  // Dark terminal is the default; a stored preference wins over the OS.
  const [pref, setPrefState] = useState<ThemePref>('dark');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_KEY)
      .then((v) => {
        if (cancelled) return;
        if (v === 'dark' || v === 'light' || v === 'system') setPrefState(v);
      })
      .catch(() => {
        // keep default
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {
      // preference is best-effort; in-memory value still applies
    });
  }, []);

  const palette = useMemo(() => {
    if (pref === 'system') return system === 'light' ? paperColors : terminalColors;
    return pref === 'light' ? paperColors : terminalColors;
  }, [pref, system]);

  const toggle = useCallback(() => {
    setPref(palette === terminalColors ? 'light' : 'dark');
  }, [palette, setPref]);

  const value = useMemo(
    () => ({ palette, pref, setPref, toggle }),
    [palette, pref, setPref, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Returns the active palette (keeps existing screen code working unchanged). */
export function useTheme(): Palette {
  return useContext(ThemeContext).palette;
}

/** Full theme state — pref + switcher. Used by the profile screen. */
export function useThemeControls(): ThemeState {
  return useContext(ThemeContext);
}
