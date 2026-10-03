import { useQuery } from "@tanstack/react-query";

import { geoService } from "@/services/geo.service";
import type { GeoLevel } from "@/types";

export const useGeoCountries = () => useQuery({ queryKey: ["geo", "countries"], queryFn: geoService.fetchCountries, staleTime: Infinity });

export const useGeoAreas = (parentId: string | null, level: GeoLevel) =>
  useQuery({
    queryKey: ["geo", "areas", level, parentId],
    queryFn: () => geoService.fetchAreasUnderParent(parentId!, level),
    enabled: parentId !== null,
    staleTime: Infinity,
  });
