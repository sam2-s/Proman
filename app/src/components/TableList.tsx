import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

export interface TableRow {
  key: string;
  cells: React.ReactNode[];
  onPress?: () => void;
  selected?: boolean;
}

export interface TableListProps {
  /** Column header labels, drawn uppercase above the rows. */
  columns: string[];
  /** Optional flex weights per column (default 1 each). */
  flex?: number[];
  rows: TableRow[];
  style?: StyleProp<ViewStyle>;
}

/**
 * Monospace table: uppercase header row, hairline separators,
 * selectable rows. Works for members, admin lists, and search results.
 */
export function TableList({ columns, flex, rows, style }: TableListProps) {
  const colors = useTheme();
  const weights = flex ?? columns.map(() => 1);

  return (
    <View style={[{ borderColor: colors.line }, style]}>
      <View style={[styles.row, { borderBottomColor: colors.line }]}>
        {columns.map((col, i) => (
          <Text
            key={col}
            style={[
              styles.headerCell,
              { color: colors.textMuted, flex: weights[i] ?? 1 },
            ]}
            numberOfLines={1}
          >
            {col}
          </Text>
        ))}
      </View>
      {rows.map((row, idx) => {
        const body = (
          <View
            style={[
              styles.row,
              {
                borderBottomColor: colors.line,
                backgroundColor: row.selected ? colors.selection : undefined,
              },
              idx === rows.length - 1 && styles.lastRow,
            ]}
          >
            {row.cells.map((cell, i) => (
              <View key={i} style={{ flex: weights[i] ?? 1 }}>
                {cell}
              </View>
            ))}
          </View>
        );
        return row.onPress ? (
          <Pressable
            key={row.key}
            onPress={row.onPress}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            {body}
          </Pressable>
        ) : (
          <View key={row.key}>{body}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    gap: spacing.sm,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  headerCell: {
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
