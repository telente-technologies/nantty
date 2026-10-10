import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ConfirmActionSheet } from "@/components/escrow/confirmActionSheet";
import { formatFriendlyDate } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { VerificationPlanCard } from "@/components/profile/verificationPlanCard";
import { useMyVerificationQuery, useVerificationPlansQuery, verificationQueryKeys } from "@/components/profile/verificationQueries.hook";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useActingProfileType } from "@/hooks/useActingProfileType.hook";
import { webHandoffService } from "@/services/core/webHandoff.service";
import { MANAGE_ON_THE_WEB_LABEL, verificationForProfileKind } from "@/utils/verificationProfile.util";
import { useActingProfileStore } from "@/store/actingProfile.store";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { verificationService } from "@/services/auth/verification.service";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

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
  const { kind, type } = useActingProfileType();
  const actingProfileId = useActingProfileStore((state) => state.actingProfile?.id ?? "me");
  const subscription = mine.data?.subscription;
  const currentForProfile = verificationForProfileKind(mine.data?.current, kind ?? "person");
  const goldPending = type === "business" && currentForProfile?.status !== "active";
  const application = mine.data?.application;
  const refreshControl = usePullToRefresh(plans.refetch, mine.refetch);
  const loadFailed = (mine.isError && !mine.data) || (plans.isError && !plans.data);

  return (
    <Screen>
      <Header title="Verification" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        {loadFailed ? (
          <ErrorState compact message="Couldn't load verification details." onRetry={() => Promise.all([plans.refetch(), mine.refetch()])} retrying={plans.isRefetching || mine.isRefetching} />
        ) : null}
        {type === "personal" && (currentForProfile || application) ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text size={typeScale.base} weight={600} lineHeight={19.2}>Your verification</Text>
              <VerificationBadge verification={currentForProfile} size={20} />
            </View>
            {application?.status === "pending" ? <StatusPill label="Application under review" tone="caution" /> : null}
            {application?.status === "rejected" ? <Text size={typeScale.sm} color={colors.error}>{application.rejectionReason ?? "Your application wasn't approved."}</Text> : null}
            {subscription ? (
              <Text size={typeScale.sm} lineHeight={17.5} color={colors.textMuted}>
                {subscription.cancelAtPeriodEnd
                  ? `Cancelled — your badge stays until ${subscription.renewsAt ? formatFriendlyDate(subscription.renewsAt) : "the end of this period"}.`
                  : `Renews ${subscription.renewsAt ? formatFriendlyDate(subscription.renewsAt) : "automatically"}.`}
              </Text>
            ) : null}
            {subscription && !subscription.cancelAtPeriodEnd ? <Button variant="subtle" title="Cancel subscription" onPress={() => setCancelSheetVisible(true)} /> : null}
          </View>
        ) : null}

        {type === "personal" ? (
          <View style={styles.section}>
            <Text size={typeScale.base} weight={600} lineHeight={19.2}>Blue: people</Text>
            <Text size={typeScale.sm} lineHeight={17.5} color={colors.textMuted}>For personal accounts, including creator accounts. Confirms you are who you say you are.</Text>
            {(plans.data ?? []).filter((plan) => plan.color === "blue").map((plan) => (
              <VerificationPlanCard key={plan.id} plan={plan} current={subscription?.planId === plan.id} />
            ))}
            <Button title="Get the blue badge" disabled={application?.status === "pending"} onPress={() => navigation.navigate("IdentityVerification")} />
          </View>
        ) : null}

        {type === "business" ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text size={typeScale.base} weight={600} lineHeight={19.2}>Gold: businesses and brands</Text>
              <VerificationBadge verification={currentForProfile} size={20} />
            </View>
            <Text size={typeScale.sm} lineHeight={17.5} color={colors.textMuted}>
              {goldPending ? "Gold after business verification" : "Your business profile is verified."}
            </Text>
            {goldPending ? <Button title="Verify your identity" onPress={() => navigation.navigate("IdentityVerification")} /> : null}
            <Button variant="subtle" title={MANAGE_ON_THE_WEB_LABEL} onPress={() => webHandoffService.openManageBilling(actingProfileId)} />
          </View>
        ) : null}

        {type === "government" ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text size={typeScale.base} weight={600} lineHeight={19.2}>Black: government</Text>
              <VerificationBadge verification={currentForProfile} size={20} />
            </View>
            <Text size={typeScale.sm} lineHeight={17.5} color={colors.textMuted}>Official government bodies apply through a reviewed process. This badge can't be bought in the app.</Text>
            <Button variant="subtle" title="Apply for government verification" onPress={() => webHandoffService.openGovernmentApplication()} />
          </View>
        ) : null}
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
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[5] },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing[4], gap: spacing[2] },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: { gap: 10 },
}));
