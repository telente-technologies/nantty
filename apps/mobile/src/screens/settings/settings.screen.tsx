import { Pressable, StyleSheet, View } from "react-native";

import { useMyProfileQuery } from "@/components/profile/profileQueries.hook";
import { CheckmarkSuggestionCards } from "@/components/profile/checkmarkSuggestionCards";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import {
  Bell24Icon,
  BuildingStore20Icon,
  CaretRight24Icon,
  CreditCard24Icon,
  Document24Icon,
  EyeSlash24Icon,
  Frame83032Icon,
  Headset24Icon,
  Info24Icon,
  MagnifyingGlass24Icon,
  MapPin24Icon,
  SealCheck20Icon,
  ShieldCheck24Icon,
  ShieldStar24Icon,
  SlidersHorizontal24Icon,
  Tag24Icon,
  TrademarkRegistered24Icon,
  UserCircle24Icon,
} from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { HeaderAction } from "@/components/ui/header";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { useMyAccountHealth } from "@/components/accountHealth/accountHealth.hook";
import { describeAccountStanding } from "@/services/account/accountHealth.service";
import { authService } from "@/services/auth/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function SettingsScreen({ navigation }: MainScreenProps<"Settings">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { data: profile } = useMyProfileQuery();
  const { data: accountHealth } = useMyAccountHealth();
  const accountStatusTrailing = accountHealth ? { text: describeAccountStanding(accountHealth.status) } : undefined;
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearSessionAndSignOut = useAuthStore((s) => s.clearSessionAndSignOut);

  const logOutAndClearSession = async () => {
    await authService.logOutCurrentSession(refreshToken).catch(() => undefined);
    await clearSessionAndSignOut();
  };

  const confirmLogOut = () =>
    showAlertWithButtons("Log out?", "You'll need to log in again to use Zudomart.", [
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
            <View style={styles.nameRow}>
              <Text size={typeScale.md} weight={600} lineHeight={16.8} numberOfLines={1}>
                {profile?.name ?? " "}
              </Text>
              <VerificationBadge verification={profile?.verification} legacyVerified={profile?.verified} size={16} />
            </View>
            <Text size={typeScale.md} lineHeight={16.8} numberOfLines={1}>
              {profile?.email ?? " "}
            </Text>
          </View>
        </View>
        <CaretRight24Icon />
      </Pressable>

      <CheckmarkSuggestionCards />

      <SettingsGroup>
        <SettingsRow label="Account" icon={<UserCircle24Icon color={colors.text} />} onPress={() => navigation.navigate("SettingsAccount")} />
        <SettingsRow label="Account status" icon={<SealCheck20Icon size={24} color={colors.text} />} trailing={accountStatusTrailing} onPress={() => navigation.navigate("AccountStatus")} />
        <SettingsRow label="Security & Password" icon={<ShieldStar24Icon />} onPress={() => navigation.navigate("SettingsSecurity")} />
        <SettingsRow label="Privacy" icon={<EyeSlash24Icon />} onPress={() => navigation.navigate("SettingsPrivacy")} />
        <SettingsRow label="Privacy & Data" icon={<ShieldCheck24Icon />} onPress={() => navigation.navigate("SettingsPrivacyData")} />
        <SettingsRow label="Notification" icon={<Bell24Icon />} onPress={() => navigation.navigate("SettingsNotifications")} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow label="App Preference" icon={<SlidersHorizontal24Icon />} onPress={() => navigation.navigate("SettingsAppPreference")} />
        <SettingsRow label="Payment Methods" icon={<CreditCard24Icon />} onPress={() => navigation.navigate("SettingsPaymentMethods")} />
        <SettingsRow label="Shipping Address" icon={<MapPin24Icon />} onPress={() => navigation.navigate("ShippingAddresses")} />
      </SettingsGroup>

      <SettingsGroup>
        {profile?.isSeller ? null : (
          <SettingsRow label="Start selling on Zudomart" icon={<Tag24Icon />} trailing={{ text: "Free to apply" }} onPress={() => navigation.navigate("SellerApplication")} />
        )}
        {profile?.isSeller ? <SettingsRow label="Business documents" icon={<Document24Icon />} onPress={() => navigation.navigate("BusinessDocuments")} /> : null}
        <SettingsRow label="Create business profile" icon={<BuildingStore20Icon size={24} />} onPress={() => navigation.navigate("CreateBusinessProfile")} />
        <SettingsRow label="Create a brand profile" icon={<TrademarkRegistered24Icon />} onPress={() => navigation.navigate("CreateBrand")} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow label="Support" icon={<Headset24Icon />} onPress={() => navigation.navigate("SettingsSupport")} />
        <SettingsRow label="About" icon={<Info24Icon />} onPress={() => navigation.navigate("SettingsAbout")} />
      </SettingsGroup>

      <Pressable accessibilityRole="button" onPress={confirmLogOut} style={styles.logOut}>
        <Frame83032Icon />
        <Text size={typeScale.md} lineHeight={16.8} color={colors.error}>
          Log out
        </Text>
      </Pressable>
    </SettingsPage>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  profileCard: {
    height: 80,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  profileIdentity: { flexDirection: "row", alignItems: "center", gap: spacing[3], flexShrink: 1 },
  profileText: { gap: spacing[1], flexShrink: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing[1] },
  logOut: {
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginTop: 6,
  },
}));
