import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { HelpMarkdown, type HelpLinkTarget } from "@/components/support/helpMarkdown";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { helpCenterService } from "@/services/helpCenter.service";
import type { HelpTopicDetail } from "@/types/helpCentre.type";
import { requireAuthThen } from "@/utils/requireAuth.util";

export function HelpArticleScreen({ navigation, route }: MainScreenProps<"HelpArticle">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { topicSlug } = route.params;
  const queryKey = ["help", "topic", topicSlug];
  const topic = useQuery({ queryKey, queryFn: () => helpCenterService.fetchHelpTopic(topicSlug) });
  const vote = useMutation({
    mutationFn: (helpful: boolean) => helpCenterService.voteOnHelpTopic(topic.data?.id ?? "", helpful),
    onSuccess: (result) => queryClient.setQueryData<HelpTopicDetail>(queryKey, (current) => (current ? { ...current, ...result } : current)),
  });
  const openHelpLink = (target: HelpLinkTarget) => (target.topicSlug ? navigation.push("HelpArticle", { topicSlug: target.topicSlug }) : navigation.navigate("HelpCategory", { categorySlug: target.categorySlug }));
  const contactSupport = () => requireAuthThen(() => navigation.navigate("NewSupportTicket"), undefined, "contact support");
  const detail = topic.data;

  return (
    <Screen>
      <Header title="Help" />
      <ScrollView contentContainerStyle={styles.content}>
        {topic.isLoading ? <ListSkeleton rows={4} /> : null}
        {topic.isError ? <ErrorState message="Couldn't load this topic." onRetry={() => topic.refetch()} /> : null}
        {detail ? (
          <>
            <Text size={12} lineHeight={14.4} color={colors.textSubtle}>{detail.categoryTitle}</Text>
            <Text size={20} weight={600} lineHeight={24} accessibilityRole="header">{detail.title}</Text>
            {detail.fromResolvedQuestion ? <Text size={12} lineHeight={16} color={colors.textSubtle}>{detail.sourceLabel}</Text> : null}
            <HelpMarkdown markdown={detail.bodyMarkdown} onOpenHelpLink={openHelpLink} />
            <View style={styles.card} accessibilityRole="summary">
              <Text size={14} weight={600}>Was this helpful?</Text>
              <View style={styles.voteRow}>
                {([true, false] as const).map((helpful) => {
                  const selected = detail.viewerVote === helpful;
                  return (
                    <Pressable
                      key={String(helpful)}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: vote.isPending }}
                      accessibilityLabel={helpful ? `Yes, helpful. ${detail.helpfulCount} people said yes` : "No, not helpful"}
                      onPress={() => requireAuthThen(() => vote.mutate(helpful), undefined, "rate this topic")}
                      style={[styles.voteButton, selected && styles.voteSelected]}
                    >
                      <Text size={14} weight={500} color={selected ? colors.white : colors.text}>{helpful ? "Yes" : "No"}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {detail.viewerVote === false ? <Text size={13} lineHeight={18} color={colors.textMuted}>Sorry about that. Our team can help directly.</Text> : null}
              {detail.viewerVote === true ? <Text size={13} lineHeight={18} color={colors.textMuted}>Thanks for letting us know.</Text> : null}
            </View>
            {detail.related.length > 0 ? (
              <View style={styles.related}>
                <Text size={15} weight={600} accessibilityRole="header">Related topics</Text>
                {detail.related.map((related) => (
                  <Pressable key={related.id} accessibilityRole="link" accessibilityLabel={related.title} onPress={() => navigation.push("HelpArticle", { topicSlug: related.slug })} style={styles.relatedRow}>
                    <Text size={14} color={colors.primary}>{related.title}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Button variant="subtle" title="Still need help? Contact support" onPress={contactSupport} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 10 },
  voteRow: { flexDirection: "row", gap: 8 },
  voteButton: { minWidth: 72, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  voteSelected: { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid },
  related: { gap: 6 },
  relatedRow: { paddingVertical: 6 },
}));
