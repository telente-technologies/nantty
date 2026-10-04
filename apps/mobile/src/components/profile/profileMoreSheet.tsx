import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";

import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { makeThemedStyles, useTheme } from "@/theme";
import { followsService } from "@/services/follows.service";
import { REPORT_REASON_OPTIONS, reportsService, type ReportReason } from "@/services/reports.service";
import type { User } from "@/types";
import { isViewerSignedIn, requireAuthAfterClosingModal } from "@/utils/requireAuth.util";
import { webAppLinks } from "@/config/webAppLinks.config";

export interface ProfileMoreSheetProps {
  readonly profile: User;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onBlocked: () => void;
  readonly onSendCoins?: () => void;
}

export function ProfileMoreSheet({ profile, visible, onClose, onBlocked, onSendCoins }: ProfileMoreSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { openSendInChat, sendInChatElement } = useShareToChat();
  const [mode, setMode] = useState<"menu" | "report" | "reported">("menu");
  const closeAndReset = () => {
    setMode("menu");
    onClose();
  };
  const report = useMutation({
    mutationFn: (reason: ReportReason) => reportsService.submitReportForContent({ targetType: "user", targetId: profile.id, reason, details: "" }),
    onSuccess: () => setMode("reported"),
  });
  const block = useMutation({ mutationFn: () => followsService.blockUser(profile.id), onSuccess: () => { closeAndReset(); onBlocked(); } });
  const requireSignIn = (action: () => void, reason: string) => requireAuthAfterClosingModal(closeAndReset, action, reason);
  const shareProfileLink = () => {
    closeAndReset();
    Share.share({ message: `${profile.name} on Zudomart: ${webAppLinks.profile(profile.username)}` });
  };

  const option = (label: string, onPress: () => void, color: string = colors.text) => (
    <Pressable key={label} accessibilityRole="button" onPress={onPress} style={styles.option}>
      <Text size={15} lineHeight={18} color={color}>{label}</Text>
    </Pressable>
  );

  return (
    <>
    {sendInChatElement}
    <BottomSheet visible={visible} onClose={closeAndReset} title={mode === "report" ? `Report @${profile.username}` : undefined} floating={mode === "menu"}>
      {mode === "menu" ? (
        <View style={styles.menu}>
          {option("Send in chat", () =>
            requireSignIn(() => {
              closeAndReset();
              openSendInChat({ kind: "profile", id: profile.id });
            }, "send this in chat"),
          )}
          {option("Share or copy profile link", shareProfileLink)}
          {onSendCoins
            ? option(`Send coins to ${profile.name}`, () =>
                requireSignIn(() => {
                  closeAndReset();
                  onSendCoins();
                }, "send coins"),
              )
            : null}
          {option(`Report @${profile.username}`, () => (isViewerSignedIn() ? setMode("report") : requireSignIn(() => undefined, "report accounts")), colors.error)}
          {option(block.isPending ? "Blocking…" : `Block ${profile.name}`, () => requireSignIn(() => showAlertWithButtons(`Block ${profile.name}?`, "They won't be able to find your profile, see your posts or message you. They won't be told you blocked them.", [
              { text: "Cancel", style: "cancel" },
              { text: "Block", style: "destructive", onPress: () => block.mutate() },
            ]), "block accounts"), colors.error)}
        </View>
      ) : mode === "report" ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.menu}>
          {REPORT_REASON_OPTIONS.map((reasonOption) => option(reasonOption.label, () => report.mutate(reasonOption.reason)))}
          {report.isError ? <Text size={12} color={colors.error}>{report.error.message}</Text> : null}
        </ScrollView>
      ) : (
        <View style={styles.done}>
          <Text size={16} weight={600} lineHeight={19.2}>Thanks for letting us know</Text>
          <Text size={13} lineHeight={17.5} color={colors.textMuted}>We'll review this account. You can follow the outcome in Settings › Support › My reports.</Text>
          {option("Done", closeAndReset, colors.primary)}
        </View>
      )}
    </BottomSheet>
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  menu: { paddingHorizontal: 16, paddingBottom: 12 },
  list: { maxHeight: 420 },
  option: { minHeight: 50, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.background },
  done: { padding: 16, gap: 8 },
}));
