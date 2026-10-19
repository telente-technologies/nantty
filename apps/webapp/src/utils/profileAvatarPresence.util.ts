export interface StoryRingStatus {
  readonly hasActiveStory: boolean;
  readonly hasUnseenStory: boolean;
}

export interface HostLiveStatus {
  readonly liveStreamId: string | null;
  readonly startedAt: string | null;
}

export type ProfileAvatarRing = "none" | "storyUnseen" | "storySeen" | "live";

export type ProfileAvatarMenuOption = "watchLive" | "viewStory" | "viewProfilePicture";

export interface ProfileAvatarPresence {
  readonly ring: ProfileAvatarRing;
  readonly liveStreamId: string | null;
  readonly hasActiveStory: boolean;
}

export interface ProfileAvatarPresenceInput {
  readonly storyStatus: StoryRingStatus | null | undefined;
  readonly liveStatus: HostLiveStatus | null | undefined;
  readonly isProfileHiddenFromViewer: boolean;
}

export const profileAvatarWithoutPresence: ProfileAvatarPresence = { ring: "none", liveStreamId: null, hasActiveStory: false };

export function resolveProfileAvatarPresence({ storyStatus, liveStatus, isProfileHiddenFromViewer }: ProfileAvatarPresenceInput): ProfileAvatarPresence {
  if (isProfileHiddenFromViewer) return profileAvatarWithoutPresence;
  const liveStreamId = liveStatus?.liveStreamId || null;
  const hasActiveStory = storyStatus?.hasActiveStory === true;
  const ring: ProfileAvatarRing = liveStreamId ? "live" : hasActiveStory ? (storyStatus?.hasUnseenStory ? "storyUnseen" : "storySeen") : "none";
  return { ring, liveStreamId, hasActiveStory };
}

export const doesProfileAvatarOpenMenu = (presence: ProfileAvatarPresence) => presence.liveStreamId !== null || presence.hasActiveStory;

export function listProfileAvatarMenuOptions(presence: ProfileAvatarPresence, hasProfilePicture: boolean): ProfileAvatarMenuOption[] {
  return [
    ...(presence.liveStreamId ? (["watchLive"] as const) : []),
    ...(presence.hasActiveStory ? (["viewStory"] as const) : []),
    ...(hasProfilePicture ? (["viewProfilePicture"] as const) : []),
  ];
}

export const profileAvatarMenuOptionLabels: Readonly<Record<ProfileAvatarMenuOption, string>> = {
  watchLive: "Watch live",
  viewStory: "View story",
  viewProfilePicture: "View profile picture",
};

export function describeProfileAvatarForAccessibility(presence: ProfileAvatarPresence, displayName: string): string {
  if (presence.liveStreamId) return presence.hasActiveStory ? `${displayName}, Live now. View live, story or profile picture` : `${displayName}, Live now. Watch live or view profile picture`;
  if (presence.hasActiveStory) return `${displayName}, View story or profile picture`;
  return `View ${displayName}'s profile picture`;
}

export const storyNoLongerAvailableMessage = "This story is no longer available.";
export const liveNoLongerAvailableMessage = "This live has ended.";
export const profileAvatarOpenFailedMessage = "Couldn't open that right now. Check your connection and try again.";

export interface ProfileAvatarOpenHandlers {
  readonly open: (targetId: string) => void;
  readonly reportUnavailable: (message: string) => void;
}

export async function openStoryWhenStillActive(userId: string, fetchStoriesForUser: (userId: string) => Promise<readonly unknown[]>, handlers: ProfileAvatarOpenHandlers): Promise<boolean> {
  try {
    const stories = await fetchStoriesForUser(userId);
    if (stories.length === 0) {
      handlers.reportUnavailable(storyNoLongerAvailableMessage);
      return false;
    }
  } catch {
    handlers.reportUnavailable(profileAvatarOpenFailedMessage);
    return false;
  }
  handlers.open(userId);
  return true;
}

export async function openLiveWhenStillOn(userId: string, fetchHostLiveStatus: (userId: string) => Promise<HostLiveStatus>, handlers: ProfileAvatarOpenHandlers): Promise<boolean> {
  let liveStreamId: string | null;
  try {
    liveStreamId = (await fetchHostLiveStatus(userId)).liveStreamId;
  } catch {
    handlers.reportUnavailable(profileAvatarOpenFailedMessage);
    return false;
  }
  if (!liveStreamId) {
    handlers.reportUnavailable(liveNoLongerAvailableMessage);
    return false;
  }
  handlers.open(liveStreamId);
  return true;
}
