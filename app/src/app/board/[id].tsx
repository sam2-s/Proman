import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../context/auth';
import { useBoard } from '../hooks/useBoard';
import { useProjectSocket } from '../hooks/useProjectSocket';
import { colors, radius, spacing } from '../theme';
import { TaskCard } from '../../components/TaskCard';

export default function BoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = Number(id);
  const { user } = useAuth();
  const { data, loading, error, reload, applyEvent, moveCard, addCard } =
    useBoard(boardId);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [quickAddCol, setQuickAddCol] = useState<number | null>(null);
  const [quickTitle, setQuickTitle] = useState('');

  const projectId = data?.board.project_id ?? null;
  const { connected } = useProjectSocket(projectId, applyEvent);

  const moveWithin = useCallback(
    async (cardId: number, direction: -1 | 1) => {
      if (!data) return;
      const cols = data.columns;
      let fromIdx = -1;
      let colIdx = -1;
      let cardPos = -1;
      cols.forEach((c, i) => {
        const idx = c.cards.findIndex((x) => x.id === cardId);
        if (idx >= 0) {
          fromIdx = i;
          colIdx = i;
          cardPos = idx;
        }
      });
      if (fromIdx < 0) return;

      const card = cols[fromIdx].cards[cardPos];
      const targetCol = fromIdx + direction;
      if (targetCol >= 0 && targetCol < cols.length) {
        const target = cols[targetCol];
        await moveCard(card, target.column.id, target.cards.length);
      } else {
        // Reorder within same column
        const newPos = cardPos + direction;
        if (newPos < 0 || newPos >= cols[fromIdx].cards.length) return;
        await moveCard(card, cols[fromIdx].column.id, newPos);
      }
    },
    [data, moveCard],
  );

  async function createColumn() {
    if (!newColumnName.trim() || !data) return;
    try {
      await api.post(`/api/boards/${data.board.id}/columns`, {
        name: newColumnName.trim(),
      });
      setNewColumnName('');
      setAddColumnOpen(false);
      await reload();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    }
  }

  async function createCard(columnId: number) {
    if (!quickTitle.trim()) return;
    try {
      await addCard(columnId, quickTitle.trim());
      setQuickTitle('');
      setQuickAddCol(null);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Board not found'}</Text>
        <Pressable onPress={reload} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.boardName}>{data.board.name}</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: connected ? colors.success : colors.textMuted },
              ]}
            />
            <Text style={styles.status}>
              {connected ? 'Live' : 'Offline'} · {user?.name}
            </Text>
          </View>
        </View>
        <View style={styles.toolbarActions}>
          <Pressable
            style={styles.toolBtn}
            onPress={() =>
              router.push(`/project/${projectId}/timeline`)
            }
          >
            <Text style={styles.toolBtnText}>Timeline</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() =>
              router.push(`/project/${projectId}/calendar`)
            }
          >
            <Text style={styles.toolBtnText}>Calendar</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() =>
              router.push(`/project/${projectId}/members`)
            }
          >
            <Text style={styles.toolBtnText}>Team</Text>
          </Pressable>
          <Pressable
            style={[styles.toolBtn, styles.toolBtnPrimary]}
            onPress={() => setAddColumnOpen(true)}
          >
            <Text style={[styles.toolBtnText, { color: '#fff' }]}>+ Column</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={styles.columnsRow}
        showsHorizontalScrollIndicator={false}
      >
        {data.columns.map((col, colIdx) => (
          <View key={col.column.id} style={styles.column}>
            <View style={styles.columnHeader}>
              <Text style={styles.columnTitle}>{col.column.name}</Text>
              <Text style={styles.count}>{col.cards.length}</Text>
            </View>
            <ScrollView
              vertical
              contentContainerStyle={{
                gap: spacing.sm,
                paddingBottom: spacing.md,
              }}
              style={{ maxHeight: 560 }}
            >
              {col.cards.map((card, cardIdx) => (
                <TaskCard
                  key={card.id}
                  card={card}
                  isFirst={colIdx === 0 && cardIdx === 0}
                  isLast={
                    colIdx === data.columns.length - 1 &&
                    cardIdx === col.cards.length - 1
                  }
                  onPress={() => router.push(`/task/${card.id}`)}
                  onMoveLeft={() => moveWithin(card.id, -1)}
                  onMoveRight={() => moveWithin(card.id, 1)}
                />
              ))}
            </ScrollView>
            {quickAddCol === col.column.id ? (
              <View style={styles.quickAdd}>
                <TextInput
                  autoFocus
                  style={styles.quickInput}
                  placeholder="Task title"
                  placeholderTextColor={colors.textMuted}
                  value={quickTitle}
                  onChangeText={setQuickTitle}
                  onSubmitEditing={() => createCard(col.column.id)}
                  onBlur={() => {
                    if (!quickTitle.trim()) setQuickAddCol(null);
                  }}
                />
              </View>
            ) : (
              <Pressable
                style={styles.addCard}
                onPress={() => setQuickAddCol(col.column.id)}
              >
                <Text style={styles.addCardText}>+ Add task</Text>
              </Pressable>
            )}
          </View>
        ))}

        <View style={[styles.column, styles.addColumnCol]}>
          <Pressable onPress={() => setAddColumnOpen(true)}>
            <Text style={styles.addCardText}>+ Add column</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={addColumnOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New column</Text>
            <TextInput
              style={styles.input}
              placeholder="Column name"
              placeholderTextColor={colors.textMuted}
              value={newColumnName}
              onChangeText={setNewColumnName}
              onSubmitEditing={createColumn}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setAddColumnOpen(false)}
                style={styles.btnGhost}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={createColumn} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>Create</Text>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  errorText: { color: colors.textSecondary, paddingHorizontal: spacing.lg, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  boardName: { fontSize: 20, fontWeight: '800', color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 12, color: colors.textSecondary },
  toolbarActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  toolBtnText: { fontSize: 12, fontWeight: '700', color: colors.text },
  columnsRow: { padding: spacing.md, gap: spacing.md, alignItems: 'flex-start' },
  column: {
    width: 270,
    backgroundColor: '#EEF2F7',
    borderRadius: radius.lg,
    padding: spacing.sm,
    minHeight: 200,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  columnTitle: { fontWeight: '800', color: colors.text, fontSize: 14 },
  count: {
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  addCard: { padding: spacing.sm, alignItems: 'center' },
  addCardText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  quickAdd: { padding: spacing.xs },
  quickInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },
  addColumnCol: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    width: 180,
  },
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
    maxWidth: 400,
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
