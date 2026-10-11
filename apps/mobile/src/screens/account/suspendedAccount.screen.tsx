import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { inAppBrowserColorsFromTheme, openTrustedWebPage } from "@/components/links/openLink.util";
import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { DataExportSection } from "@/components/settings/dataExportSection";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { legalLinks } from "@/config/legalLinks.config";
import { makeThemedStyles, useTheme } from "@/theme";
import { accountStatusService } from "@/services/account/accountStatus.service";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { supportService } from "@/services/support/support.service";
import { useAuthStore } from "@/store/auth.store";
import { describeActionFailure } from "@/errors/errorExperience/describeError";

export function SuspendedAccountScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const clearSessionAndSignOut = useAuthStore((state) => state.clearSessionAndSignOut);
  const notice = useQuery({ queryKey: ["account", "suspension"], queryFn: accountStatusService.fetchMySuspensionNotice });
  const idempotencyKey = useRef(generateIdempotencyKey());
  const appeal = useMutation({
    mutationFn: () =>
      supportService.createSupportTicket(
        { category: "account", subject: "Appeal: account suspension", message: "I would like to appeal the suspension of my account. Please review it again.", attachmentUrls: [], linkedReference: null },
        idempotencyKey.current,
      ),
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text size={22} weight={600} lineHeight={27} accessibilityRole="header">Your account is suspended</Text>
        {notice.data ? (
          <View style={styles.card}>
            <Text size={13} weight={500} lineHeight={16.9} color={colors.textMuted}>Reason</Text>
            <Text size={14} lineHeight={19.6}>{notice.data.reason}</Text>
            <Text size={13} weight={500} lineHeight={16.9} color={colors.textMuted}>Suspended on</Text>
            <Text size={14} lineHeight={19.6}>{formatFriendlyDate(notice.data.suspendedAt)}</Text>
          </View>
        ) : null}
        <Text size={14} lineHeight={19.6} color={colors.textMuted}>
          You can't post, message or sell while your account is suspended.{" "}
          <Text size={14} lineHeight={19.6} color={colors.primary} accessibilityRole="link" onPress={() => openTrustedWebPage(legalLinks.communityGuidelines, inAppBrowserColorsFromTheme(colors))}>Read the Community Guidelines</Text>
        </Text>
        {appeal.isSuccess ? (
          <Text size={14} weight={500} lineHeight={19.6} color={colors.success} accessibilityRole="alert">
            Appeal sent. Our team will reply to your email within 3 working days.
          </Text>
        ) : (
          <Button title="Appeal this decision" loading={appeal.isPending} onPress={() => appeal.mutate()} />
        )}
        {appeal.isError ? <Text size={12} color={colors.error} accessibilityRole="alert">{describeActionFailure(appeal.error)}</Text> : null}
        <DataExportSection />
        {notice.data ? (
          <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
            If the suspension isn't lifted, your profile, posts, media and messages are deleted after {notice.data.retentionDays} days, on {formatFriendlyDate(notice.data.deletionScheduledFor)}. Payment and order records are kept in anonymised form for the period the law requires.
          </Text>
        ) : null}
        <Button variant="subtle" title="Log out" onPress={() => clearSessionAndSignOut()} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40, gap: 18 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 4 },
}));
