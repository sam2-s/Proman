import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'j / k', desc: 'move selection down / up' },
  { keys: 'h / l', desc: 'move selection left / right' },
  { keys: 'enter', desc: 'open selected task' },
  { keys: '/', desc: 'focus search' },
  { keys: 'n', desc: 'new task in first column' },
  { keys: 'c', desc: 'new column' },
  { keys: 'esc', desc: 'close dialogs / clear selection' },
  { keys: '?', desc: 'toggle this help' },
];

export function HelpOverlay({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useTheme();
  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.box}>
          <Text style={styles.frame}>┌─ keyboard shortcuts ──────────</Text>
          <ScrollView>
            {SHORTCUTS.map((s) => (
              <View key={s.keys} style={styles.row}>
                <Text style={styles.keys}>{s.keys}</Text>
                <Text style={styles.desc}>{s.desc}</Text>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.frame}>└──────────────────────────────</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.45)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    box: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: spacing.lg,
      maxWidth: 420,
      width: '100%',
      alignSelf: 'center',
    },
    frame: {
      fontFamily: font.mono,
      fontSize: 11,
      color: colors.line,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingVertical: 4,
    },
    keys: {
      fontFamily: font.mono,
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      width: 80,
    },
    desc: {
      fontFamily: font.mono,
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
    },
  });
}
