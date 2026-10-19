import type { TextStyle } from "react-native";

import { mediaGlass } from "@/components/ui/modalChrome.constant";
import { useTheme, type ThemeColors } from "@/theme";

export const liveGlass = mediaGlass;

export const liveAccent = { red: "#E0201B", gold: "#F5C518", goldInk: "#1A1400" } as const;

export const liveReadableTextShadow: TextStyle = { textShadowColor: "rgba(0, 0, 0, 0.55)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } };

export interface LiveForeground {
  readonly ink: string;
  readonly inkMuted: string;
  readonly chip: string;
  readonly chipBorder: string;
  readonly textShadow: TextStyle | undefined;
}

export function buildLiveForeground(isShownOverVideo: boolean, colors: ThemeColors, isDark: boolean): LiveForeground {
  if (isShownOverVideo) return { ink: liveGlass.ink, inkMuted: liveGlass.inkMuted, chip: liveGlass.background, chipBorder: liveGlass.border, textShadow: liveReadableTextShadow };
  return {
    ink: colors.text,
    inkMuted: colors.textMuted,
    chip: isDark ? "#26282D" : "#F0F2FA",
    chipBorder: isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(10, 10, 20, 0.06)",
    textShadow: undefined,
  };
}

export function useLiveForeground(isShownOverVideo: boolean): LiveForeground {
  const { colors, isDark } = useTheme();
  return buildLiveForeground(isShownOverVideo, colors, isDark);
}

