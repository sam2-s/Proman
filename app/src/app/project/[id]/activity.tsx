import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState, Loading } from '../../../components/Tui';
import { api } from '../../../api/client';
import type { ActivityItem } from '../../../api/types';
import { useTheme } from '../../../theme/Theme';
import { font, spacing } from '../../../theme';

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const colors = useTheme();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    try {
      const data = await api.get<ActivityItem[]>(
        `/api/projects/${projectId}/activity?limit=${PAGE_SIZE}`,
      );
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      setItems([]);
    }
  }, [projectId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items === null) return;
    setLoadingMore(true);
    try {
      const data = await api.get<ActivityItem[]>(
        `/api/projects/${projectId}/activity?limit=${PAGE_SIZE}&offset=${items.length}`,
      );
      setItems((prev) => [...(prev ?? []), ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, items, loadingMore, projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state updates happen after await
    void load();
  }, [load]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    row: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.line,
    },
    summary: {
      fontFamily: font.mono,
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    meta: {
      fontFamily: font.mono,
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 6,
      letterSpacing: 1,
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
    loadMore: {
      margin: spacing.md,
      padding: spacing.md,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      alignItems: 'center',
    },
    loadMoreText: {
      fontFamily: font.mono,
      color: colors.primary,
      fontWeight: '700',
      fontSize: 13,
      letterSpacing: 1,
    },
  });

  if (!items) {
    return (
      <Loading label="activity" />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        ListEmptyComponent={
          <EmptyState
            title="no activity yet"
            hint="task moves, comments and edits stream here as your team works"
          />
        }
        ListFooterComponent={
          hasMore ? (
            <Pressable style={styles.loadMore} onPress={() => void loadMore()}>
              <Text style={styles.loadMoreText}>
                {loadingMore ? '[ ... ]' : '[ load more ]'}
              </Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.summary}>{item.summary}</Text>
            <Text style={styles.meta}>
              {item.verb} · {item.created_at}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
