import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, API_URL, getToken } from '../../api/client';
import type { Attachment, Card, Comment, Subtask } from '../../api/types';
import { colors, radius, spacing } from '../../theme';

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = Number(id);

  const [card, setCard] = useState<Card | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, s, cm, a] = await Promise.all([
        api.get<{ card: Card }>(`/api/cards/${cardId}`),
        api.get<Subtask[]>(`/api/cards/${cardId}/subtasks`),
        api.get<Comment[]>(`/api/cards/${cardId}/comments`),
        api.get<Attachment[]>(`/api/cards/${cardId}/attachments`),
      ]);
      setCard(c.card);
      setSubtasks(s);
      setComments(cm);
      setAttachments(a);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    load();
  }, [load]);

  async function patchCard(body: Partial<Card>) {
    if (!card) return;
    try {
      const updated = await api.patch<Card>(`/api/cards/${card.id}`, body);
      setCard(updated);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function addSubtask() {
    if (!newSubtask.trim()) return;
    await api.post(`/api/cards/${cardId}/subtasks`, {
      title: newSubtask.trim(),
    });
    setNewSubtask('');
    await load();
  }

  async function toggleSubtask(s: Subtask) {
    await api.patch(`/api/subtasks/${s.id}`, { done: s.done === 0 });
    await load();
  }

  async function addComment() {
    if (!newComment.trim()) return;
    await api.post(`/api/cards/${cardId}/comments`, {
      body: newComment.trim(),
    });
    setNewComment('');
    await load();
  }

  async function deleteCard() {
    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.del(`/api/cards/${cardId}`);
          router.back();
        },
      },
    ]);
  }

  async function pickAndUpload() {
    // Document picker would go here; use a simple prompt-free path with
    // expo-image-picker style input when available. For now, allow web file input.
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const uri = URL.createObjectURL(file);
        try {
          await api.upload(`/api/cards/${cardId}/attachments`, {
            name: file.name,
            uri,
            type: file.type,
          });
          await load();
        } catch (e) {
          Alert.alert('Upload failed', e instanceof Error ? e.message : '');
        }
      };
      input.click();
    } else {
      Alert.alert(
        'Attachments',
        'On mobile, attach files from the web app or add expo-image-picker later.',
      );
    }
  }

  async function downloadAttachment(att: Attachment) {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/attachments/${att.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const blob = await res.blob();
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = att.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      Alert.alert('Download failed');
    }
  }

  if (loading || !card) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const doneCount = subtasks.filter((s) => s.done).length;
  const priorityColor =
    colors.priority[card.priority as keyof typeof colors.priority] ??
    colors.priority.medium;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
        <View style={styles.headerRow}>
          <View style={[styles.priorityChip, { backgroundColor: priorityColor + '22' }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {card.priority}
            </Text>
          </View>
          <Pressable onPress={deleteCard} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.titleInput}
          value={card.title}
          onChangeText={(t) => setCard({ ...card, title: t })}
          onBlur={() => patchCard({ title: card.title })}
          multiline
          placeholder="Task title"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.descInput}
          value={card.description}
          onChangeText={(t) => setCard({ ...card, description: t })}
          onBlur={() => patchCard({ description: card.description })}
          multiline
          placeholder="Add a description…"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Priority</Text>
            <View style={styles.chipRow}>
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => patchCard({ priority: p })}
                  style={[
                    styles.chip,
                    card.priority === p && {
                      backgroundColor: colors.priority[p],
                      borderColor: colors.priority[p],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      card.priority === p && { color: '#fff' },
                    ]}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Start date</Text>
            <TextInput
              style={styles.dateInput}
              value={card.start_date ?? ''}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              onChangeText={(t) => setCard({ ...card, start_date: t || null })}
              onBlur={() => patchCard({ start_date: card.start_date || null })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Due date</Text>
            <TextInput
              style={styles.dateInput}
              value={card.due_date ?? ''}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              onChangeText={(t) => setCard({ ...card, due_date: t || null })}
              onBlur={() => patchCard({ due_date: card.due_date || null })}
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Subtasks {doneCount}/{subtasks.length}
          </Text>
        </View>
        {subtasks.map((s) => (
          <Pressable
            key={s.id}
            style={styles.subtaskRow}
            onPress={() => toggleSubtask(s)}
          >
            <View style={[styles.checkbox, !!s.done && styles.checkboxDone]}>
              {s.done ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text
              style={[styles.subtaskText, !!s.done && styles.subtaskDone]}
            >
              {s.title}
            </Text>
          </Pressable>
        ))}
        <View style={styles.inlineAdd}>
          <TextInput
            style={styles.inlineInput}
            placeholder="Add subtask"
            placeholderTextColor={colors.textMuted}
            value={newSubtask}
            onChangeText={setNewSubtask}
            onSubmitEditing={addSubtask}
          />
          <Pressable onPress={addSubtask} style={styles.inlineBtn}>
            <Text style={styles.inlineBtnText}>Add</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Attachments</Text>
        <Pressable onPress={pickAndUpload} style={styles.attachBtn}>
          <Text style={styles.attachBtnText}>+ Upload file</Text>
        </Pressable>
        {attachments.map((a) => (
          <Pressable
            key={a.id}
            style={styles.attachmentRow}
            onPress={() => downloadAttachment(a)}
          >
            <Text style={styles.attachmentName} numberOfLines={1}>
              {a.filename}
            </Text>
            <Text style={styles.attachmentSize}>
              {(a.size / 1024).toFixed(1)} KB
            </Text>
          </Pressable>
        ))}

        <Text style={styles.sectionTitle}>Comments</Text>
        {comments.map((c) => (
          <View key={c.id} style={styles.comment}>
            <Text style={styles.commentAuthor}>{c.author_name}</Text>
            <Text style={styles.commentBody}>{c.body}</Text>
            <Text style={styles.commentTime}>{c.created_at}</Text>
          </View>
        ))}
        <View style={styles.inlineAdd}>
          <TextInput
            style={styles.inlineInput}
            placeholder="Write a comment…"
            placeholderTextColor={colors.textMuted}
            value={newComment}
            onChangeText={setNewComment}
            onSubmitEditing={addComment}
          />
          <Pressable onPress={addComment} style={styles.inlineBtn}>
            <Text style={styles.inlineBtnText}>Send</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  priorityText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  titleInput: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.sm,
    padding: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  descInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    minHeight: 80,
    textAlignVertical: 'top',
    color: colors.text,
    fontSize: 14,
  },
  row2: { flexDirection: 'row', gap: spacing.sm },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  dateInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    color: colors.text,
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  check: { color: '#fff', fontSize: 12, fontWeight: '800' },
  subtaskText: { fontSize: 14, color: colors.text, flex: 1 },
  subtaskDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  inlineAdd: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  inlineInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  inlineBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  attachBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  attachBtnText: { color: colors.primary, fontWeight: '700' },
  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachmentName: { color: colors.text, fontWeight: '600', flex: 1, fontSize: 13 },
  attachmentSize: { color: colors.textMuted, fontSize: 12 },
  comment: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentAuthor: { fontWeight: '700', fontSize: 13, color: colors.text },
  commentBody: { fontSize: 14, color: colors.text, marginTop: 4 },
  commentTime: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
});
