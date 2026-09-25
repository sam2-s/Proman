import React from 'react';
import type { ImageStyle, StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, Text, View } from 'react-native';
import { font } from '../theme';
import { useTheme } from '../theme/Theme';

export interface AvatarProps {
  /** Display name — used for initials and the fallback color hash. */
  name: string;
  /** Profile picture URL, if the user has one. */
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Readable on both the terminal (dark) and paper (light) palettes. */
const HASH_COLORS = [
  '#137A3F',
  '#1565C0',
  '#B26B00',
  '#C62828',
  '#6B4EC6',
  '#0E7490',
  '#4F46E5',
  '#A16207',
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HASH_COLORS[h % HASH_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

/**
 * Square avatar: profile picture when available, hashed initials otherwise.
 * The TUI counterpart of a rounded photo — one character block.
 */
export function Avatar({ name, uri, size = 32, style }: AvatarProps) {
  const colors = useTheme();
  const dim = { width: size, height: size };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          dim,
          styles.image,
          { borderColor: colors.line },
          style as StyleProp<ImageStyle>,
        ]}
        accessibilityLabel={`${name} avatar`}
      />
    );
  }

  const c = hashColor(name);
  return (
    <View
      style={[
        dim,
        styles.fallback,
        { backgroundColor: c + '26', borderColor: c },
        style,
      ]}
      accessibilityLabel={`${name} avatar`}
    >
      <Text
        style={[
          styles.initials,
          { color: c, fontSize: Math.max(10, size * 0.4) },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
    borderWidth: 1,
  },
  fallback: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: font.mono,
    fontWeight: '700',
  },
});
