import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeviceMobileIcon } from "phosphor-react-native";

import { ShieldCheck24Icon } from "@/components/icons";
import { SettingsGroup } from "@/components/settings/settingsGroup";
import { Text } from "@/components/ui/text";
import { api } from "@/services/core/apiClient.service";
import { useTheme } from "@/theme";

interface MessengerLoginAuthorization {
  readonly id: string;
  readonly status: string;
  readonly expiresAt: string;
  readonly device: {
    readonly name: string;
    readonly platform: string;
    readonly requestedAt: string;
    readonly approximateLocation: string | null;
  };
}

interface MessengerDevicesResponse {
  readonly authorizations: readonly MessengerLoginAuthorization[];
}

interface TrustedMessengerDevice {
  readonly id: string;
  readonly platform: string;
  readonly deviceName: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly expiresAt: string;
}

interface TrustedMessengerDevicesResponse { readonly devices: readonly TrustedMessengerDevice[] }

const queryKey = ["messenger", "login-authorizations"] as const;

export function MessengerLoginAuthorizations() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [issuedCode, setIssuedCode] = useState<{ authorizationId: string; code: string; expiresAt: string } | null>(null);
  const pending = useQuery({
    queryKey,
    queryFn: () => api.get<MessengerDevicesResponse>("/api/v1/auth/messenger/authorizations"),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const devices = useQuery({
    queryKey: ["messenger", "trusted-devices"],
    queryFn: () => api.get<TrustedMessengerDevicesResponse>("/api/v1/auth/messenger/devices"),
  });
  const decision = useMutation({
    mutationFn: (input: { authorizationId: string; action: "approve" | "deny" }) =>
      api.post<void>(`/api/v1/auth/messenger/authorizations/${encodeURIComponent(input.authorizationId)}/${input.action}`, {}),
    onSuccess: async (_result, input) => {
      setIssuedCode((current) => current?.authorizationId === input.authorizationId ? null : current);
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const issueCode = useMutation({
    mutationFn: (authorizationId: string) => api.post<{ code: string; expiresAt: string }>(`/api/v1/auth/messenger/authorizations/${encodeURIComponent(authorizationId)}/code`, {}),
    onSuccess: (result, authorizationId) => setIssuedCode({ authorizationId, code: result.code, expiresAt: result.expiresAt }),
  });
  const revokeDevice = useMutation({
    mutationFn: (deviceId: string) => api.delete<void>(`/api/v1/auth/messenger/devices/${encodeURIComponent(deviceId)}`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["messenger", "trusted-devices"] }); },
  });

  const requests = pending.data?.authorizations ?? [];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <ShieldCheck24Icon />
        <View style={styles.headingCopy}>
          <Text size={14} weight={600} lineHeight={19} accessibilityRole="header">Messenger sign-in requests</Text>
          <Text size={12} lineHeight={17} color={colors.textSubtle}>Review each new device before it can access your messages.</Text>
        </View>
        {pending.isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {pending.isError ? (
        <SettingsGroup>
          <View style={styles.emptyRow}><Text size={13} lineHeight={19} color={colors.error}>We couldn’t load sign-in requests. Pull down to retry.</Text></View>
        </SettingsGroup>
      ) : requests.length === 0 ? (
        <SettingsGroup>
          <View style={styles.emptyRow}><Text size={13} lineHeight={19} color={colors.textSubtle}>No new Messenger devices are waiting for approval.</Text></View>
        </SettingsGroup>
      ) : requests.map((request) => {
        const currentCode = issuedCode?.authorizationId === request.id ? issuedCode : null;
        const requestedAt = new Date(request.device.requestedAt);
        const expiresAt = new Date(request.expiresAt);
        return (
          <SettingsGroup key={request.id} style={styles.requestCard}>
            <View style={styles.requestHead}>
              <View style={[styles.deviceIcon, { backgroundColor: colors.primaryTint }]}><DeviceMobileIcon size={20} color={colors.primary} /></View>
              <View style={styles.requestCopy}>
                <Text size={14} weight={600} lineHeight={19}>{request.device.name} · {platformLabel(request.device.platform)}</Text>
                <Text size={12} lineHeight={17} color={colors.textSubtle}>{Number.isNaN(requestedAt.getTime()) ? "Just now" : requestedAt.toLocaleString()}</Text>
                {request.device.approximateLocation ? <Text size={12} lineHeight={17} color={colors.textSubtle}>{request.device.approximateLocation}</Text> : null}
              </View>
            </View>
            <Text size={12} lineHeight={17} color={colors.textSubtle}>Only approve if you started this sign-in. It expires {Number.isNaN(expiresAt.getTime()) ? "soon" : `at ${expiresAt.toLocaleTimeString()}`}.</Text>
            {currentCode ? (
              <View style={[styles.codePanel, { backgroundColor: colors.primaryTint }]}>
                <Text size={12} lineHeight={17}>Enter this one-time code in Messenger. It expires {new Date(currentCode.expiresAt).toLocaleTimeString()}.</Text>
                <Text selectable size={22} weight={600} lineHeight={28} style={styles.code}>{currentCode.code}</Text>
              </View>
            ) : null}
            {(decision.isError || issueCode.isError) ? <Text size={12} lineHeight={17} color={colors.error} accessibilityRole="alert">We couldn’t complete that action. Try again.</Text> : null}
            <View style={styles.actions}>
              <ActionButton label="Deny" destructive onPress={() => decision.mutate({ authorizationId: request.id, action: "deny" })} disabled={decision.isPending || issueCode.isPending} />
              <ActionButton label={issueCode.isPending && issueCode.variables === request.id ? "Creating…" : "Get code"} onPress={() => issueCode.mutate(request.id)} disabled={decision.isPending || issueCode.isPending} />
              <ActionButton label="Approve" primary onPress={() => decision.mutate({ authorizationId: request.id, action: "approve" })} disabled={decision.isPending || issueCode.isPending} />
            </View>
          </SettingsGroup>
        );
      })}

      <View style={styles.deviceHeading}>
        <Text size={14} weight={600} lineHeight={19} accessibilityRole="header">Trusted Messenger devices</Text>
        <Text size={12} lineHeight={17} color={colors.textSubtle}>Revoke a device to end its Messenger sessions and require authorization again.</Text>
      </View>
      {devices.isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {devices.isError ? <SettingsGroup><View style={styles.emptyRow}><Text size={13} lineHeight={19} color={colors.error}>We couldn’t load trusted devices.</Text></View></SettingsGroup> : null}
      {(devices.data?.devices ?? []).length === 0 && !devices.isLoading && !devices.isError ? (
        <SettingsGroup><View style={styles.emptyRow}><Text size={13} lineHeight={19} color={colors.textSubtle}>No trusted Messenger devices.</Text></View></SettingsGroup>
      ) : null}
      {(devices.data?.devices ?? []).map((device) => (
        <SettingsGroup key={device.id} style={styles.trustedRow}>
          <View style={styles.requestHead}>
            <View style={[styles.deviceIcon, { backgroundColor: colors.primaryTint }]}><DeviceMobileIcon size={20} color={colors.primary} /></View>
            <View style={styles.requestCopy}>
              <Text size={14} weight={600} lineHeight={19}>{device.deviceName} · {platformLabel(device.platform)}</Text>
              <Text size={12} lineHeight={17} color={colors.textSubtle}>Last used {new Date(device.lastUsedAt).toLocaleString()}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Revoke ${device.deviceName}`} disabled={revokeDevice.isPending} onPress={() => Alert.alert("Revoke Messenger device?", `${device.deviceName} will be signed out and must be authorized again.`, [
              { text: "Cancel", style: "cancel" },
              { text: "Revoke", style: "destructive", onPress: () => revokeDevice.mutate(device.id) },
            ])} style={styles.revokeButton}>
              <Text size={12} weight={600} lineHeight={16} color={colors.error}>Revoke</Text>
            </Pressable>
          </View>
        </SettingsGroup>
      ))}
      {revokeDevice.isError ? <Text size={12} lineHeight={17} color={colors.error} accessibilityRole="alert">We couldn’t revoke that device. Try again.</Text> : null}
    </View>
  );
}

function ActionButton({ label, onPress, disabled, destructive = false, primary = false }: { readonly label: string; readonly onPress: () => void; readonly disabled?: boolean; readonly destructive?: boolean; readonly primary?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, primary ? { backgroundColor: colors.primary } : { borderColor: destructive ? colors.error : colors.divider, borderWidth: 1 }, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text size={12} weight={600} lineHeight={16} color={primary ? colors.onPrimary : destructive ? colors.error : colors.text}>{label}</Text>
    </Pressable>
  );
}

function platformLabel(value: string): string {
  const platform = value.toLowerCase();
  return platform === "ios" ? "iOS" : platform === "android" ? "Android" : value;
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  deviceHeading: { gap: 4, marginTop: 14 },
  headingCopy: { flex: 1, gap: 3 },
  emptyRow: { padding: 16 },
  requestCard: { padding: 14, gap: 12, marginBottom: 8 },
  trustedRow: { padding: 12, marginBottom: 8 },
  revokeButton: { paddingVertical: 8, paddingHorizontal: 10 },
  requestHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  deviceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  requestCopy: { flex: 1, gap: 3 },
  codePanel: { padding: 12, borderRadius: 10, gap: 4 },
  code: { letterSpacing: 5 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  action: { minHeight: 36, paddingHorizontal: 11, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
