import { useNavigation } from "@react-navigation/native";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useCreatorEntry } from "@/hooks/useCreatorStatus.hook";
import type { User } from "@/types";

import { ProfileSwitcher } from "./profileSwitcher";
import { StartSellingCard } from "./startSellingCard";

type ShortcutRoute = "SellerDashboard" | "CreatorDashboard" | "CreatorApplicationStatus" | "CreatorProgram" | "Orders" | "Wallet" | "Verification" | "Referral" | "Settings";

export function OwnProfileShortcuts({ profile }: { profile: User }) {
  const navigation = useNavigation();
  const creatorEntry = useCreatorEntry();
  const shortcuts: { label: string; route: ShortcutRoute }[] = [
    ...(profile.isSeller ? [{ label: "Seller dashboard", route: "SellerDashboard" as const }] : []),
    { label: creatorEntry.label, route: creatorEntry.route },
    { label: "My orders", route: "Orders" },
    { label: "Wallet", route: "Wallet" },
    { label: profile.verification?.badgeVisible ? "Verification" : "Get verified", route: "Verification" },
    { label: "Invite friends", route: "Referral" },
    { label: "Settings", route: "Settings" },
  ];
  return (
    <>
      <ProfileSwitcher />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {shortcuts.map((shortcut) => (
          <Pressable
            key={shortcut.label}
            accessibilityRole="button"
            onPress={() => navigation.navigate(shortcut.route)}
            style={styles.shortcut}
          >
            <Text size={13} weight={500} lineHeight={16.9} color={colors.primary}>{shortcut.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {profile.isSeller ? null : <StartSellingCard compact />}
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, gap: 8 },
  shortcut: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.primaryTint, justifyContent: "center" },
});
