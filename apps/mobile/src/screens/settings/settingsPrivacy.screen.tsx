import { StyleSheet, View } from "react-native";

import { useMyProfileQuery, useSaveProfileDetailsMutation } from "@/components/profile/profileQueries.hook";
import { DownloadPrivacySection } from "@/components/settings/downloadPrivacySection";
import { MentionPrivacySection } from "@/components/settings/mentionPrivacySection";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { EyeSlash24Icon, Funnel24Icon } from "@/components/icons";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export function SettingsPrivacyScreen({ navigation }: MainScreenProps<"SettingsPrivacy">) {
  const { colors } = useTheme();
  const { data: profile } = useMyProfileQuery();
  const saveProfile = useSaveProfileDetailsMutation();
  const isPrivate = profile?.isPrivate ?? false;

  return (
    <SettingsPage title="Privacy">
      <View style={styles.block}>
        <Text size={typeScale.md} weight={500} lineHeight={16.8}>Profile visibility</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          <Chip kind="filter" label="Public" selected={!isPrivate} onPress={() => saveProfile.mutate({ isPrivate: false })} />
          <Chip kind="filter" label="Private" selected={isPrivate} onPress={() => saveProfile.mutate({ isPrivate: true })} />
        </View>
        <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted}>
          {isPrivate
            ? "Only approved followers can see your posts, followers and following. New followers need your approval."
            : "Anyone can see your posts and follow you."}
          {" Review follow requests from the menu on your profile."}
        </Text>
      </View>
      <MentionPrivacySection />
      <DownloadPrivacySection />
      <SettingsGroup>
        <SettingsRow label="Content preferences" icon={<Funnel24Icon />} trailing="chevron" onPress={() => navigation.navigate("ContentPreferences")} />
        <SettingsRow label="Hidden comments" icon={<EyeSlash24Icon />} trailing="chevron" onPress={() => navigation.navigate("HiddenComments")} />
      </SettingsGroup>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ block: { gap: spacing[3] }, chips: { flexDirection: "row", gap: spacing[2] } });
