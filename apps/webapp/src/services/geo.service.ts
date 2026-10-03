import type { GeoArea, GeoCountry, GeoLevel } from "@/types";

import { sendListRequestToWebappServer } from "./clientApi.service";

const areasPath = (parentId: string, level: GeoLevel) =>
  level === "state"
    ? `/api/v1/geo/countries/${parentId}/regions`
    : level === "lga"
      ? `/api/v1/geo/regions/${parentId}/admin-areas`
      : `/api/v1/geo/admin-areas/${parentId}/cities`;

export const geoService = {
  fetchCountries: () => sendListRequestToWebappServer<GeoCountry>("/api/v1/geo/countries"),
  fetchAreasUnderParent: (parentId: string, level: GeoLevel) => sendListRequestToWebappServer<GeoArea>(areasPath(parentId, level)),
};
