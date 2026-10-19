export type FeedModuleKind = "getVerified" | "suggestedClips" | "peopleYouMayKnow";

export interface FeedModuleCadence {
  readonly firstAfterPosts: number;
  readonly repeatEveryPosts: number | null;
}

export const feedModuleCadence: Readonly<Record<FeedModuleKind, FeedModuleCadence>> = {
  getVerified: { firstAfterPosts: 3, repeatEveryPosts: null },
  suggestedClips: { firstAfterPosts: 6, repeatEveryPosts: 18 },
  peopleYouMayKnow: { firstAfterPosts: 10, repeatEveryPosts: 30 },
};

export const feedModulePriority: readonly FeedModuleKind[] = ["getVerified", "suggestedClips", "peopleYouMayKnow"];

export const minimumPostsBetweenFeedModules = 1;

export const suggestedClipsPerRail = 8;
export const minimumClipsToShowSuggestedRail = 3;
export const suggestedClipsNotInterestedCooldownDays = 7;
export const suggestedClipsHiddenDays = 30;

export const peopleYouMayKnowFetchLimit = 20;
export const peopleYouMayKnowPerCarousel = 10;
export const minimumPeopleToShowCarousel = 2;

export const getVerifiedCardRules = { impressionIntervalDays: 3, dismissalsBeforeSnooze: 2, snoozeDays: 30 } as const;

export const millisecondsPerDay = 86_400_000;
