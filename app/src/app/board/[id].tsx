import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { Loading } from '../../components/Tui';
import { api } from '../../api/client';
import type { Card } from '../../api/types';
import { useAuth } from '../../context/auth';
import { useBoard } from '../../hooks/useBoard';
import { useDragDrop } from '../../hooks/useDragDrop';
import { useProjectSocket } from '../../hooks/useProjectSocket';
import { font, spacing } from '../../theme';
import { useTheme } from '../../theme/Theme';
import { DragGhost, TaskCard } from '../../components/TaskCard';
import { HelpOverlay } from '../../components/HelpOverlay';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

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
  const [selected, setSelected] = useState<{ col: number; card: number } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const dd = useDragDrop();
  const boardRef = useRef<View>(null);

  const projectId = data?.board.project_id ?? null;
  const { connected } = useProjectSocket(projectId, applyEvent);

  // Viewer = read-only; global admins can edit anywhere.
  const myRole = data?.members?.find((m) => m.user_id === user?.id)?.role;
  const canEdit = !!user?.is_admin || (myRole !== undefined && myRole !== 'viewer');

  // Keep board-level absolute origin for drop math on native.
  useEffect(() => {
    // no-op placeholder for future measure; layouts registered per column
  }, []);

  const handleDrop = useCallback(
    (cardId: number, absX: number, absY: number) => {
      if (!data || !canEdit) return;
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
    [data, dd, moveCard, canEdit],
  );

  const moveWithin = useCallback(
    async (cardId: number, direction: -1 | 1) => {
      if (!data || !canEdit) return;
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
    [data, moveCard, canEdit],
  );

  async function createColumn() {
    if (!canEdit || !newColumnName.trim() || !data) return;
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
    if (!canEdit || !quickTitle.trim()) return;
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
    if (!canEdit || !name) return;
    try {
      await api.patch(`/api/columns/${columnId}`, { name });
      setEditingCol(null);
      await reload();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    }
  }

  function deleteColumn(columnId: number, name: string) {
    if (!canEdit) return;
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

  useKeyboardShortcuts({
    '?': () => setHelpOpen((v) => !v),
    '/': () => router.push('/search'),
    n: () => {
      if (canEdit && data?.columns[0]) setQuickAddCol(data.columns[0].column.id);
    },
    c: () => {
      if (canEdit) setAddColumnOpen(true);
    },
    Escape: () => {
      setHelpOpen(false);
      setAddColumnOpen(false);
      setQuickAddCol(null);
      setEditingCol(null);
      setSelected(null);
    },
    j: () => {
      if (!data) return;
      setSelected((prev) => {
        if (!prev) return { col: 0, card: 0 };
        const next = Math.min(prev.card + 1, data.columns[prev.col].cards.length - 1);
        return { col: prev.col, card: next };
      });
    },
    k: () => {
      if (!data) return;
      setSelected((prev) => {
        if (!prev) return { col: 0, card: 0 };
        const next = Math.max(prev.card - 1, 0);
        return { col: prev.col, card: next };
      });
    },
    h: () => {
      if (!data) return;
      setSelected((prev) => {
        if (!prev) return { col: 0, card: 0 };
        const next = Math.max(prev.col - 1, 0);
        return { col: next, card: 0 };
      });
    },
    l: () => {
      if (!data) return;
      setSelected((prev) => {
        if (!prev) return { col: 0, card: 0 };
        const next = Math.min(prev.col + 1, data.columns.length - 1);
        return { col: next, card: 0 };
      });
    },
    Enter: () => {
      if (!data || !selected) return;
      const card = data.columns[selected.col]?.cards[selected.card];
      if (card) router.push(`/task/${card.id}`);
    },
  });

  async function exportProject() {
    if (!projectId) return;
    try {
      const dump = await api.get<unknown>(
        `/api/projects/${projectId}/export`,
      );
      const json = JSON.stringify(dump, null, 2);
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-${projectId}-export.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(`data:application/json;base64,${btoa(json)}`, {
            mimeType: 'application/json',
            dialogTitle: 'Export project',
          });
        }
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : '');
    }
  }

  const dragCard: Card | null = useMemoFindCard(data, dd.activeCardId);

  if (loading) {
    return (
      <Loading label="board" />
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Board not found'}</Text>
        <Pressable onPress={reload} style={styles.retryBtn}>
          <Text style={styles.retryText}>[ retry ]</Text>
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
              {connected ? '[LIVE]' : '[OFFLINE]'} {user?.name}
              {myRole ? ` · ${myRole}` : user?.is_admin ? ' · admin' : ''}
              {!canEdit ? ' · read-only' : ''}
              {dd.activeCardId ? ' · dragging' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.toolbarActions}>
          <Pressable
            style={styles.toolBtn}
            onPress={() => router.push(`/project/${projectId}/timeline`)}
          >
            <Text style={styles.toolBtnText}>[ timeline ]</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() => router.push(`/project/${projectId}/calendar`)}
          >
            <Text style={styles.toolBtnText}>[ calendar ]</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() =>
              router.push(`/project/${projectId}/activity`)
            }
          >
            <Text style={styles.toolBtnText}>[ activity ]</Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() => router.push(`/project/${projectId}/members`)}
          >
            <Text style={styles.toolBtnText}>[ team ]</Text>
          </Pressable>
          <Pressable style={styles.toolBtn} onPress={exportProject}>
            <Text style={styles.toolBtnText}>[ export ]</Text>
          </Pressable>
          <Pressable style={styles.toolBtn} onPress={() => setHelpOpen(true)}>
            <Text style={styles.toolBtnText}>[ ? ]</Text>
          </Pressable>
          {canEdit && (
            <Pressable
              style={[styles.toolBtn, styles.toolBtnPrimary]}
              onPress={() => setAddColumnOpen(true)}
            >
              <Text style={[styles.toolBtnText, { color: '#fff' }]}>[ + column ]</Text>
            </Pressable>
          )}
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
                  onLongPress={
                    canEdit
                      ? () => {
                          setEditingCol(col.column.id);
                          setEditColName(col.column.name);
                        }
                      : undefined
                  }
                >
                  <Text style={styles.columnTitle} numberOfLines={1}>
                    {`┌─ ${col.column.name.toUpperCase()}`}
                  </Text>
                </Pressable>
              )}
              <Text style={styles.count}>{col.cards.length}</Text>
              {canEdit && (
                <>
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
                </>
              )}
            </View>
            <ScrollView
              contentContainerStyle={{
                gap: spacing.sm,
                paddingBottom: spacing.md,
                flexGrow: 1,
              }}
              style={{ flex: 1 }}
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
                  onMoveLeft={canEdit ? () => moveWithin(card.id, -1) : undefined}
                  onMoveRight={canEdit ? () => moveWithin(card.id, 1) : undefined}
                  assigneeName={memberNameById(card.assignee_id)}
                  drag={dd.drag}
                  setDrag={dd.setDrag}
                  onDrop={handleDrop}
                  isDragging={dd.isDragging(card.id)}
                  draggable={canEdit}
                  selected={selected?.col === colIdx && selected?.card === cardIdx}
                />
              ))}
            </ScrollView>
            {canEdit &&
              (quickAddCol === col.column.id ? (
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
                  <Text style={styles.addCardText}>[ + add task ]</Text>
                </Pressable>
              ))}
          </View>
        ))}

        {canEdit && (
          <View style={[styles.column, styles.addColumnCol]}>
            <Pressable onPress={() => setAddColumnOpen(true)}>
              <Text style={styles.addCardText}>[ + column ]</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {dragCard ? <DragGhost card={dragCard} drag={dd.drag} /> : null}

      <HelpOverlay visible={helpOpen} onClose={() => setHelpOpen(false)} />

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
                <Text style={styles.btnGhostText}>[ cancel ]</Text>
              </Pressable>
              <Pressable onPress={createColumn} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>[ create ]</Text>
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
    fontFamily: font.mono,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryText: { fontFamily: font.mono, color: colors.primary, fontWeight: '700' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  boardName: {
    fontFamily: font.mono,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 0 },
  status: { fontFamily: font.mono, fontSize: 11, color: colors.textSecondary },
  toolbarActions: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  toolBtn: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 0,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  toolBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toolBtnText: {
    fontFamily: font.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
  },
  columnsRow: {
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'stretch',
    flexGrow: 1,
  },
  column: {
    width: 270,
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.sm,
    minHeight: 200,
  },
  columnDropTarget: {
    borderColor: colors.primary,
    backgroundColor: colors.selection,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: spacing.sm,
  },
  columnTitle: {
    fontFamily: font.mono,
    fontWeight: '700',
    color: colors.text,
    fontSize: 12,
    flexShrink: 1,
  },
  colRenameInput: {
    flex: 1,
    fontFamily: font.mono,
    fontWeight: '700',
    color: colors.text,
    fontSize: 12,
    backgroundColor: colors.bg,
    borderRadius: 0,
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
    fontFamily: font.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  count: {
    fontFamily: font.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  addCard: { padding: spacing.sm, alignItems: 'center' },
  addCardText: {
    fontFamily: font.mono,
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  quickAdd: { padding: spacing.xs },
  quickInput: {
    backgroundColor: colors.bg,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.sm,
    fontFamily: font.mono,
    fontSize: 14,
    color: colors.text,
  },
  addColumnCol: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
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
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.lg,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    fontFamily: font.mono,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: spacing.md,
    fontFamily: font.mono,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
    marginBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btnGhost: { padding: 12, borderRadius: 0 },
  btnGhostText: { fontFamily: font.mono, color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    padding: 12,
    borderRadius: 0,
  },
  btnPrimaryText: { fontFamily: font.mono, color: '#fff', fontWeight: '700' },
});
}
