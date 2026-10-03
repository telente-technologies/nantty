"use client";

import { Combobox } from "@/components/ui/combobox";
import type { GeoSelection } from "@/types";

import { useGeoAreas, useGeoCountries } from "./geoQueries.hook";

interface AddressGeoFieldsProps {
  readonly value: GeoSelection;
  readonly onChange: (next: GeoSelection) => void;
  readonly errors?: Partial<Record<keyof GeoSelection, string>>;
}

export function AddressGeoFields({ value, onChange, errors = {} }: AddressGeoFieldsProps) {
  const countries = useGeoCountries();
  const country = countries.data?.find((candidate) => candidate.id === value.countryId) ?? null;
  const hasLevel = (level: "state" | "lga" | "city") => country?.levels.includes(level) ?? false;
  const states = useGeoAreas(hasLevel("state") ? value.countryId : null, "state");
  const lgas = useGeoAreas(hasLevel("lga") && value.stateId ? value.stateId : null, "lga");
  const cities = useGeoAreas(hasLevel("city") && value.lgaId ? value.lgaId : null, "city");

  return (
    <>
      <Combobox
        label="Country"
        required
        loading={countries.isLoading}
        options={countries.data ?? []}
        selectedId={value.countryId || null}
        error={errors.countryId}
        onSelect={(option) => onChange({ countryId: option.id, stateId: null, lgaId: null, cityId: null })}
      />
      {hasLevel("state") ? (
        <Combobox
          label={country?.stateLabel ?? "State"}
          required
          loading={states.isLoading}
          options={states.data ?? []}
          selectedId={value.stateId}
          error={errors.stateId}
          onSelect={(option) => onChange({ ...value, stateId: option.id, lgaId: null, cityId: null })}
        />
      ) : null}
      {hasLevel("lga") ? (
        <Combobox
          label={country?.lgaLabel ?? "LGA"}
          required
          disabled={!value.stateId}
          loading={lgas.isLoading}
          options={lgas.data ?? []}
          selectedId={value.lgaId}
          error={errors.lgaId}
          onSelect={(option) => onChange({ ...value, lgaId: option.id, cityId: null })}
        />
      ) : null}
      {hasLevel("city") ? (
        <Combobox
          label="City or town"
          required
          disabled={!value.lgaId}
          loading={cities.isLoading}
          options={cities.data ?? []}
          selectedId={value.cityId}
          error={errors.cityId}
          onSelect={(option) => onChange({ ...value, cityId: option.id })}
        />
      ) : null}
    </>
  );
}
