import { Alert, Pressable, StyleSheet, View } from "react-native";

import { useMyProfileQuery } from "@/components/profile/profileQueries.hook";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import {
  BellRinging24Icon,
  CaretRight24Icon,
  CreditCard24Icon,
  Frame83032Icon,
  Headset24Icon,
  MagnifyingGlass24Icon,
  Question24Icon,
  Shield24Icon,
  SquaresFour24Icon,
  Tag24Icon,
  Truck24Icon,
  UserCircle24Icon,
} from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { HeaderAction } from "@/components/ui/header";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";

export function SettingsScreen({ navigation }: MainScreenProps<"Settings">) {
  const { data: profile } = useMyProfileQuery();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearSessionAndSignOut = useAuthStore((s) => s.clearSessionAndSignOut);

  const logOutAndClearSession = async () => {
    await authService.logOutCurrentSession(refreshToken).catch(() => undefined);
    await clearSessionAndSignOut();
  };

  const confirmLogOut = () =>
    Alert.alert("Log out?", "You'll need to log in again to use Zudomart.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logOutAndClearSession },
    ]);

  return (
    <SettingsPage
      title="Settings"
      contentTopSpacing={24}
      gap={42}
      right={
        <HeaderAction label="Search settings" onPress={() => navigation.navigate("Search", { scope: "all" })}>
          <MagnifyingGlass24Icon />
        </HeaderAction>
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${profile?.name ?? "Your profile"}, edit profile`}
        onPress={() => navigation.navigate("EditProfile")}
        style={styles.profileCard}
      >
        <View style={styles.profileIdentity}>
          <Avatar uri={profile?.avatarUrl} size={48} />
          <View style={styles.profileText}>
            <Text size={14} weight={600} lineHeight={16.8} numberOfLines={1}>
              {profile?.name ?? " "}
            </Text>
            <Text size={14} lineHeight={16.8} numberOfLines={1}>
              {profile?.email ?? " "}
            </Text>
          </View>
        </View>
        <CaretRight24Icon />
      </Pressable>

      <SettingsGroup>
        <SettingsRow label="Account" icon={<UserCircle24Icon />} onPress={() => navigation.navigate("SettingsAccount")} />
        <SettingsRow label="Security & Password" icon={<Shield24Icon />} onPress={() => navigation.navigate("SettingsSecurity")} />
        <SettingsRow label="Notification" icon={<BellRinging24Icon />} onPress={() => navigation.navigate("SettingsNotifications")} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow label="App Preference" icon={<SquaresFour24Icon />} onPress={() => navigation.navigate("SettingsAppPreference")} />
        <SettingsRow label="Payment Methods" icon={<CreditCard24Icon />} onPress={() => navigation.navigate("SettingsPaymentMethods")} />
        <SettingsRow label="Shipping Address" icon={<Truck24Icon />} onPress={() => navigation.navigate("ShippingAddresses")} />
      </SettingsGroup>

      <SettingsGroup>
        {profile?.isSeller ? (
          <SettingsRow label="Seller Dashboard" icon={<Tag24Icon />} onPress={() => navigation.navigate("SellerDashboard")} />
        ) : (
          <SettingsRow label="Become a seller" icon={<Tag24Icon />} onPress={() => navigation.navigate("SellerApplication")} />
        )}
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow label="Support" icon={<Headset24Icon />} onPress={() => navigation.navigate("SettingsSupport")} />
        <SettingsRow label="About" icon={<Question24Icon />} onPress={() => navigation.navigate("SettingsAbout")} />
      </SettingsGroup>

      <Pressable accessibilityRole="button" onPress={confirmLogOut} style={styles.logOut}>
        <Frame83032Icon />
        <Text size={14} lineHeight={16.8} color={colors.error}>
          Log out
        </Text>
      </Pressable>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    height: 80,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  profileIdentity: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  profileText: { gap: 4, flexShrink: 1 },
  logOut: {
    height: 48,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
});
