import type { GeoSelection, Money, ShippingQuote } from "@/types";

import { destinationIdsOf } from "./geo.mock";
import { convertNairaMinorToViewerCurrency } from "./locale.mock";

interface ShippingZone {
  readonly destinationId: string;
  readonly feeMinor: number;
}

interface SellerShippingRule {
  readonly zones: readonly ShippingZone[];
  readonly freeDestinationIds: readonly string[];
  readonly freeThresholdMinor: number | null;
}

const naira = (amount: number) => amount * 100;

const NIGERIA_WIDE_FLAT: SellerShippingRule = { zones: [{ destinationId: "ng", feeMinor: naira(2500) }], freeDestinationIds: [], freeThresholdMinor: naira(100000) };

export const sellerShippingRules: Readonly<Record<string, SellerShippingRule>> = {
  s_ada: {
    zones: [
      { destinationId: "ng-lagos", feeMinor: naira(1500) },
      { destinationId: "ng-ogun", feeMinor: naira(2000) },
      { destinationId: "ng", feeMinor: naira(3000) },
    ],
    freeDestinationIds: [],
    freeThresholdMinor: null,
  },
  s_tunde: { zones: [{ destinationId: "ng", feeMinor: naira(4000) }], freeDestinationIds: ["ng-lagos"], freeThresholdMinor: null },
  s_glow: NIGERIA_WIDE_FLAT,
  s_home: {
    zones: [
      { destinationId: "ng-lagos", feeMinor: naira(1000) },
      { destinationId: "ng-ogun", feeMinor: naira(1500) },
    ],
    freeDestinationIds: [],
    freeThresholdMinor: null,
  },
  s_food: {
    zones: [
      { destinationId: "ng-lagos", feeMinor: naira(1800) },
      { destinationId: "ng-ogun", feeMinor: naira(1800) },
      { destinationId: "ng-oyo", feeMinor: naira(2200) },
    ],
    freeDestinationIds: [],
    freeThresholdMinor: naira(50000),
  },
  s_kids: { zones: [{ destinationId: "ng", feeMinor: naira(3000) }], freeDestinationIds: [], freeThresholdMinor: null },
  s_kicks: NIGERIA_WIDE_FLAT,
};

const NOT_SHIPPABLE: ShippingQuote = { status: "notDeliverable", fee: null, message: "This seller does not currently ship to your selected location", isFree: false, freeThreshold: null, amountToFreeShipping: null };
const NEEDS_ADDRESS: ShippingQuote = { status: "needsAddress", fee: null, message: "Enter your delivery address to calculate shipping", isFree: false, freeThreshold: null, amountToFreeShipping: null };

export const quoteSellerShipping = (storeId: string, subtotal: Money, destination: GeoSelection | null): ShippingQuote => {
  if (!destination) return NEEDS_ADDRESS;
  const rule = sellerShippingRules[storeId];
  const destinationIds = destinationIdsOf(destination);
  const mostSpecificZone = [...destinationIds].reverse().map((id) => rule?.zones.find((zone) => zone.destinationId === id)).find(Boolean);
  if (!rule || !mostSpecificZone) return NOT_SHIPPABLE;
  const freeThreshold = rule.freeThresholdMinor === null ? null : convertNairaMinorToViewerCurrency(rule.freeThresholdMinor);
  const freeByDestination = rule.freeDestinationIds.some((id) => destinationIds.includes(id));
  const freeByThreshold = freeThreshold !== null && subtotal.amountMinor >= freeThreshold.amountMinor;
  const isFree = freeByDestination || freeByThreshold;
  const feeIfCharged = convertNairaMinorToViewerCurrency(mostSpecificZone.feeMinor);
  return {
    status: "calculated",
    message: null,
    fee: isFree ? { ...feeIfCharged, amountMinor: 0 } : feeIfCharged,
    isFree,
    freeThreshold,
    amountToFreeShipping:
      !isFree && freeThreshold ? { ...freeThreshold, amountMinor: freeThreshold.amountMinor - subtotal.amountMinor } : null,
  };
};
