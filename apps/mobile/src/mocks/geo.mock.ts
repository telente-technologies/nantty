import { ApiError } from "@/errors/api.error";
import type { Address, GeoArea, GeoCountry, GeoSelection, ShippingAddressInput } from "@/types";

import { GHANA_REGIONS, KENYA_COUNTIES, NIGERIA_CITIES_BY_LGA, NIGERIA_STATES_WITH_LGAS } from "./geoNigeria.mock";
import { createMockRoute, mockPage, type MockRoute } from "./registry.mock";

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const geoCountries: readonly GeoCountry[] = [
  { id: "ng", code: "NG", name: "Nigeria", currency: "NGN", levels: ["state", "lga", "city"], stateLabel: "State", lgaLabel: "LGA" },
  { id: "gh", code: "GH", name: "Ghana", currency: "GHS", levels: ["state"], stateLabel: "Region", lgaLabel: "District" },
  { id: "ke", code: "KE", name: "Kenya", currency: "KES", levels: ["state"], stateLabel: "County", lgaLabel: "Sub-county" },
];

const areasById = new Map<string, GeoArea>();
const childrenByParentId = new Map<string, GeoArea[]>();

const registerArea = (area: GeoArea) => {
  areasById.set(area.id, area);
  childrenByParentId.set(area.parentId, [...(childrenByParentId.get(area.parentId) ?? []), area]);
};

const sortedNames = (names: readonly string[]) => [...names].sort((a, b) => a.localeCompare(b));

Object.entries(NIGERIA_STATES_WITH_LGAS).forEach(([stateName, lgaNames]) => {
  const stateId = `ng-${slug(stateName)}`;
  registerArea({ id: stateId, name: stateName === "FCT" ? "FCT (Abuja)" : stateName, parentId: "ng" });
  sortedNames(lgaNames).forEach((lgaName) => {
    const lgaId = `${stateId}-${slug(lgaName)}`;
    registerArea({ id: lgaId, name: lgaName, parentId: stateId });
    const cityNames = NIGERIA_CITIES_BY_LGA[`${stateName}/${lgaName}`] ?? [lgaName];
    sortedNames(cityNames).forEach((cityName) => registerArea({ id: `${lgaId}-${slug(cityName)}`, name: cityName, parentId: lgaId }));
  });
});
sortedNames(GHANA_REGIONS).forEach((name) => registerArea({ id: `gh-${slug(name)}`, name, parentId: "gh" }));
sortedNames(KENYA_COUNTIES).forEach((name) => registerArea({ id: `ke-${slug(name)}`, name, parentId: "ke" }));

export const findGeoCountry = (countryId: string) => geoCountries.find((country) => country.id === countryId);
export const findGeoArea = (areaId: string | null) => (areaId ? areasById.get(areaId) : undefined);

export const destinationIdsOf = (selection: GeoSelection): readonly string[] =>
  [selection.countryId, selection.stateId, selection.lgaId, selection.cityId].filter((id): id is string => id !== null);

const REQUIRED_LEVEL_FIELD = { state: "stateId", lga: "lgaId", city: "cityId" } as const;
const PARENT_OF_LEVEL = { stateId: "countryId", lgaId: "stateId", cityId: "lgaId" } as const;

export const buildAddressFromInput = (input: ShippingAddressInput, id: string): Address => {
  const country = findGeoCountry(input.countryId);
  if (!country) throw new ApiError(422, "Choose a supported country");
  const selection: Record<string, string | null> = { countryId: country.id, stateId: null, lgaId: null, cityId: null };
  (["state", "lga", "city"] as const).forEach((level) => {
    const field = REQUIRED_LEVEL_FIELD[level];
    const area = findGeoArea(input[field]);
    if (!country.levels.includes(level)) return;
    if (!area || area.parentId !== selection[PARENT_OF_LEVEL[field]]) throw new ApiError(422, `Choose a valid ${level === "state" ? country.stateLabel : level === "lga" ? country.lgaLabel : "city"}`);
    selection[field] = area.id;
  });
  return {
    id,
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    line1: input.line1.trim(),
    postalCode: input.postalCode.trim(),
    details: input.details.trim(),
    isDefault: input.isDefault,
    countryId: country.id,
    countryCode: country.code,
    country: country.name,
    stateId: selection.stateId,
    state: findGeoArea(selection.stateId)?.name ?? "",
    lgaId: selection.lgaId,
    lga: findGeoArea(selection.lgaId)?.name ?? null,
    cityId: selection.cityId,
    city: findGeoArea(selection.cityId)?.name ?? "",
  };
};

export const geoMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/geo/countries", () => mockPage(geoCountries)),
  createMockRoute("GET", "/api/v1/geo/countries/:parentId/regions", ({ params }) => mockPage(childrenByParentId.get(params.parentId!) ?? [])),
  createMockRoute("GET", "/api/v1/geo/regions/:parentId/admin-areas", ({ params }) => mockPage(childrenByParentId.get(params.parentId!) ?? [])),
  createMockRoute("GET", "/api/v1/geo/admin-areas/:parentId/cities", ({ params }) => mockPage(childrenByParentId.get(params.parentId!) ?? [])),
];
