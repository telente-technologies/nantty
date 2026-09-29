import { StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { OrderStatus } from "@/types";

const STEPS = [
  { key: "pending", label: "Pending", detail: "Order placed and payment held in escrow" },
  { key: "shipped", label: "Shipped", detail: "The seller has sent your order" },
  { key: "delivered", label: "Delivered", detail: "Confirm receipt to release payment" },
] as const;

const progressOf = (status: OrderStatus) => {
  if (status === "completed" || status === "delivered") return 2;
  if (status === "shipped") return 1;
  return 0;
};

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const reached = progressOf(status);
  return (
    <View style={styles.list} accessibilityRole="list">
      {STEPS.map((step, index) => {
        const done = index <= reached;
        return (
          <View key={step.key} style={styles.step} accessibilityLabel={`${step.label}${done ? ", done" : ""}`}>
            <View style={styles.rail}>
              <View style={[styles.circle, done && styles.circleDone]}>{done ? <Check16Icon size={12} color={colors.white} /> : null}</View>
              {index < STEPS.length - 1 ? <View style={[styles.line, index < reached && styles.lineDone]} /> : null}
            </View>
            <View style={styles.texts}>
              <Text size={14} weight={500} lineHeight={16.8} color={done ? colors.black : colors.textSubtle}>
                {step.label}
              </Text>
              <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
                {step.detail}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  step: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center" },
  circle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.divider, alignItems: "center", justifyContent: "center" },
  circleDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  line: { width: 2, flex: 1, minHeight: 28, backgroundColor: colors.divider },
  lineDone: { backgroundColor: colors.primary },
  texts: { flex: 1, paddingBottom: 20, gap: 2 },
});
