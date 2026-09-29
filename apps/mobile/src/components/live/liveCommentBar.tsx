import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { PaperPlaneTilt24Icon, Smiley24Icon, ViewProducts24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";

export interface LiveCommentBarProps {
  readonly onSend: (text: string) => void;
  readonly onToggleReactions: () => void;
  readonly onPressProducts?: () => void;
  readonly onPressGift?: () => void;
}

export function LiveCommentBar({ onSend, onToggleReactions, onPressProducts, onPressGift }: LiveCommentBarProps) {
  const [text, setText] = useState("");
  const sendTypedLiveComment = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <View style={styles.bar}>
      <View style={styles.field}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Add comment..."
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.primary}
          returnKeyType="send"
          onSubmitEditing={sendTypedLiveComment}
          accessibilityLabel="Add comment"
          style={styles.input}
        />
      </View>
      {text.trim() ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Send comment" hitSlop={8} onPress={sendTypedLiveComment}>
          <PaperPlaneTilt24Icon />
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Reactions" hitSlop={8} onPress={onToggleReactions}>
          <Smiley24Icon />
        </Pressable>
      )}
      {onPressGift ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Send a gift" hitSlop={8} onPress={onPressGift}>
          <Text size={22} lineHeight={26}>
            🎁
          </Text>
        </Pressable>
      ) : null}
      {onPressProducts ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Products in this live" hitSlop={8} onPress={onPressProducts}>
          <ViewProducts24Icon />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 49,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  field: { flex: 1, height: 33, borderWidth: 1, borderColor: colors.divider, borderRadius: 4, paddingHorizontal: 8, justifyContent: "center" },
  input: { padding: 0, fontFamily: fontFamily[400], fontSize: 14, letterSpacing: calculateDefaultLetterSpacing(14), color: colors.text },
});
