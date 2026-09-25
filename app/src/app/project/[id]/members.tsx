import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../../../api/client';
import type { Member, ProjectDetail } from '../../../api/types';
import { radius, spacing } from '../../../theme';
import { useTheme } from '../../../theme/Theme';

export default function MembersScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get<ProjectDetail>(`/api/projects/${projectId}`);
      setDetail(d);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state updates happen after await
    load();
  }, [load]);

  async function addMember() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/projects/${projectId}/members`, {
        email: email.trim(),
        role: 'editor',
      });
      setEmail('');
      await load();
    } catch (e) {
      Alert.alert('Could not add', e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={detail.members}
        keyExtractor={(m) => String(m.user_id)}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        ListHeaderComponent={
          <View>
            <Text style={styles.projectName}>{detail.project.name}</Text>
            <Text style={styles.subtitle}>
              Invite teammates by email — they need a Proman account.
            </Text>
            <View style={styles.inviteRow}>
              <TextInput
                style={styles.input}
                placeholder="teammate@example.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={addMember}
              />
              <Pressable
                onPress={addMember}
                style={[styles.inviteBtn, busy && { opacity: 0.6 }]}
                disabled={busy}
              >
                <Text style={styles.inviteBtnText}>Invite</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionLabel}>Members</Text>
          </View>
        }
        renderItem={({ item }) => (
          <MemberRow member={item} />
        )}
      />
    </View>
  );
}

function MemberRow({ member }: { member: Member }) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const initial = member.name.slice(0, 1).toUpperCase();
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{member.name}</Text>
        <Text style={styles.email}>{member.email}</Text>
      </View>
      <View
        style={[
          styles.role,
          member.role === 'owner' && { backgroundColor: colors.primaryLight },
        ]}
      >
        <Text
          style={[
            styles.roleText,
            member.role === 'owner' && { color: colors.primary },
          ]}
        >
          {member.role}
        </Text>
      </View>
    </View>
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
  projectName: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  inviteRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  inviteBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnText: { color: '#fff', fontWeight: '700' },
  sectionLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  email: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  role: {
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
});
}
