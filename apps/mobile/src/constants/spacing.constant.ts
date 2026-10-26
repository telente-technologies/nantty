export const layout = {
  gutter: 16,
  controlHeight: 44,
  inputHeight: 42,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const elevation = {
  flat: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  low: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 2 },
  mid: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 4 },
  high: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8 },
  extreme: { shadowColor: "#000", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 16 },
} as const;

export { spacing } from "@nantty/design-tokens/native";
