import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LocalMessageDeliveryStatus } from "@/cache/messageHistory.type";
import type { Message } from "@/types";

import { MessageReactionsRow } from "./messageReactionsRow";
import { VoiceNoteBubble } from "./voiceNoteBubble";

export interface ChatBubbleProps {
  readonly message: Message;
  readonly isMine: boolean;
  readonly deliveryStatus?: LocalMessageDeliveryStatus;
  readonly showSenderIdentity?: boolean;
  readonly onLongPress?: () => void;
  readonly onToggleReaction?: (emoji: string, shouldReact: boolean) => void;
}

export function SystemNoticeRow({ text }: { text: string }) {
  return (
    <View style={styles.systemRow} accessibilityRole="text">
      <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} color={colors.textMuted} align="center">
        {text}
      </Text>
    </View>
  );
}

export function ChatBubble({
  message,
  isMine,
  deliveryStatus = "sent",
  showSenderIdentity = false,
  onLongPress,
  onToggleReaction,
}: ChatBubbleProps) {
  if (message.kind === "system") return <SystemNoticeRow text={message.text} />;
  const isVoiceNote = message.kind === "voice" && !!message.media;
  const isShort = !isVoiceNote && message.text.length <= 24 && !message.text.includes("\n");
  const shouldShowSender = showSenderIdentity && !isMine && !!message.sender;
  return (
    <View style={[styles.row, isMine ? styles.mine : styles.theirs]}>
      {shouldShowSender ? <Avatar uri={message.sender!.avatarUrl} size={24} placeholderColor={colors.placeholder} /> : null}
      <View style={isMine ? styles.mineColumn : styles.theirsColumn}>
        {shouldShowSender ? (
          <Text size={11} weight={600} lineHeight={15.4} letterSpacing={0} color={colors.textMuted}>
            {message.sender!.name}
          </Text>
        ) : null}
        <Pressable
          disabled={!onLongPress}
          onLongPress={onLongPress}
          delayLongPress={350}
          accessibilityHint={onLongPress ? "Long press to react" : undefined}
          accessibilityLabel={deliveryStatus === "pending" ? `${isVoiceNote ? "Voice note" : message.text}, sending` : undefined}
          style={[
            styles.bubble,
            deliveryStatus === "pending" && styles.pendingBubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
            isShort ? styles.pill : isMine ? styles.cornerMine : styles.cornerTheirs,
          ]}
        >
          {isVoiceNote ? (
            <VoiceNoteBubble media={message.media!} isMine={isMine} deliveryStatus={deliveryStatus} />
          ) : (
            <Text size={13} lineHeight={16.9} color={isMine ? colors.white : colors.text}>
              {message.text}
            </Text>
          )}
        </Pressable>
        {onToggleReaction && message.reactions ? (
          <MessageReactionsRow reactions={message.reactions} onToggleReaction={onToggleReaction} alignEnd={isMine} />
        ) : null}
        {deliveryStatus === "failed" ? (
          <Text size={11} lineHeight={15.4} color={colors.error} align="right">
            Not sent
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: 20, gap: 8, alignItems: "flex-end" },
  mine: { justifyContent: "flex-end" },
  theirs: { justifyContent: "flex-start" },
  mineColumn: { alignItems: "flex-end", gap: 2 },
  theirsColumn: { alignItems: "flex-start", gap: 2, flexShrink: 1 },
  systemRow: { paddingHorizontal: 32, paddingVertical: 6 },
  bubble: { maxWidth: 260, padding: 12 },
  pendingBubble: { opacity: 0.6 },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTheirs: { backgroundColor: colors.skeleton },
  pill: { borderRadius: 999 },
  cornerMine: { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomRightRadius: 0, borderBottomLeftRadius: 12 },
  cornerTheirs: { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderBottomLeftRadius: 0 },
});
