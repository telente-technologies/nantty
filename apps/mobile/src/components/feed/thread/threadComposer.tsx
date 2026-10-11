import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Cancel20Icon, LockSimple24Icon } from "@/components/icons";
import { useMentionComposer } from "@/components/mentions/mentionComposer.hook";
import { MentionCountLabel, MentionSuggestionList } from "@/components/mentions/mentionSuggestionList";
import { Avatar } from "@/components/ui/avatar";
import { ComposerSlot } from "@/components/ui/composerSlot";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { Text } from "@/components/ui/text";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { useAuthStore } from "@/store/auth.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Comment, ReplyRestriction } from "@/types";
import type { CommentQuoteOptions } from "@/components/clips/commentThreadController.hook";
import { QuotedPostCard } from "@/components/feed/quotedPostCard";
import { useQuotedPostPreview } from "@/components/feed/quotedPostPreview.hook";
import type { MentionEntity } from "@/types/mention.type";
import { shiftMentionsAfterTrimmingStart } from "@/utils/mentions.util";
import { requireAuthThen } from "@/utils/requireAuth.util";
import { hasSendableContent } from "@/utils/sendableContent.util";

const MAXIMUM_REPLY_LENGTH = 1000;

export interface ThreadComposerProps {
  readonly postAuthorUsername: string | undefined;
  readonly replyTarget: Comment | null;
  readonly onCancelReply: () => void;
  readonly onSubmit: (text: string, mentions: readonly MentionEntity[], quote?: CommentQuoteOptions) => void;
  readonly replyRestriction?: ReplyRestriction | null;
  readonly focusRequest?: number;
}

export const ThreadComposer = forwardRef<TextInput, ThreadComposerProps>(function ThreadComposer(
  { postAuthorUsername, replyTarget, onCancelReply, onSubmit, replyRestriction, focusRequest = 0 },
  ref,
) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const viewerAvatarUrl = useAuthStore((state) => state.user?.avatarUrl ?? null);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<readonly MentionEntity[]>([]);
  const inputRef = useRef<TextInput>(null);
  const mentionComposer = useMentionComposer({
    surface: "comment",
    text,
    mentions,
    inputRef,
    signInReason: "reply",
    onChange: (nextText, nextMentions) => {
      setText(nextText);
      setMentions(nextMentions);
    },
  });
  const quote = useQuotedPostPreview(text);
  useImperativeHandle(ref, () => inputRef.current as TextInput);

  const lastFocusRequest = useRef(focusRequest);
  useEffect(() => {
    if (focusRequest === lastFocusRequest.current) return;
    lastFocusRequest.current = focusRequest;
    inputRef.current?.focus();
  }, [focusRequest]);

  const replyingToUsername = replyTarget?.author.username ?? postAuthorUsername;
  const canSubmit = hasSendableContent(text);
  const submitReply = () => {
    if (!canSubmit) return;
    const trimmed = shiftMentionsAfterTrimmingStart(text, mentions);
    onSubmit(trimmed.text, trimmed.mentions, { quotedPostId: quote.quotedPostId, quotedPost: quote.preview?.quoted ?? null });
    setText("");
    setMentions([]);
    quote.reset();
  };

  return (
    <>
      {mentionComposer.suggestions ? <MentionSuggestionList suggestions={mentionComposer.suggestions} /> : null}
      <View style={styles.root}>
        {isSignedIn && replyRestriction ? (
          <View style={styles.restricted} accessible accessibilityRole="text" accessibilityLabel={`Who can reply? ${replyRestriction.message}`}>
            <LockSimple24Icon size={18} color={colors.textMuted} />
            <View style={styles.flex}>
              <Text size={14} weight={600} lineHeight={18}>Who can reply?</Text>
              <Text size={13} lineHeight={18} color={colors.textMuted}>{replyRestriction.message}</Text>
            </View>
          </View>
        ) : null}
        {isSignedIn && replyingToUsername && !replyRestriction ? (
          <View style={styles.replyingTo}>
            <Text size={13} lineHeight={17} color={colors.textMuted} numberOfLines={1} style={styles.flex}>
              Replying to{" "}
              <Text size={13} lineHeight={17} color={colors.primary}>
                @{replyingToUsername}
              </Text>
            </Text>
            {replyTarget ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Reply to the post instead" hitSlop={12} onPress={onCancelReply}>
                <Cancel20Icon />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {isSignedIn && replyRestriction ? null : isSignedIn ? (
          <View style={styles.inputRow}>
            <Avatar uri={viewerAvatarUrl} size={32} />
            <TextInput
              ref={inputRef}
              {...mentionComposer.inputProps}
              multiline
              placeholder="Post your reply"
              placeholderTextColor={colors.inputPlaceholderText}
              selectionColor={colors.primary}
              maxLength={MAXIMUM_REPLY_LENGTH}
              accessibilityLabel={replyingToUsername ? `Post your reply to @${replyingToUsername}` : "Post your reply"}
              style={styles.input}
            />
            {canSubmit ? (
              <ComposerSlot slotKey="send">
                <Pressable accessibilityRole="button" accessibilityLabel="Reply" onPress={submitReply} style={styles.send}>
                  <Text size={14} weight={600} lineHeight={18} color={colors.onPrimary}>
                    Reply
                  </Text>
                </Pressable>
              </ComposerSlot>
            ) : null}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in to post your reply"
            onPress={() => requireAuthThen(() => undefined, undefined, "reply")}
            style={styles.guestPrompt}
          >
            <Text size={15} lineHeight={20} color={colors.inputPlaceholderText} style={styles.flex}>
              Post your reply
            </Text>
            <Text size={14} weight={600} lineHeight={18} color={colors.primary}>
              Sign in to reply
            </Text>
          </Pressable>
        )}
        {isSignedIn && !replyRestriction && quote.preview ? (
          <View style={styles.quotePreview}>
            <QuotedPostCard compact quoted={quote.preview.quoted} loading={quote.preview.status === "loading"} unavailable={quote.preview.status === "unavailable"} onRemove={quote.remove} />
          </View>
        ) : null}
        <MentionCountLabel mentionCount={mentionComposer.mentionCount} />
      </View>
      <KeyboardSpacer style={styles.keyboardArea} />
    </>
  );
});

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    root: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, backgroundColor: colors.surface },
    keyboardArea: { backgroundColor: colors.surface },
    replyingTo: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 44 },
    inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
    input: {
      flex: 1,
      minHeight: 36,
      maxHeight: 120,
      paddingTop: 8,
      paddingBottom: 8,
      paddingHorizontal: 0,
      fontFamily: fontFamily[400],
      fontSize: 15,
      letterSpacing: calculateDefaultLetterSpacing(15),
      color: colors.text,
    },
    send: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.primarySolid, alignItems: "center", justifyContent: "center" },
    restricted: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
    guestPrompt: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
    quotePreview: { paddingLeft: 44 },
  }),
);
