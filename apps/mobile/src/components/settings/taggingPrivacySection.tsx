import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { consentsService } from "@/services/account/consents.service";
import { useTheme } from "@/theme";

const TAGGING_SETTINGS_QUERY_KEY = ["users", "me", "tagging-settings"] as const;

export function TaggingPrivacySection() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: TAGGING_SETTINGS_QUERY_KEY,
    queryFn: consentsService.fetchMyTaggingSettings,
  });
  const updateSettings = useMutation({
    mutationFn: (allowTagging: boolean) => consentsService.updateMyTaggingSettings(allowTagging),
    onSuccess: (saved) => queryClient.setQueryData(TAGGING_SETTINGS_QUERY_KEY, saved),
  });
  const allowTagging = updateSettings.variables ?? settings.data?.allowTagging ?? true;

  return (
    <View style={styles.block}>
      <Text size={14} weight={500} lineHeight={16.8}>Photo &amp; post tagging</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        <Chip kind="filter" label="Allow tagging" selected={allowTagging} onPress={() => updateSettings.mutate(true)} />
        <Chip kind="filter" label="Don't allow" selected={!allowTagging} onPress={() => updateSettings.mutate(false)} />
      </View>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        {allowTagging ? "People can tag your profile in posts." : "Nobody can add your profile to post tags."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ block: { gap: 12 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
