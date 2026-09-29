import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { ImageSquare24Icon, PaperPlaneTilt24Icon, Plus24Icon, Smiley24Icon, Microphone24Icon } from "@/components/icons";
import { colors } from "@/constants/colors.constant";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";


export interface MessageComposerBarProps {
  readonly onSend: (text: string) => void;
  readonly placeholder?: string;
  readonly plusOnRight?: boolean;
  readonly onPressPlus?: () => void;
  readonly onPressImage?: () => void;
  readonly onPressEmoji?: () => void;
  readonly sending?: boolean;
}

export function MessageComposerBar({
  onSend,
  placeholder = "Send a message...",
  plusOnRight = false,
  onPressPlus,
  onPressImage,
  onPressEmoji,
  sending = false,
}: MessageComposerBarProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const canSend = text.trim().length > 0 && !sending;

  const sendTypedMessage = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };

  const plusButton = (
    <Pressable accessibilityRole="button" accessibilityLabel="Add attachment" hitSlop={10} onPress={onPressPlus}>
      <Plus24Icon />
    </Pressable>
  );

  return (
    <View style={styles.bar}>
      {!plusOnRight ? (focused ? <Microphone24Icon /> : plusButton) : null}
      <View style={styles.field}>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          returnKeyType="send"
          onSubmitEditing={sendTypedMessage}
          accessibilityLabel={placeholder}
          style={styles.input}
        />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Add emoji" hitSlop={8} onPress={onPressEmoji}>
            <Smiley24Icon />
          </Pressable>
          {canSend ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Send message" hitSlop={8} onPress={sendTypedMessage}>
              <PaperPlaneTilt24Icon color={colors.primary} />
            </Pressable>
          ) : focused && !plusOnRight ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Send an image" hitSlop={8} onPress={onPressImage}>
              <ImageSquare24Icon />
            </Pressable>
          ) : null}
        </View>
      </View>
      {plusOnRight ? plusButton : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  field: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    height: "100%",
    padding: 0,
    fontFamily: fontFamily[400],
    fontSize: 13,
    letterSpacing: calculateDefaultLetterSpacing(13),
    color: colors.text,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
