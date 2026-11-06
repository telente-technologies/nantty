import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from "react-native";

import { Text } from "@/components/ui/text";
import { liveService } from "@/services/live/live.service";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { makeThemedStyles, useTheme } from "@/theme";

interface LiveCoinSupportControlProps {
  readonly liveId: string;
  readonly enabled: boolean;
  readonly onUpdated: () => void;
}

export function LiveCoinSupportControl({ liveId, enabled, onUpdated }: LiveCoinSupportControlProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useRef<{ readonly enabled: boolean; readonly key: string } | null>(null);

  const update = async (nextEnabled: boolean) => {
    if (pending || nextEnabled === enabled) return;
    const pendingRequest = requestKey.current;
    const key = pendingRequest?.enabled === nextEnabled ? pendingRequest.key : generateIdempotencyKey();
    requestKey.current = { enabled: nextEnabled, key };
    setPending(true);
    setError(null);
    try {
      await liveService.setCoinSupport(liveId, nextEnabled, key);
      requestKey.current = null;
      onUpdated();
    } catch {
      setError("Couldn't update Coin Support. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.container} testID="live-coin-support-control">
      <View style={styles.copy}>
        <Text size={12} weight={700} lineHeight={16} color={colors.white}>Coin Support</Text>
        <Text size={10} lineHeight={13} color={colors.white}>{enabled ? "Viewers can donate coins" : "Donations are off"}</Text>
      </View>
      {pending ? <ActivityIndicator accessibilityLabel="Updating Coin Support" size="small" color={colors.white} /> : null}
      <Switch
        accessibilityLabel="Allow viewers to donate coins"
        accessibilityHint="Controls whether viewers can donate coins during this live"
        accessibilityState={{ checked: enabled, disabled: pending, busy: pending }}
        disabled={pending}
        value={enabled}
        onValueChange={(value) => void update(value)}
        trackColor={{ false: "rgba(255,255,255,0.3)", true: colors.primarySolid }}
        thumbColor={colors.white}
      />
      {error ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Retry Coin Support update" onPress={() => void update(!enabled)} style={styles.error}>
          <Text size={11} lineHeight={14} color={colors.white} accessibilityLiveRegion="polite">{error} Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  container: { position: "absolute", top: 0, left: 12, zIndex: 5, minHeight: 48, maxWidth: 230, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, backgroundColor: "rgba(16,16,24,0.68)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.24)" },
  copy: { flex: 1, gap: 1 },
  error: { position: "absolute", top: 52, left: 0, right: 0, padding: 8, borderRadius: 10, backgroundColor: colors.error },
}));
