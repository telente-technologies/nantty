import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Cancel20Icon } from "@/components/icons";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { FollowSuggestion } from "@/types/explore.type";
import type { FollowState } from "@/types/socialGraph.type";
import { horizontalScrollGestureGuardProps } from "@/components/home/horizontalScrollGestureGuard.util";

export interface PeopleYouMayKnowRowProps {
  readonly suggestions: readonly FollowSuggestion[];
  readonly followStateFor: (userId: string) => FollowState;
  readonly onToggleFollow: (suggestion: FollowSuggestion) => void;
  readonly onDismiss: (suggestion: FollowSuggestion) => void;
  readonly onPressProfile: (userId: string) => void;
  readonly onSeeAll: () => void;
}

const followButtonLabel = (state: FollowState) => (state === "accepted" ? "Following" : state === "requested" ? "Requested" : "Follow");

export function PeopleYouMayKnowRow({ suggestions, followStateFor, onToggleFollow, onDismiss, onPressProfile, onSeeAll }: PeopleYouMayKnowRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text size={14} weight={600} lineHeight={16.9} accessibilityRole="header">
          People you may know
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="See all suggested people" hitSlop={10} onPress={onSeeAll}>
          <Text size={13} weight={600} color={colors.link}>See all</Text>
        </Pressable>
      </View>
      <ScrollView horizontal {...horizontalScrollGestureGuardProps} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slider}>
        {suggestions.map((suggestion) => {
          const { user } = suggestion;
          const state = followStateFor(user.id);
          const active = state === "accepted" || state === "requested";
          return (
            <View key={user.id} style={styles.card}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${user.name} from suggestions`} hitSlop={8} onPress={() => onDismiss(suggestion)} style={styles.dismiss}>
                <Cancel20Icon size={16} color={colors.textMuted} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${user.name}'s profile`} onPress={() => onPressProfile(user.id)} style={styles.identity}>
                <Avatar uri={user.avatarUrl} size={72} placeholderColor={colors.primaryTint} />
                <View style={styles.nameRow}>
                  <Text size={14} weight={600} numberOfLines={1} style={styles.name}>{user.name}</Text>
                  <VerificationBadge verification={user.verification} legacyVerified={user.verified} size={14} />
                </View>
                <Text size={12} color={colors.textMuted} numberOfLines={2} style={styles.reason}>{suggestion.reason.label}</Text>
              </Pressable>
              <Button
                title={followButtonLabel(state)}
                variant={active ? "outline" : "primary"}
                height={34}
                style={styles.follow}
                onPress={() => onToggleFollow(suggestion)}
                accessibilityLabel={state === "requested" ? `Cancel follow request to ${user.name}` : `${active ? "Unfollow" : "Follow"} ${user.name}`}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  section: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider, paddingVertical: 12, gap: 12 },
  titleRow: { minHeight: 24, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slider: { paddingHorizontal: 16, gap: 8 },
  card: { width: 156, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.elevated, paddingHorizontal: 10, paddingTop: 16, paddingBottom: 10, alignItems: "center", gap: 8 },
  dismiss: { position: "absolute", top: 6, right: 6, zIndex: 1, padding: 4 },
  identity: { alignItems: "center", gap: 6, alignSelf: "stretch" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
  name: { flexShrink: 1 },
  reason: { textAlign: "center", minHeight: 32 },
  follow: { alignSelf: "stretch" },
}));
