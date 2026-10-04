import { darkColors, lightColors } from "@zudomart/design-tokens/native";

import type { EmailTheme, Tone } from "../emailTypes";

export interface EmailPalette {
  readonly page: string;
  readonly card: string;
  readonly sunken: string;
  readonly text: string;
  readonly muted: string;
  readonly subtle: string;
  readonly line: string;
  readonly lineStrong: string;
  readonly brand: string;
  readonly button: string;
  readonly onButton: string;
  readonly dangerButton: string;
  readonly accent: string;
  readonly onAccent: string;
  readonly toneText: Record<Tone, string>;
  readonly toneTint: Record<Tone, string>;
  readonly toneSolid: Record<Tone, string>;
}

export const lightPalette: EmailPalette = {
  page: "#F2F3F7",
  card: "#FFFFFF",
  sunken: "#F6F7FA",
  text: lightColors.text,
  muted: "#55566A",
  subtle: "#6B6D80",
  line: "#E6E8EF",
  lineStrong: "#D3D6E2",
  brand: lightColors.brand,
  button: lightColors.brandSolid,
  onButton: lightColors.onBrand,
  dangerButton: lightColors.dangerText,
  accent: lightColors.accent,
  onAccent: lightColors.onAccent,
  toneText: { brand: lightColors.brand, success: lightColors.successText, warn: lightColors.warnText, danger: lightColors.dangerText, neutral: "#55566A" },
  toneTint: { brand: lightColors.brandTint, success: lightColors.successTint, warn: lightColors.warnTint, danger: lightColors.dangerTint, neutral: "#EEEFF4" },
  toneSolid: { brand: lightColors.brandSolid, success: lightColors.success, warn: lightColors.warn, danger: lightColors.danger, neutral: "#9396AA" },
};

export const darkPalette: EmailPalette = {
  page: "#090B13",
  card: "#121522",
  sunken: "#181C2C",
  text: darkColors.text,
  muted: darkColors.textMuted,
  subtle: "#9196AE",
  line: "#252A40",
  lineStrong: "#343A55",
  brand: "#8FA1FA",
  button: darkColors.brandSolid,
  onButton: darkColors.onBrand,
  dangerButton: "#D93636",
  accent: darkColors.accent,
  onAccent: darkColors.onAccent,
  toneText: { brand: "#9DAEFB", success: darkColors.successText, warn: darkColors.warnText, danger: darkColors.dangerText, neutral: darkColors.textMuted },
  toneTint: { brand: "#1B2252", success: darkColors.successTint, warn: darkColors.warnTint, danger: darkColors.dangerTint, neutral: "#1E2234" },
  toneSolid: { brand: darkColors.brandSolid, success: darkColors.success, warn: darkColors.warn, danger: darkColors.danger, neutral: "#5D6380" },
};

export function selectPalette(theme: EmailTheme): EmailPalette {
  return theme === "dark" ? darkPalette : lightPalette;
}

const tones: readonly Tone[] = ["brand", "success", "warn", "danger", "neutral"];

export function buildDarkModeCss(): string {
  const p = darkPalette;
  const rules = [
    `.zm-page{background-color:${p.page}!important}`,
    `.zm-card{background-color:${p.card}!important;border-color:${p.line}!important}`,
    `.zm-sunken{background-color:${p.sunken}!important}`,
    `.zm-text{color:${p.text}!important}`,
    `.zm-muted{color:${p.muted}!important}`,
    `.zm-subtle{color:${p.subtle}!important}`,
    `.zm-brand{color:${p.brand}!important}`,
    `.zm-line{border-color:${p.line}!important}`,
    `.zm-line-strong{border-color:${p.lineStrong}!important}`,
    `.zm-rule{background-color:${p.line}!important}`,
    `.zm-btn{background-color:${p.button}!important}`,
    `.zm-btn-border{border-color:${p.button}!important}`,
    `.zm-ring{border-color:${p.line}!important;background-color:${p.card}!important}`,
    ...tones.flatMap((tone) => [
      `.zm-tint-${tone}{background-color:${p.toneTint[tone]}!important}`,
      `.zm-tone-${tone}{color:${p.toneText[tone]}!important}`,
      `.zm-solid-${tone}{background-color:${p.toneSolid[tone]}!important}`,
      `.zm-edge-${tone}{border-color:${p.toneSolid[tone]}!important}`,
    ]),
  ];
  const scoped = rules.join("");
  const outlook = rules.map((rule) => `[data-ogsc] ${rule}`).join("");
  return `:root{color-scheme:light dark;supported-color-schemes:light dark}@media (prefers-color-scheme:dark){${scoped}}${outlook}`;
}

export const fontStack = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const monoStack = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
