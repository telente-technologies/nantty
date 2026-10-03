import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";
import type { PayoutOnboardingState, PayoutOnboardingStep } from "@/types/payoutOnboarding.type";

import { SyncBadge } from "./syncBadge";

const LABELS: Record<PayoutOnboardingStep, string> = { identity: "Personal details", business: "Business details", bank: "Bank account", document: "ID document" };

export function StepSyncList({ state }: { readonly state: PayoutOnboardingState }) {
  const styles = useStyles();
  const rows = state.completedSteps.filter((step) => state.syncByStep[step]);
  if (!rows.length) return null;
  return (
    <View style={styles.card}>
      {rows.map((step) => (
        <View key={step} style={styles.row}>
          <Text size={14} lineHeight={16.8}>{LABELS[step]}</Text>
          <SyncBadge status={state.syncByStep[step]!} />
        </View>
      ))}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));
