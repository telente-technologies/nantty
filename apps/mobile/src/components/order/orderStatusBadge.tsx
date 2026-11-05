import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";
import { darkStatusTones, useTheme, type StatusToneName } from "@/theme";
import type { OrderStatus } from "@/types";

const LOOKS: Record<OrderStatus, { label: string; background: string; text: string }> = {
  pending: { label: "Awaiting payment", background: colors.skeleton, text: colors.textMuted },
  paid: { label: "Preparing", background: palette.primary[50], text: colors.primary },
  new: { label: "Preparing", background: palette.primary[50], text: colors.primary },
  processing: { label: "Preparing", background: palette.primary[50], text: colors.primary },
  ready: { label: "Ready to ship", background: palette.primary[50], text: colors.primary },
  shipped: { label: "On the way", background: palette.caution[50], text: palette.caution[700] },
  delivered: { label: "Delivered", background: palette.success[50], text: palette.success[700] },
  completed: { label: "Completed", background: palette.success[50], text: palette.success[700] },
  cancelled: { label: "Cancelled", background: palette.error[50], text: colors.error },
  returned: { label: "Returned", background: palette.error[50], text: colors.error },
  refunded: { label: "Refunded", background: palette.error[50], text: colors.error },
  disputed: { label: "Disputed", background: palette.error[50], text: colors.error },
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

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { isDark } = useTheme();
  const look = { ...LOOKS[status], ...(isDark ? darkStatusTones[DARK_TONE_BY_STATUS[status]] : null) };
  return (
    <View style={[styles.badge, { backgroundColor: look.background }]}>
      <Text size={11} weight={500} lineHeight={15.4} color={look.text}>
        {look.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 } });
