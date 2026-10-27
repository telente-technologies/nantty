export interface WidgetStoryPerson {
  readonly userId: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly hasUnseen: boolean;
  readonly storyCount: number;
  readonly latestStoryAt: string;
  readonly thumbnailUrl: string | null;
  readonly deepLink: string;
}

export interface WidgetStoriesPayload {
  readonly people: readonly WidgetStoryPerson[];
  readonly generatedAt: string;
}

export function orderWidgetStoryPeople(people: readonly WidgetStoryPerson[], limit: number): WidgetStoryPerson[] {
  return [...people].sort((left, right) => Number(right.hasUnseen) - Number(left.hasUnseen) || right.latestStoryAt.localeCompare(left.latestStoryAt)).slice(0, limit);
}

export function storyDeepLink(userId: string): string {
  return `nantty://stories/${encodeURIComponent(userId)}`;
}
