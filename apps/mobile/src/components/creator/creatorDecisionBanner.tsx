import { StyleSheet, View } from "react-native";

import { StatusPill, type StatusTone } from "@/components/escrow/statusPill";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { CreatorProgramDecision } from "@/types/creator.type";

const DECISION_APPEARANCE: Record<CreatorProgramDecision, { label: string; tone: StatusTone }> = {
  auto_approve: { label: "Instant approval", tone: "success" },
  manual_review: { label: "Manual review", tone: "caution" },
  not_eligible: { label: "Not eligible yet", tone: "neutral" },
  unavailable: { label: "Eligibility data unavailable", tone: "caution" },
};

export function CreatorDecisionBanner({ decision, note }: { decision: CreatorProgramDecision; note: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <StatusPill label={DECISION_APPEARANCE[decision].label} tone={DECISION_APPEARANCE[decision].tone} />
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: "flex-start", gap: 6 } });
