import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/auth';
import { useTheme } from '../theme/Theme';
import { radius, spacing } from '../theme';

export default function Login() {
  const colors = useTheme();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
    },
    logo: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.primary,
      textAlign: 'center',
    },
    subtitle: {
      textAlign: 'center',
      color: colors.textSecondary,
      marginBottom: spacing.lg,
      marginTop: spacing.xs,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.card,
      marginBottom: spacing.md,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    linkWrap: { marginTop: spacing.md, alignItems: 'center' },
    link: { color: colors.textSecondary, fontSize: 14 },
    linkBold: { color: colors.primary, fontWeight: '700' },
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>Proman</Text>
        <Text style={styles.subtitle}>Sign in to your workspace</Text>

        <Text style={styles.label}>Username</Text>
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

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={onSubmit}
        />

        <Pressable
          style={[styles.button, busy && { opacity: 0.6 }]}
          onPress={onSubmit}
          disabled={busy}
        >
          <Text style={styles.buttonText}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>

        <Link href="/register" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.link}>
              New here? <Text style={styles.linkBold}>Create an account</Text>
            </Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
