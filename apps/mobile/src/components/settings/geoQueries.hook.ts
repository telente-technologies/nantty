import { useQuery } from "@tanstack/react-query";

import type { GeoLevel } from "@/types";
import { geoService } from "@/services/geo/geo.service";

export const geoQueryKeys = {
  countries: ["geo", "countries"] as const,
  areas: (parentId: string | null, level: GeoLevel) => ["geo", "areas", level, parentId] as const,
};

export const useGeoCountries = () =>
  useQuery({ queryKey: geoQueryKeys.countries, queryFn: geoService.fetchCountries, staleTime: Infinity });

export const useGeoAreas = (parentId: string | null, level: GeoLevel) =>
  useQuery({
    queryKey: geoQueryKeys.areas(parentId, level),
    queryFn: () => geoService.fetchAreasUnderParent(parentId!, level),
    enabled: parentId !== null,
    staleTime: Infinity,
  });
