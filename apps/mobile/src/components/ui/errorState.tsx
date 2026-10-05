import { StyleSheet, View } from "react-native";

import { Refresh20Icon, Warning20Icon, WifiSlash24Icon } from "@/components/icons";
import { useOfflineStore } from "@/store/offline.store";
import { makeThemedStyles, useTheme } from "@/theme";

import { Button } from "./button";
import { Text } from "./text";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export interface ErrorStateProps {
  readonly message?: string;
  readonly detail?: string;
  readonly onRetry?: () => void;
  readonly retrying?: boolean;
  readonly compact?: boolean;
}

export function ErrorState({ message = "Something went wrong.", detail, onRetry, retrying = false, compact = false }: ErrorStateProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isOnline = useOfflineStore((state) => state.isOnline);
  const title = isOnline ? message : "You're offline";
  const body = isOnline ? detail : "Check your connection, then try again.";
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.root, compact ? styles.compact : styles.fill]}>
      <View style={[styles.badge, { backgroundColor: isOnline ? colors.errorTint : colors.chip }]}>
        {isOnline ? <Warning20Icon size={22} color={colors.error} /> : <WifiSlash24Icon color={colors.textMuted} />}
      </View>
      <View style={styles.copy}>
        <Text size={typeScale.base} weight={600} lineHeight={21} align="center">{title}</Text>
        {body ? <Text size={typeScale.md} lineHeight={19.6} align="center" color={colors.textMuted}>{body}</Text> : null}
      </View>
      {onRetry ? (
        <Button title="Try again" variant="outline" icon={<Refresh20Icon size={18} color={colors.text} />} loading={retrying} onPress={onRetry} style={styles.button} />
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", gap: spacing[4], paddingHorizontal: spacing[7] },
  fill: { flex: 1, paddingVertical: spacing[7] },
  compact: { paddingVertical: spacing[6] },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  copy: { gap: 6, maxWidth: 320 },
  button: { minWidth: 160, paddingHorizontal: spacing[5] },
}));
