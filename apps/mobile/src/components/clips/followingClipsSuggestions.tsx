import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { FollowSuggestionRow } from "@/components/explore/followSuggestionRow";
import { setUserFollowStateEverywhere } from "@/cache/followCache.util";
import { isActiveFollowState, useConfirmedFollowToggle } from "@/components/profile/confirmedFollowToggle.hook";
import { Text } from "@/components/ui/text";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { exploreService } from "@/services/feed/explore.service";
import { followsService } from "@/services/social/follows.service";
import { useTheme } from "@/theme";
import type { FollowState } from "@/types/socialGraph.type";

const SUGGESTED_CREATORS_TO_SHOW = 5;

export function FollowingClipsSuggestions({ onFollowedCreator }: { readonly onFollowedCreator: () => void }) {
  const { colors } = useTheme();
  const openUserProfile = useOpenUserProfile();
  const queryClient = useQueryClient();
  const { toggle } = useConfirmedFollowToggle();
  const [followStates, setFollowStates] = useState<ReadonlyMap<string, FollowState>>(new Map());
  const suggestions = useQuery({ queryKey: ["clips", "followingEmpty", "creators"], queryFn: () => exploreService.fetchWhoToFollow(SUGGESTED_CREATORS_TO_SHOW), staleTime: 300_000 });
  const creators = suggestions.data?.data ?? [];
  if (creators.length === 0) return null;
  return (
    <View style={styles.root}>
      <Text size={13} weight={600} color={colors.textMuted} style={styles.heading} accessibilityRole="header">
        Suggested creators
      </Text>
      {creators.map((suggestion) => (
        <FollowSuggestionRow
          key={suggestion.user.id}
          suggestion={suggestion}
          following={isActiveFollowState(followStates.get(suggestion.user.id))}
          onPressProfile={() => openUserProfile(suggestion.user.id)}
          onToggleFollow={() => {
            const userId = suggestion.user.id;
            toggle({
              subjectLabel: `@${suggestion.user.username}`,
              state: followStates.get(userId),
              followedState: suggestion.isPrivate ? "requested" : "accepted",
              follow: async () => {
                const result = await followsService.followUser(userId);
                onFollowedCreator();
                return result;
              },
              unfollow: async () => {
                await followsService.unfollowUser(userId);
                onFollowedCreator();
              },
              apply: (state) => {
                setUserFollowStateEverywhere(queryClient, userId, state);
                setFollowStates((current) => new Map(current).set(userId, state));
              },
            });
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: "stretch", marginTop: 16 },
  heading: { paddingHorizontal: 16, paddingBottom: 4 },
});
