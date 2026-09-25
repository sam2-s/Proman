import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Panel } from '../components/Panel';
import { StatusBar } from '../components/StatusBar';
import { Divider, TuiButton } from '../components/Tui';
import { useAuth } from '../context/auth';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

export default function Login() {
  const colors = useTheme();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

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
    links: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    footer: {
      marginTop: spacing.md,
    },
  });

  async function onSubmit() {
    if (!username.trim() || !password) {
      Alert.alert('Missing fields', 'Enter username and password.');
      return;
    }
    setBusy(true);
    try {
      await login(username.trim(), password);
      router.replace('/projects');
    } catch (e) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Try again');
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
      <Text style={styles.tagline}>_ project board terminal _</Text>

      <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
        <Panel title="sign in" accent>
          <View style={styles.field}>
            <Text style={styles.label}>username</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              value={username}
              onChangeText={setUsername}
              placeholder="your-handle"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="********"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={onSubmit}
            />
          </View>

          <TuiButton
            label={busy ? 'signing in...' : 'sign in'}
            variant="primary"
            onPress={onSubmit}
            disabled={busy}
          />

          <View style={styles.links}>
            <Link href="/register" asChild>
              <TuiButton label="new account" variant="ghost" compact />
            </Link>
            <TuiButton label="enter" variant="default" compact onPress={onSubmit} disabled={busy} />
          </View>
        </Panel>

        <View style={styles.footer}>
          <Divider label=" OR " />
        </View>

        <StatusBar
          segments={[
            { text: 'proman v0.1.0' },
            { text: busy ? 'auth...' : 'ready', color: busy ? colors.warning : colors.success },
          ]}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
