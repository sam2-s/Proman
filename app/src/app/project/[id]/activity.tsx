import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../../../api/client';
import type { ActivityItem } from '../../../api/types';
import { useTheme } from '../../../theme/Theme';
import { radius, spacing } from '../../../theme';

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const colors = useTheme();
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<ActivityItem[]>(
        `/api/projects/${projectId}/activity`,
      );
      setItems(data);
    } catch {
      setItems([]);
    }
  }, [projectId]);

  useEffect(() => {
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
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summary: { color: colors.text, fontSize: 14, fontWeight: '600' },
    meta: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  });

  if (!items) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        ListEmptyComponent={
          <Text style={styles.empty}>No activity yet</Text>
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
