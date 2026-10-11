import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { emptyCatalog, type EmptyKind } from "@/errors/errorExperience/emptyCatalog";
import { makeThemedStyles, useTheme } from "@/theme";

import { Button } from "./button";
import { ErrorHalo } from "./errorHalo";
import { Text } from "./text";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export interface EmptyStateProps {
  readonly kind?: EmptyKind;
  readonly title?: string;
  readonly body?: string;
  readonly icon?: ReactNode;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly compact?: boolean;
}

export function EmptyState({ kind = "generic", title, body, icon, actionLabel, onAction, compact = false }: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const preset = emptyCatalog[kind];
  const heading = title ?? preset.title;
  const description = body ?? (title && kind === "generic" ? undefined : preset.description);
  return (
    <View accessible accessibilityLabel={description ? `${heading}. ${description}` : heading} style={[styles.root, compact ? styles.compact : styles.fill]}>
      {icon ? <View style={[styles.badge, { backgroundColor: colors.primaryTint }]}>{icon}</View> : <ErrorHalo icon={preset.icon} tone="brand" motion="float" size={compact ? 56 : 72} animated={!compact} />}
      <View style={styles.copy}>
        <Text size={typeScale.base} weight={700} lineHeight={21} align="center">{heading}</Text>
        {description ? <Text size={typeScale.md} lineHeight={20} align="center" color={colors.textMuted}>{description}</Text> : null}
      </View>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={styles.button} /> : null}
    </View>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", gap: spacing[4], paddingHorizontal: spacing[7] },
  fill: { flex: 1, paddingVertical: 48 },
  compact: { paddingVertical: spacing[7] },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  copy: { gap: 6, maxWidth: 440 },
  button: { minWidth: 160, paddingHorizontal: spacing[5] },
}));
