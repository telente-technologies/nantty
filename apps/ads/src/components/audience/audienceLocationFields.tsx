"use client";

import { useEffect, useState } from "react";

import { SearchableMultiSelect, type MultiSelectOption } from "@/components/ui/searchableMultiSelect";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.hook";
import { audiencesApi } from "@/services/audiencesApi.service";
import type { AudienceSpec, LocationTarget } from "@/types/audience.type";

import styles from "./audienceBuilder.module.css";

const locationTypeLabels: Record<LocationTarget["type"], string> = { country: "Country", state: "State / region", city: "City" };

function convertLocationToOption(location: LocationTarget): MultiSelectOption {
  return { value: location.code, label: location.name, detail: location.parentName ? `${locationTypeLabels[location.type]} · ${location.parentName}` : locationTypeLabels[location.type] };
}

function useLocationSearchResults(searchText: string) {
  const debouncedSearchText = useDebouncedValue(searchText, 250);
  const [results, setResults] = useState<LocationTarget[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  useEffect(() => {
    const abortController = new AbortController();
    setIsSearching(true);
    audiencesApi
      .searchLocations(debouncedSearchText, "", abortController.signal)
      .then((response) => setResults(response.items))
      .catch(() => undefined)
      .finally(() => {
        if (!abortController.signal.aborted) setIsSearching(false);
      });
    return () => abortController.abort();
  }, [debouncedSearchText]);
  return { results, isSearching };
}

export function AudienceLocationFields({ audience, onAudienceChange, error }: { readonly audience: AudienceSpec; readonly onAudienceChange: (audience: AudienceSpec) => void; readonly error?: string }) {
  const [includeSearchText, setIncludeSearchText] = useState("");
  const [excludeSearchText, setExcludeSearchText] = useState("");
  const includeSearch = useLocationSearchResults(includeSearchText);
  const excludeSearch = useLocationSearchResults(excludeSearchText);
  const knownLocations = new Map<string, LocationTarget>([...includeSearch.results, ...excludeSearch.results, ...audience.locations, ...audience.excludedLocations].map((location) => [location.code, location]));

  function convertOptionsToLocations(options: readonly MultiSelectOption[]): LocationTarget[] {
    return options.map((option) => knownLocations.get(option.value)).filter((location): location is LocationTarget => Boolean(location));
  }

  return (
    <div className={styles.stack}>
      <SearchableMultiSelect
        label="Include people living in"
        placeholder="Search countries, states or cities"
        options={includeSearch.results.map(convertLocationToOption)}
        selectedOptions={audience.locations.map(convertLocationToOption)}
        onSelectedOptionsChange={(options) => onAudienceChange({ ...audience, locations: convertOptionsToLocations(options) })}
        onSearchTextChange={setIncludeSearchText}
        isLoading={includeSearch.isSearching}
        hint="Nigeria first, but you can reach buyers in any supported country."
      />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <SearchableMultiSelect
        label="Exclude locations"
        placeholder="Optional"
        tone="exclude"
        options={excludeSearch.results.map(convertLocationToOption)}
        selectedOptions={audience.excludedLocations.map(convertLocationToOption)}
        onSelectedOptionsChange={(options) => onAudienceChange({ ...audience, excludedLocations: convertOptionsToLocations(options) })}
        onSearchTextChange={setExcludeSearchText}
        isLoading={excludeSearch.isSearching}
      />
    </div>
  );
}
