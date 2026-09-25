import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import type { NotificationItem } from '../api/types';
import { useTheme } from '../theme/Theme';
import { radius, spacing } from '../theme';

export default function NotificationsScreen() {
  const colors = useTheme();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    try {
      const data = await api.get<NotificationItem[]>(
        `/api/notifications?limit=${PAGE_SIZE}`,
      );
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await api.get<NotificationItem[]>(
        `/api/notifications?limit=${PAGE_SIZE}&offset=${items.length}`,
      );
      setItems((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, items.length, loadingMore]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: number) {
    try {
      await api.post(`/api/notifications/${id}/read`);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: 1 } : n)),
      );
    } catch {
      // ignore
    }
  }

  async function markAll() {
    try {
      await api.post('/api/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, read: 1 })));
    } catch {
      // ignore
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerText: { fontWeight: '800', color: colors.text },
    markAll: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    row: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowUnread: { borderColor: colors.primary + '55' },
    body: { color: colors.text, fontSize: 14, fontWeight: '600' },
    time: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    loadMore: {
      margin: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
    },
    loadMoreText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    allLoaded: {
      color: colors.textMuted,
      textAlign: 'center',
      fontSize: 12,
      marginVertical: spacing.md,
    },
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Notifications</Text>
        <Pressable onPress={markAll}>
          <Text style={styles.markAll}>Mark all read</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => String(n.id)}
        ListEmptyComponent={<Text style={styles.empty}>You're all caught up</Text>}
        ListFooterComponent={
          hasMore ? (
            <Pressable style={styles.loadMore} onPress={() => void loadMore()}>
              <Text style={styles.loadMoreText}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Text>
            </Pressable>
          ) : items.length > 0 ? (
            <Text style={styles.allLoaded}>End of notifications</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, item.read === 0 && styles.rowUnread]}
            onPress={() => {
              void markRead(item.id);
              if (item.card_id) router.push(`/task/${item.card_id}`);
            }}
          >
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>{item.created_at}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
