import { buildDateRangeFromPreset, dateRangePresetLabels, type DateRangePreset } from "@/utils/dateRange.util";

export type DeliveryRangePreset = Exclude<DateRangePreset, "custom"> | "lifetime" | "custom";

export interface DeliveryRangeSelection {
  readonly preset: DeliveryRangePreset;
  readonly customFrom: string;
  readonly customTo: string;
}

export interface ResolvedDeliveryRange {
  readonly from: string | undefined;
  readonly to: string | undefined;
}

export const deliveryRangePresetOptions: readonly { readonly value: DeliveryRangePreset; readonly label: string }[] = [
  { value: "lifetime", label: "Lifetime" },
  ...(["today", "yesterday", "last_7_days", "last_14_days", "last_30_days", "this_month", "last_month"] as const).map((preset) => ({ value: preset, label: dateRangePresetLabels[preset] })),
  { value: "custom", label: "Custom dates" },
];

export function resolveDeliveryRangeSelection(selection: DeliveryRangeSelection): ResolvedDeliveryRange {
  if (selection.preset === "lifetime") return { from: undefined, to: undefined };
  if (selection.preset === "custom") {
    if (!selection.customFrom || !selection.customTo || selection.customFrom > selection.customTo) return { from: undefined, to: undefined };
    return { from: selection.customFrom, to: selection.customTo };
  }
  return buildDateRangeFromPreset(selection.preset);
}

export function buildDeliveryRangeKey(range: ResolvedDeliveryRange): string {
  return `${range.from ?? "all"}:${range.to ?? "all"}`;
}
