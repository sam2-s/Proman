import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
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

        <Panel title="session">
          <TuiButton label="log out" variant="danger" onPress={onLogout} />
        </Panel>
      </ScrollView>

      <StatusBar
        segments={[
          { text: 'profile' },
          { text: `@${user.username}`, color: colors.primary, bold: true },
          { text: pref },
        ]}
      />
    </View>
  );
}
