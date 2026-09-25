import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

export interface PanelProps {
  /** Title bar text, drawn as `┌─ title ───┐`. Omit for a plain box. */
  title?: string;
  /** Tint the title with the accent color. */
  accent?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Style for the padded content area between the frame edges. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Disable the default padding around children. */
  unpadded?: boolean;
}

/**
 * The TUI replacement for a card: a box-drawn frame with an optional
 * title bar. Renders:
 *
 *   ┌─ title ───────────┐
 *   │  content          │
 *   └───────────────────┘
 */
export function Panel({
  title,
  accent,
  children,
  style,
  contentStyle,
  unpadded,
}: PanelProps) {
  const colors = useTheme();

  if (!title) {
    return (
      <View
        style={[
          styles.box,
          { borderColor: colors.line, backgroundColor: colors.card },
          style,
        ]}
      >
        <View style={[unpadded ? null : styles.padded, contentStyle]}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: colors.card }, style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.glyph, { color: colors.textMuted }]}>┌─</Text>
        <Text
          style={[
            styles.title,
            { color: accent ? colors.primary : colors.textSecondary },
          ]}
        >
          {title}
        </Text>
        <View style={[styles.filler, { backgroundColor: colors.line }]} />
        <Text style={[styles.glyph, { color: colors.textMuted }]}>┐</Text>
      </View>
      <View
        style={[
          styles.frameSides,
          { borderLeftColor: colors.line, borderRightColor: colors.line },
        ]}
      >
        <View style={[unpadded ? null : styles.padded, contentStyle]}>
          {children}
        </View>
      </View>
      <View style={styles.footerRow}>
        <Text style={[styles.glyph, { color: colors.textMuted }]}>└</Text>
        <View style={[styles.filler, { backgroundColor: colors.line }]} />
        <Text style={[styles.glyph, { color: colors.textMuted }]}>┘</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    paddingHorizontal: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 12,
    paddingHorizontal: 6,
  },
  frameSides: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  glyph: {
    fontFamily: font.mono,
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    fontFamily: font.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginHorizontal: 6,
  },
  filler: {
    flex: 1,
    height: 1,
  },
  padded: {
    padding: spacing.md,
  },
});
