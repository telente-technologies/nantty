import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";

import { ConfirmActionSheet } from "@/components/escrow/confirmActionSheet";
import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { VerificationPlanCard } from "@/components/profile/verificationPlanCard";
import { useMyVerificationQuery, useVerificationPlansQuery, verificationQueryKeys } from "@/components/profile/verificationQueries.hook";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { buildContactMailtoUrl } from "@/constants/contactEmails.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { verificationService } from "@/services/verification.service";

const COLOUR_SECTIONS = [
  { color: "blue" as const, title: "Blue — people", body: "For individuals and creators. Confirms you are who you say you are." },
  { color: "gold" as const, title: "Gold — businesses & stores", body: "For registered businesses. Includes access to the Zudomart Dashboard with one subscription." },
];

export function VerificationScreen({ navigation }: MainScreenProps<"Verification">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const plans = useVerificationPlansQuery();
  const mine = useMyVerificationQuery();
  const [cancelSheetVisible, setCancelSheetVisible] = useState(false);
  const cancelKey = useRef(generateIdempotencyKey());
  const cancelSubscription = useMutation({
    mutationFn: () => verificationService.cancelVerificationSubscription(cancelKey.current),
    onSuccess: (updated) => {
      queryClient.setQueryData(verificationQueryKeys.mine, updated);
      setCancelSheetVisible(false);
    },
  });
  const subscription = mine.data?.subscription;
  const application = mine.data?.application;

  return (
    <Screen>
      <Header title="Verification" />
      <ScrollView contentContainerStyle={styles.content}>
        {mine.data?.current || application ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text size={16} weight={600} lineHeight={19.2}>Your verification</Text>
              <VerificationBadge verification={mine.data?.current} size={20} />
            </View>
            {application?.status === "pending" ? <StatusPill label="Application under review" tone="caution" /> : null}
            {application?.status === "rejected" ? <Text size={13} color={colors.error}>{application.rejectionReason ?? "Your application wasn't approved."}</Text> : null}
            {subscription ? (
              <Text size={13} lineHeight={17.5} color={colors.textMuted}>
                {subscription.cancelAtPeriodEnd
                  ? `Cancelled — your badge stays until ${subscription.renewsAt ? formatFriendlyDate(subscription.renewsAt) : "the end of this period"}.`
                  : `Renews ${subscription.renewsAt ? formatFriendlyDate(subscription.renewsAt) : "automatically"}.`}
              </Text>
            ) : null}
            {subscription && !subscription.cancelAtPeriodEnd ? <Button variant="subtle" title="Cancel subscription" onPress={() => setCancelSheetVisible(true)} /> : null}
          </View>
        ) : null}

        {COLOUR_SECTIONS.map((section) => (
          <View key={section.color} style={styles.section}>
            <Text size={16} weight={600} lineHeight={19.2}>{section.title}</Text>
            <Text size={13} lineHeight={17.5} color={colors.textMuted}>{section.body}</Text>
            {(plans.data ?? []).filter((plan) => plan.color === section.color).map((plan) => (
              <VerificationPlanCard key={plan.id} plan={plan} current={subscription?.planId === plan.id} />
            ))}
            <Button
              title={section.color === "blue" ? "Get the blue badge" : "Verify my business"}
              variant={section.color === "blue" ? "primary" : "subtle"}
              disabled={application?.status === "pending"}
              onPress={() => navigation.navigate("VerificationApply", { color: section.color })}
            />
          </View>
        ))}

        <View style={styles.card}>
          <View style={styles.row}>
            <Text size={16} weight={600} lineHeight={19.2}>Black — government</Text>
            <VerificationBadge verification={{ status: "active", type: "government", color: "black", tier: "OFFICIAL", badgeVisible: true }} size={20} />
          </View>
          <Text size={13} lineHeight={17.5} color={colors.textMuted}>
            Official government bodies apply through our official process. This badge can't be bought.
          </Text>
          <Text size={13} weight={500} lineHeight={17.5} color={colors.primary} accessibilityRole="link" onPress={() => Linking.openURL(buildContactMailtoUrl("Official government verification"))}>
            Contact our government partnerships team
          </Text>
        </View>
      </ScrollView>
      <ConfirmActionSheet
        visible={cancelSheetVisible}
        title="Cancel verification?"
        message="Your badge and perks stay until the end of the current billing period. You won't be charged again."
        confirmTitle="Cancel subscription"
        confirming={cancelSubscription.isPending}
        errorMessage={cancelSubscription.isError ? cancelSubscription.error.message : null}
        onConfirm={() => cancelSubscription.mutate()}
        onClose={() => setCancelSheetVisible(false)}
      />
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: { gap: 10 },
}));
