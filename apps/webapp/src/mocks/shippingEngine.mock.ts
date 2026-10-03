import type { GeoSelection, Money, SellerShippingQuote } from "@/types";

import { destinationIdsOf } from "./geo.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";

interface ShippingRule {
  readonly zones: readonly { readonly destinationId: string; readonly feeNaira: number }[];
  readonly freeDestinationIds: readonly string[];
  readonly freeThresholdNaira: number | null;
}

const NAIRA_PER_USD = 1550;
const nairaToViewer = (naira: number): Money => convertUsdCentsToViewerCurrency(Math.round((naira * 100) / NAIRA_PER_USD));

const nigeriaWide = (feeNaira: number, freeThresholdNaira: number | null = null): ShippingRule => ({
  zones: [{ destinationId: "ng", feeNaira }],
  freeDestinationIds: [],
  freeThresholdNaira,
});

const sellerShippingRules: Readonly<Record<string, ShippingRule>> = {
  s_ada: {
    zones: [
      { destinationId: "ng-lagos", feeNaira: 1500 },
      { destinationId: "ng-ogun", feeNaira: 2000 },
      { destinationId: "ng", feeNaira: 3000 },
    ],
    freeDestinationIds: [],
    freeThresholdNaira: null,
  },
  s_tunde: { zones: [{ destinationId: "ng", feeNaira: 4000 }], freeDestinationIds: ["ng-lagos"], freeThresholdNaira: null },
  s_glow: nigeriaWide(2500, 100000),
  s_home: {
    zones: [
      { destinationId: "ng-lagos", feeNaira: 1000 },
      { destinationId: "ng-ogun", feeNaira: 1500 },
    ],
    freeDestinationIds: [],
    freeThresholdNaira: null,
  },
  s_food: {
    zones: [
      { destinationId: "ng-lagos", feeNaira: 1800 },
      { destinationId: "ng-ogun", feeNaira: 1800 },
      { destinationId: "ng-oyo", feeNaira: 2200 },
    ],
    freeDestinationIds: [],
    freeThresholdNaira: 50000,
  },
  s_kids: nigeriaWide(3000),
  s_kicks: nigeriaWide(2500, 100000),
};

export const quoteSellerShipping = (storeId: string, subtotal: Money, destination: GeoSelection | null): SellerShippingQuote => {
  if (!destination) return { storeId, status: "needsAddress", fee: null, isFree: false, message: "Choose a delivery address to calculate shipping", amountToFreeShipping: null };
  const rule = sellerShippingRules[storeId];
  const ids = destinationIdsOf(destination);
  const zone = [...ids].reverse().map((id) => rule?.zones.find((candidate) => candidate.destinationId === id)).find(Boolean);
  if (!rule || !zone) return { storeId, status: "notDeliverable", fee: null, isFree: false, message: "This seller does not ship to your selected location", amountToFreeShipping: null };
  const threshold = rule.freeThresholdNaira === null ? null : nairaToViewer(rule.freeThresholdNaira);
  const isFree = rule.freeDestinationIds.some((id) => ids.includes(id)) || (threshold !== null && subtotal.amountMinor >= threshold.amountMinor);
  const fee = nairaToViewer(zone.feeNaira);
  return {
    storeId,
    status: "calculated",
    fee: isFree ? { ...fee, amountMinor: 0 } : fee,
    isFree,
    message: null,
    amountToFreeShipping: !isFree && threshold ? { ...threshold, amountMinor: threshold.amountMinor - subtotal.amountMinor } : null,
  };
};
