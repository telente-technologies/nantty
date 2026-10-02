import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Plus24Icon, PaperPlaneTilt24Icon, Smiley24Icon, Microphone24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";

const CHAT_EMOJI = [
  "😀", "😂", "🥰", "😍", "🤩", "😎", "🤔", "😅",
  "🙌", "👏", "👍", "👎", "🙏", "💪", "🤝", "✌️",
  "❤️", "🔥", "⭐", "🎉", "✨", "💯", "😢", "😭",
  "😡", "🥳", "😴", "🤯", "🥶", "🥵", "🤗", "🙄",
  "👀", "🐶", "🐱", "🍕", "☕", "🎁", "🚀", "🌈",
] as const;

export interface MessageComposerBarProps {
  readonly onSend: (text: string) => void;
  readonly placeholder?: string;
  readonly plusOnRight?: boolean;
  readonly onPressPlus?: () => void;
  readonly sending?: boolean;
  readonly onPressMicrophone?: () => void;
  readonly onTypingChange?: (isTyping: boolean) => void;
}

export function MessageComposerBar({
  onSend,
  placeholder = "Send a message...",
  plusOnRight = false,
  onPressPlus,
  sending = false,
  onPressMicrophone,
  onTypingChange,
}: MessageComposerBarProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const canSend = text.trim().length > 0 && !sending;

  const sendTypedMessage = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    setShowEmojiPanel(false);
    onTypingChange?.(false);
  };

  const updateTypedText = (nextText: string) => {
    if ((nextText.length > 0) !== (text.length > 0)) onTypingChange?.(nextText.length > 0);
    setText(nextText);
  };

  const toggleEmojiPanel = () => {
    const next = !showEmojiPanel;
    setShowEmojiPanel(next);
    if (next) inputRef.current?.blur();
    else inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => updateTypedText(text + emoji);

  const microphoneButton = onPressMicrophone ? (
    <Pressable accessibilityRole="button" accessibilityLabel="Record a voice note" hitSlop={10} onPress={onPressMicrophone}>
      <Microphone24Icon />
    </Pressable>
  ) : (
    <Microphone24Icon />
  );

  const plusButton = (
    <Pressable accessibilityRole="button" accessibilityLabel="Add attachment" hitSlop={10} onPress={onPressPlus}>
      <Plus24Icon />
    </Pressable>
  );

  return (
    <View>
      {showEmojiPanel ? (
        <View style={styles.emojiPanel} accessibilityLabel="Emoji picker">
          {CHAT_EMOJI.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`Insert ${emoji}`}
              hitSlop={4}
              onPress={() => insertEmoji(emoji)}
              style={styles.emojiCell}
            >
              <Text size={26} lineHeight={32} letterSpacing={0}>
                {emoji}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.bar}>
        {!plusOnRight ? (focused ? microphoneButton : plusButton) : null}
        <View style={styles.field}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={updateTypedText}
            onFocus={() => {
              setFocused(true);
              setShowEmojiPanel(false);
            }}
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showEmojiPanel ? "Hide emoji picker" : "Add emoji"}
              hitSlop={8}
              onPress={toggleEmojiPanel}
            >
              <Smiley24Icon color={showEmojiPanel ? colors.primary : undefined} />
            </Pressable>
            {canSend ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Send message" hitSlop={8} onPress={sendTypedMessage}>
                <PaperPlaneTilt24Icon color={colors.primary} />
              </Pressable>
            ) : focused && !plusOnRight ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Add attachment" hitSlop={8} onPress={onPressPlus}>
                <Plus24Icon />
              </Pressable>
            ) : onPressMicrophone && !plusOnRight ? (
              microphoneButton
            ) : null}
          </View>
        </View>
        {plusOnRight ? plusButton : null}
      </View>
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
  emojiPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.white,
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  emojiCell: { width: "10%", alignItems: "center", paddingVertical: 6 },
});
