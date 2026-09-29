import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ArrowLeft24Icon, Cancel20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";

export interface CreateHeaderProps {
  readonly title?: string;
  readonly onClose: () => void;
  readonly useBackArrow?: boolean;
  readonly afterTitle?: ReactNode;
  readonly actionLabel?: string;
  readonly actionDisabled?: boolean;
  readonly onAction?: () => void;
  readonly color?: string;
}

export function CreateHeader({ title, onClose, useBackArrow, afterTitle, actionLabel, actionDisabled, onAction, color }: CreateHeaderProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <Pressable accessibilityRole="button" accessibilityLabel={useBackArrow ? "Go back" : "Close"} hitSlop={12} onPress={onClose}>
          {useBackArrow ? <ArrowLeft24Icon color={color} /> : <Cancel20Icon color={color} />}
        </Pressable>
        {title ? (
          <Text size={21} weight={500} lineHeight={25.2} letterSpacing={-0.42} color={color} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {afterTitle}
      </View>
      {actionLabel ? (
        <Text
          size={14}
          weight={500}
          lineHeight={16.8}
          color={color}
          accessibilityRole="button"
          accessibilityState={{ disabled: actionDisabled }}
          onPress={actionDisabled ? undefined : onAction}
          style={actionDisabled ? styles.disabled : undefined}
        >
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 49, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 24 },
  disabled: { opacity: 0.4 },
});
