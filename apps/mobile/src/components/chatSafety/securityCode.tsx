import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import { useTheme } from "@/theme";

const identityChangesKey = (peerIds: readonly string[]) => ["chatCrypto", "identityChanges", ...peerIds] as const;

export function SecurityCodeChangedBanner({ peerIds, peerName }: { readonly peerIds: readonly string[]; readonly peerName: string }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const changes = useQuery({ queryKey: identityChangesKey(peerIds), queryFn: () => chatCryptoService.identityChanges(peerIds), enabled: peerIds.length > 0, refetchInterval: 30_000 });
  const changed = changes.data ?? [];
  if (changed.length === 0) return null;
  const acknowledge = async () => {
    await Promise.all(changed.map((userId) => chatCryptoService.acknowledgeIdentityChange(userId)));
    await queryClient.invalidateQueries({ queryKey: ["chatCrypto", "identityChanges"] });
  };
  return (
    <View style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.divider }]} accessibilityRole="alert">
      <Text size={12} lineHeight={16} color={colors.textMuted} style={styles.flex}>
        {peerIds.length === 1 ? `${peerName}'s security code changed.` : "A member's security code changed."} This happens when someone reinstalls or adds a device.
      </Text>
      <Pressable accessibilityRole="button" onPress={acknowledge} hitSlop={8}>
        <Text size={12} weight={600} lineHeight={16} color={colors.primary}>OK</Text>
      </Pressable>
    </View>
  );
}

export function SecurityCodeRow({ peerId }: { readonly peerId: string }) {
  const { colors } = useTheme();
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => chatCryptoService.securityCode(peerId).then(setCode, () => setFailed(true))}
      style={[styles.row, { borderColor: colors.divider }]}
    >
      <Text size={14} weight={500} lineHeight={18}>Security code</Text>
      <Text size={12} lineHeight={17} color={colors.textMuted} style={code ? styles.code : undefined}>
        {code ?? (failed ? "Couldn't load the code. Try again." : "Compare this code with theirs in person to verify your chat is end-to-end encrypted.")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  row: { gap: 4, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  code: { fontVariant: ["tabular-nums"], letterSpacing: 1 },
});
