import { StyleSheet, View } from "react-native";

import { inAppBrowserColorsFromTheme, openUserSuppliedWebLink } from "@/components/links/openLink.util";
import { Check16Icon, Warning20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme, type ThemeColors } from "@/theme";
import type { EscrowDetail } from "@/types/commerce.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { formatFriendlyDate, formatFriendlyDateTime } from "./escrowStage.util";

type StepState = "done" | "current" | "upcoming" | "problem";

interface TimelineStep {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly state: StepState;
  readonly trackingUrl?: string | null;
}

const lastCompletedStepIndex = (escrow: EscrowDetail): number => {
  if (escrow.releasedAt) return 5;
  if (escrow.buyerConfirmedAt) return 4;
  if (escrow.deliveredAt) return 3;
  if (escrow.shipment) return 2;
  if (escrow.paidAt) return 0;
  return -1;
};

function buildTimelineSteps(escrow: EscrowDetail, viewerRole: "buyer" | "seller"): TimelineStep[] {
  const completed = lastCompletedStepIndex(escrow);
  const paused = escrow.stage === "disputed" || escrow.stage === "refunded";
  const stateFor = (index: number): StepState => (index <= completed ? "done" : index === completed + 1 && !paused ? "current" : "upcoming");
  const storeName = escrow.store.name;
  const shipment = escrow.shipment;
  const steps: TimelineStep[] = [
    {
      key: "paid",
      title: "Paid into escrow",
      detail: escrow.paidAt ? `${formatMoneyForDisplay(escrow.heldAmount)} held safely by Zudomart · ${formatFriendlyDateTime(escrow.paidAt)}` : "Waiting for your payment",
      state: escrow.paidAt ? "done" : "current",
    },
    {
      key: "preparing",
      title: "Seller preparing",
      detail: viewerRole === "seller" ? "Pack the order and add the courier's tracking number" : `${storeName} is packing your order`,
      state: stateFor(1),
    },
    {
      key: "shipped",
      title: "Shipped",
      detail: shipment ? `${shipment.courierName} · ${shipment.trackingNumber} · ${formatFriendlyDate(shipment.shippedAt)}` : "Courier and tracking number will appear here",
      state: stateFor(2),
      trackingUrl: shipment?.trackingUrl,
    },
    {
      key: "delivered",
      title: "Delivered",
      detail: escrow.deliveredAt
        ? formatFriendlyDateTime(escrow.deliveredAt)
        : shipment?.estimatedDeliveryAt
          ? `Expected by ${formatFriendlyDate(shipment.estimatedDeliveryAt)}`
          : "Arrives after shipping",
      state: stateFor(3),
    },
    {
      key: "confirmed",
      title: escrow.buyerConfirmedAt ? "Buyer confirmed" : "Buyer confirms or auto-release",
      detail: escrow.buyerConfirmedAt
        ? `Confirmed ${formatFriendlyDateTime(escrow.buyerConfirmedAt)}`
        : escrow.autoReleaseAt
          ? `Released automatically on ${formatFriendlyDate(escrow.autoReleaseAt)} unless a problem is reported`
          : "Buyer has 3 days after delivery to confirm or report a problem",
      state: escrow.releasedAt && !escrow.buyerConfirmedAt ? "done" : stateFor(4),
    },
    {
      key: "released",
      title: "Released to seller",
      detail: escrow.releasedAt
        ? `${formatMoneyForDisplay(escrow.sellerPayoutAmount)} paid to ${storeName} · ${formatFriendlyDate(escrow.releasedAt)}`
        : `${storeName} receives ${formatMoneyForDisplay(escrow.sellerPayoutAmount)} after the ${formatMoneyForDisplay(escrow.platformFee)} fee`,
      state: stateFor(5),
    },
  ];
  if (!paused) return steps;
  const problemStep: TimelineStep = {
    key: "problem",
    title: escrow.stage === "refunded" ? "Refunded to buyer" : "Dispute open — release paused",
    detail: escrow.stage === "refunded" ? `${formatMoneyForDisplay(escrow.heldAmount)} returned to the buyer` : "Zudomart is holding the money until the dispute is resolved",
    state: "problem",
  };
  return [...steps.slice(0, completed + 1), problemStep, ...steps.slice(completed + 1)];
}

const circleColorsFor = (colors: ThemeColors): Record<StepState, { background: string; border: string }> => ({
  done: { background: colors.primarySolid, border: colors.primarySolid },
  current: { background: colors.surface, border: colors.primary },
  upcoming: { background: colors.surface, border: colors.divider },
  problem: { background: colors.errorTint, border: colors.error },
});

export function EscrowTimeline({ escrow, viewerRole }: { escrow: EscrowDetail; viewerRole: "buyer" | "seller" }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const steps = buildTimelineSteps(escrow, viewerRole);
  return (
    <View accessibilityRole="list">
      {steps.map((step, index) => (
        <View key={step.key} style={styles.step} accessibilityLabel={`${step.title}. ${step.detail}. ${step.state === "done" ? "Done" : step.state === "current" ? "In progress" : ""}`}>
          <View style={styles.rail}>
            <View style={[styles.circle, { backgroundColor: circleColorsFor(colors)[step.state].background, borderColor: circleColorsFor(colors)[step.state].border }]}>
              {step.state === "done" ? <Check16Icon size={12} color={colors.white} /> : null}
              {step.state === "current" ? <View style={styles.currentDot} /> : null}
              {step.state === "problem" ? <Warning20Icon size={12} color={colors.error} /> : null}
            </View>
            {index < steps.length - 1 ? <View style={[styles.line, step.state === "done" && styles.lineDone]} /> : null}
          </View>
          <View style={styles.texts}>
            <Text size={14} weight={step.state === "upcoming" ? 400 : 500} lineHeight={16.8} color={step.state === "upcoming" ? colors.textSubtle : step.state === "problem" ? colors.error : colors.text}>
              {step.title}
            </Text>
            <Text size={12} lineHeight={16.8} color={colors.textMuted}>
              {step.detail}
            </Text>
            {step.trackingUrl && step.state !== "upcoming" ? (
              <Text size={12} weight={500} lineHeight={16.8} color={colors.primary} accessibilityRole="link" onPress={() => openUserSuppliedWebLink(step.trackingUrl!, inAppBrowserColorsFromTheme(colors))}>
                Track parcel
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  step: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 20 },
  circle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  currentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primarySolid },
  line: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.divider, marginVertical: 2 },
  lineDone: { backgroundColor: colors.primarySolid },
  texts: { flex: 1, paddingBottom: 18, gap: 2 },
}));
