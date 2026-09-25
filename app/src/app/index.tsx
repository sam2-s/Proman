import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/auth';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

export default function Index() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.banner}>┌───────────┐</Text>
        <Text style={styles.word}>│ PROMAN v0.1│</Text>
        <Text style={styles.banner}>└───────────┘</Text>
        <Text style={styles.boot}>booting…</Text>
      </View>
    );
  }

  return user ? <Redirect href="/projects" /> : <Redirect href="/login" />;
}

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
      gap: 2,
    },
    banner: { fontFamily: font.mono, color: colors.line, fontSize: 14 },
    word: {
      fontFamily: font.mono,
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    boot: {
      fontFamily: font.mono,
      color: colors.textMuted,
      fontSize: 11,
      marginTop: spacing.sm,
    },
  });
}
