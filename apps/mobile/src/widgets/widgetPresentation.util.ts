import { darkColors, lightColors } from "@nantty/design-tokens/native";

import type { Money } from "@/types/money.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export const hiddenAmountText = "••••";

export interface WidgetPalette {
  readonly background: `#${string}`;
  readonly surface: `#${string}`;
  readonly text: `#${string}`;
  readonly muted: `#${string}`;
  readonly brand: `#${string}`;
  readonly onBrand: `#${string}`;
  readonly ring: `#${string}`;
  readonly seenRing: `#${string}`;
  readonly live: `#${string}`;
}

const hex = (value: string) => value as `#${string}`;

export function widgetPaletteFor(scheme: "light" | "dark"): WidgetPalette {
  const tokens = scheme === "dark" ? darkColors : lightColors;
  return {
    background: hex(scheme === "dark" ? "#15161A" : tokens.surface), surface: hex(scheme === "dark" ? "#1E2024" : tokens.sunken), text: hex(tokens.text), muted: hex(tokens.textMuted),
    brand: hex(tokens.brandSolid), onBrand: hex(tokens.onBrand), ring: hex(tokens.brandSolid), seenRing: hex(tokens.borderStrong), live: hex(tokens.danger),
  };
}

export function widgetAmountText(amount: Money | null, hidden: boolean): string {
  if (hidden || amount === null) return hiddenAmountText;
  return formatMoneyForDisplay(amount, { showDecimals: false });
}

export function widgetCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
}

export function widgetEtaText(etaAt: string | null, now: Date): string | null {
  if (etaAt === null) return null;
  const eta = new Date(etaAt);
  if (Number.isNaN(eta.getTime())) return null;
  const sameDay = eta.toDateString() === now.toDateString();
  const time = eta.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Arrives by ${time}` : `Arrives ${eta.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}`;
}

export type WidgetSize = "small" | "medium" | "large";

export function widgetSizeFromDimensions(width: number, height: number): WidgetSize {
  if (height >= 300) return "large";
  return width >= 250 ? "medium" : "small";
}
