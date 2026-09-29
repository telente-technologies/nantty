import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";
import type { OrderStatus } from "@/types";

const LOOKS: Record<OrderStatus, { label: string; background: string; text: string }> = {
  pending: { label: "Pending", background: palette.primary[50], text: colors.primary },
  paid: { label: "Paid", background: palette.primary[50], text: colors.primary },
  shipped: { label: "Shipped", background: palette.caution[50], text: palette.caution[500] },
  delivered: { label: "Delivered", background: palette.success[50], text: palette.success[500] },
  completed: { label: "Completed", background: palette.success[50], text: palette.success[700] },
  cancelled: { label: "Cancelled", background: palette.error[50], text: colors.error },
  disputed: { label: "Disputed", background: palette.error[50], text: colors.error },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const look = LOOKS[status];
  return (
    <View style={[styles.badge, { backgroundColor: look.background }]}>
      <Text size={11} weight={500} lineHeight={15.4} color={look.text}>
        {look.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 } });
