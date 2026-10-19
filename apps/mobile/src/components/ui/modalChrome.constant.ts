import { StyleSheet, type ViewStyle } from "react-native";

import { palette as colorPalette } from "@/constants/colors.constant";
import type { ColorSchemeName, ThemeColors } from "@/theme";

export type ModalTone = "neutral" | "brand" | "destructive" | "success" | "caution";

export const modalRadius = { dialog: 20, sheet: 24, action: 12, card: 14, chip: 999 } as const;

export const modalSpacing = { edge: 20, gap: 12, actionGap: 10, actionHeight: 48 } as const;

export const modalMotion = { enterMs: 240, exitMs: 160, sheetDamping: 26, sheetStiffness: 260 } as const;

export const modalMaxWidth = 400;

const scrimByScheme: Readonly<Record<ColorSchemeName, string>> = {
  light: "rgba(10, 10, 20, 0.45)",
  dark: "rgba(0, 0, 0, 0.68)",
};

export interface ModalPalette {
  readonly surface: string;
  readonly border: string;
  readonly scrim: string;
  readonly handle: string;
  readonly ink: string;
  readonly inkMuted: string;
  readonly link: string;
  readonly secondaryBorder: string;
  readonly secondaryPressed: string;
  readonly destructiveSolid: string;
  readonly destructiveInk: string;
  readonly inset: string;
}

export function buildModalPalette(colors: ThemeColors, scheme: ColorSchemeName): ModalPalette {
  const isDark = scheme === "dark";
  return {
    surface: isDark ? colors.surface : colors.elevated,
    border: isDark ? "rgba(255, 255, 255, 0.10)" : "transparent",
    scrim: scrimByScheme[scheme],
    handle: isDark ? "rgba(255, 255, 255, 0.28)" : "rgba(10, 10, 20, 0.18)",
    ink: colors.text,
    inkMuted: colors.textMuted,
    link: isDark ? colors.link : colors.primary,
    secondaryBorder: isDark ? "rgba(255, 255, 255, 0.18)" : "#CDD1E6",
    secondaryPressed: isDark ? "rgba(255, 255, 255, 0.06)" : "#F4F6FD",
    destructiveSolid: isDark ? "#C8333B" : "#D32F2F",
    destructiveInk: isDark ? "#FF8A8A" : "#B91C1C",
    inset: isDark ? "#232326" : "#F4F6FD",
  };
}

export function buildModalToneColors(colors: ThemeColors, scheme: ColorSchemeName, tone: ModalTone): { readonly tint: string; readonly ink: string } {
  const isDark = scheme === "dark";
  switch (tone) {
    case "destructive":
      return { tint: colors.errorTint, ink: isDark ? "#FF8A8A" : "#B91C1C" };
    case "success":
      return { tint: colors.successTint, ink: colors.successText };
    case "caution":
      return { tint: colors.cautionTint, ink: colors.cautionText };
    case "brand":
      return { tint: colors.primaryTint, ink: isDark ? colors.link : colors.primary };
    default:
      return { tint: isDark ? "#26282D" : "#F0F2FA", ink: colors.text };
  }
}

export function buildModalElevation(scheme: ColorSchemeName, palette: ModalPalette): ViewStyle {
  if (scheme === "dark") return { borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border };
  return { shadowColor: colorPalette.primary[900], shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 28, elevation: 12 };
}

export function buildPopoverMenuSurface(colors: ThemeColors, scheme: ColorSchemeName): ViewStyle {
  const palette = buildModalPalette(colors, scheme);
  return {
    minWidth: 200,
    paddingVertical: 6,
    borderRadius: modalRadius.card,
    backgroundColor: palette.surface,
    ...buildModalElevation(scheme, palette),
    ...(scheme === "dark" ? null : { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(10, 10, 20, 0.08)" }),
  };
}

export const mediaGlass = {
  background: "rgba(12, 12, 18, 0.50)",
  backgroundStrong: "rgba(12, 12, 18, 0.66)",
  border: "rgba(255, 255, 255, 0.14)",
  ink: "#FFFFFF",
  inkMuted: "rgba(255, 255, 255, 0.82)",
  pressed: "rgba(255, 255, 255, 0.12)",
} as const;
