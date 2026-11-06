import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Coin24Icon, PaperPlaneTilt24Icon, Smiley24Icon, ViewProducts24Icon } from "@/components/icons";
import { ComposerSlot } from "@/components/ui/composerSlot";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { useTheme } from "@/theme";
import { hasSendableContent } from "@/utils/sendableContent.util";

import { useLiveForeground } from "./liveSurface.constant";

const LIVE_COMMENT_MAX_LENGTH = 200;

export interface LiveCommentBarProps {
  readonly onSend: (text: string) => void;
  readonly onToggleReactions: () => void;
  readonly onPressProducts?: () => void;
  readonly onPressTip?: () => void;
  readonly isShownOverVideo?: boolean;
  readonly isSending?: boolean;
  readonly hideComposer?: boolean;
}

function RoundAction({ label, onPress, background, border, children }: { label: string; onPress: () => void; background: string; border?: string; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.roundAction, { backgroundColor: background, borderColor: border ?? "transparent" }, pressed ? styles.pressed : null]}
    >
      {children}
    </Pressable>
  );
}

export function LiveCommentBar({ onSend, onToggleReactions, onPressProducts, onPressTip, isShownOverVideo = true, isSending = false, hideComposer = false }: LiveCommentBarProps) {
  const [text, setText] = useState("");
  const { colors, isDark } = useTheme();
  const foreground = useLiveForeground(isShownOverVideo);
  const hasText = hasSendableContent(text);
  const placeholderInk = isShownOverVideo ? "rgba(255, 255, 255, 0.72)" : colors.inputPlaceholderText;
  const sendTypedLiveComment = () => {
    if (!hasText || isSending) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <View style={styles.bar}>
      {hideComposer ? null : (
      <View style={[styles.pill, { backgroundColor: foreground.chip, borderColor: foreground.chipBorder }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Say something…"
          placeholderTextColor={placeholderInk}
          selectionColor={isShownOverVideo ? "#FFFFFF" : colors.primary}
          keyboardAppearance={isShownOverVideo || isDark ? "dark" : "light"}
          returnKeyType="send"
          maxLength={LIVE_COMMENT_MAX_LENGTH}
          onSubmitEditing={sendTypedLiveComment}
          accessibilityLabel="Add comment"
          accessibilityHint="Type @ before a username to mention someone"
          style={[styles.input, { color: foreground.ink }]}
        />
        {hasText ? (
          <ComposerSlot slotKey="send">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send comment"
              accessibilityState={{ busy: isSending, disabled: isSending }}
              disabled={isSending}
              hitSlop={6}
              onPress={sendTypedLiveComment}
              style={[styles.sendButton, { backgroundColor: colors.primarySolid }]}
            >
              {isSending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <PaperPlaneTilt24Icon size={16} color="#FFFFFF" />}
            </Pressable>
          </ComposerSlot>
        ) : (
          <ComposerSlot slotKey="reactions">
            <Pressable accessibilityRole="button" accessibilityLabel="Reactions" hitSlop={6} onPress={onToggleReactions} style={styles.emojiButton}>
              <Smiley24Icon size={22} color={foreground.inkMuted} />
            </Pressable>
          </ComposerSlot>
        )}
      </View>
      )}
      {onPressTip ? (
        <RoundAction label="Donate coins to the host" onPress={onPressTip} background={foreground.chip} border={foreground.chipBorder}>
          <Coin24Icon size={20} />
        </RoundAction>
      ) : null}
      {onPressProducts ? (
        <RoundAction label="Products in this live" onPress={onPressProducts} background={foreground.chip} border={foreground.chipBorder}>
          <ViewProducts24Icon size={20} color={foreground.ink} />
        </RoundAction>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  pill: { flex: 1, minHeight: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, paddingLeft: 16, paddingRight: 4, flexDirection: "row", alignItems: "center", gap: 6 },
  input: { flex: 1, paddingVertical: 10, fontFamily: fontFamily[400], fontSize: 14, letterSpacing: calculateDefaultLetterSpacing(14) },
  sendButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  emojiButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  roundAction: { width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
