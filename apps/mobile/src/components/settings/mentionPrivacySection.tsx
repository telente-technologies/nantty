import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { mentionsService } from "@/services/content/mentions.service";
import type { WhoCanMentionMe } from "@/types/mention.type";

const MENTION_PRIVACY_QUERY_KEY = ["users", "me", "mention-privacy"] as const;

const MENTION_AUDIENCE_OPTIONS: readonly { readonly value: WhoCanMentionMe; readonly label: string; readonly description: string }[] = [
  { value: "everyone", label: "Everyone", description: "Anyone on Zudomart can mention you in posts, comments and groups you are in." },
  { value: "following", label: "People I follow", description: "Only people you follow can mention you. Other mentions show as plain text and you are not notified." },
  { value: "no_one", label: "No one", description: "Mentions of you show as plain text and you are never notified." },
];

export function MentionPrivacySection() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const privacy = useQuery({ queryKey: MENTION_PRIVACY_QUERY_KEY, queryFn: mentionsService.fetchMyMentionPrivacy });
  const updatePrivacy = useMutation({
    mutationFn: (whoCanMentionMe: WhoCanMentionMe) => mentionsService.updateMyMentionPrivacy({ whoCanMentionMe }),
    onSuccess: (saved) => queryClient.setQueryData(MENTION_PRIVACY_QUERY_KEY, saved),
  });
  const selected = updatePrivacy.variables ?? privacy.data?.whoCanMentionMe ?? "everyone";
  const description = MENTION_AUDIENCE_OPTIONS.find((option) => option.value === selected)?.description;

  return (
    <View style={styles.block}>
      <Text size={14} weight={500} lineHeight={16.8}>Who can mention me</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {MENTION_AUDIENCE_OPTIONS.map((option) => (
          <Chip key={option.value} kind="filter" label={option.label} selected={selected === option.value} onPress={() => updatePrivacy.mutate(option.value)} />
        ))}
      </View>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ block: { gap: 12 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
