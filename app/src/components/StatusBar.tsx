import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

export interface StatusSegment {
  text: string;
  color?: string;
  /** Show a filled `●` before the text (connection states). */
  dot?: boolean;
  bold?: boolean;
}

export interface StatusBarProps {
  segments: StatusSegment[];
  style?: StyleProp<ViewStyle>;
}

/**
 * Terminal-style status line, pinned to the bottom of a screen:
 *
 *   ▌ proman │ project: Website │ ● live │ sam
 */
export function StatusBar({ segments, style }: StatusBarProps) {
  const colors = useTheme();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.statusBar, borderTopColor: colors.line },
        style,
      ]}
    >
      <Text style={[styles.prompt, { color: colors.primary }]}>▌</Text>
      {segments.map((seg, i) => (
        <View key={`${seg.text}-${i}`} style={styles.segment}>
          {i > 0 && (
            <Text style={[styles.sep, { color: colors.line }]}>│</Text>
          )}
          {seg.dot && (
            <Text
              style={[
                styles.dot,
                { color: seg.color ?? colors.success },
              ]}
            >
              ●
            </Text>
          )}
          <Text
            style={[
              styles.text,
              {
                color: seg.color ?? colors.textSecondary,
                fontWeight: seg.bold ? '700' : '400',
              },
            ]}
            numberOfLines={1}
          >
            {seg.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    gap: 6,
    minHeight: 26,
  },
  prompt: {
    fontFamily: font.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sep: {
    fontFamily: font.mono,
    fontSize: 11,
  },
  dot: {
    fontSize: 8,
  },
  text: {
    fontFamily: font.mono,
    fontSize: 11,
  },
});
