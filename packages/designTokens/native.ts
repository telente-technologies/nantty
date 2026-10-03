export const lightColors = {
  bg: "#F7F8FE",
  surface: "#FFFFFF",
  elevated: "#FFFFFF",
  sunken: "#F0F2FA",
  text: "#0A0A14",
  textMuted: "#5B5B6B",
  textSubtle: "#6E6E80",
  border: "#E4E6F2",
  borderStrong: "#CDD1E6",
  brand: "#2043F5",
  brandSolid: "#2043F5",
  brandTint: "#ECEFFF",
  onBrand: "#FFFFFF",
  accent: "#F5E320",
  onAccent: "#0A0A14",
  success: "#10B981",
  successTint: "#E7F8F1",
  successText: "#067A55",
  warn: "#F59E0B",
  warnTint: "#FEF4E2",
  warnText: "#8A5100",
  danger: "#EF4444",
  dangerTint: "#FDECEC",
  dangerText: "#B91C1C",
  overlay: "rgba(10, 10, 20, 0.5)",
  focus: "#2043F5",
} as const;

export type SemanticColors = { readonly [Key in keyof typeof lightColors]: string };

export const darkColors: SemanticColors = {
  bg: "#0B0D17",
  surface: "#141726",
  elevated: "#1C2033",
  sunken: "#0F1220",
  text: "#F2F3F8",
  textMuted: "#A9ADC2",
  textSubtle: "#8A8FA8",
  border: "#262B42",
  borderStrong: "#353B57",
  brand: "#6A82F8",
  brandSolid: "#4563F7",
  brandTint: "#1A2150",
  onBrand: "#FFFFFF",
  accent: "#F5E320",
  onAccent: "#0A0A14",
  success: "#34D399",
  successTint: "#0E2A22",
  successText: "#6EE7B7",
  warn: "#FBBF24",
  warnTint: "#2E2410",
  warnText: "#FCD34D",
  danger: "#F87171",
  dangerTint: "#2E1416",
  dangerText: "#FCA5A5",
  overlay: "rgba(0, 0, 0, 0.65)",
  focus: "#8FA1FA",
};

export const typeScale = { xs: 12, sm: 13, md: 14, base: 16, lg: 20, xl: 24, xxl: 32 } as const;
export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 56 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
export const controlHeight = { sm: 32, md: 36, lg: 44 } as const;
export const motionDuration = { fast: 120, base: 200, slow: 320 } as const;
