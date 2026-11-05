import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";
import { darkStatusTones, useTheme, type StatusToneName } from "@/theme";
import type { OrderStatus } from "@/types";

const STATUS_APPEARANCE: Record<OrderStatus, { label: string; text: string; background: string }> = {
  pending: { label: "Unpaid", text: colors.textMuted, background: colors.skeleton },
  paid: { label: "To ship", text: colors.primary, background: palette.primary[50] },
  new: { label: "To process", text: colors.primary, background: palette.primary[50] },
  processing: { label: "Preparing", text: colors.primary, background: palette.primary[50] },
  ready: { label: "Ready to ship", text: colors.primary, background: palette.primary[50] },
  shipped: { label: "Shipped", text: palette.caution[500], background: palette.caution[50] },
  delivered: { label: "Delivered", text: palette.success[500], background: palette.success[50] },
  completed: { label: "Completed", text: palette.success[500], background: palette.success[50] },
  cancelled: { label: "Cancelled", text: palette.error[500], background: palette.error[50] },
  returned: { label: "Returned", text: palette.error[500], background: palette.error[50] },
  refunded: { label: "Refunded", text: palette.error[500], background: palette.error[50] },
  disputed: { label: "Disputed", text: palette.error[500], background: palette.error[50] },
};

const DARK_TONE_BY_STATUS: Record<OrderStatus, StatusToneName> = {
  pending: "neutral",
  paid: "primary",
  new: "primary",
  processing: "primary",
  ready: "primary",
  shipped: "caution",
  delivered: "success",
  completed: "success",
  cancelled: "error",
  returned: "error",
  refunded: "error",
  disputed: "error",
};

export const orderStatusLabel = (status: OrderStatus) => STATUS_APPEARANCE[status].label;

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const { isDark } = useTheme();
  const appearance = { ...STATUS_APPEARANCE[status], ...(isDark ? darkStatusTones[DARK_TONE_BY_STATUS[status]] : null) };
  return (
    <View style={[styles.pill, { backgroundColor: appearance.background }]}>
      <Text size={13} weight={500} lineHeight={16.9} color={appearance.text}>
        {appearance.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ pill: { height: 25, paddingHorizontal: 8, borderRadius: 99, justifyContent: "center" } });
