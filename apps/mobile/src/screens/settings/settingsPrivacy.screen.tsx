import { StyleSheet, View } from "react-native";

import { useFollowRequestsQuery } from "@/components/profile/followRequests.hook";
import { useMyProfileQuery, useSaveProfileDetailsMutation } from "@/components/profile/profileQueries.hook";
import { MentionPrivacySection } from "@/components/settings/mentionPrivacySection";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function SettingsPrivacyScreen({ navigation }: MainScreenProps<"SettingsPrivacy">) {
  const { colors } = useTheme();
  const { data: profile } = useMyProfileQuery();
  const saveProfile = useSaveProfileDetailsMutation();
  const pendingRequests = useFollowRequestsQuery().data?.data.length ?? 0;
  const isPrivate = profile?.isPrivate ?? false;

  return (
    <SettingsPage title="Privacy">
      <View style={styles.block}>
        <Text size={14} weight={500} lineHeight={16.8}>Profile visibility</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          <Chip kind="filter" label="Public" selected={!isPrivate} onPress={() => saveProfile.mutate({ isPrivate: false })} />
          <Chip kind="filter" label="Private" selected={isPrivate} onPress={() => saveProfile.mutate({ isPrivate: true })} />
        </View>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          {isPrivate
            ? "Only approved followers can see your posts, followers and following. New followers need your approval."
            : "Anyone can see your posts and follow you."}
        </Text>
      </View>
      <MentionPrivacySection />
      <SettingsGroup>
        <SettingsRow
          label="Follow requests"
          trailing={pendingRequests > 0 ? { text: String(pendingRequests), color: colors.primary } : "chevron"}
          onPress={() => navigation.navigate("FollowRequests")}
        />
        <SettingsRow label="Content preferences" trailing="chevron" onPress={() => navigation.navigate("ContentPreferences")} />
      </SettingsGroup>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ block: { gap: 12 }, chips: { flexDirection: "row", gap: 8 } });
