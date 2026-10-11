"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";

import { CloseIcon, MapPinIcon } from "@/components/ui/icons";
import { placesService } from "@/services/places.service";
import type { PostLocationTag } from "@/types";

import styles from "./composer.module.css";

export function PlacePicker({ selected, onChange }: { readonly selected: PostLocationTag | null; readonly onChange: (place: PostLocationTag | null) => void }) {
  const inputId = useId();
  const hintId = useId();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const places = useQuery({
    queryKey: ["places", "search", debounced],
    queryFn: () => placesService.searchPlaces(debounced),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const emptyMessage = debounced.length < 2 ? "Type at least 2 letters to search." : places.isError ? "Search isn't available right now. Try again." : "No places match. Try a nearby area or landmark.";
  const results = debounced.length >= 2 ? (places.data ?? []) : [];

  return (
    <div className={styles.picker}>
      <label htmlFor={inputId} className={styles.pickerLabel}>Add location</label>
      <span id={hintId} className={styles.hint}>Search for a place by name. Zudomart never reads your device location for this.</span>
      {selected ? (
        <ul className={styles.chosenList} aria-label="Location">
          <li className={styles.chosenChip}>
            <MapPinIcon size={12} />
            <span>{selected.area ? `${selected.name}, ${selected.area}` : selected.name}</span>
            <button type="button" aria-label={`Remove ${selected.name}`} onClick={() => onChange(null)}><CloseIcon size={12} /></button>
          </li>
        </ul>
      ) : (
        <>
          <input id={inputId} type="search" className={styles.pickerInput} placeholder="Search places" aria-describedby={hintId} value={search} maxLength={120} onChange={(event) => setSearch(event.target.value)} />
          {search.trim() ? (
            <ul className={styles.pickerResults}>
              {results.length === 0 && !places.isFetching ? <li className={styles.pickerEmpty}>{emptyMessage}</li> : null}
              {results.map((place) => (
                <li key={place.placeId}>
                  <button type="button" className={styles.pickerRow} onClick={() => { onChange(place); setSearch(""); }}>
                    <MapPinIcon size={16} />
                    <span className={styles.pickerRowText}>
                      <strong>{place.name}</strong>
                      {place.area ? <span>{place.area}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
