import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/AppText';
import { Card } from '../../../src/components/Card';
import { askQuestion, AssistantError } from '../../../src/features/assistant/api';
import {
  AssistantAnswer,
  confidenceNote,
  dedupeCitations,
  formatCitation,
} from '../../../src/features/assistant/citations';
import { colors, radius, spacing, touchTarget, typography } from '../../../src/theme';

interface ChatItem {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  answer?: AssistantAnswer;
}

const SUGGESTIONS = [
  'What is my Aviva pension number?',
  'When does my home insurance expire?',
  'Which documents need action this month?',
  'Show me the last HMRC letter.',
];

export default function AskScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const conversationRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<ChatItem>>(null);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    setItems((prev) => [...prev, { id: Crypto.randomUUID(), role: 'user', text: q }]);
    try {
      const answer = await askQuestion(q, conversationRef.current);
      conversationRef.current = answer.conversationId;
      setItems((prev) => [...prev, { id: Crypto.randomUUID(), role: 'assistant', text: answer.answer, answer }]);
    } catch (err) {
      const message = err instanceof AssistantError ? err.message : 'Something went wrong. Please try again.';
      setItems((prev) => [...prev, { id: Crypto.randomUUID(), role: 'error', text: message }]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.bottom + 48}
    >
      <View style={styles.header}>
        <AppText variant="largeTitle">Ask</AppText>
        <AppText tone="secondary" variant="caption" style={{ marginTop: spacing.xs }}>
          Answers come only from your stored documents, with sources. Nothing is invented.
        </AppText>
      </View>

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.chatContent}
        ListEmptyComponent={
          <View style={{ marginTop: spacing.xl }}>
            <AppText variant="captionMedium" tone="secondary" style={{ marginBottom: spacing.md }}>
              Try asking:
            </AppText>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`Ask: ${s}`}
                onPress={() => void send(s)}
                style={styles.suggestion}
              >
                <Ionicons name="chatbubble-outline" size={16} color={colors.accent} />
                <AppText variant="caption" tone="accent" style={{ flex: 1 }}>
                  {s}
                </AppText>
              </Pressable>
            ))}
          </View>
        }
        renderItem={({ item }) => {
          if (item.role === 'user') {
            return (
              <View style={[styles.bubble, styles.userBubble]}>
                <AppText style={{ color: colors.onAccent }}>{item.text}</AppText>
              </View>
            );
          }
          if (item.role === 'error') {
            return (
              <View style={[styles.bubble, styles.errorBubble]} accessibilityLiveRegion="polite">
                <AppText tone="danger" variant="caption">
                  {item.text}
                </AppText>
              </View>
            );
          }
          const note = item.answer ? confidenceNote(item.answer.confidence) : null;
          const citations = item.answer ? dedupeCitations(item.answer.citations) : [];
          return (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <AppText>{item.text}</AppText>
              {note ? (
                <View style={styles.confidenceNote}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
                  <AppText variant="caption" style={{ color: colors.warning, flex: 1 }}>
                    {note}
                  </AppText>
                </View>
              ) : null}
              {citations.map((c) => (
                <Card key={`${c.documentId}:${c.pageNumber ?? ''}`} style={styles.citationCard}>
                  <AppText variant="caption" tone="secondary">
                    {formatCitation(c)}
                  </AppText>
                  {c.quote ? (
                    <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs, fontStyle: 'italic' }}>
                      “{c.quote}”
                    </AppText>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View document ${c.title}`}
                    onPress={() => router.push(`/document/${c.documentId}`)}
                    style={styles.viewDocButton}
                  >
                    <Ionicons name="open-outline" size={14} color={colors.accent} />
                    <AppText variant="captionMedium" tone="accent">
                      View document
                    </AppText>
                  </Pressable>
                </Card>
              ))}
            </View>
          );
        }}
        ListFooterComponent={
          busy ? (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <AppText tone="muted" variant="caption">
                Checking your documents…
              </AppText>
            </View>
          ) : null
        }
      />

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TextInput
          accessibilityLabel="Ask a question about your documents"
          placeholder="Ask about your paperwork…"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => void send(input)}
          returnKeyType="send"
          style={styles.input}
          editable={!busy}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send question"
          accessibilityState={{ disabled: busy || !input.trim() }}
          onPress={() => void send(input)}
          disabled={busy || !input.trim()}
          style={[styles.sendButton, (busy || !input.trim()) && { opacity: 0.4 }]}
        >
          <Ionicons name="arrow-up" size={20} color={colors.onAccent} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  chatContent: { padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: touchTarget,
  },
  bubble: { borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, maxWidth: '92%' },
  userBubble: { backgroundColor: colors.accent, alignSelf: 'flex-end', borderBottomRightRadius: radius.sm },
  assistantBubble: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  errorBubble: { backgroundColor: colors.dangerSoft, alignSelf: 'flex-start' },
  confidenceNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  citationCard: { marginTop: spacing.md, padding: spacing.md },
  viewDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    minHeight: 32,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    minHeight: touchTarget,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
