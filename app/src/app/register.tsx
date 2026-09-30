import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Panel } from '../components/Panel';
import { StatusBar } from '../components/StatusBar';
import { TuiButton } from '../components/Tui';
import { useAuth } from '../context/auth';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

export default function Register() {
  const colors = useTheme();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    banner: {
      fontFamily: font.mono,
      fontSize: 28,
      fontWeight: '800',
      color: colors.primary,
      textAlign: 'center',
      letterSpacing: 4,
      marginBottom: spacing.xs,
    },
    tagline: {
      fontFamily: font.mono,
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      letterSpacing: 1,
      marginBottom: spacing.lg,
    },
    field: {
      marginBottom: spacing.md,
    },
    label: {
      fontFamily: font.mono,
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontFamily: font.mono,
      fontSize: 14,
      color: colors.text,
    },
    hint: {
      fontFamily: font.mono,
      fontSize: 10,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    footer: {
      marginTop: spacing.md,
    },
    error: {
      fontFamily: font.mono,
      fontSize: 11,
      color: colors.danger,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
  });

  async function onSubmit() {
    setError(null);
    if (!name.trim() || !username.trim() || password.length < 8) {
      setError('name, username, and a password of 8+ characters are required');
      return;
    }
    setBusy(true);
    try {
      await register(name.trim(), username.trim(), password);
      router.replace('/projects');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.banner}>PROMAN</Text>
      <Text style={styles.tagline}>_ new operator registration _</Text>

      <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
        <Panel title="create account" accent>
          <View style={styles.field}>
            <Text style={styles.label}>display name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ada Lovelace"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>username</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              placeholder="your-handle"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.hint}>3-32 chars: a-z 0-9 _ - only</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="at least 8 characters"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={onSubmit}
            />
          </View>

          <TuiButton
            label={busy ? 'creating...' : 'create account'}
            variant="primary"
            onPress={onSubmit}
            disabled={busy}
          />

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <View style={{ marginTop: spacing.md }}>
            <Link href="/login" asChild>
              <TuiButton label="back to sign in" variant="ghost" compact />
            </Link>
          </View>
        </Panel>

        <View style={styles.footer}>
          <StatusBar
            segments={[
              { text: 'proman v0.1.0' },
              { text: busy ? 'registering...' : 'ready', color: busy ? colors.warning : colors.success },
            ]}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
