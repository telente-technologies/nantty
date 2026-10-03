import { darkColors, lightColors, type SemanticColors } from "@zudomart/design-tokens/native";

import type { EmailTheme, Tone } from "../emailTypes";

export interface EmailPalette {
  readonly page: string;
  readonly card: string;
  readonly sunken: string;
  readonly text: string;
  readonly muted: string;
  readonly line: string;
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

function buildPalette(colors: SemanticColors): EmailPalette {
  return {
    page: colors.sunken,
    card: colors.surface,
    sunken: colors.bg,
    text: colors.text,
    muted: colors.textMuted,
    line: colors.border,
    brand: colors.brand,
    button: colors.brandSolid,
    onButton: colors.onBrand,
    dangerButton: lightColors.dangerText,
    accent: colors.accent,
    onAccent: colors.onAccent,
    toneText: { brand: colors.brand, success: colors.successText, warn: colors.warnText, danger: colors.dangerText, neutral: colors.textMuted },
    toneTint: { brand: colors.brandTint, success: colors.successTint, warn: colors.warnTint, danger: colors.dangerTint, neutral: colors.bg },
    toneSolid: { brand: colors.brandSolid, success: colors.success, warn: colors.warn, danger: colors.danger, neutral: colors.borderControl },
  };
}

export const lightPalette = buildPalette(lightColors);
export const darkPalette = buildPalette(darkColors);

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
    `.zm-brand{color:${p.brand}!important}`,
    `.zm-line{border-color:${p.line}!important}`,
    `.zm-rule{background-color:${p.line}!important}`,
    `.zm-btn{background-color:${p.button}!important}`,
    ...tones.flatMap((tone) => [
      `.zm-tint-${tone}{background-color:${p.toneTint[tone]}!important}`,
      `.zm-tone-${tone}{color:${p.toneText[tone]}!important}`,
      `.zm-solid-${tone}{background-color:${p.toneSolid[tone]}!important}`,
    ]),
  ];
  const scoped = rules.join("");
  const outlook = rules.map((rule) => `[data-ogsc] ${rule}`).join("");
  return `:root{color-scheme:light dark;supported-color-schemes:light dark}@media (prefers-color-scheme:dark){${scoped}}${outlook}`;
}

export const fontStack = "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const monoStack = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
