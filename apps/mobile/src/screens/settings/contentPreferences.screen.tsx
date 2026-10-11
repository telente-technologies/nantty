import { StyleSheet, View } from "react-native";

import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import { SettingsPage } from "@/components/settings/settingsPage";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { useContentPreferences } from "@/hooks/useContentPreferences.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { useTheme } from "@/theme";
import { describeActionFailure } from "@/errors/errorExperience/describeError";

export function ContentPreferencesScreen(_props: MainScreenProps<"ContentPreferences">) {
  const { colors } = useTheme();
  const { query, update } = useContentPreferences();
  const preferences = query.data;
  return (
    <SettingsPage title="Content preferences">
      {!preferences ? (
        <ListSkeleton rows={2} />
      ) : (
        <View style={styles.block}>
          {preferences.canChangeSensitiveContentSetting ? (
            <ConsentToggleRow
              label="Show sensitive content without warning"
              description="Posts marked as sensitive open straight away instead of showing a warning first. You can turn warnings back on at any time."
              enabled={update.isPending ? (update.variables ?? preferences.showSensitiveWithoutWarning) : preferences.showSensitiveWithoutWarning}
              onChange={(enabled) => update.mutate(enabled)}
            />
          ) : (
            <View style={styles.notice} accessible accessibilityRole="text">
              <Text size={14} weight={600} lineHeight={18}>Sensitive content warnings stay on</Text>
              <Text size={13} lineHeight={18} color={colors.textMuted}>
                {preferences.ageBracket === "unknown"
                  ? "Add your birthday under Settings, Account to manage this. Until then we treat your account as under 18, so adult content is never shown."
                  : "Accounts under 18 always see warnings, and adult content such as nudity or dangerous acts is never shown."}
              </Text>
            </View>
          )}
          {update.isError ? (
            <Text size={12} lineHeight={16.8} color={colors.error} accessibilityLiveRegion="polite">
              {describeActionFailure(update.error)}
            </Text>
          ) : null}
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            Sensitive labels come from the person who posted, from our moderators and from automated checks that our team reviews.
          </Text>
        </View>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ block: { gap: 12 }, notice: { gap: 4, paddingVertical: 12 } });
