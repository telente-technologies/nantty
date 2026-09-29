import type { StatusTone } from "@/components/ui/statusBadge";
import type { Money } from "@/types/money.type";
import type { Promotion, PromotionStatus } from "@/types/promotion.type";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

export const promotionStatusTone: Record<PromotionStatus, StatusTone> = { active: "success", scheduled: "info", expired: "neutral", disabled: "caution" };
export const promotionStatusLabel: Record<PromotionStatus, string> = { active: "Active", scheduled: "Scheduled", expired: "Ended", disabled: "Switched off" };
export const promotionKindLabel: Record<Promotion["kind"], string> = { coupon: "Coupon code", automatic: "Automatic discount", scheduled_sale: "Scheduled sale" };

export function describePromotionDiscount(promotion: Pick<Promotion, "discount">, formatMoney: (money: Money) => string, currency: Money["currency"] | null): string {
  if (promotion.discount.kind === "percent") return `${formatBasisPointsAsPercent(promotion.discount.value)} off`;
  return currency ? `${formatMoney({ amountMinor: promotion.discount.value, currency })} off` : "Amount off";
}

export function convertIsoToLocalDateTimeInputValue(isoDate: string | null): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function convertLocalDateTimeInputValueToIso(localValue: string): string | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
