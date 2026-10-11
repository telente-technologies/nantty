import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppealStrikeSheet } from "@/components/accountHealth/appealStrikeSheet";
import { AccountStandingCard, NoticeItem, StrikeItem } from "@/components/accountHealth/accountHealthItems";
import { useMyAccountHealth } from "@/components/accountHealth/accountHealth.hook";
import { CounterNoticeSheet } from "@/components/accountHealth/counterNoticeSheet";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { BookOpenText24Icon } from "@/components/icons";
import { BrandLoader } from "@/components/ui/brandLoader";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { useTheme } from "@/theme";
import type { AccountStrike, CopyrightNotice } from "@/types";

const HELP_TOPIC_SLUG = "copyright-and-account-status";

export function AccountStatusScreen({ navigation }: MainScreenProps<"AccountStatus">) {
  const { colors } = useTheme();
  const { data: health, isPending, isError, refetch } = useMyAccountHealth();
  const [appealTarget, setAppealTarget] = useState<AccountStrike | null>(null);
  const [counterNoticeTarget, setCounterNoticeTarget] = useState<CopyrightNotice | null>(null);

  return (
    <SettingsPage title="Account status" contentTopSpacing={24} gap={28}>
      {isPending ? <BrandLoader size="md" /> : null}
      {isError ? <ErrorState onRetry={() => refetch()} /> : null}
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
          <SettingsGroup>
            <SettingsRow label="Learn about copyright and strikes" icon={<BookOpenText24Icon />} onPress={() => navigation.navigate("HelpArticle", { topicSlug: HELP_TOPIC_SLUG })} />
          </SettingsGroup>
        </>
      ) : null}
      <AppealStrikeSheet strike={appealTarget} onClose={() => setAppealTarget(null)} />
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

const styles = StyleSheet.create({ section: { gap: 10 } });
