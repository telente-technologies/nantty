import type { StoryTrayItem } from "@/types";

export function getStoryTrayNeighbors(items: readonly StoryTrayItem[], userId: string) {
  const position = items.findIndex((item) => item.user.id === userId);

  return {
    previous: position > 0 ? items[position - 1] : undefined,
    next: position < 0 ? items[0] : items[position + 1],
  };
}
