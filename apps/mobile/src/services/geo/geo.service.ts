import type { GeoArea, GeoCountry, GeoLevel } from "@/types";

import { api } from "../core/apiClient.service";

export const geoService = {
  fetchCountries: () => api.getList<GeoCountry>("/api/v1/geo/countries"),
  fetchAreasUnderParent: (parentId: string, level: GeoLevel) =>
    api.getList<GeoArea>(
      level === "state"
        ? `/api/v1/geo/countries/${parentId}/regions`
        : level === "lga"
          ? `/api/v1/geo/regions/${parentId}/admin-areas`
          : `/api/v1/geo/admin-areas/${parentId}/cities`,
    ),
};
