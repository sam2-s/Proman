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
import { radius, spacing } from '../theme';

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
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    row: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    title: { fontWeight: '700', color: colors.text, fontSize: 15 },
    meta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
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
        placeholder="Search tasks…"
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
          q ? <Text style={styles.empty}>No matching tasks</Text> : null
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
