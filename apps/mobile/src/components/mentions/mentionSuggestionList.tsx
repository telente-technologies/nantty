import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MentionCandidate } from "@/types/mention.type";
import { MAXIMUM_MENTIONS_PER_CONTENT } from "@/utils/mentions.util";

import type { MentionSuggestionsState } from "./mentionComposer.hook";

const DOES_NOT_ALLOW_MENTIONS_LABEL = "Doesn't allow mentions";

function CandidateRow({ candidate, onPick }: { readonly candidate: MentionCandidate; readonly onPick: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { user, allowsMentions } = candidate;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={allowsMentions ? `Mention ${user.name}, @${user.username}` : `${user.name}, @${user.username}. ${DOES_NOT_ALLOW_MENTIONS_LABEL}`}
      accessibilityState={{ disabled: !allowsMentions }}
      onPress={onPick}
      style={[styles.row, !allowsMentions && styles.disabledRow]}
    >
      <Avatar uri={user.avatarUrl} size={36} placeholderColor={colors.primaryTint} />
      <View style={styles.text}>
        <View style={styles.nameLine}>
          <Text size={14} weight={600} lineHeight={16.8} numberOfLines={1} style={styles.name}>{user.name}</Text>
          <VerificationBadge verification={user.verification} legacyVerified={user.verified} size={14} />
        </View>
        <Text size={12} lineHeight={16.8} color={colors.textMuted} numberOfLines={1}>
          {allowsMentions ? `@${user.username}` : `@${user.username} · ${DOES_NOT_ALLOW_MENTIONS_LABEL}`}
        </Text>
      </View>
    </Pressable>
  );
}

export function MentionSuggestionList({ suggestions }: { readonly suggestions: MentionSuggestionsState }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { candidates, everyone, isLoading, mentionCount, onPickCandidate, onPickEveryone } = suggestions;
  const isEmpty = candidates.length === 0 && !everyone;
  if (isEmpty && isLoading) return null;
  return (
    <View style={styles.panel} accessibilityLabel="Mention suggestions">
      <View style={styles.header}>
        <Text size={12} weight={600} lineHeight={16.8} color={colors.textMuted}>Mention someone</Text>
        <Text size={12} lineHeight={16.8} color={mentionCount >= MAXIMUM_MENTIONS_PER_CONTENT ? colors.error : colors.textMuted}>
          {mentionCount}/{MAXIMUM_MENTIONS_PER_CONTENT} mentions
        </Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="always" style={styles.scroll}>
        {everyone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={everyone.available ? "Mention everyone in this group" : `@all. ${everyone.unavailableReason ?? ""}`}
            accessibilityState={{ disabled: !everyone.available }}
            onPress={everyone.available ? onPickEveryone : undefined}
            style={[styles.row, !everyone.available && styles.disabledRow]}
          >
            <View style={styles.everyoneBadge}>
              <Text size={14} weight={700} lineHeight={16.8} color={colors.primary}>@</Text>
            </View>
            <View style={styles.text}>
              <Text size={14} weight={600} lineHeight={16.8}>@all</Text>
              <Text size={12} lineHeight={16.8} color={colors.textMuted}>
                {everyone.available ? "Notify every member" : (everyone.unavailableReason ?? "Not available")}
              </Text>
            </View>
          </Pressable>
        ) : null}
        {candidates.map((candidate, index) => (
          <View key={candidate.user.id}>
            {candidate.rank === "other" && index > 0 && candidates[index - 1]!.rank !== "other" ? (
              <View style={styles.divider}><Text size={12} weight={600} lineHeight={16.8} color={colors.textMuted}>More people on Nantty</Text></View>
            ) : null}
            <CandidateRow candidate={candidate} onPick={() => onPickCandidate(candidate)} />
          </View>
        ))}
        {isEmpty ? <Text size={13} lineHeight={16.9} color={colors.textMuted} style={styles.empty}>No people found</Text> : null}
      </ScrollView>
    </View>
  );
}

export function MentionCountLabel({ mentionCount }: { readonly mentionCount: number }) {
  const { colors } = useTheme();
  if (mentionCount === 0) return null;
  return (
    <Text size={12} lineHeight={16.8} color={mentionCount >= MAXIMUM_MENTIONS_PER_CONTENT ? colors.error : colors.textMuted} accessibilityLiveRegion="polite">
      {mentionCount}/{MAXIMUM_MENTIONS_PER_CONTENT} mentions
    </Text>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  panel: { backgroundColor: colors.elevated, borderTopWidth: 1, borderTopColor: colors.divider },
  header: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 },
  scroll: { maxHeight: 220 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  disabledRow: { opacity: 0.5 },
  text: { flex: 1 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flexShrink: 1 },
  everyoneBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  divider: { paddingHorizontal: 16, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.divider },
  empty: { paddingHorizontal: 16, paddingVertical: 12 },
}));
