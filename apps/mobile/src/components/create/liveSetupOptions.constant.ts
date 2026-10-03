import type { ComponentType } from "react";

import { ArrowsOutSimple24Icon, Camera24Icon, VideoCamera24Icon } from "@/components/icons";
import type { LiveCategory, LiveSource } from "@/types";

export const LIVE_SOURCES: readonly { readonly source: LiveSource; readonly label: string }[] = [
  { source: "camera", label: "Camera" },
  { source: "screen", label: "Screen" },
  { source: "external", label: "External" },
];

export const LIVE_CATEGORIES: readonly { readonly category: LiveCategory; readonly label: string }[] = [
  { category: "justChatting", label: "Just chatting" },
  { category: "gaming", label: "Gaming" },
  { category: "music", label: "Music" },
  { category: "irl", label: "IRL" },
  { category: "education", label: "Education" },
  { category: "shopping", label: "Shopping" },
];

export const LIVE_SOURCE_ICON: Record<LiveSource, ComponentType<{ size?: number; color?: string }>> = {
  camera: Camera24Icon,
  screen: ArrowsOutSimple24Icon,
  external: VideoCamera24Icon,
};
