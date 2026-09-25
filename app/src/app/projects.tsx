import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api/client';
import type { Board, Project } from '../api/types';
import { Avatar } from '../components/Avatar';
import { StatusBar } from '../components/StatusBar';
import { EmptyState, TuiButton } from '../components/Tui';
import { useAuth } from '../context/auth';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

export default function Projects() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const data = await api.get<{ count: number }>(
        '/api/notifications/unread-count',
      );
      setUnread(data.count);
    } catch {
      // ignore; badge stays at last known value
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadUnread();
    }, [loadUnread]),
  );

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.get<Project[]>('/api/projects');
      setProjects(data);
    } catch {
      // ignore; pull-to-refresh will retry
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state updates happen after await
    load();
  }, [load]);

  async function createProject() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const project = await api.post<Project>('/api/projects', {
        name: name.trim(),
        description: description.trim(),
      });
      setModalOpen(false);
      setName('');
      setDescription('');
      // Open the default board
      const boards = await api.get<Board[]>(
        `/api/projects/${project.id}/boards`,
      );
      if (boards[0]) {
        router.push(`/board/${boards[0].id}`);
      } else {
        await load();
      }
    } catch {
      // handled by alert below if needed
    } finally {
      setBusy(false);
    }
  }

  async function openProject(p: Project) {
    const boards = await api.get<Board[]>(`/api/projects/${p.id}/boards`);
    if (boards[0]) router.push(`/board/${boards[0].id}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.path}>~/projects</Text>
          <Text style={styles.title}>your projects [{projects.length}]</Text>
        </View>
        <View style={styles.headerActions}>
          <TuiButton
            label="search"
            compact
            variant="ghost"
            onPress={() => router.push('/search')}
          />
          <TuiButton
            label={unread > 0 ? `alerts (${unread})` : 'alerts'}
            compact
            variant={unread > 0 ? 'primary' : 'ghost'}
            onPress={() => router.push('/notifications')}
          />
          <TuiButton
            label={user ? `@${user.username}` : 'profile'}
            compact
            variant="ghost"
            onPress={() => router.push('/profile')}
          />
          <TuiButton
            label="exit"
            compact
            variant="danger"
            onPress={() => logout()}
          />
        </View>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        ListEmptyComponent={
          <EmptyState
            title="no projects found"
            hint="press [ + new project ] to create your first board, timeline and calendar"
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.projectCard}
            onPress={() => openProject(item)}
          >
            <Avatar name={item.name} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.projectName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.projectDesc} numberOfLines={1}>
                {item.description || 'no description'}
              </Text>
            </View>
            {item.role && (
              <Text style={styles.roleBadge}>[{item.role.toUpperCase()}]</Text>
            )}
            <Text style={styles.openMark}>▸</Text>
          </Pressable>
        )}
      />

      <StatusBar
        segments={[
          { text: projects.length ? `${projects.length} projects` : 'empty' },
          { text: unread ? `${unread} unread` : 'all read', color: unread ? colors.warning : colors.success },
          { text: user ? `@${user.username}` : 'guest', color: colors.primary, bold: true },
        ]}
      />

      <Pressable style={styles.fab} onPress={() => setModalOpen(true)}>
        <Text style={styles.fabText}>[ + new project ]</Text>
      </Pressable>

      <Modal visible={modalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalFrame}>┌─ new project ──────────</Text>
            <TextInput
              style={styles.input}
              placeholder="project name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="description (optional)"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <View style={styles.modalActions}>
              <TuiButton
                label="cancel"
                compact
                variant="ghost"
                onPress={() => setModalOpen(false)}
              />
              <TuiButton
                label={busy ? '...' : 'create'}
                compact
                variant="primary"
                onPress={createProject}
                disabled={busy || !name.trim()}
              />
            </View>
            <Text style={styles.modalFrame}>└─────────────────────────</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    path: {
      fontFamily: font.mono,
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    title: {
      fontFamily: font.mono,
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      textTransform: 'uppercase',
    },
    headerActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      justifyContent: 'flex-end',
    },
    projectCard: {
      backgroundColor: colors.card,
      borderRadius: 0,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    projectName: {
      fontFamily: font.mono,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
    },
    projectDesc: {
      fontFamily: font.mono,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    roleBadge: {
      fontFamily: font.mono,
      fontSize: 10,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 1,
    },
    openMark: { fontFamily: font.mono, color: colors.textMuted, fontSize: 14 },
    empty: { alignItems: 'center', paddingTop: 64, paddingHorizontal: spacing.lg },
    emptyTitle: {
      fontFamily: font.mono,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    emptyText: {
      fontFamily: font.mono,
      textAlign: 'center',
      color: colors.textMuted,
      marginTop: spacing.sm,
      fontSize: 12,
      lineHeight: 18,
    },
    fab: {
      position: 'absolute',
      bottom: 56,
      right: spacing.lg,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    fabText: {
      fontFamily: font.mono,
      color: colors.primary,
      fontWeight: '800',
      fontSize: 13,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.45)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: spacing.lg,
      maxWidth: 440,
      width: '100%',
      alignSelf: 'center',
    },
    modalFrame: {
      fontFamily: font.mono,
      fontSize: 11,
      color: colors.line,
      marginBottom: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 0,
      padding: spacing.md,
      fontFamily: font.mono,
      fontSize: 14,
      color: colors.text,
      marginBottom: spacing.sm,
      backgroundColor: colors.bg,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
  });
}
