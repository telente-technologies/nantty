import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { makeThemedStyles, useTheme } from "@/theme";

import { Button } from "./button";
import { Text } from "./text";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export interface EmptyStateProps {
  readonly title: string;
  readonly body?: string;
  readonly icon?: ReactNode;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly compact?: boolean;
}

export function EmptyState({ title, body, icon, actionLabel, onAction, compact = false }: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel={body ? `${title}. ${body}` : title} style={[styles.root, compact ? styles.compact : styles.fill]}>
      {icon ? <View style={styles.badge}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text size={typeScale.base} weight={600} lineHeight={21} align="center">{title}</Text>
        {body ? <Text size={typeScale.md} lineHeight={19.6} align="center" color={colors.textMuted}>{body}</Text> : null}
      </View>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={styles.button} /> : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", gap: spacing[4], paddingHorizontal: spacing[7] },
  fill: { flex: 1, paddingVertical: 48 },
  compact: { paddingVertical: spacing[7] },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip },
  copy: { gap: 6, maxWidth: 320 },
  button: { minWidth: 160, paddingHorizontal: spacing[5] },
}));
