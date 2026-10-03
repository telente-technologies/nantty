import type { PlanEntitlements } from "@/types/sellerAccess.type";
import { formatMoneyForDisplay, isSupportedCurrencyCode } from "@/utils/money.util";

export function describePlanEntitlements(entitlements: PlanEntitlements, locale = "en-NG"): string[] {
  const descriptions = [
    entitlements.maxStaffSeats === null ? "Unlimited staff seats" : `${entitlements.maxStaffSeats} staff seats`,
    entitlements.maxLocations === null ? "Unlimited locations" : `${entitlements.maxLocations} ${entitlements.maxLocations === 1 ? "location" : "locations"}`,
  ];
  if (entitlements.adCredits && isSupportedCurrencyCode(entitlements.adCredits.currency)) {
    descriptions.push(`${formatMoneyForDisplay({ amountMinor: entitlements.adCredits.amountMinor, currency: entitlements.adCredits.currency }, locale)} ad credit every month`);
  }
  if (entitlements.reducedEscrowFee) descriptions.push("1% escrow fee instead of 1.5%");
  if (entitlements.priorityPlacement) descriptions.push("Priority placement in Mart and search");
  if (entitlements.apiAccess) descriptions.push("API access");
  return descriptions;
}
