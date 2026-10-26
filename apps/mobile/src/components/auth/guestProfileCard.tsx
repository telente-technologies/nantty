import { ScrollView, StyleSheet, View } from "react-native";

import { UserCircle24Icon } from "@/components/icons";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { rootNavigationRef } from "@/navigation/navigationRef";
import { useGuestSessionStore } from "@/store/guestSession.store";
import { refreshTrackingConsents } from "@/services/sellers/productInteractions.service";
import { makeThemedStyles } from "@/theme";
import { openAuthFlowThenReturn } from "@/utils/requireAuth.util";

export function GuestProfileCard() {
  const styles = useStyles();
  const hasAcceptedAnalytics = useGuestSessionStore((s) => s.hasAcceptedGuestAnalytics);
  const acceptGuestAnalytics = useGuestSessionStore((s) => s.acceptGuestAnalytics);

  const allowAnalytics = () => {
    acceptGuestAnalytics();
    refreshTrackingConsents();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <UserCircle24Icon />
          </View>
          <Text size={18} weight={600} align="center" accessibilityRole="header">
            Your Nantty profile
          </Text>
          <Text size={14} align="center" style={styles.message}>
            Sign in to like, follow, shop, message and go live. Your account, orders and wallet will be waiting here.
          </Text>
          <View style={styles.buttons}>
            <Button title="Sign in" onPress={() => openAuthFlowThenReturn("login")} />
            <Button variant="outline" title="Create account" onPress={() => openAuthFlowThenReturn("signup")} />
          </View>
        </View>
        <SettingsGroup>
          <SettingsRow label="Appearance and region" onPress={() => rootNavigationRef.navigate("SettingsAppPreference")} />
          <SettingsRow label="About and legal" onPress={() => rootNavigationRef.navigate("SettingsAbout")} />
          <SettingsRow
            label="Allow usage analytics"
            trailing={{ text: hasAcceptedAnalytics ? "On" : "Off" }}
            accessibilityHint="Essential-only until you allow"
            onPress={hasAcceptedAnalytics ? undefined : allowAnalytics}
          />
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { padding: 16, gap: 16 },
  card: { alignItems: "center", gap: 12, padding: 24, borderRadius: 16, backgroundColor: colors.surface },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center" },
  message: { color: colors.textSubtle },
  buttons: { alignSelf: "stretch", gap: 12, marginTop: 8 },
}));
