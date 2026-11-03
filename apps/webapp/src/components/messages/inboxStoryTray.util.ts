import type { StoryTrayItem } from "@/types";

export interface InboxStoryItem {
  readonly key: string;
  readonly href: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly hasUnseen: boolean;
  readonly isOwnStory: boolean;
  readonly accessibleLabel: string;
}

export function buildInboxStoryItems(items: readonly StoryTrayItem[]): readonly InboxStoryItem[] {
  return [
    {
      key: "own-story",
      href: "/create/story",
      name: "Your story",
      avatarUrl: null,
      hasUnseen: false,
      isOwnStory: true,
      accessibleLabel: "Add to your story",
    },
    ...items.map(({ user, hasUnseen }) => ({
      key: user.id,
      href: `/stories/${encodeURIComponent(user.id)}`,
      name: `@${user.username}`,
      avatarUrl: user.avatarUrl ?? null,
      hasUnseen,
      isOwnStory: false,
      accessibleLabel: `View @${user.username}'s story`,
    })),
  ];
}
