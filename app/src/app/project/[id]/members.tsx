import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../../../api/client';
import type { Member, ProjectDetail, Role } from '../../../api/types';
import { Avatar } from '../../../components/Avatar';
import { Panel } from '../../../components/Panel';
import { StatusBar } from '../../../components/StatusBar';
import { Badge, Loading, TuiButton } from '../../../components/Tui';
import { useAuth } from '../../../context/auth';
import { font, spacing } from '../../../theme';
import { useTheme } from '../../../theme/Theme';

const EDITABLE_ROLES: Role[] = ['viewer', 'editor', 'admin'];

export default function MembersScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const { user } = useAuth();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [invite, setInvite] = useState('');
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

  const myRole = detail?.members.find((m) => m.user_id === user?.id)?.role;
  const canManage =
    !!user?.is_admin || myRole === 'owner' || myRole === 'admin';

  async function addMember() {
    if (!invite.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/projects/${projectId}/members`, {
        username: invite.trim(),
        role: 'editor',
      });
      setInvite('');
      await load();
    } catch (e) {
      Alert.alert('Could not add', e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(member: Member, role: Role) {
    if (member.role === role) return;
    try {
      await api.patch(
        `/api/projects/${projectId}/members/${member.user_id}`,
        { role },
      );
      await load();
    } catch (e) {
      Alert.alert('Could not change role', e instanceof Error ? e.message : '');
    }
  }

  function removeMember(member: Member) {
    Alert.alert(`Remove @${member.username}?`, 'They lose access immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.del(`/api/projects/${projectId}/members/${member.user_id}`);
            await load();
          } catch (e) {
            Alert.alert('Could not remove', e instanceof Error ? e.message : '');
          }
        },
      },
    ]);
  }

  if (!detail) {
    return (
      <Loading label="members" />
    );
  }

  const ownerId = detail.project.owner_id;

  return (
    <View style={styles.screen}>
      <FlatList
        data={detail.members}
        keyExtractor={(m) => String(m.user_id)}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <Panel title={detail.project.name} accent>
              <Text style={styles.hint}>
                invite by username — they need a proman account
              </Text>
              {canManage ? (
                <View style={styles.inviteRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="teammate-handle"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={invite}
                    onChangeText={setInvite}
                    onSubmitEditing={addMember}
                  />
                  <TuiButton
                    label={busy ? '...' : 'invite'}
                    variant="primary"
                    compact
                    onPress={addMember}
                    disabled={busy || !invite.trim()}
                  />
                </View>
              ) : (
                <Text style={styles.hint}>[read-only] ask an owner/admin to invite</Text>
              )}
            </Panel>
            <Text style={styles.sectionLabel}>
              members [{detail.members.length}]
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MemberRow
            member={item}
            canManage={canManage}
            protectedRow={item.user_id === ownerId}
            isSelf={item.user_id === user?.id}
            onChangeRole={changeRole}
            onRemove={removeMember}
          />
        )}
      />
      <StatusBar
        segments={[
          { text: 'members' },
          { text: myRole ?? (user?.is_admin ? 'admin' : 'guest'), color: colors.primary, bold: true },
          { text: canManage ? 'can manage' : 'read-only', color: canManage ? colors.success : colors.warning },
        ]}
      />
    </View>
  );
}

function MemberRow({
  member,
  canManage,
  protectedRow,
  isSelf,
  onChangeRole,
  onRemove,
}: {
  member: Member;
  canManage: boolean;
  protectedRow: boolean;
  isSelf: boolean;
  onChangeRole: (m: Member, r: Role) => void;
  onRemove: (m: Member) => void;
}) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const controls = canManage && !protectedRow;
  const roleColor =
    member.role === 'owner' ? colors.primary : member.role === 'admin' ? colors.warning : colors.textSecondary;

  return (
    <Panel style={{ marginBottom: 0 }}>
      <View style={styles.row}>
        <Avatar name={member.name} uri={undefined} size={36} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{member.name}</Text>
            <Badge label={member.role.toUpperCase()} color={roleColor} />
            {isSelf && <Badge label="YOU" color={colors.success} />}
          </View>
          <Text style={styles.handle}>@{member.username}</Text>
          {controls && (
            <View style={styles.roleRow}>
              {EDITABLE_ROLES.map((r) => (
                <TuiButton
                  key={r}
                  label={r}
                  compact
                  variant={member.role === r ? 'primary' : 'ghost'}
                  onPress={() => onChangeRole(member, r)}
                />
              ))}
              <TuiButton
                label="remove"
                compact
                variant="danger"
                onPress={() => onRemove(member)}
              />
            </View>
          )}
        </View>
      </View>
    </Panel>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    hint: {
      fontFamily: font.mono,
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: spacing.sm,
    },
    sectionLabel: {
      fontFamily: font.mono,
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    inviteRow: { flexDirection: 'row', gap: spacing.sm },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      color: colors.text,
      fontFamily: font.mono,
      fontSize: 13,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    name: { fontWeight: '700', color: colors.text, fontSize: 15 },
    handle: { fontFamily: font.mono, color: colors.primary, fontSize: 12, marginTop: 2 },
    roleRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.sm,
      flexWrap: 'wrap',
    },
  });
}
