import type { Card } from '../api/types';
import { colors, radius, shadow, spacing } from '../theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  card: Card;
  onPress: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function TaskCard({
  card,
  onPress,
  onMoveLeft,
  onMoveRight,
  isFirst,
  isLast,
}: Props) {
  const priorityColor =
    colors.priority[card.priority as keyof typeof colors.priority] ??
    colors.priority.medium;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
      <View style={styles.body}>
        <Text style={styles.title}>{card.title}</Text>
        {card.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {card.description}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: priorityColor + '22' }]}>
            <Text style={[styles.badgeText, { color: priorityColor }]}>
              {card.priority}
            </Text>
          </View>
          {card.due_date ? (
            <Text style={styles.due}>Due {card.due_date}</Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={onMoveLeft}
            disabled={isFirst}
            hitSlop={8}
            style={[styles.arrow, isFirst && styles.arrowDisabled]}
          >
            <Text style={styles.arrowText}>←</Text>
          </Pressable>
          <Pressable
            onPress={onMoveRight}
            disabled={isLast}
            hitSlop={8}
            style={[styles.arrow, isLast && styles.arrowDisabled]}
          >
            <Text style={styles.arrowText}>→</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadow.card,
  },
  priorityBar: { width: 4 },
  body: { flex: 1, padding: spacing.sm + 4 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  desc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  due: { fontSize: 11, color: colors.textMuted },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: spacing.sm,
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  arrowDisabled: { opacity: 0.35 },
  arrowText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
});
