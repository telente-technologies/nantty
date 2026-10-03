import { StyleSheet, View } from "react-native";

import { SealCheck20Icon, Warning20Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";

interface PayoutStatusPanelProps {
  readonly state: PayoutOnboardingState;
  readonly context: "seller" | "creator";
  readonly onFix: () => void;
  readonly onDone: () => void;
}

const COPY = {
  pending_review: {
    title: "Pending review",
    body: "We're reviewing your documents. You can carry on, we'll notify you when it's done.",
    withdrawals: "Withdrawals stay locked until review finishes. Your earnings keep building and nothing is lost.",
  },
  action_needed: {
    title: "Action needed",
    body: "We couldn't finish verifying you. Fix the items below and resubmit. Nothing you already entered is lost.",
    withdrawals: "Withdrawals stay locked until you fix these. Your earnings keep building in the meantime.",
  },
  verified: {
    title: "You're verified",
    body: "Your payout account is verified.",
    withdrawals: "You can withdraw available earnings to your bank account. Your first withdrawal is held for one quick safety review.",
  },
} as const;

export function PayoutStatusPanel({ state, context, onFix, onDone }: PayoutStatusPanelProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const key = state.status === "verified" ? "verified" : state.status === "action_needed" ? "action_needed" : "pending_review";
  const copy = COPY[key];
  const sharedAccountNote = key === "verified" && state.verifiedVia && state.verifiedVia !== context
    ? `Your ${state.verifiedVia} payout setup covers this too. One payout account for everything you earn, so there is nothing more to do.`
    : null;
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        {key === "verified" ? <SealCheck20Icon size={32} color={colors.success} /> : key === "action_needed" ? <Warning20Icon size={32} color={colors.error} /> : null}
        <Text size={22} weight={600} lineHeight={28} align="center" accessibilityRole="header">{copy.title}</Text>
        <Text size={14} lineHeight={20} align="center" color={colors.textMuted}>{key === "pending_review" && state.reviewEstimate ? `We're reviewing your documents. This usually takes ${state.reviewEstimate}. You can carry on, we'll notify you when it's done.` : copy.body}</Text>
        {sharedAccountNote ? <Text size={14} lineHeight={20} align="center">{sharedAccountNote}</Text> : null}
      </View>
      {key === "action_needed" ? (
        <View style={styles.card}>
          {state.reasons.map((reason) => (
            <View key={reason.code} style={styles.reason}>
              <Text size={14} weight={500} lineHeight={18.2}>{reason.step === "identity" ? "Personal details" : reason.step === "document" ? "ID document" : reason.step === "bank" ? "Bank account" : "Business details"}</Text>
              <Text size={13} lineHeight={18} color={colors.textMuted}>{reason.message}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {state.bankSummary ? (
        <View style={styles.card}>
          <Text size={12} lineHeight={14.4} color={colors.textMuted}>Payout account</Text>
          <Text size={14} weight={500} lineHeight={16.8}>{state.bankSummary}</Text>
        </View>
      ) : null}
      <View style={styles.card}>
        <Text size={14} weight={600} lineHeight={16.8}>What this means for withdrawals</Text>
        <Text size={13} lineHeight={18} color={colors.textMuted}>{copy.withdrawals}</Text>
      </View>
      {key === "action_needed" ? <Button title="Fix it" onPress={onFix} /> : null}
      {key === "verified" ? <Button title={context === "creator" ? "Back to Creator Studio" : "Go to wallet"} onPress={onDone} /> : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  wrap: { gap: 16 },
  hero: { alignItems: "center", gap: 8, paddingVertical: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 6 },
  reason: { gap: 2, paddingBottom: 8 },
}));
