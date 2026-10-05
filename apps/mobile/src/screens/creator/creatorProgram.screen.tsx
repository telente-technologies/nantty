import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { CreatorDecisionBanner } from "@/components/creator/creatorDecisionBanner";
import { EligibilityChecklist } from "@/components/creator/eligibilityChecklist";
import { useCreatorApplicationQuery, useCreatorEligibilityQuery, useCreatorRevenueRulesQuery } from "@/components/creator/creatorQueries.hook";
import { RevenueRulesCard } from "@/components/creator/revenueRulesCard";
import { StatusPill } from "@/components/escrow/statusPill";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { palette } from "@/constants/colors.constant";
import { makeThemedStyles, useTheme } from "@/theme";
import { useCreatorStatus } from "@/hooks/useCreatorStatus.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

const BENEFITS = [
  { title: "Go live", body: "Host live shows, pin products and chat with your audience in real time." },
  { title: "Receive gifts", body: "Fans send gifts during your lives — they turn into real earnings." },
  { title: "Earn affiliate commissions", body: "Promote sellers' products and earn a commission on every confirmed sale." },
  { title: "Fan subscriptions", body: "Offer monthly plans with perks for your most loyal followers." },
];

export function CreatorProgramScreen({ navigation }: MainScreenProps<"CreatorProgram">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { isApprovedCreator } = useCreatorStatus();
  const eligibility = useCreatorEligibilityQuery();
  const application = useCreatorApplicationQuery();
  const revenueRules = useCreatorRevenueRulesQuery();
  const applicationStatus = application.data?.status;
  const approved = isApprovedCreator || applicationStatus === "approved";

  const primaryAction = approved
    ? { title: "Open creator dashboard", onPress: () => navigation.navigate("CreatorDashboard"), disabled: false }
    : applicationStatus === "pending" || applicationStatus === "rejected"
      ? { title: "View application status", onPress: () => navigation.navigate("CreatorApplicationStatus"), disabled: false }
      : { title: eligibility.data?.eligible ? "Apply now" : "Apply when you're eligible", onPress: () => navigation.navigate("CreatorApplication"), disabled: !eligibility.data?.eligible };

  return (
    <Screen>
      <Header title="Creator Program" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={eligibility.isRefetching} onRefresh={() => Promise.all([eligibility.refetch(), application.refetch()])} tintColor={colors.primary} />}
      >
        <View style={styles.hero}>
          {approved ? <StatusPill label="You're a Zudomart Creator" tone="success" /> : null}
          <Text size={21} weight={600} lineHeight={25.2} color={colors.white}>Turn your audience into income</Text>
          <Text size={typeScale.md} lineHeight={19.6} color={palette.primary[50]}>
            Accepted creators can go live, receive gifts, earn commissions on sellers' products and offer paid subscriptions.
          </Text>
        </View>

        <View style={styles.card}>
          <Text size={typeScale.base} weight={600} lineHeight={19.2}>What you get</Text>
          {BENEFITS.map((benefit) => (
            <View key={benefit.title} style={styles.benefit}>
              <Text size={typeScale.md} weight={500} lineHeight={16.8}>{benefit.title}</Text>
              <Text size={typeScale.sm} lineHeight={17.5} color={colors.textMuted}>{benefit.body}</Text>
            </View>
          ))}
        </View>

        {!approved ? (
          <View style={styles.card}>
            <Text size={typeScale.base} weight={600} lineHeight={19.2}>Eligibility</Text>
            {eligibility.data ? <CreatorDecisionBanner decision={eligibility.data.decision} note={eligibility.data.decisionNote} /> : null}
            {eligibility.data ? (
              <EligibilityChecklist requirements={eligibility.data.requirements} />
            ) : eligibility.isError ? (
              <ErrorState compact message="Couldn't check your eligibility." onRetry={() => eligibility.refetch()} retrying={eligibility.isRefetching} />
            ) : (
              <ListSkeleton rows={3} />
            )}
          </View>
        ) : null}

        {revenueRules.data ? <RevenueRulesCard rules={revenueRules.data} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button title={primaryAction.title} disabled={primaryAction.disabled} onPress={primaryAction.onPress} />
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[6], gap: spacing[4] },
  hero: { backgroundColor: colors.primarySolid, borderRadius: 12, padding: spacing[5], gap: spacing[2] },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing[4], gap: spacing[3] },
  benefit: { gap: 2 },
  footer: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[6] },
}));
