import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors, darkColors, type Palette } from './index';

const ThemeContext = createContext<Palette>(colors);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const palette = useMemo(() => (scheme === 'dark' ? darkColors : colors), [scheme]);
  return (
    <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Palette {
  return useContext(ThemeContext);
}
