import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Cancel20Icon, Gif24Icon, PaperPlaneTilt24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { ComposerSlot } from "@/components/ui/composerSlot";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { MentionCountLabel, MentionSuggestionList } from "@/components/mentions/mentionSuggestionList";
import { useMentionComposer } from "@/components/mentions/mentionComposer.hook";
import type { Comment } from "@/types";
import { QuotedPostCard } from "@/components/feed/quotedPostCard";
import { useQuotedPostPreview } from "@/components/feed/quotedPostPreview.hook";
import type { CommentQuoteOptions } from "./commentThreadController.hook";
import type { MentionEntity } from "@/types/mention.type";
import { shiftMentionsAfterTrimmingStart } from "@/utils/mentions.util";
import { hasSendableContent } from "@/utils/sendableContent.util";

export const QUICK_REACTION_EMOJI = ["😂", "😍", "💕", "😊", "🥰", "😆", "😎", "🤔"] as const;

export interface CommentComposerProps {
  readonly myAvatarUrl: string | null;
  readonly onSubmit: (text: string, mentions: readonly MentionEntity[], quote?: CommentQuoteOptions) => void;
  readonly placeholder?: string;
  readonly replyTarget?: Comment | null;
  readonly onCancelReply?: () => void;
  readonly avoidKeyboard?: boolean;
}

export const CommentComposer = forwardRef<TextInput, CommentComposerProps>(function CommentComposer(
  { myAvatarUrl, onSubmit, placeholder = "Add comment...", replyTarget, onCancelReply, avoidKeyboard = true },
  ref,
) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<readonly MentionEntity[]>([]);
  const inputRef = useRef<TextInput>(null);
  const mentionComposer = useMentionComposer({
    surface: "comment",
    text,
    mentions,
    inputRef,
    signInReason: "comment",
    onChange: (nextText, nextMentions) => {
      setText(nextText);
      setMentions(nextMentions);
    },
  });
  const quote = useQuotedPostPreview(text);
  useImperativeHandle(ref, () => inputRef.current as TextInput);

  useEffect(() => {
    if (replyTarget) inputRef.current?.focus();
  }, [replyTarget]);

  const hasContent = hasSendableContent(text);
  const submitTypedComment = () => {
    if (!hasContent) return;
    const trimmed = shiftMentionsAfterTrimmingStart(text, mentions);
    onSubmit(trimmed.text, trimmed.mentions, { quotedPostId: quote.quotedPostId, quotedPost: quote.preview?.quoted ?? null });
    setText("");
    setMentions([]);
    quote.reset();
  };
  const effectivePlaceholder = replyTarget ? `Reply to @${replyTarget.author.username}...` : placeholder;

  return (
    <>
    {mentionComposer.suggestions ? <MentionSuggestionList suggestions={mentionComposer.suggestions} /> : null}
    <View style={styles.root}>
      {replyTarget ? (
        <View style={styles.replyingTo}>
          <Text size={12} lineHeight={16.8} color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            Replying to{" "}
            <Text size={12} weight={600} lineHeight={16.8}>
              @{replyTarget.author.username}
            </Text>
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" hitSlop={10} onPress={onCancelReply}>
            <Cancel20Icon />
          </Pressable>
        </View>
      ) : null}
      {quote.preview ? (
        <QuotedPostCard compact quoted={quote.preview.quoted} loading={quote.preview.status === "loading"} unavailable={quote.preview.status === "unavailable"} onRemove={quote.remove} />
      ) : null}
      <View style={styles.emojiRow}>
        {QUICK_REACTION_EMOJI.map((emoji) => (
          <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Add ${emoji}`} onPress={() => mentionComposer.inputProps.onChangeText(text + emoji)}>
            <Text size={24} lineHeight={28.8} letterSpacing={-0.5}>
              {emoji}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.inputRow}>
        <Avatar uri={myAvatarUrl} size={40} placeholderColor={colors.placeholder} />
        <View style={styles.field}>
          <TextInput
            ref={inputRef}
            {...mentionComposer.inputProps}
            placeholder={effectivePlaceholder}
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.primary}
            returnKeyType="send"
            maxLength={1000}
            onSubmitEditing={submitTypedComment}
            accessibilityLabel={effectivePlaceholder}
            style={styles.input}
          />
          {hasContent ? (
            <ComposerSlot slotKey="send">
              <Pressable accessibilityRole="button" accessibilityLabel={replyTarget ? "Send reply" : "Send comment"} hitSlop={8} onPress={submitTypedComment}>
                <PaperPlaneTilt24Icon color={colors.primary} />
              </Pressable>
            </ComposerSlot>
          ) : (
            <ComposerSlot slotKey="gif">
              <View accessible accessibilityLabel="Add GIF">
                <Gif24Icon />
              </View>
            </ComposerSlot>
          )}
        </View>
      </View>
      <MentionCountLabel mentionCount={mentionComposer.mentionCount} />
    </View>
    {avoidKeyboard ? <KeyboardSpacer style={styles.keyboardArea} /> : null}
    </>
  );
});

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 16, gap: 16, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  keyboardArea: { backgroundColor: colors.surface },
  replyingTo: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: -4 },
  emojiRow: { flexDirection: "row", justifyContent: "space-between" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  field: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: "100%",
    padding: 0,
    fontFamily: fontFamily[400],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
}));
