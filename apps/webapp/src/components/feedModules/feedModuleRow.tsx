"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { Clip } from "@/types";
import type { FeedModuleSlot } from "@/utils/feedModuleLayout.util";
import { rememberFeedScrollPosition } from "@/utils/feedScrollRestoration.util";

import type { FeedModules } from "./feedModules.hook";
import { GetVerifiedCard } from "./getVerifiedCard";
import { PeopleYouMayKnowRail } from "./peopleYouMayKnowRail";
import { SuggestedClipsRail } from "./suggestedClipsRail";
import { suggestedVideoStartQueryKey } from "./suggestedClipsStream.hook";

export function FeedModuleRow({ slot, modules }: { readonly slot: FeedModuleSlot; readonly modules: FeedModules }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  if (slot.kind === "getVerified") return <GetVerifiedCard model={modules.getVerified} />;
  if (slot.kind === "peopleYouMayKnow") return <PeopleYouMayKnowRail suggestions={modules.peopleForCarousel(slot.occurrence)} onDismiss={modules.people.dismiss} />;
  const openSuggestedVideos = (clip: Clip) => {
    queryClient.setQueryData(suggestedVideoStartQueryKey(clip.id), clip);
    rememberFeedScrollPosition(window.scrollY);
    router.push(`/videos/suggested?start=${encodeURIComponent(clip.id)}`);
  };
  return <SuggestedClipsRail clips={modules.suggestedClips.railClipsFor(slot.occurrence)} onOpenClip={openSuggestedVideos} />;
}
