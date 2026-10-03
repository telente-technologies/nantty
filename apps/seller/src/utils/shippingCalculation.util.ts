import { nigeriaCountry } from "@/constants/nigeriaGeo.constant";
import type { Money } from "@/types/money.type";
import type { ShippingCalculation, ShippingDestination, ShippingDestinationLevel, ShippingProfile, ShippingRule, ShippingZone } from "@/types/shipping.type";

const levelSpecificity: Record<ShippingDestinationLevel, number> = { country: 1, state: 2, lga: 3 };

export interface ShippingCustomerLocation {
  readonly stateCode: string;
  readonly lgaName: string | null;
}

function readDestinationMatchLevel(destination: ShippingDestination, location: ShippingCustomerLocation): ShippingDestinationLevel | null {
  if (destination.countryCode !== nigeriaCountry.code) return null;
  if (destination.level === "country") return "country";
  if (destination.stateCode !== location.stateCode) return null;
  if (destination.level === "state") return "state";
  return location.lgaName !== null && destination.lgaName === location.lgaName ? "lga" : null;
}

function readZoneMatchLevel(zone: ShippingZone, location: ShippingCustomerLocation): ShippingDestinationLevel | null {
  let best: ShippingDestinationLevel | null = null;
  for (const destination of zone.destinations) {
    const level = readDestinationMatchLevel(destination, location);
    if (level && (!best || levelSpecificity[level] > levelSpecificity[best])) best = level;
  }
  return best;
}

export function calculateShippingForOrderGroup(profile: ShippingProfile, location: ShippingCustomerLocation, orderSubtotal: Money): ShippingCalculation {
  const zero: Money = { amountMinor: 0, currency: profile.currency };
  let bestRule: ShippingRule | null = null;
  let bestZone: ShippingZone | null = null;
  let bestLevel: ShippingDestinationLevel | null = null;
  for (const rule of profile.rules) {
    if (!rule.active) continue;
    const zone = profile.zones.find((candidate) => candidate.id === rule.zoneId);
    const level = zone ? readZoneMatchLevel(zone, location) : null;
    if (!zone || !level) continue;
    if (!bestLevel || levelSpecificity[level] > levelSpecificity[bestLevel]) {
      bestRule = rule;
      bestZone = zone;
      bestLevel = level;
    }
  }
  if (!bestRule || !bestZone) return { outcome: "not_deliverable", fee: zero, ruleId: null, zoneName: null, matchedLevel: null, thresholdApplied: null };
  const common = { ruleId: bestRule.id, zoneName: bestZone.name, matchedLevel: bestLevel };
  if (bestRule.type === "free") return { ...common, outcome: "free_rule", fee: zero, thresholdApplied: null };
  const threshold = profile.freeShippingThreshold;
  if (threshold && orderSubtotal.amountMinor >= threshold.amountMinor) return { ...common, outcome: "free_threshold", fee: zero, thresholdApplied: threshold };
  return { ...common, outcome: "fee", fee: bestRule.fee, thresholdApplied: null };
}
