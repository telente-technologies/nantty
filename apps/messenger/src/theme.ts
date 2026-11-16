import { darkColors, lightColors, spacing, typeScale } from "@nantty/design-tokens/native";

export const messengerTheme = {
  light: {
    background: lightColors.bg,
    surface: lightColors.surface,
    elevated: lightColors.elevated,
    text: lightColors.text,
    muted: lightColors.textMuted,
    subtle: lightColors.textSubtle,
    border: lightColors.border,
    brand: lightColors.brandSolid,
    brandTint: lightColors.brandTint,
    onBrand: lightColors.onBrand,
    danger: lightColors.danger,
    scrim: "rgba(0,0,0,0.46)",
  },
  dark: {
    background: darkColors.bg,
    surface: darkColors.surface,
    elevated: darkColors.elevated,
    text: darkColors.text,
    muted: darkColors.textMuted,
    subtle: darkColors.textSubtle,
    border: darkColors.border,
    brand: darkColors.brandSolid,
    brandTint: darkColors.brandTint,
    onBrand: darkColors.onBrand,
    danger: darkColors.danger,
    scrim: "rgba(0,0,0,0.62)",
  },
  spacing,
  typeScale,
} as const;

export type MessengerColorScheme = "light" | "dark";
export type MessengerColors = (typeof messengerTheme)[MessengerColorScheme];
