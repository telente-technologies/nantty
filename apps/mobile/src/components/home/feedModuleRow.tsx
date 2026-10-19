import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";

import type { Clip } from "@/types";
import type { FeedModuleSlot } from "@/utils/feedModuleLayout.util";

import type { FeedModules } from "./feedModules.hook";
import { GetVerifiedCard } from "./getVerifiedCard";
import { PeopleYouMayKnowRow } from "./peopleYouMayKnowRow";
import { suggestedVideoStartQueryKey } from "./suggestedClipsStream.hook";
import { SuggestedClipsRow } from "./suggestedClipsRow";

export interface FeedModuleRowProps {
  readonly slot: FeedModuleSlot;
  readonly modules: FeedModules;
  readonly onPressRailMore: (railClipIds: readonly string[]) => void;
}

const posterOf = (clip: Clip) => clip.media[0]?.posterUrl ?? null;

export function FeedModuleRow({ slot, modules, onPressRailMore }: FeedModuleRowProps) {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  if (slot.kind === "getVerified") return <GetVerifiedCard model={modules.getVerified} />;
  if (slot.kind === "peopleYouMayKnow") {
    const { people } = modules;
    return (
      <PeopleYouMayKnowRow
        suggestions={modules.peopleForCarousel(slot.occurrence)}
        followStateFor={people.followStateFor}
        onToggleFollow={people.toggleFollow}
        onDismiss={people.dismiss}
        onPressProfile={(userId) => navigation.navigate("UserProfile", { userId })}
        onSeeAll={() => navigation.navigate("Search", { scope: "global" })}
      />
    );
  }
  const railClips = modules.suggestedClips.railClipsFor(slot.occurrence);
  const openSuggestedVideos = (clipId: string) => {
    const tapped = railClips.find((clip) => clip.id === clipId);
    if (tapped) queryClient.setQueryData(suggestedVideoStartQueryKey(clipId), tapped);
    navigation.navigate("SuggestedVideos", { start: clipId });
  };
  return (
    <SuggestedClipsRow
      clips={railClips.map((clip) => ({ id: clip.id, thumbnailUrl: posterOf(clip), authorName: clip.author.name }))}
      onPressClip={openSuggestedVideos}
      onPressMore={() => onPressRailMore(railClips.map((clip) => clip.id))}
    />
  );
}
