import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, avatarSrc } from '../api/client';
import { Avatar } from '../components/Avatar';
import { Panel } from '../components/Panel';
import { StatusBar } from '../components/StatusBar';
import { TuiButton } from '../components/Tui';
import { useAuth } from '../context/auth';
import { font, spacing } from '../theme';
import { useTheme, useThemeControls, type ThemePref } from '../theme/Theme';

const THEME_OPTIONS: { key: ThemePref; label: string }[] = [
  { key: 'dark', label: 'dark' },
  { key: 'light', label: 'light' },
  { key: 'system', label: 'system' },
];

export default function ProfileScreen() {
  const colors = useTheme();
  const { user, logout, refresh } = useAuth();
  const { pref, setPref } = useThemeControls();
  const [uploading, setUploading] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delBusy, setDelBusy] = useState(false);

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.md, gap: spacing.md },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    name: {
      fontFamily: font.mono,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    handle: {
      fontFamily: font.mono,
      fontSize: 13,
      color: colors.primary,
      marginTop: 2,
    },
    meta: {
      fontFamily: font.mono,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
    },
    sectionLabel: {
      fontFamily: font.mono,
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    badgeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    input: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 0,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      color: colors.text,
      fontFamily: font.mono,
      fontSize: 13,
    },
    errorText: {
      fontFamily: font.mono,
      color: colors.danger,
      fontSize: 11,
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
      borderColor: colors.danger,
      padding: spacing.lg,
      maxWidth: 400,
      width: '100%',
      alignSelf: 'center',
    },
    modalFrame: {
      fontFamily: font.mono,
      fontSize: 11,
      color: colors.line,
      marginBottom: spacing.sm,
    },
    modalHint: {
      fontFamily: font.mono,
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: spacing.md,
    },
  });

  async function changeAvatar() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      setUploading(true);
      await api.upload('/api/me/avatar', {
        name: asset.name ?? 'avatar',
        uri: asset.uri,
        type: asset.mimeType ?? 'image/png',
      });
      await refresh();
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : '');
    } finally {
      setUploading(false);
    }
  }

  async function changePassword() {
    setPwError(null);
    if (newPw.length < 8) {
      setPwError('new password must be at least 8 characters');
      return;
    }
    setPwBusy(true);
    try {
      await api.post('/api/me/password', {
        current_password: currentPw,
        new_password: newPw,
      });
      setPwOpen(false);
      setCurrentPw('');
      setNewPw('');
      Alert.alert('Password updated');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'failed');
    } finally {
      setPwBusy(false);
    }
  }

  function deleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently removes your account, projects you own, and all your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDelPw('');
            setDelOpen(true);
          },
        },
      ],
    );
  }

  async function confirmDelete() {
    setDelBusy(true);
    try {
      await api.del('/api/me', { password: delPw });
      setDelOpen(false);
      await logout();
      router.replace('/login');
    } catch (e) {
      Alert.alert('Deletion failed', e instanceof Error ? e.message : '');
    } finally {
      setDelBusy(false);
    }
  }

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  if (!user) return null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Panel title="operator" accent>
          <View style={styles.identity}>
            <Avatar name={user.name} uri={avatarSrc(user.avatar_url)} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.handle}>@{user.username}</Text>
              {user.created_at ? (
                <Text style={styles.meta}>since {user.created_at.slice(0, 10)}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.badgeRow}>
            {user.is_admin ? <Text style={[styles.meta, { color: colors.danger }]}>[ADMIN]</Text> : null}
          </View>
          <View style={{ marginTop: spacing.md }}>
            <TuiButton
              label={uploading ? 'uploading...' : 'change avatar'}
              onPress={changeAvatar}
              disabled={uploading}
              compact
            />
          </View>
        </Panel>

        <Panel title="theme">
          <Text style={styles.sectionLabel}>palette</Text>
          <View style={styles.row}>
            {THEME_OPTIONS.map((opt) => (
              <TuiButton
                key={opt.key}
                label={opt.label}
                variant={pref === opt.key ? 'primary' : 'default'}
                onPress={() => setPref(opt.key)}
                compact
              />
            ))}
          </View>
          <Text style={styles.meta}>
            current: {pref} — toggle switches terminal/paper instantly
          </Text>
        </Panel>

        <Panel title="security">
          <Text style={styles.sectionLabel}>password</Text>
          {pwOpen ? (
            <View style={{ gap: spacing.sm }}>
              <TextInput
                style={styles.input}
                placeholder="current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={currentPw}
                onChangeText={setCurrentPw}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="new password (8+ chars)"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={newPw}
                onChangeText={setNewPw}
                autoCapitalize="none"
              />
              {pwError ? <Text style={styles.errorText}>{pwError}</Text> : null}
              <View style={styles.row}>
                <TuiButton
                  label={pwBusy ? '...' : 'save'}
                  variant="primary"
                  compact
                  onPress={changePassword}
                  disabled={pwBusy || !currentPw || !newPw}
                />
                <TuiButton
                  label="cancel"
                  variant="ghost"
                  compact
                  onPress={() => {
                    setPwOpen(false);
                    setPwError(null);
                  }}
                />
              </View>
            </View>
          ) : (
            <TuiButton
              label="change password"
              variant="default"
              compact
              onPress={() => setPwOpen(true)}
            />
          )}
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.sectionLabel}>danger zone</Text>
            <TuiButton
              label="delete account"
              variant="danger"
              compact
              onPress={deleteAccount}
            />
          </View>
        </Panel>

        <Panel title="session">
          <TuiButton label="log out" variant="danger" onPress={onLogout} />
        </Panel>

        {user.is_admin && (
          <Panel title="admin" accent>
            <TuiButton
              label="open admin console"
              variant="primary"
              onPress={() => router.push('/admin')}
            />
          </Panel>
        )}
      </ScrollView>

      <StatusBar
        segments={[
          { text: 'profile' },
          { text: `@${user.username}`, color: colors.primary, bold: true },
          { text: pref },
        ]}
      />

      {delOpen && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalFrame}>┌─ confirm deletion ──────────</Text>
            <Text style={styles.modalHint}>
              enter your password to permanently delete your account
            </Text>
            <TextInput
              style={styles.input}
              placeholder="password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={delPw}
              onChangeText={setDelPw}
              autoCapitalize="none"
            />
            <View style={styles.row}>
              <TuiButton
                label="cancel"
                variant="ghost"
                compact
                onPress={() => setDelOpen(false)}
              />
              <TuiButton
                label={delBusy ? '...' : 'delete forever'}
                variant="danger"
                compact
                onPress={confirmDelete}
                disabled={delBusy || !delPw}
              />
            </View>
            <Text style={styles.modalFrame}>└────────────────────────────</Text>
          </View>
        </View>
      )}
    </View>
  );
}
