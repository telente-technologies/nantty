import { type ReactNode, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { Plus24Icon, PaperPlaneTilt24Icon, Smiley24Icon, Microphone24Icon } from "@/components/icons";
import { useMentionComposer } from "@/components/mentions/mentionComposer.hook";
import { MentionCountLabel, MentionSuggestionList } from "@/components/mentions/mentionSuggestionList";
import { ComposerSlot } from "@/components/ui/composerSlot";
import { useKeyboardHandler } from "@/components/ui/keyboardController";
import { KeyboardSpacer } from "@/components/ui/keyboardSpacer";
import { Text } from "@/components/ui/text";
import { useLastKeyboardHeight } from "@/hooks/useLastKeyboardHeight.hook";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { MentionEntity } from "@/types/mention.type";
import { shiftMentionsAfterTrimmingStart } from "@/utils/mentions.util";
import { hasSendableContent } from "@/utils/sendableContent.util";

const CHAT_EMOJI = [
  "😀", "😂", "🥰", "😍", "🤩", "😎", "🤔", "😅",
  "🙌", "👏", "👍", "👎", "🙏", "💪", "🤝", "✌️",
  "❤️", "🔥", "⭐", "🎉", "✨", "💯", "😢", "😭",
  "😡", "🥳", "😴", "🤯", "🥶", "🥵", "🤗", "🙄",
  "👀", "🐶", "🐱", "🍕", "☕", "🎁", "🚀", "🌈",
] as const;

export interface MessageComposerBarProps {
  readonly onSend: (text: string, mentions?: readonly MentionEntity[]) => void;
  readonly mentionConversation?: { readonly id: string; readonly surface: "group" | "direct" };
  readonly placeholder?: string;
  readonly plusOnRight?: boolean;
  readonly onPressPlus?: () => void;
  readonly sending?: boolean;
  readonly microphoneButton?: ReactNode;
  readonly barOverlay?: ReactNode;
  readonly onTypingChange?: (isTyping: boolean) => void;
}

export function MessageComposerBar({
  onSend,
  mentionConversation,
  placeholder = "Send a message...",
  plusOnRight = false,
  onPressPlus,
  sending = false,
  microphoneButton: providedMicrophoneButton,
  barOverlay,
  onTypingChange,
}: MessageComposerBarProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [emojiPanelReserve, setEmojiPanelReserve] = useState(0);
  const lastKeyboardHeight = useLastKeyboardHeight();
  const insets = useSafeAreaInsets();
  useKeyboardHandler(
    {
      onEnd: (event) => {
        "worklet";
        if (event.height > 0) scheduleOnRN(setEmojiPanelReserve, 0);
      },
    },
    [],
  );
  const [mentions, setMentions] = useState<readonly MentionEntity[]>([]);
  const inputRef = useRef<TextInput>(null);
  const mentionComposer = useMentionComposer({
    surface: mentionConversation?.surface ?? "group",
    conversationId: mentionConversation?.id,
    isEnabled: mentionConversation !== undefined,
    text,
    mentions,
    inputRef,
    signInReason: "send a message",
    onChange: (nextText, nextMentions) => {
      updateTypedText(nextText);
      setMentions(nextMentions);
    },
  });
  const hasContent = hasSendableContent(text);
  const canSend = hasContent && !sending;

  const sendTypedMessage = () => {
    if (!canSend) return;
    const trimmed = shiftMentionsAfterTrimmingStart(text, mentions);
    onSend(trimmed.text, trimmed.mentions.length ? trimmed.mentions : undefined);
    setText("");
    setMentions([]);
    setShowEmojiPanel(false);
    if (!focused) setEmojiPanelReserve(0);
    onTypingChange?.(false);
  };

  const updateTypedText = (nextText: string) => {
    if ((nextText.length > 0) !== (text.length > 0)) onTypingChange?.(nextText.length > 0);
    setText(nextText);
  };

  const toggleEmojiPanel = () => {
    const next = !showEmojiPanel;
    setShowEmojiPanel(next);
    if (next) setEmojiPanelReserve(lastKeyboardHeight);
    if (next) inputRef.current?.blur();
    else inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => mentionComposer.inputProps.onChangeText(text + emoji);

  const microphoneButton = providedMicrophoneButton ?? <Microphone24Icon />;
  const isBarCovered = barOverlay !== undefined && barOverlay !== null;

  const plusButton = (
    <Pressable accessibilityRole="button" accessibilityLabel="Add attachment" hitSlop={10} onPress={onPressPlus}>
      <Plus24Icon />
    </Pressable>
  );

  return (
    <View>
      {mentionComposer.suggestions ? <MentionSuggestionList suggestions={mentionComposer.suggestions} /> : null}
      {mentionComposer.mentionCount > 0 ? (
        <View style={styles.mentionCount}>
          <MentionCountLabel mentionCount={mentionComposer.mentionCount} />
        </View>
      ) : null}
      <View style={styles.bar}>
        <View
          style={styles.barContents}
          accessibilityElementsHidden={isBarCovered}
          importantForAccessibility={isBarCovered ? "no-hide-descendants" : "auto"}
        >
        {!plusOnRight ? (focused ? microphoneButton : plusButton) : null}
        <View style={styles.field}>
          <TextInput
            ref={inputRef}
            {...mentionComposer.inputProps}
            onFocus={() => {
              mentionComposer.inputProps.onFocus();
              setFocused(true);
              setShowEmojiPanel(false);
            }}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            placeholderTextColor={colors.inputPlaceholderText}
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
            {hasContent ? (
              <ComposerSlot slotKey="send">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  accessibilityState={{ disabled: !canSend, busy: sending }}
                  disabled={!canSend}
                  hitSlop={8}
                  onPress={sendTypedMessage}
                  style={!canSend ? styles.sendDisabled : null}
                >
                  <PaperPlaneTilt24Icon color={colors.primary} />
                </Pressable>
              </ComposerSlot>
            ) : focused && !plusOnRight ? (
              <ComposerSlot slotKey="attach">
                <Pressable accessibilityRole="button" accessibilityLabel="Add attachment" hitSlop={8} onPress={onPressPlus}>
                  <Plus24Icon />
                </Pressable>
              </ComposerSlot>
            ) : providedMicrophoneButton && !plusOnRight ? (
              <ComposerSlot slotKey="mic">{microphoneButton}</ComposerSlot>
            ) : null}
          </View>
        </View>
        {plusOnRight ? plusButton : null}
        </View>
        {barOverlay}
      </View>
      <KeyboardSpacer reservedHeight={emojiPanelReserve} style={styles.keyboardArea}>
        {showEmojiPanel ? (
          <ScrollView style={[styles.emojiPanel, { bottom: insets.bottom }]} contentContainerStyle={styles.emojiGrid} accessibilityLabel="Emoji picker">
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
          </ScrollView>
        ) : null}
      </KeyboardSpacer>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  bar: {
    height: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  barContents: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
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
  mentionCount: { paddingHorizontal: 16, paddingTop: 4, backgroundColor: colors.surface },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  sendDisabled: { opacity: 0.45 },
  keyboardArea: { backgroundColor: colors.surface },
  emojiPanel: { position: "absolute", top: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: colors.divider },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  emojiCell: { width: "10%", alignItems: "center", paddingVertical: 6 },
}));
