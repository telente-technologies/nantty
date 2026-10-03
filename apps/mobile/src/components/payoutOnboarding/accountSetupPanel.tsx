import { useMutation } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { payoutOnboardingService } from "@/services/payoutOnboarding.service";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";

export function AccountSetupPanel({ state, onChanged }: { readonly state: PayoutOnboardingState; readonly onChanged: () => Promise<unknown> | void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const retry = useMutation({ mutationFn: payoutOnboardingService.retryAccountCreation, onSuccess: onChanged });
  const failed = state.accountStatus === "failed";
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      {failed ? null : <ActivityIndicator color={colors.primary} />}
      <Text size={18} weight={600} lineHeight={23} align="center">
        {failed ? "We couldn't finish setting up your payout account" : "Setting up your payout account…"}
      </Text>
      <Text size={14} lineHeight={20} align="center" color={colors.textMuted}>
        {failed
          ? "We'll keep trying automatically. Your details are saved, so there is nothing to type again."
          : "This runs in the background. You can leave this screen and come back, and we'll let you know when it's ready."}
      </Text>
      {state.earningsPendingTransfer ? (
        <Text size={13} lineHeight={18} align="center" color={colors.textMuted}>
          Earnings in the meantime are recorded and show as pending transfer. Only direct payments and withdrawals wait for this.
        </Text>
      ) : null}
      {failed ? <Button title="Try again" loading={retry.isPending} onPress={() => retry.mutate()} /> : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({ card: { backgroundColor: colors.surface, borderRadius: 12, padding: 20, gap: 12, alignItems: "stretch" } }));
