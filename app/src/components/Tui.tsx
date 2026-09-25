import React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

type Variant = 'default' | 'primary' | 'danger' | 'ghost';

export interface TuiButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Render inline (no flex growth) — for toolbars. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Bracket button: `[ label ]` in monospace. Variants only change color.
 */
export function TuiButton({
  label,
  onPress,
  variant = 'default',
  disabled,
  compact,
  style,
  textStyle,
}: TuiButtonProps) {
  const colors = useTheme();

  const color =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'ghost'
          ? colors.textMuted
          : colors.textSecondary;

  const bg =
    variant === 'primary' ? colors.primaryLight : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        compact ? styles.compact : null,
        { borderColor: disabled ? colors.line : color, backgroundColor: bg },
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: disabled ? colors.textMuted : color },
          textStyle,
        ]}
      >
        {`[ ${label} ]`}
      </Text>
    </Pressable>
  );
}

export interface BadgeProps {
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Square bracket badge: `[OWNER]`, `[LIVE]`, `[P0]`. */
export function Badge({ label, color, style }: BadgeProps) {
  const colors = useTheme();
  const c = color ?? colors.textSecondary;
  return (
    <View
      style={[
        styles.badge,
        { borderColor: c, backgroundColor: colors.card },
        style,
      ]}
    >
      <Text style={[styles.badgeText, { color: c }]}>{`[${label}]`}</Text>
    </View>
  );
}

export interface DividerProps {
  /** Optional centered label, e.g. `── OR ──`. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Horizontal rule drawn with box-drawing dashes. */
export function Divider({ label, style }: DividerProps) {
  const colors = useTheme();
  if (!label) {
    return <View style={[styles.rule, { backgroundColor: colors.line }, style]} />;
  }
  return (
    <View style={[styles.dividerRow, style]}>
      <View style={[styles.rule, { backgroundColor: colors.line }]} />
      <Text style={[styles.dividerLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <View style={[styles.rule, { backgroundColor: colors.line }]} />
    </View>
  );
}

export interface LoadingProps {
  label?: string;
}

/** Bracketed loading indicator: `[ loading… ]`. */
export function Loading({ label = 'loading' }: LoadingProps) {
  const colors = useTheme();
  return (
    <View style={loadStyles.center}>
      <Text style={[loadStyles.text, { color: colors.textMuted }]}>
        {`[ ${label}… ]`}
      </Text>
    </View>
  );
}

export interface EmptyStateProps {
  title: string;
  hint?: string;
}

/** Box-framed empty state: `┌─ TITLE` + muted hint + `└─`. */
export function EmptyState({ title, hint }: EmptyStateProps) {
  const colors = useTheme();
  return (
    <View style={emptyStyles.wrap}>
      <Text style={[emptyStyles.title, { color: colors.textSecondary }]}>
        {`┌─ ${title}`}
      </Text>
      {hint ? (
        <Text style={[emptyStyles.hint, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
      <Text style={[emptyStyles.rule, { color: colors.line }]}>└─</Text>
    </View>
  );
}

const loadStyles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  text: {
    fontFamily: font.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

const emptyStyles = StyleSheet.create({
  wrap: {
    marginTop: 48,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: font.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hint: {
    fontFamily: font.mono,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.sm,
    marginLeft: 4,
  },
  rule: {
    fontFamily: font.mono,
    fontSize: 14,
    marginTop: spacing.sm,
  },
});

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  label: {
    fontFamily: font.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rule: {
    flex: 1,
    height: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLabel: {
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
});
