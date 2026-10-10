import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { useUpdateConsentMutation } from "@/components/settings/privacyQueries.hook";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { consentsService } from "@/services/account/consents.service";
import type { MarketingFrequency } from "@/types/trust.type";

const FREQUENCY_OPTIONS: readonly { id: MarketingFrequency; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "important_only", label: "Only important" },
  { id: "off", label: "Off" },
];

const marketingPreferencesQueryKey = ["privacy", "marketingPreferences"] as const;

export function MarketingFrequencyPicker({ marketingEnabled }: { marketingEnabled: boolean }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const updateConsent = useUpdateConsentMutation();
  const preferences = useQuery({ queryKey: marketingPreferencesQueryKey, queryFn: consentsService.fetchMyMarketingPreferences });
  const choose = useMutation({
    mutationFn: async (frequency: MarketingFrequency) => {
      const saved = await consentsService.updateMyMarketingPreferences({ frequency });
      updateConsent.mutate({ key: "marketing", enabled: frequency !== "off" });
      return saved;
    },
    onSuccess: (saved) => queryClient.setQueryData(marketingPreferencesQueryKey, saved),
  });
  const storedFrequency = preferences.data?.frequency ?? "weekly";
  const selected: MarketingFrequency = !marketingEnabled ? "off" : storedFrequency === "off" ? "weekly" : storedFrequency;

  return (
    <View style={styles.block}>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>How often should we email you?</Text>
      <View style={styles.chips}>
        {FREQUENCY_OPTIONS.map((option) => (
          <Chip key={option.id} kind="topic" label={option.label} selected={selected === option.id} onPress={() => choose.mutate(option.id)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8, paddingBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
