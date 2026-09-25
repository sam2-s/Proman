import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, API_URL, avatarSrc, getToken } from '../../api/client';
import type {
  Attachment,
  BoardMember,
  Card,
  CardDetail,
  Comment,
  Subtask,
} from '../../api/types';
import { radius, spacing } from '../../theme';
import { useTheme } from '../../theme/Theme';
import { Avatar } from '../../components/Avatar';

export default function TaskScreen() {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = Number(id);

  const [card, setCard] = useState<Card | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, s, cm, a] = await Promise.all([
        api.get<CardDetail>(`/api/cards/${cardId}`),
        api.get<Subtask[]>(`/api/cards/${cardId}/subtasks`),
        api.get<Comment[]>(`/api/cards/${cardId}/comments`),
        api.get<Attachment[]>(`/api/cards/${cardId}/attachments`),
      ]);
      setCard(c.card);
      setMembers(c.members ?? []);
      setSubtasks(s);
      setComments(cm);
      setAttachments(a);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [cardId, setCard]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state updates happen after await
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
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await api.upload(`/api/cards/${cardId}/attachments`, {
        name: asset.name,
        uri: asset.uri,
        type: asset.mimeType ?? 'application/octet-stream',
      });
      await load();
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : '');
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
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const reader = new FileReader();
        reader.onload = async () => {
          // Share via temp path is limited on native; show URL for now
          Alert.alert(
            'Download',
            `${API_URL}/api/attachments/${att.id}\n\nOpen in browser or copy the link.`,
          );
        };
        reader.readAsDataURL(blob);
      } else {
        Alert.alert('Download', `${API_URL}/api/attachments/${att.id}`);
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

        <View style={{ marginTop: spacing.md }}>
          <Text style={styles.label}>Assignee</Text>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => patchCard({ assignee_id: null })}
              style={[
                styles.chip,
                !card.assignee_id && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  !card.assignee_id && { color: '#fff' },
                ]}
              >
                Unassigned
              </Text>
            </Pressable>
            {members.map((m) => (
              <Pressable
                key={m.user_id}
                onPress={() => patchCard({ assignee_id: m.user_id })}
                style={[
                  styles.chip,
                  styles.assigneeChip,
                  card.assignee_id === m.user_id && {
                    backgroundColor: colors.primaryLight,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Avatar
                  name={m.name}
                  uri={avatarSrc(m.avatar_url)}
                  size={20}
                />
                <Text
                  style={[
                    styles.chipText,
                    card.assignee_id === m.user_id && { color: colors.primary },
                  ]}
                >
                  {m.name}
                </Text>
              </Pressable>
            ))}
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

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
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
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
  },
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
}
