import { failValidation } from "@/mocks/mockResponses.mock";
import { pricingRegions } from "@/mocks/seed/regionalPricing.mock";
import type { AdRegionPricing, CreatorSubscriptionBand, PricingRegionCode, RegionalPricingDocument } from "@/types/regionalPricing.type";

import { readArrayAtPath, readIntegerBetween, readObjectAtPath, readTextValue } from "./configurationFieldReaders.mock";

const maximumMinor = 1_000_000_000_000;

function readRegionCode(value: string, path: string): { region: PricingRegionCode; currency: string } {
  const region = pricingRegions.find((candidate) => candidate.region === value);
  if (!region) failValidation(path, "Use one of NG, GH, KE, ZA, GB, EU or US.");
  return region;
}

export function validateRegionalPricingDocument(rawContent: unknown): RegionalPricingDocument {
  const content = readObjectAtPath(rawContent, "content");
  const ads = readArrayAtPath(content.ads, "content.ads", pricingRegions.length).map((raw, index): AdRegionPricing => {
    const path = `content.ads.${index}`;
    const row = readObjectAtPath(raw, path);
    const { region, currency } = readRegionCode(readTextValue(row, "region", path, 2, 2), `${path}.region`);
    if (row.currency !== currency) failValidation(`${path}.currency`, `Prices for ${region} are in ${currency}.`);
    const parsed = {
      region, currency,
      cpmFloorMinor: readIntegerBetween(row, "cpmFloorMinor", path, 1, maximumMinor),
      cpcFloorMinor: readIntegerBetween(row, "cpcFloorMinor", path, 1, maximumMinor),
      minimumDailyBudgetMinor: readIntegerBetween(row, "minimumDailyBudgetMinor", path, 1, maximumMinor),
      boostMinimumDailyMinor: readIntegerBetween(row, "boostMinimumDailyMinor", path, 1, maximumMinor),
    };
    if (parsed.cpcFloorMinor > parsed.minimumDailyBudgetMinor) failValidation(`${path}.cpcFloorMinor`, "The CPC floor can't be more than the minimum daily budget.");
    return parsed;
  });
  const bandsObject = readObjectAtPath(content.creatorSubscriptionBands, "content.creatorSubscriptionBands");
  const creatorSubscriptionBands: Partial<Record<PricingRegionCode, CreatorSubscriptionBand[]>> = {};
  for (const [regionCode, rawBands] of Object.entries(bandsObject)) {
    const path = `content.creatorSubscriptionBands.${regionCode}`;
    const { region } = readRegionCode(regionCode, path);
    let previousWebMinor = 0;
    creatorSubscriptionBands[region] = readArrayAtPath(rawBands, path, 8).map((raw, index) => {
      const bandPath = `${path}.${index}`;
      const band = readObjectAtPath(raw, bandPath);
      const parsed = { band: readTextValue(band, "band", bandPath, 30, 1), webMinor: readIntegerBetween(band, "webMinor", bandPath, 1, maximumMinor), appMinor: readIntegerBetween(band, "appMinor", bandPath, 1, maximumMinor) };
      if (parsed.webMinor <= previousWebMinor) failValidation(`${bandPath}.webMinor`, "Each band must cost more than the one before it.");
      if (parsed.appMinor < parsed.webMinor) failValidation(`${bandPath}.appMinor`, "The app price can't be lower than the web price.");
      previousWebMinor = parsed.webMinor;
      return parsed;
    });
  }
  return { ads, creatorSubscriptionBands };
}
