import { router } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { useAuth } from '../context/auth';
import { colors, radius, shadow, spacing } from '../theme';

export default function Projects() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

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

  useState(() => {
    load();
  });

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
        <View>
          <Text style={styles.hello}>Hi {user?.name?.split(' ')[0]}</Text>
          <Text style={styles.title}>Your projects</Text>
        </View>
        <Pressable onPress={() => logout()} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptyText}>
              Create your first project to start planning with Kanban boards,
              timelines, and calendars.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.projectCard}
            onPress={() => openProject(item)}
          >
            <View style={styles.projectRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.projectName}>{item.name}</Text>
                <Text style={styles.projectDesc} numberOfLines={1}>
                  {item.description || 'No description'}
                </Text>
              </View>
              {item.role && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{item.role}</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setModalOpen(true)}>
        <Text style={styles.fabText}>+ New project</Text>
      </Pressable>

      <Modal visible={modalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New project</Text>
            <TextInput
              style={styles.input}
              placeholder="Project name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setModalOpen(false)}
                style={styles.btnGhost}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={createProject}
                style={[styles.btnPrimary, busy && { opacity: 0.6 }]}
                disabled={busy}
              >
                <Text style={styles.btnPrimaryText}>
                  {busy ? 'Creating…' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hello: { color: colors.textSecondary, fontSize: 14 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  logoutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  logoutText: { color: colors.danger, fontWeight: '600' },
  projectCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  projectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 18 },
  projectName: { fontSize: 16, fontWeight: '700', color: colors.text },
  projectDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  roleText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 64, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.full,
    ...shadow.card,
  },
  fabText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btnGhost: { padding: 12, borderRadius: radius.md },
  btnGhostText: { color: colors.textSecondary, fontWeight: '600' },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    padding: 12,
    borderRadius: radius.md,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
});
