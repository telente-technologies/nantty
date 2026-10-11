import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { MentionText } from "@/components/mentions/mentionText";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LocalMessageDeliveryStatus } from "@/cache/messageHistory.type";
import type { Message } from "@/types";

import { formatClockTime } from "@/utils/formatDate.util";
import { MessageReactionsRow } from "./messageReactionsRow";
import { isRichMessage, RichMessageContent } from "./richMessageContent";
import { VoiceNoteBubble } from "./voiceNoteBubble";
import { useImagePreview } from "@/components/ui/previewableImage";
import { useMessageWithDecryptedMedia } from "@/components/chat/decryptedMedia.hook";
import { LinkPreviewCard } from "@/components/chatSafety/linkPreviewCard";
import { SharedContentCardView } from "@/components/chatSafety/sharedContentCardView";
import { findFirstExternalUrl, findFirstInternalReference } from "./chatLinks.util";

export interface ChatBubbleProps {
  readonly message: Message;
  readonly isMine: boolean;
  readonly deliveryStatus?: LocalMessageDeliveryStatus;
  readonly showSenderIdentity?: boolean;
  readonly showReadReceipt?: boolean;
  readonly onLongPress?: () => void;
  readonly onToggleReaction?: (emoji: string, shouldReact: boolean) => void;
  readonly onRetryDocument?: () => void;
  readonly onDiscardDocument?: () => void;
}

export function SystemNoticeRow({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.systemRow} accessibilityRole="text">
      <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} color={colors.textMuted} align="center">
        {text}
      </Text>
    </View>
  );
}

export function ChatBubble({
  message: storedMessage,
  isMine,
  deliveryStatus = "sent",
  showSenderIdentity = false,
  showReadReceipt = false,
  onLongPress,
  onToggleReaction,
  onRetryDocument,
  onDiscardDocument,
}: ChatBubbleProps) {
  const message = useMessageWithDecryptedMedia(storedMessage);
  const { colors } = useTheme();
  const styles = useStyles();
  const { openImagePreview, imagePreviewElement } = useImagePreview();
  if (message.kind === "system") return <SystemNoticeRow text={message.text} />;
  if (message.kind === "control") return null;
  const isMediaExpired = !!message.media && !!message.mediaExpiresAt && message.mediaExpiresAt <= new Date().toISOString();
  const isRich = isRichMessage(message);
  const isDocumentExpired = message.kind === "document" && !!message.mediaExpiresAt && message.mediaExpiresAt <= new Date().toISOString();
  const isVoiceNote = message.kind === "voice" && !!message.media && !isMediaExpired;
  const isPhoto = message.kind === "image" && !!message.media?.url && !isMediaExpired;
  const isShared = message.kind === "shared" && !!message.sharedReference;
  const externalUrl = message.kind === "text" || !message.kind ? findFirstExternalUrl(message.text) : null;
  const internalReference = isShared ? message.sharedReference! : message.kind === "text" || !message.kind ? findFirstInternalReference(message.text) : null;
  const hasBubble = !isShared || message.text.length > 0 || !!message.decryptionNotice;
  const isShort = !isRich && !isVoiceNote && !isPhoto && !isMediaExpired && message.text.length <= 24 && !message.text.includes("\n");
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
        {hasBubble ? (
        <Pressable
          disabled={!onLongPress && !isPhoto}
          accessibilityRole={isPhoto ? "imagebutton" : undefined}
          onPress={isPhoto ? () => openImagePreview([message.media!.url]) : undefined}
          onLongPress={onLongPress}
          delayLongPress={350}
          accessibilityHint={onLongPress ? "Long press to react" : undefined}
          accessibilityLabel={deliveryStatus === "pending" && !isRich ? `${isVoiceNote ? "Voice note" : message.text}, sending` : undefined}
          style={[
            styles.bubble,
            deliveryStatus === "pending" && !isRich && styles.pendingBubble,
            isMine && !isRich ? styles.bubbleMine : styles.bubbleTheirs,
            isPhoto && styles.photoBubble,
            isRich && styles.richBubble,
            isShort ? styles.pill : isMine ? styles.cornerMine : styles.cornerTheirs,
          ]}
        >
          {isRich ? (
            <RichMessageContent
              message={message}
              isMine={isMine}
              deliveryStatus={deliveryStatus}
              isMediaExpired={isDocumentExpired}
              onRetryDocument={onRetryDocument}
              onDiscardDocument={onDiscardDocument}
            />
          ) : isVoiceNote ? (
            <VoiceNoteBubble media={message.media!} isMine={isMine} deliveryStatus={deliveryStatus} />
          ) : isPhoto ? (
            <Image source={{ uri: message.media!.url! }} style={styles.photo} contentFit="cover" accessibilityLabel="Photo, tap to view full screen" />
          ) : isMediaExpired ? (
            <Text size={13} lineHeight={16.9} color={isMine ? colors.white : colors.textMuted} accessibilityLabel="Media expired">
              Media expired
            </Text>
          ) : message.decryptionNotice ? (
            <Text size={13} lineHeight={16.9} style={{ fontStyle: "italic" }} color={isMine ? colors.white : colors.textMuted}>
              {message.decryptionNotice}
            </Text>
          ) : (
            <MentionText
              text={message.text}
              mentions={message.mentions}
              size={13}
              lineHeight={16.9}
              color={isMine ? colors.white : colors.text}
              mentionColor={isMine ? colors.white : undefined}
            />
          )}
        </Pressable>
        ) : null}
        {internalReference ? <SharedContentCardView reference={internalReference} /> : null}
        {externalUrl ? <LinkPreviewCard url={externalUrl} preview={message.linkPreview} /> : null}
        {onToggleReaction && message.reactions ? (
          <MessageReactionsRow reactions={message.reactions} onToggleReaction={onToggleReaction} alignEnd={isMine} />
        ) : null}
        <View style={styles.metaRow}>
          <Text size={11} lineHeight={15.4} letterSpacing={0} color={colors.textMuted}>
            {formatClockTime(message.createdAt)}
          </Text>
          {deliveryStatus === "failed" ? (
            <Text size={11} lineHeight={15.4} letterSpacing={0} color={colors.error}>
              · Not sent
            </Text>
          ) : null}
          {showReadReceipt && isMine && message.readAt ? (
            <Text size={11} lineHeight={15.4} letterSpacing={0} color={colors.textMuted}>
              · Seen
            </Text>
          ) : null}
        </View>
      </View>
      {imagePreviewElement}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: 20, gap: 8, alignItems: "flex-end" },
  mine: { justifyContent: "flex-end" },
  theirs: { justifyContent: "flex-start" },
  mineColumn: { alignItems: "flex-end", gap: 2 },
  theirsColumn: { alignItems: "flex-start", gap: 2, flexShrink: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  systemRow: { paddingHorizontal: 32, paddingVertical: 6 },
  bubble: { maxWidth: 260, padding: 12 },
  photoBubble: { padding: 4 },
  richBubble: { maxWidth: 260, padding: 10, backgroundColor: colors.skeleton },
  photo: { width: 200, height: 260, borderRadius: 8 },
  pendingBubble: { opacity: 0.6 },
  bubbleMine: { backgroundColor: colors.primarySolid },
  bubbleTheirs: { backgroundColor: colors.skeleton },
  pill: { borderRadius: 999 },
  cornerMine: { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomRightRadius: 0, borderBottomLeftRadius: 12 },
  cornerTheirs: { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderBottomLeftRadius: 0 },
}));
