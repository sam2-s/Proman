import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../../api/client';
import type { Card } from '../../api/types';
import { useAuth } from '../../context/auth';
import { useBoard } from '../../hooks/useBoard';
import { useDragDrop } from '../../hooks/useDragDrop';
import { useProjectSocket } from '../../hooks/useProjectSocket';
import { radius, spacing } from '../../theme';
import { useTheme } from '../../theme/Theme';
import { DragGhost, TaskCard } from '../../components/TaskCard';

export default function BoardScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = Number(id);
  const { user } = useAuth();
  const { data, loading, error, reload, applyEvent, moveCard, addCard } =
    useBoard(boardId);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [quickAddCol, setQuickAddCol] = useState<number | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [editingCol, setEditingCol] = useState<number | null>(null);
  const [editColName, setEditColName] = useState('');

  const dd = useDragDrop();
  const boardRef = useRef<View>(null);

  const projectId = data?.board.project_id ?? null;
  const { connected } = useProjectSocket(projectId, applyEvent);

  // Keep board-level absolute origin for drop math on native.
  useEffect(() => {
    // no-op placeholder for future measure; layouts registered per column
  }, []);

  const handleDrop = useCallback(
    (cardId: number, absX: number, absY: number) => {
      if (!data) return;
      const targetColId = dd.hitColumn(absX, absY);
      if (targetColId == null) return;

      let fromColIdx = -1;
      let cardPos = -1;
      let card: Card | null = null;
      data.columns.forEach((c, i) => {
        const idx = c.cards.findIndex((x) => x.id === cardId);
        if (idx >= 0) {
          fromColIdx = i;
          cardPos = idx;
          card = c.cards[idx];
        }
      });
      if (!card) return;

      const targetCol = data.columns.find((c) => c.column.id === targetColId);
      if (!targetCol) return;

      const sameCol = targetColId === data.columns[fromColIdx]?.column.id;
      const rawIndex = dd.hitIndex(targetColId, absY, targetCol.cards.length);
      let toPos = rawIndex;
      if (sameCol && toPos > cardPos) toPos = Math.max(cardPos, toPos - 1);

      if (sameCol && toPos === cardPos) return;
      void moveCard(card, targetColId, toPos);
    },
    [data, dd, moveCard],
  );

  const moveWithin = useCallback(
    async (cardId: number, direction: -1 | 1) => {
      if (!data) return;
      const cols = data.columns;
      let fromIdx = -1;
      let cardPos = -1;
      cols.forEach((c, i) => {
        const idx = c.cards.findIndex((x) => x.id === cardId);
        if (idx >= 0) {
          fromIdx = i;
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

  async function renameColumn(columnId: number) {
    const name = editColName.trim();
    if (!name) return;
    try {
      await api.patch(`/api/columns/${columnId}`, { name });
      setEditingCol(null);
      await reload();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    }
  }

  function deleteColumn(columnId: number, name: string) {
    Alert.alert(
      `Delete "${name}"?`,
      'All tasks in this column will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete column',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.del(`/api/columns/${columnId}`);
              await reload();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
            }
          },
        },
      ],
    );
  }

  const memberNameById = (id: number | null): string | null => {
    if (id == null) return null;
    return data?.members?.find((m) => m.user_id === id)?.name ?? null;
  };

  const dragCard: Card | null = useMemoFindCard(data, dd.activeCardId);

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
    <View style={styles.container} ref={boardRef}>
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
              {dd.activeCardId ? ' · dragging' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.toolbarActions}>
          <Pressable
            style={styles.toolBtn}
            onPress={() => router.push(`/project/${projectId}/timeline`)}
          >
            <Text style={styles.toolBtnText}>Timeline</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() => router.push(`/project/${projectId}/calendar`)}
          >
            <Text style={styles.toolBtnText}>Calendar</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() =>
              router.push(`/project/${projectId}/activity`)
            }
          >
            <Text style={styles.toolBtnText}>Activity</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() => router.push(`/project/${projectId}/members`)}
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
        scrollEnabled={dd.activeCardId === null}
      >
        {data.columns.map((col, colIdx) => (
          <View
            key={col.column.id}
            style={[
              styles.column,
              dd.activeCardId !== null && styles.columnDropTarget,
            ]}
            onLayout={(e) => {
              const { x, y, width, height } = e.nativeEvent.layout;
              const node = e.target as unknown as {
                measureInWindow?: (
                  cb: (x: number, y: number, w: number, h: number) => void,
                ) => void;
              };
              if (typeof node?.measureInWindow === 'function') {
                node.measureInWindow((wx, wy, ww, wh) => {
                  dd.registerColumnWindow(col.column.id, wx, wy, ww, wh);
                });
              } else {
                // Web fallback: layout coords relative to scroll container
                dd.registerColumn(col.column.id, {
                  id: col.column.id,
                  left: x,
                  right: x + width,
                  top: y,
                  bottom: y + height,
                });
              }
            }}
          >
            <View style={styles.columnHeader}>
              {editingCol === col.column.id ? (
                <TextInput
                  autoFocus
                  style={styles.colRenameInput}
                  value={editColName}
                  onChangeText={setEditColName}
                  onSubmitEditing={() => renameColumn(col.column.id)}
                  onBlur={() => renameColumn(col.column.id)}
                  placeholder="Column name"
                  placeholderTextColor={colors.textMuted}
                />
              ) : (
                <Pressable
                  style={{ flex: 1 }}
                  onLongPress={() => {
                    setEditingCol(col.column.id);
                    setEditColName(col.column.name);
                  }}
                >
                  <Text style={styles.columnTitle}>{col.column.name}</Text>
                </Pressable>
              )}
              <Text style={styles.count}>{col.cards.length}</Text>
              <Pressable
                onPress={() => {
                  setEditingCol(col.column.id);
                  setEditColName(col.column.name);
                }}
                hitSlop={8}
                style={styles.colAction}
              >
                <Text style={styles.colActionText}>✎</Text>
              </Pressable>
              <Pressable
                onPress={() => deleteColumn(col.column.id, col.column.name)}
                hitSlop={8}
                style={styles.colAction}
              >
                <Text style={[styles.colActionText, { color: colors.danger }]}>
                  ×
                </Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={{
                gap: spacing.sm,
                paddingBottom: spacing.md,
              }}
              style={{ maxHeight: 560 }}
              scrollEnabled={dd.activeCardId === null}
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
                  assigneeName={memberNameById(card.assignee_id)}
                  drag={dd.drag}
                  setDrag={dd.setDrag}
                  onDrop={handleDrop}
                  isDragging={dd.isDragging(card.id)}
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

      {dragCard ? <DragGhost card={dragCard} drag={dd.drag} /> : null}

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

function useMemoFindCard(
  data: { columns: { cards: Card[] }[] } | null,
  cardId: number | null,
): Card | null {
  if (!data || cardId == null) return null;
  for (const col of data.columns) {
    const c = col.cards.find((x) => x.id === cardId);
    if (c) return c;
  }
  return null;
}

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  errorText: {
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
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
  toolBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toolBtnText: { fontSize: 12, fontWeight: '700', color: colors.text },
  columnsRow: {
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'flex-start',
    minHeight: 640,
  },
  column: {
    width: 270,
    backgroundColor: colors.border + '66',
    borderRadius: radius.lg,
    padding: spacing.sm,
    minHeight: 200,
  },
  columnDropTarget: {
    borderWidth: 1,
    borderColor: colors.primary + '44',
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  columnTitle: { fontWeight: '800', color: colors.text, fontSize: 14 },
  colRenameInput: {
    flex: 1,
    fontWeight: '800',
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  colAction: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  colActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
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
  addCardText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
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
}
