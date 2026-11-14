import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ArrowClockwise, LockKey } from "phosphor-react-native";

import { useMessengerAuth } from "../auth/AuthProvider";
import { useMessengerColors } from "../ui/useMessengerColors";
import { StatePanel } from "../ui/StatePanel";

export function SessionRestoreScreen({ failed = false }: { readonly failed?: boolean }) {
  const colors = useMessengerColors();
  const { restoreError, retryRestore } = useMessengerAuth();
  if (failed) {
    return <StatePanel Icon={ArrowClockwise} title="Can’t restore your session" description={restoreError ?? "Check your connection and try again."} actionLabel="Try again" onAction={() => void retryRestore()} tone="error" />;
  }
  return (
    <View style={styles.root}>
      <LockKey size={28} color={colors.brand} weight="regular" />
      <ActivityIndicator color={colors.brand} />
      <Text style={[styles.copy, { color: colors.muted }]}>Securely checking your Nantty session…</Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, padding: 28 }, copy: { fontSize: 14, textAlign: "center" } });
