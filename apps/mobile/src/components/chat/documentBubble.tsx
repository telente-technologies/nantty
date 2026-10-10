import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon, Document24Icon, Refresh20Icon, Trash24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { cancelDocumentUpload } from "@/services/chat/documentUpload.service";
import { openChatDocument, saveChatDocumentToDevice } from "@/services/core/documentOpening.service";
import { useDocumentUploadProgress } from "@/store/documentUploads.store";
import { makeThemedStyles, useTheme, type ThemeColors } from "@/theme";
import type { LocalMessageDeliveryStatus } from "@/cache/messageHistory.type";
import type { Message } from "@/types";
import { buildDocumentSummaryLine, describeDocumentKind, type ChatDocumentKind } from "@/utils/chatDocument.util";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

export interface DocumentBubbleProps {
  readonly message: Message;
  readonly deliveryStatus: LocalMessageDeliveryStatus;
  readonly isExpired: boolean;
  readonly onRetry?: () => void;
  readonly onDiscard?: () => void;
}

const pickBadgeColor = (tone: ChatDocumentKind["tone"], colors: ThemeColors) =>
  ({ red: colors.error, blue: colors.primary, green: colors.success, orange: colors.caution, grey: colors.textMuted })[tone];

export function DocumentBubble({ message, deliveryStatus, isExpired, onRetry, onDiscard }: DocumentBubbleProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const document = message.document!;
  const upload = useDocumentUploadProgress(message.id);
  const kind = describeDocumentKind(document.fileName);
  const isUploading = deliveryStatus === "pending" && !upload?.wasCancelled;
  const hasFailed = deliveryStatus === "failed" || (deliveryStatus === "pending" && !!upload?.wasCancelled);
  const percent = Math.round((upload?.fraction ?? 0) * 100);

  const reportProblem = (title: string) => (error: unknown) => showAlertWithButtons(title, error instanceof Error ? error.message : "Please try again.");

  const [isOpenOrSaveSheetVisible, setIsOpenOrSaveSheetVisible] = useState(false);
  const closeSheetThen = (action: () => void) => () => {
    setIsOpenOrSaveSheetVisible(false);
    action();
  };
  const openDocument = () => void openChatDocument(document).catch(reportProblem("Couldn't open file"));
  const saveDocument = () =>
    void saveChatDocumentToDevice(document)
      .then((outcome) => outcome === "saved" && showAlertWithButtons("Saved", "The file was saved to the folder you chose."))
      .catch(reportProblem("Couldn't save file"));

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isExpired ? `${document.fileName}, file expired` : `${document.fileName}, ${buildDocumentSummaryLine(document.sizeBytes, document.pageCount)}`}
        accessibilityHint={isExpired || isUploading || hasFailed ? undefined : "Opens or saves the file"}
        disabled={isExpired || isUploading || hasFailed}
        onPress={() => setIsOpenOrSaveSheetVisible(true)}
        style={styles.fileRow}
      >
        <View style={[styles.badge, { backgroundColor: pickBadgeColor(kind.tone, colors), opacity: isExpired ? 0.4 : 1 }]}>
          <Text size={11} weight={700} lineHeight={13} letterSpacing={0} color={colors.white}>{kind.label}</Text>
        </View>
        <View style={styles.details}>
          <Text size={14} weight={500} lineHeight={18} numberOfLines={2} color={isExpired ? colors.textMuted : colors.text}>{document.fileName}</Text>
          <Text size={12} lineHeight={15.6} letterSpacing={0} color={colors.textMuted}>
            {isExpired ? "File expired" : buildDocumentSummaryLine(document.sizeBytes, document.pageCount)}
          </Text>
        </View>
        {isUploading ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel upload" hitSlop={10} onPress={() => cancelDocumentUpload(message.id)}>
            <Cancel20Icon />
          </Pressable>
        ) : null}
      </Pressable>
      {isUploading ? (
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.progressBlock}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${percent}%` }]} />
          </View>
          <Text size={12} lineHeight={15.6} letterSpacing={0} color={colors.textMuted}>Uploading {percent}%</Text>
        </View>
      ) : null}
      {hasFailed ? (
        <View style={styles.failedRow}>
          <Text size={12} lineHeight={15.6} letterSpacing={0} color={colors.error} style={styles.failedLabel}>
            {upload?.wasCancelled ? "Upload cancelled" : "Upload failed"}
          </Text>
          <Pressable accessibilityRole="button" hitSlop={14} onPress={onRetry} style={styles.failedAction}>
            <Refresh20Icon size={20} color={colors.primary} />
            <Text size={13} weight={600} lineHeight={16.9} color={colors.primary}>Retry</Text>
          </Pressable>
          <Pressable accessibilityRole="button" hitSlop={14} onPress={onDiscard} style={styles.failedAction}>
            <Trash24Icon size={20} color={colors.textMuted} />
            <Text size={13} weight={600} lineHeight={16.9} color={colors.textMuted}>Discard</Text>
          </Pressable>
        </View>
      ) : null}
      <BottomSheet
        visible={isOpenOrSaveSheetVisible}
        onClose={() => setIsOpenOrSaveSheetVisible(false)}
        title={document.fileName}
        subtitle={buildDocumentSummaryLine(document.sizeBytes, document.pageCount)}
        footerActions={[
          { label: "Open", style: "primary", onPress: closeSheetThen(openDocument) },
          { label: "Save to device", style: "secondary", onPress: closeSheetThen(saveDocument) },
        ]}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Document24Icon size={22} color={colors.textMuted} />
        </View>
        <Text size={14} lineHeight={19.6} color={colors.textMuted}>Open this file or save it to your device.</Text>
      </BottomSheet>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { width: 232, gap: 8 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: { width: 40, height: 48, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  details: { flex: 1, gap: 2 },
  progressBlock: { gap: 4 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.placeholder, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  failedRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  failedAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  failedLabel: { flex: 1 },
}));
