import { View, StyleSheet } from "react-native";

import { GeoPickerField } from "@/components/settings/geoPickerField";
import { useGeoAreas, useGeoCountries } from "@/components/settings/geoQueries.hook";
import type { ShippingAddressInput } from "@/types";

export interface AddressGeoFieldsProps {
  readonly value: Pick<ShippingAddressInput, "countryId" | "stateId" | "lgaId" | "cityId">;
  readonly onChange: (next: Pick<ShippingAddressInput, "countryId" | "stateId" | "lgaId" | "cityId">) => void;
}

export function AddressGeoFields({ value, onChange }: AddressGeoFieldsProps) {
  const countries = useGeoCountries().data ?? [];
  const country = countries.find((candidate) => candidate.id === value.countryId);
  const hasLevel = (level: "state" | "lga" | "city") => country?.levels.includes(level) ?? false;
  const states = useGeoAreas(hasLevel("state") ? value.countryId : null, "state").data ?? [];
  const lgas = useGeoAreas(hasLevel("lga") ? value.stateId : null, "lga").data ?? [];
  const cities = useGeoAreas(hasLevel("city") ? value.lgaId : null, "city").data ?? [];

  return (
    <View style={styles.fields}>
      <GeoPickerField
        label="Country"
        options={countries}
        selectedId={value.countryId}
        onSelect={(option) => onChange({ countryId: option.id, stateId: null, lgaId: null, cityId: null })}
      />
      {hasLevel("state") ? (
        <GeoPickerField
          label={country!.stateLabel}
          options={states}
          selectedId={value.stateId}
          onSelect={(option) => onChange({ ...value, stateId: option.id, lgaId: null, cityId: null })}
        />
      ) : null}
      {hasLevel("lga") ? (
        <GeoPickerField
          label={country!.lgaLabel}
          options={lgas}
          selectedId={value.lgaId}
          disabled={!value.stateId}
          onSelect={(option) => onChange({ ...value, lgaId: option.id, cityId: null })}
        />
      ) : null}
      {hasLevel("city") ? (
        <GeoPickerField
          label="City / Town"
          options={cities}
          selectedId={value.cityId}
          disabled={!value.lgaId}
          onSelect={(option) => onChange({ ...value, cityId: option.id })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ fields: { gap: 16 } });
