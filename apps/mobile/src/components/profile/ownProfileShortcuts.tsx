import { useNavigation } from "@react-navigation/native";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useCreatorEntry } from "@/hooks/useCreatorStatus.hook";
import type { User } from "@/types";

import { CheckmarkSuggestionCards } from "./checkmarkSuggestionCards";
import { ProfileSwitcher } from "./profileSwitcher";
import { StartSellingCard } from "./startSellingCard";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

type ShortcutRoute = "SellerDashboard" | "CreatorDashboard" | "CreatorApplicationStatus" | "CreatorProgram" | "Orders" | "Wallet" | "Verification" | "Settings" | "FollowRequests" | "Rankings" | "Saved";

export function OwnProfileShortcuts({ profile }: { profile: User }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const creatorEntry = useCreatorEntry();
  const shortcuts: { label: string; route: ShortcutRoute }[] = [
    ...(profile.isSeller ? [{ label: "Seller dashboard", route: "SellerDashboard" as const }] : []),
    { label: creatorEntry.label, route: creatorEntry.route },
    { label: "Follow requests", route: "FollowRequests" },
    { label: "Rankings", route: "Rankings" },
    { label: "Saved", route: "Saved" },
    { label: "My orders", route: "Orders" },
    { label: "Wallet", route: "Wallet" },
    { label: profile.verification?.badgeVisible ? "Verification" : "Get verified", route: "Verification" },
    { label: "Settings", route: "Settings" },
  ];
  return (
    <>
      <ProfileSwitcher />
      <View style={styles.suggestions}><CheckmarkSuggestionCards /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {shortcuts.map((shortcut) => (
          <Pressable
            key={shortcut.label}
            accessibilityRole="button"
            disabled={shortcut.route === creatorEntry.route && creatorEntry.isLoading}
            onPress={() => navigation.navigate(shortcut.route)}
            style={styles.shortcut}
          >
            <Text size={typeScale.sm} weight={500} lineHeight={16.9} color={colors.primary}>{shortcut.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {profile.isSeller ? null : <StartSellingCard compact />}
    </>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { paddingHorizontal: spacing[3], gap: spacing[2] },
  suggestions: { paddingHorizontal: spacing[3], gap: spacing[2] },
  shortcut: { height: 32, paddingHorizontal: spacing[3], borderRadius: 16, backgroundColor: colors.primaryTint, justifyContent: "center" },
}));
