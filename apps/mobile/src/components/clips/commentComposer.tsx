import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Gif24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";

export const QUICK_REACTION_EMOJI = ["😂", "😍", "💕", "😊", "🥰", "😆", "😎", "🤔"] as const;

export interface CommentComposerProps {
  readonly myAvatarUrl: string | null;
  readonly onSubmit: (text: string) => void;
  readonly placeholder?: string;
}

export const CommentComposer = forwardRef<TextInput, CommentComposerProps>(function CommentComposer(
  { myAvatarUrl, onSubmit, placeholder = "Add comment..." },
  ref,
) {
  const [text, setText] = useState("");
  const submitTypedComment = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText("");
  };
  return (
    <View style={styles.root}>
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
            ref={ref}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.primary}
            returnKeyType="send"
            onSubmitEditing={submitTypedComment}
            accessibilityLabel={placeholder}
            style={styles.input}
          />
          <Gif24Icon />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { padding: 16, gap: 16, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.white },
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

