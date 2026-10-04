import { StyleSheet, View } from "react-native";

import { inAppBrowserColorsFromTheme, openTrustedWebPage } from "@/components/links/openLink.util";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { legalLinks } from "@/config/legalLinks.config";
import { useTheme } from "@/theme";
import type { UserSummary } from "@/types";

export function SuspendedProfileState({ profile }: { profile: Pick<UserSummary, "name" | "username" | "avatarUrl"> }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.greyedAvatar}>
        <Avatar uri={profile.avatarUrl} size={88} />
      </View>
      <Text size={16} weight={600} lineHeight={20} align="center" color={colors.textMuted}>{profile.name}</Text>
      <Text size={13} lineHeight={16.9} align="center" color={colors.textSubtle}>@{profile.username}</Text>
      <Text size={18} weight={600} lineHeight={22} align="center">This account is suspended</Text>
      <Text size={14} lineHeight={19.6} align="center" color={colors.textMuted}>
        This account broke our Community Guidelines, so its posts and profile are hidden.
      </Text>
      <Text size={14} weight={500} lineHeight={16.8} color={colors.primary} accessibilityRole="link" onPress={() => openTrustedWebPage(legalLinks.communityGuidelines, inAppBrowserColorsFromTheme(colors))}>
        Learn more
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  greyedAvatar: { opacity: 0.35, marginBottom: 6 },
});
