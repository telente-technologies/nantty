import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Cancel20Icon, Gif24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { Comment } from "@/types";

export const QUICK_REACTION_EMOJI = ["😂", "😍", "💕", "😊", "🥰", "😆", "😎", "🤔"] as const;

export interface CommentComposerProps {
  readonly myAvatarUrl: string | null;
  readonly onSubmit: (text: string) => void;
  readonly placeholder?: string;
  readonly replyTarget?: Comment | null;
  readonly onCancelReply?: () => void;
}

export const CommentComposer = forwardRef<TextInput, CommentComposerProps>(function CommentComposer(
  { myAvatarUrl, onSubmit, placeholder = "Add comment...", replyTarget, onCancelReply },
  ref,
) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => inputRef.current as TextInput);

  useEffect(() => {
    if (replyTarget) inputRef.current?.focus();
  }, [replyTarget]);

  const submitTypedComment = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText("");
  };
  const effectivePlaceholder = replyTarget ? `Reply to @${replyTarget.author.username}...` : placeholder;

  return (
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
      <View style={styles.emojiRow}>
        {QUICK_REACTION_EMOJI.map((emoji) => (
          <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Add ${emoji}`} onPress={() => setText((t) => t + emoji)}>
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
            value={text}
            onChangeText={setText}
            placeholder={effectivePlaceholder}
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.primary}
            returnKeyType="send"
            maxLength={1000}
            onSubmitEditing={submitTypedComment}
            accessibilityLabel={effectivePlaceholder}
            style={styles.input}
          />
          <Gif24Icon />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { padding: 16, gap: 16, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.white },
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
});
