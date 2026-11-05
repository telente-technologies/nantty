import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { useCreatorApplicationQuery } from "@/components/creator/creatorQueries.hook";
import { formatFriendlyDate, formatFriendlyDateTime } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

const STATUS_COPY = {
  pending: { label: "Under review", tone: "caution" as const, title: "We're reviewing your application", body: "Reviews usually take 3–5 working days. We'll notify you when there's a decision." },
  approved: { label: "Approved", tone: "success" as const, title: "Welcome to the Creator Program!", body: "You can now go live, receive gifts, earn affiliate commissions and offer subscriptions." },
  rejected: { label: "Not approved", tone: "error" as const, title: "Your application wasn't approved this time", body: "See the reason below. You can apply again after the date shown." },
};

export function CreatorApplicationStatusScreen({ navigation }: MainScreenProps<"CreatorApplicationStatus">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const application = useCreatorApplicationQuery();
  const details = application.data;
  if (!details) {
    return (
      <Screen>
        <Header title="Creator application" />
        {application.isLoading ? <ListSkeleton /> : application.isError ? (
          <ErrorState error={application.error} message="Couldn't load your application." onRetry={() => application.refetch()} retrying={application.isRefetching} />
        ) : (
          <View style={styles.empty}>
            <Text align="center" color={colors.textSubtle}>You haven't applied yet.</Text>
            <Button title="See the Creator Program" onPress={() => navigation.replace("CreatorProgram")} />
          </View>
        )}
      </Screen>
    );
  }
  const copy = STATUS_COPY[details.status];
  const canReapply = details.status === "rejected" && (!details.reapplyAvailableAt || new Date(details.reapplyAvailableAt).getTime() <= Date.now());
  return (
    <Screen>
      <Header title="Creator application" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={application.isRefetching} onRefresh={() => { void application.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}>
        <View style={styles.card}>
          <StatusPill label={copy.label} tone={copy.tone} />
          <Text size={21} weight={600} lineHeight={25.2} accessibilityRole="header">{copy.title}</Text>
          <Text size={typeScale.md} lineHeight={19.6} color={colors.textMuted}>{copy.body}</Text>
          <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>Submitted {formatFriendlyDateTime(details.submittedAt)}</Text>
          {details.rejectionReason ? <Text size={typeScale.sm} lineHeight={17.5} color={colors.error}>{details.rejectionReason}</Text> : null}
          {details.reapplyAvailableAt ? <Text size={typeScale.sm} weight={500} lineHeight={17.5}>You can re-apply from {formatFriendlyDate(details.reapplyAvailableAt)}.</Text> : null}
        </View>
        {details.status === "approved" ? <Button title="Open creator dashboard" onPress={() => navigation.replace("CreatorDashboard")} /> : null}
        {details.status === "rejected" ? <Button title="Apply again" disabled={!canReapply} onPress={() => navigation.replace("CreatorApplication")} /> : null}
        <Button variant="subtle" title="Check eligibility" onPress={() => navigation.navigate("CreatorProgram")} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  empty: { padding: spacing[7], gap: spacing[4] },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[4] },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing[4], gap: spacing[2] },
}));
