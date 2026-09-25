import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api/client';
import type { SearchResult } from '../api/types';
import { useTheme } from '../theme/Theme';
import { font, spacing } from '../theme';

export default function SearchScreen() {
  const colors = useTheme();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get<SearchResult[]>(
        `/api/search?q=${encodeURIComponent(term.trim())}`,
      );
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void run(q), 250);
    return () => clearTimeout(t);
  }, [q, run]);

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
    emptyBox: { alignItems: 'center', marginTop: 48, paddingHorizontal: spacing.lg },
    emptyTitle: {
      fontFamily: font.mono,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    emptyHint: {
      fontFamily: font.mono,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
      fontSize: 11,
      lineHeight: 17,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
  });

  if (loading && !results.length && q) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
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
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          q.trim() ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>no matching tasks</Text>
              <Text style={styles.emptyHint}>
                try another keyword — search covers titles and descriptions
                across your projects
              </Text>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>type to search</Text>
              <Text style={styles.emptyHint}>
                grep task titles and descriptions across all of your projects
              </Text>
            </View>
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
