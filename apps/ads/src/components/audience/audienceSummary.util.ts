import type { AudienceSpec } from "@/types/audience.type";

export function describeAudienceInOneLine(audience: AudienceSpec): string {
  const places = audience.locations.map((location) => location.name).join(", ") || "No location yet";
  const ages = `${audience.ageMin}–${audience.ageMax >= 65 ? "65+" : audience.ageMax}`;
  const gender = audience.gender === "all" ? "all genders" : audience.gender === "female" ? "women" : "men";
  return `${places} · ${ages} · ${gender}`;
}

export function createDefaultAudienceForCountry(countryCode: string, countryName: string): AudienceSpec {
  return {
    locations: [{ type: "country", code: countryCode, name: countryName, countryCode, parentName: null }],
    excludedLocations: [],
    ageMin: 18,
    ageMax: 65,
    gender: "all",
    topicIds: [],
    behaviourIds: [],
    customAudienceIds: [],
    excludedCustomAudienceIds: [],
  };
}
