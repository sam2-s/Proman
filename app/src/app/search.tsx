import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { EmptyState, Loading, TuiButton } from '../components/Tui';
import { api } from '../api/client';
import type { SearchResult } from '../api/types';
import { useTheme } from '../theme/Theme';
import { font, spacing } from '../theme';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export default function SearchScreen() {
  const colors = useTheme();
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (term: string, prio: string | null, asg: string | null) => {
      if (!term.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: term.trim() });
        if (prio) params.set('priority', prio);
        if (asg) params.set('assignee_id', asg);
        const data = await api.get<SearchResult[]>(
          `/api/search?${params.toString()}`,
        );
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => void run(q, priority, assignee), 250);
    return () => clearTimeout(t);
  }, [q, priority, assignee, run]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 0,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: colors.text,
      fontFamily: font.mono,
      fontSize: 14,
    },
    filterRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.sm,
      flexWrap: 'wrap',
    },
    assigneeInput: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      color: colors.text,
      fontFamily: font.mono,
      fontSize: 12,
    },
    row: {
      backgroundColor: colors.card,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    title: {
      fontFamily: font.mono,
      fontWeight: '700',
      color: colors.text,
      fontSize: 13,
    },
    meta: {
      fontFamily: font.mono,
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 4,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
  });

  if (loading && !results.length && q) {
    return <Loading label="search" />;
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="search tasks…"
        placeholderTextColor={colors.textMuted}
        value={q}
        onChangeText={setQ}
        autoFocus
        autoCapitalize="none"
      />
      <View style={styles.filterRow}>
        {PRIORITIES.map((p) => (
          <TuiButton
            key={p}
            label={p}
            compact
            variant={priority === p ? 'primary' : 'ghost'}
            onPress={() => setPriority(priority === p ? null : p)}
          />
        ))}
      </View>
      <View style={styles.filterRow}>
        <TextInput
          style={styles.assigneeInput}
          placeholder="assignee username…"
          placeholderTextColor={colors.textMuted}
          value={assignee ?? ''}
          onChangeText={(t) => setAssignee(t.trim() || null)}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {(priority || assignee) && (
          <TuiButton
            label="clear"
            compact
            variant="danger"
            onPress={() => {
              setPriority(null);
              setAssignee(null);
            }}
          />
        )}
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          q.trim() ? (
            <EmptyState
              title="no matching tasks"
              hint="try another keyword or clear filters — search covers titles and descriptions across your projects"
            />
          ) : (
            <EmptyState
              title="type to search"
              hint="grep task titles and descriptions across all of your projects"
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/task/${item.id}`)}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.project_name} · {item.board_name} · {item.column_name}
              {item.due_date ? ` · due ${item.due_date}` : ''}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
