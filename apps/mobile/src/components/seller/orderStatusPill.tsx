import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";
import type { OrderStatus } from "@/types";

const STATUS_APPEARANCE: Record<OrderStatus, { label: string; text: string; background: string }> = {
  pending: { label: "Pending", text: colors.primary, background: palette.primary[50] },
  paid: { label: "Pending", text: colors.primary, background: palette.primary[50] },
  shipped: { label: "Shipped", text: palette.caution[500], background: palette.caution[50] },
  delivered: { label: "Delivered", text: palette.success[500], background: palette.success[50] },
  completed: { label: "Completed", text: palette.success[500], background: palette.success[50] },
  cancelled: { label: "Cancelled", text: palette.error[500], background: palette.error[50] },
  disputed: { label: "Disputed", text: palette.error[500], background: palette.error[50] },
};

export const orderStatusLabel = (status: OrderStatus) => STATUS_APPEARANCE[status].label;

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const appearance = STATUS_APPEARANCE[status];
  return (
    <View style={[styles.pill, { backgroundColor: appearance.background }]}>
      <Text size={13} weight={500} lineHeight={16.9} color={appearance.text}>
        {appearance.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ pill: { height: 25, paddingHorizontal: 8, borderRadius: 99, justifyContent: "center" } });
