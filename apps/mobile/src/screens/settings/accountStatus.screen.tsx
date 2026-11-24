import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppealDecisionSheet, AppealStrikeSheet } from "@/components/accountHealth/appealStrikeSheet";
import { AccountStandingCard, NoticeItem, StrikeItem } from "@/components/accountHealth/accountHealthItems";
import { useMyAccountHealth, useMyModerationDecisions } from "@/components/accountHealth/accountHealth.hook";
import { CounterNoticeSheet } from "@/components/accountHealth/counterNoticeSheet";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { BookOpenText24Icon } from "@/components/icons";
import { BrandLoader } from "@/components/ui/brandLoader";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { useTheme } from "@/theme";
import type { AccountStrike, CopyrightNotice, ModerationDecision } from "@/types";

const HELP_TOPIC_SLUG = "copyright-and-account-status";

export function AccountStatusScreen({ navigation }: MainScreenProps<"AccountStatus">) {
  const { colors } = useTheme();
  const { data: health, isPending, isError, error, refetch } = useMyAccountHealth();
  const decisionsQuery = useMyModerationDecisions();
  const [appealTarget, setAppealTarget] = useState<AccountStrike | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<ModerationDecision | null>(null);
  const [counterNoticeTarget, setCounterNoticeTarget] = useState<CopyrightNotice | null>(null);
  const decisions = decisionsQuery.data?.data ?? [];

  return (
    <SettingsPage title="Account status" contentTopSpacing={24} gap={28}>
      {isPending ? <BrandLoader size="md" /> : null}
      {isError ? <ErrorState error={error} variant="section" message="Couldn't load your account status." onRetry={() => refetch()} /> : null}
      {health ? (
        <>
          <AccountStandingCard health={health} />
          <Section title="Copyright notices" empty="No copyright claims against your content." count={health.notices.length}>
            {health.notices.map((notice) => <NoticeItem key={notice.claimId} notice={notice} onCounterNotice={() => setCounterNoticeTarget(notice)} />)}
          </Section>
          <Section title="Active strikes" empty="You have no active strikes." count={health.strikes.length}>
            {health.strikes.map((strike) => <StrikeItem key={strike.id} strike={strike} onAppeal={() => setAppealTarget(strike)} />)}
          </Section>
          <Section title="Warnings on record" empty="No warnings." count={health.warnings.length}>
            {health.warnings.map((warning) => <StrikeItem key={warning.id} strike={warning} onAppeal={() => setAppealTarget(warning)} />)}
          </Section>
          <Section title="Content decisions" empty="No recent content moderation decisions." count={decisions.length}>
            {decisions.map((decision) => (
              <View key={decision.reportId} style={styles.decisionCard}>
                <Text size={14} weight={600} lineHeight={18.2}>
                  {(decision.target.label ?? decision.target.type).toUpperCase()} · {decision.action.replace(/_/g, " ").toLowerCase()}
                </Text>
                <Text size={13} lineHeight={18.2} color={colors.textMuted}>{decision.reason}</Text>
                {decision.appeal ? (
                  <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Appeal {decision.appeal.status.toLowerCase()}</Text>
                ) : decision.appealable ? (
                  <Text size={13} weight={600} lineHeight={18.2} color={colors.primary} accessibilityRole="button" onPress={() => setDecisionTarget(decision)}>
                    Appeal decision
                  </Text>
                ) : null}
              </View>
            ))}
          </Section>
          <SettingsGroup>
            <SettingsRow label="Learn about copyright and strikes" icon={<BookOpenText24Icon />} onPress={() => navigation.navigate("HelpArticle", { topicSlug: HELP_TOPIC_SLUG })} />
          </SettingsGroup>
        </>
      ) : null}
      <AppealStrikeSheet strike={appealTarget} onClose={() => setAppealTarget(null)} />
      <AppealDecisionSheet decision={decisionTarget} onClose={() => setDecisionTarget(null)} />
      <CounterNoticeSheet notice={counterNoticeTarget} onClose={() => setCounterNoticeTarget(null)} />
    </SettingsPage>
  );
}

function Section({ title, empty, count, children }: { readonly title: string; readonly empty: string; readonly count: number; readonly children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text size={15} weight={600} lineHeight={19.5}>{title}</Text>
      {count === 0 ? <Text size={13} lineHeight={18.2} color={colors.textMuted}>{empty}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({ section: { gap: 10 }, decisionCard: { gap: 6, paddingVertical: 8 } });
