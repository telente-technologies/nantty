import { nigeriaCountry, nigeriaGeoStates, type NigeriaGeoState } from "@/constants/nigeriaGeo.constant";
import type { ShippingDestination } from "@/types/shipping.type";

export function readLeafKeysOfState(geoState: NigeriaGeoState): string[] {
  if (geoState.localGovernmentAreas.length === 0) return [`${nigeriaCountry.code}-${geoState.code}`];
  return geoState.localGovernmentAreas.map((lgaName) => `${nigeriaCountry.code}-${geoState.code}:${lgaName}`);
}

export const allShippingLeafKeys: readonly string[] = nigeriaGeoStates.flatMap(readLeafKeysOfState);

export function expandDestinationsToLeafKeys(destinations: readonly ShippingDestination[]): Set<string> {
  const selected = new Set<string>();
  for (const destination of destinations) {
    if (destination.level === "country") allShippingLeafKeys.forEach((key) => selected.add(key));
    const geoState = nigeriaGeoStates.find((candidate) => candidate.code === destination.stateCode);
    if (!geoState) continue;
    if (destination.level === "state") readLeafKeysOfState(geoState).forEach((key) => selected.add(key));
    if (destination.level === "lga" && destination.lgaName) selected.add(`${nigeriaCountry.code}-${geoState.code}:${destination.lgaName}`);
  }
  return selected;
}

export function compressLeafKeysToDestinations(selected: ReadonlySet<string>): ShippingDestination[] {
  if (allShippingLeafKeys.every((key) => selected.has(key))) return [{ level: "country", countryCode: nigeriaCountry.code, stateCode: null, lgaName: null }];
  const destinations: ShippingDestination[] = [];
  for (const geoState of nigeriaGeoStates) {
    const leafKeys = readLeafKeysOfState(geoState);
    const chosenKeys = leafKeys.filter((key) => selected.has(key));
    if (chosenKeys.length === 0) continue;
    if (chosenKeys.length === leafKeys.length) {
      destinations.push({ level: "state", countryCode: nigeriaCountry.code, stateCode: geoState.code, lgaName: null });
      continue;
    }
    for (const lgaName of geoState.localGovernmentAreas) {
      if (selected.has(`${nigeriaCountry.code}-${geoState.code}:${lgaName}`)) destinations.push({ level: "lga", countryCode: nigeriaCountry.code, stateCode: geoState.code, lgaName });
    }
  }
  return destinations;
}

export function describeDestinations(destinations: readonly ShippingDestination[]): string {
  if (destinations.some((destination) => destination.level === "country")) return "All of Nigeria";
  const parts = destinations.map((destination) => {
    const stateName = nigeriaGeoStates.find((geoState) => geoState.code === destination.stateCode)?.name ?? "";
    return destination.level === "state" ? stateName : `${destination.lgaName}, ${stateName}`;
  });
  if (parts.length <= 4) return parts.join(" · ");
  return `${parts.slice(0, 4).join(" · ")} +${parts.length - 4} more`;
}
