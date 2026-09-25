import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';
import { Panel } from '../components/Panel';
import { StatusBar } from '../components/StatusBar';
import { Badge, TuiButton } from '../components/Tui';
import { useAuth } from '../context/auth';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

interface AdminUser {
  id: number;
  username: string;
  name: string;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  projects: number;
}

export default function AdminScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.get<AdminUser[]>('/api/admin/users');
      setUsers(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state updates happen after await
    load();
  }, [load]);

  async function toggleAdmin(u: AdminUser) {
    try {
      await api.patch(`/api/admin/users/${u.id}`, { is_admin: !u.is_admin });
      await load();
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : '');
    }
  }

  function removeUser(u: AdminUser) {
    Alert.alert(`Delete @${u.username}?`, 'Their projects are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.del(`/api/admin/users/${u.id}`);
            await load();
          } catch (e) {
            Alert.alert('Failed', e instanceof Error ? e.message : '');
          }
        },
      },
    ]);
  }

  if (!user?.is_admin) {
    return (
      <View style={styles.screen}>
        <View style={styles.denied}>
          <Text style={styles.deniedText}>[403] admin access required</Text>
          <TuiButton label="back" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (!users && !error) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <Panel title="error" accent>
            <Text style={styles.err}>{error}</Text>
            <TuiButton label="retry" onPress={load} compact />
          </Panel>
        ) : (
          <Panel title={`users [${users?.length ?? 0}]`} accent>
            {users?.map((u) => (
              <View key={u.id} style={styles.row}>
                <Avatar name={u.name} uri={undefined} size={32} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{u.name}</Text>
                    <Badge
                      label={u.is_admin ? 'ADMIN' : 'USER'}
                      color={u.is_admin ? colors.danger : colors.textMuted}
                    />
                  </View>
                  <Text style={styles.handle}>
                    @{u.username} · {u.projects} project{u.projects === 1 ? '' : 's'} · since{' '}
                    {u.created_at.slice(0, 10)}
                  </Text>
                </View>
                <View style={styles.actions}>
                  {u.id !== user.id && (
                    <>
                      <TuiButton
                        label={u.is_admin ? '- admin' : '+ admin'}
                        compact
                        variant={u.is_admin ? 'danger' : 'default'}
                        onPress={() => toggleAdmin(u)}
                      />
                      <TuiButton
                        label="del"
                        compact
                        variant="danger"
                        onPress={() => removeUser(u)}
                      />
                    </>
                  )}
                </View>
              </View>
            ))}
          </Panel>
        )}
      </ScrollView>
      <StatusBar
        segments={[
          { text: 'admin console' },
          { text: `@${user.username}`, color: colors.primary, bold: true },
          { text: users ? `${users.length} users` : 'loading', color: colors.success },
        ]}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.md, gap: spacing.md },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { color: colors.text, fontWeight: '700', fontSize: 14 },
    handle: { fontFamily: font.mono, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    actions: { flexDirection: 'row', gap: spacing.xs },
    err: { fontFamily: font.mono, color: colors.danger, marginBottom: spacing.sm },
    denied: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    deniedText: {
      fontFamily: font.mono,
      color: colors.danger,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
