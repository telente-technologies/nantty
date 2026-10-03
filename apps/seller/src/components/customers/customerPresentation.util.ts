import type { StatusTone } from "@/components/ui/statusBadge";
import type { CustomerType } from "@/types/customer.type";

export const customerTypeLabels: Record<CustomerType, string> = { new: "New", returning: "Returning", no_orders: "No orders yet" };
export const customerTypeTones: Record<CustomerType, StatusTone> = { new: "highlight", returning: "success", no_orders: "neutral" };

export function formatMonthKeyAsShortLabel(monthKey: string, locale = "en-NG"): string {
  return new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${monthKey}-15T12:00:00.000Z`));
}

export function formatMonthKeyAsLongLabel(monthKey: string, locale = "en-NG"): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthKey}-15T12:00:00.000Z`));
}
