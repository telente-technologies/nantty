import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { useCreatorApplicationQuery } from "@/components/creator/creatorQueries.hook";
import { formatFriendlyDate, formatFriendlyDateTime } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";

const STATUS_COPY = {
  pending: { label: "Under review", tone: "caution" as const, title: "We're reviewing your application", body: "Reviews usually take 3–5 working days. We'll notify you when there's a decision." },
  approved: { label: "Approved", tone: "success" as const, title: "Welcome to the Creator Program!", body: "You can now go live, receive gifts, earn affiliate commissions and offer subscriptions." },
  rejected: { label: "Not approved", tone: "error" as const, title: "Your application wasn't approved this time", body: "See the reason below. You can apply again after the date shown." },
};

export function CreatorApplicationStatusScreen({ navigation }: MainScreenProps<"CreatorApplicationStatus">) {
  const application = useCreatorApplicationQuery();
  const details = application.data;
  if (!details) {
    return (
      <Screen>
        <Header title="Creator application" />
        {application.isLoading ? <ActivityIndicator style={styles.state} color={colors.primary} /> : (
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
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={application.isRefetching} onRefresh={() => application.refetch()} tintColor={colors.primary} />}>
        <View style={styles.card}>
          <StatusPill label={copy.label} tone={copy.tone} />
          <Text size={21} weight={600} lineHeight={25.2} accessibilityRole="header">{copy.title}</Text>
          <Text size={14} lineHeight={19.6} color={colors.textMuted}>{copy.body}</Text>
          <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Submitted {formatFriendlyDateTime(details.submittedAt)}</Text>
          {details.rejectionReason ? <Text size={13} lineHeight={17.5} color={colors.error}>{details.rejectionReason}</Text> : null}
          {details.reapplyAvailableAt ? <Text size={13} weight={500} lineHeight={17.5}>You can re-apply from {formatFriendlyDate(details.reapplyAvailableAt)}.</Text> : null}
        </View>
        {details.status === "approved" ? <Button title="Open creator dashboard" onPress={() => navigation.replace("CreatorDashboard")} /> : null}
        {details.status === "rejected" ? <Button title="Apply again" disabled={!canReapply} onPress={() => navigation.replace("CreatorApplication")} /> : null}
        <Button variant="subtle" title="Check eligibility" onPress={() => navigation.navigate("CreatorProgram")} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: 80 },
  empty: { padding: 32, gap: 16 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 8 },
});
