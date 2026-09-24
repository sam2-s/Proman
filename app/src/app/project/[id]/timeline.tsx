import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../../../api/client';
import type { Card } from '../../../api/types';
import { colors, radius, spacing } from '../../../theme';

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayDiff(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export default function TimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    api
      .get<Card[]>(`/api/projects/${projectId}/cards`)
      .then(setCards)
      .catch(() => setCards([]));
  }, [projectId]);

  const rows = useMemo(() => {
    if (!cards) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return cards
      .map((c) => {
        const start =
          parseDate(c.start_date) ?? parseDate(c.due_date) ?? new Date(today);
        const end = parseDate(c.due_date) ?? start;
        return { card: c, start, end };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [cards]);

  const range = useMemo(() => {
    if (rows.length === 0) {
      const t = new Date();
      return { start: t, days: 30 };
    }
    const min = new Date(Math.min(...rows.map((r) => r.start.getTime())));
    const max = new Date(Math.max(...rows.map((r) => r.end.getTime())));
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 4);
    const days = Math.max(dayDiff(min, max), 14);
    return { start: min, days };
  }, [rows]);

  const ticks = useMemo(() => {
    const out: { date: Date; label: string }[] = [];
    const step = Math.max(1, Math.floor(range.days / 8));
    for (let i = 0; i <= range.days; i += step) {
      const d = new Date(range.start);
      d.setDate(d.getDate() + i);
      out.push({
        date: d,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
      });
    }
    return out;
  }, [range]);

  if (cards === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const todayOffset = dayDiff(range.start, new Date());

  return (
    <ScrollView
      style={styles.container}
      horizontal
      contentContainerStyle={{ padding: spacing.md }}
    >
      <View>
        <View style={styles.leftCol}>
          <Text style={styles.headerLeft}>Task</Text>
          {rows.map(({ card }) => (
            <View key={card.id} style={styles.labelRow}>
              <Text style={styles.labelText} numberOfLines={1}>
                {card.title}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.chartCol}>
          <View style={styles.tickRow}>
            {ticks.map((t) => (
              <Text
                key={t.label + t.date.toISOString()}
                style={styles.tick}
              >
                {t.label}
              </Text>
            ))}
          </View>
          <View style={styles.tracks}>
            {todayOffset >= 0 && todayOffset <= range.days && (
              <View
                style={[
                  styles.todayLine,
                  {
                    left: `${(todayOffset / range.days) * 100}%`,
                  },
                ]}
              />
            )}
            {rows.map(({ card, start, end }) => {
              const s = Math.max(0, dayDiff(range.start, start));
              const e = Math.min(range.days, Math.max(dayDiff(range.start, end), s + 1));
              const left = (s / range.days) * 100;
              const width = Math.max(((e - s) / range.days) * 100, 2);
              const color =
                colors.priority[
                  card.priority as keyof typeof colors.priority
                ] ?? colors.primary;
              return (
                <View key={card.id} style={styles.trackRow}>
                  <View
                    style={[
                      styles.bar,
                      { left: `${left}%`, width: `${width}%`, backgroundColor: color },
                    ]}
                  >
                    <Text style={styles.barText} numberOfLines={1}>
                      {card.title}
                    </Text>
                  </View>
                </View>
              );
            })}
            {rows.length === 0 && (
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>No dated tasks yet</Text>
                <Text style={styles.emptyHint}>
                  Add start/due dates on a task to see it on the timeline.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  leftCol: { width: 180 },
  headerLeft: {
    height: 32,
    fontWeight: '800',
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelRow: {
    height: 40,
    justifyContent: 'center',
    paddingRight: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  labelText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chartCol: { width: 720 },
  tickRow: {
    height: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tick: { fontSize: 10, color: colors.textMuted },
  tracks: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  trackRow: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  bar: {
    position: 'absolute',
    top: 8,
    height: 24,
    borderRadius: radius.full,
    justifyContent: 'center',
    paddingHorizontal: 8,
    minWidth: 24,
  },
  barText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  todayLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.danger,
    opacity: 0.7,
    zIndex: 2,
  },
  emptyWrap: { padding: spacing.lg },
  empty: { fontWeight: '700', color: colors.text },
  emptyHint: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
});
