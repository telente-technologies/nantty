import { darkColors as semanticDark } from "@zudomart/design-tokens/native";

export type StatusToneName = "primary" | "success" | "caution" | "error" | "neutral";

export const darkStatusTones: Readonly<Record<StatusToneName, { readonly background: string; readonly text: string }>> = {
  primary: { background: semanticDark.brandTint, text: semanticDark.brand },
  success: { background: "#0E2A22", text: "#6EE7B7" },
  caution: { background: "#2E2410", text: "#FCD34D" },
  error: { background: "#2E1416", text: "#FCA5A5" },
  neutral: { background: "#3A3A3D", text: "#B3B3B3" },
};
