import { useNavigation } from "@react-navigation/native";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { formatCountdownUntil } from "@/utils/payoutName.util";

import { usePayoutOnboardingQuery } from "./payoutOnboardingQueries.hook";

export type PayoutSetupCardContext = "creator" | "seller";

export function PayoutSetupCard({ context: forcedContext }: { readonly context?: PayoutSetupCardContext }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const { data: state } = usePayoutOnboardingQuery();
  if (!state || state.status === "verified") return null;
  const context: PayoutSetupCardContext = forcedContext ?? (state.role === "creator" ? "creator" : "seller");

  const waiting = state.accountStatus === "pending_creation" && state.completedSteps.length > 0;
  const ready = state.accountStatus === "documentsRequired" && state.status === "in_progress";
  const withdrawable = state.pendingWithdrawable ? formatMoneyForDisplay(state.pendingWithdrawable) : null;
  const title = state.status === "pending_review" ? "Payouts are in review"
    : state.status === "action_needed" ? "Action needed on your payouts"
    : ready ? (withdrawable ? `Verify your ID to withdraw ${withdrawable}` : "Your payout account is ready. Verify your ID")
    : waiting ? "Setting up your payout account"
    : context === "creator" ? "Set up payouts to receive gift earnings" : "Set up payouts to withdraw your sales";
  const lockCopy = context === "seller" && state.firstEarningsUnlockAt
    ? `Selling works as normal. Your first earnings unlock for withdrawal in ${formatCountdownUntil(state.firstEarningsUnlockAt)}, and withdrawing needs payout setup. Finish before then and nothing waits.`
    : context === "creator"
      ? "Gifts keep adding up while you set this up. Withdrawing needs it. It takes about 5 minutes and covers your seller earnings too."
      : "Earnings are recorded while you set this up. Withdrawing needs it.";
  const cta = state.completedSteps.length === 0 ? "Get started" : state.status === "action_needed" ? "See what's needed" : "Continue";

  return (
    <View style={styles.card}>
      <Text size={15} weight={600} lineHeight={19.5}>{title}</Text>
      <Text size={13} lineHeight={18} color={colors.textMuted}>{lockCopy}</Text>
      <Button title={cta} height={40} onPress={() => navigation.navigate("PayoutSetup", { context })} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({ card: { backgroundColor: colors.primaryTint, borderRadius: 12, padding: 14, gap: 8 } }));
