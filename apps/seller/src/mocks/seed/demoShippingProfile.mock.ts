import type { CurrencyCode } from "@/types/money.type";
import type { ShippingDestination, ShippingProfile } from "@/types/shipping.type";

const stateDestination = (stateCode: string): ShippingDestination => ({ level: "state", countryCode: "NG", stateCode, lgaName: null });

export function buildDemoShippingProfile(currency: CurrencyCode): ShippingProfile {
  const money = (amountMinor: number) => ({ amountMinor, currency });
  return {
    id: "shp_profile_default",
    currency,
    pricedPer: "order_group",
    freeShippingThreshold: money(5_000_000),
    zones: [
      { id: "zone_ikeja", name: "Ikeja (free)", destinations: [{ level: "lga", countryCode: "NG", stateCode: "LA", lgaName: "Ikeja" }] },
      { id: "zone_lagos", name: "Lagos", destinations: [stateDestination("LA")] },
      { id: "zone_southwest", name: "South West", destinations: ["OG", "OY", "OS", "ON", "EK"].map(stateDestination) },
      { id: "zone_abuja", name: "Abuja", destinations: [stateDestination("FC")] },
      { id: "zone_rest", name: "Rest of Nigeria", destinations: [{ level: "country", countryCode: "NG", stateCode: null, lgaName: null }] },
    ],
    rules: [
      { id: "rule_ikeja", zoneId: "zone_ikeja", type: "free", fee: money(0), active: true },
      { id: "rule_lagos", zoneId: "zone_lagos", type: "flat_fee", fee: money(150_000), active: true },
      { id: "rule_southwest", zoneId: "zone_southwest", type: "flat_fee", fee: money(200_000), active: true },
      { id: "rule_abuja", zoneId: "zone_abuja", type: "flat_fee", fee: money(300_000), active: true },
      { id: "rule_rest", zoneId: "zone_rest", type: "flat_fee", fee: money(450_000), active: false },
    ],
    updatedAt: new Date().toISOString(),
  };
}
