import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { DisputeMessage } from "@/types/commerce.type";

import { formatFriendlyDateTime } from "./escrowStage.util";
import { PreviewableImage } from "@/components/ui/previewableImage";

const ROLE_LABELS = { buyer: "Buyer", seller: "Seller", support: "Nantty Support" } as const;

export function DisputeMessageBubble({ message, sentByViewer }: { message: DisputeMessage; sentByViewer: boolean }) {
  const { colors } = useTheme();
  const fromSupport = message.authorRole === "support";
  const bubbleColor = sentByViewer ? colors.primarySolid : fromSupport ? colors.successTint : colors.surface;
  const textColor = sentByViewer ? colors.white : colors.text;
  return (
    <View style={[styles.row, sentByViewer && styles.rowMine]}>
      {sentByViewer ? null : <Avatar uri={message.authorAvatarUrl} size={28} />}
      <View style={[styles.column, sentByViewer && styles.columnMine]}>
        <Text size={11} weight={500} lineHeight={14} color={colors.textSubtle}>
          {sentByViewer ? "You" : `${message.authorName} · ${ROLE_LABELS[message.authorRole]}`}
        </Text>
        <View style={[styles.bubble, { backgroundColor: bubbleColor }]}>
          <Text size={14} lineHeight={19} color={textColor}>
            {message.text}
          </Text>
          {message.attachmentUrls.map((url, index) => (
            <PreviewableImage key={url} imageUrl={url} galleryImageUrls={message.attachmentUrls} galleryIndex={index} accessibilityLabel="View attached photo">
              <Image source={{ uri: url }} style={styles.attachment} contentFit="cover" />
            </PreviewableImage>
          ))}
        </View>
        <Text size={11} lineHeight={14} color={colors.textSubtle}>
          {formatFriendlyDateTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rowMine: { justifyContent: "flex-end" },
  column: { maxWidth: "80%", gap: 4 },
  columnMine: { alignItems: "flex-end" },
  bubble: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  attachment: { width: 160, height: 120, borderRadius: 8 },
});
