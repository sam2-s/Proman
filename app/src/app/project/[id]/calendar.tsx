import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../../../api/client';
import type { Card } from '../../../api/types';
import { font, spacing } from '../../../theme';
import { useTheme } from '../../../theme/Theme';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CalendarScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Card[]>(`/api/projects/${projectId}/cards`)
      .then(setCards)
      .catch(() => setCards([]));
  }, [projectId]);

  const byDate = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of cards ?? []) {
      if (!c.due_date) continue;
      const key = c.due_date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return map;
  }, [cards]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Monday-first offset
    const offset = (first.getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  if (cards === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const monthLabel = cursor.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
          style={styles.navBtn}
        >
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel.toUpperCase()}</Text>
        <Pressable
          onPress={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
          style={styles.navBtn}
        >
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{w.toUpperCase()}</Text>
          </View>
        ))}
        {days.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={styles.cell} />;
          const key = iso(d);
          const items = byDate.get(key) ?? [];
          const isToday = key === iso(new Date());
          return (
            <Pressable
              key={key}
              style={[
                styles.cell,
                isToday && styles.today,
                selected === key && styles.selectedDay,
              ]}
              onPress={() => setSelected(selected === key ? null : key)}
            >
              <Text
                style={[
                  styles.dayNum,
                  isToday && { color: '#fff', fontWeight: '800' },
                ]}
              >
                {d.getDate()}
              </Text>
              {items.length > 0 && (
                <View style={styles.dots}>
                  {items.slice(0, 3).map((c) => (
                    <View
                      key={c.id}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            colors.priority[
                              c.priority as keyof typeof colors.priority
                            ] ?? colors.primary,
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {selected && (
        <View style={styles.agenda}>
          <Text style={styles.agendaTitle}>{`── ${selected}`}</Text>
          {(byDate.get(selected) ?? []).length === 0 ? (
            <Text style={styles.agendaEmpty}>no tasks due</Text>
          ) : (
            (byDate.get(selected) ?? []).map((c) => (
              <View key={c.id} style={styles.agendaItem}>
                <View
                  style={[
                    styles.priorityStripe,
                    {
                      backgroundColor:
                        colors.priority[
                          c.priority as keyof typeof colors.priority
                        ] ?? colors.primary,
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.agendaTask}>{c.title}</Text>
                  {c.description ? (
                    <Text style={styles.agendaDesc} numberOfLines={2}>
                      {c.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthLabel: {
    fontFamily: font.mono,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 2,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontFamily: font.mono,
    fontSize: 20,
    color: colors.primary,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  weekdayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  weekdayText: {
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  cell: {
    width: `${100 / 7}%`,
    minHeight: 56,
    borderWidth: 0.5,
    borderColor: colors.line,
    padding: 4,
    alignItems: 'center',
  },
  today: { backgroundColor: colors.primary },
  selectedDay: { backgroundColor: colors.selection },
  dayNum: { fontFamily: font.mono, fontSize: 13, fontWeight: '600', color: colors.text },
  dots: { flexDirection: 'row', gap: 3, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 0 },
  agenda: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  agendaTitle: {
    fontFamily: font.mono,
    fontWeight: '700',
    color: colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1,
  },
  agendaEmpty: {
    fontFamily: font.mono,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: 12,
  },
  agendaItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'stretch',
  },
  priorityStripe: { width: 4, borderRadius: 0 },
  agendaTask: {
    fontFamily: font.mono,
    fontWeight: '700',
    color: colors.text,
    fontSize: 13,
  },
  agendaDesc: {
    fontFamily: font.mono,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
}
