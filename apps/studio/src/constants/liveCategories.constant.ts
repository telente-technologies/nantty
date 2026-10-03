import type { LiveCategory } from "@/types";

export const LIVE_CATEGORY_OPTIONS: readonly { readonly value: LiveCategory; readonly label: string }[] = [
  { value: "justChatting", label: "Just chatting" },
  { value: "gaming", label: "Gaming" },
  { value: "music", label: "Music" },
  { value: "irl", label: "IRL" },
  { value: "education", label: "Education" },
  { value: "shopping", label: "Shopping / Selling" },
];

export const LIVE_CATEGORY_LABELS = Object.fromEntries(LIVE_CATEGORY_OPTIONS.map((option) => [option.value, option.label])) as Record<LiveCategory, string>;
