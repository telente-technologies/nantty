"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import type { ShippingAddressInput } from "@/types";

import { AddressGeoFields } from "./addressGeoFields";
import styles from "./addressForm.module.css";
import { type AddressErrors, validateAddressInput } from "./addressForm.util";
import { useGeoCountries } from "./geoQueries.hook";

interface AddressFormProps {
  readonly initial: ShippingAddressInput;
  readonly submitLabel: string;
  readonly busy?: boolean;
  readonly serverError?: string | null;
  readonly onSubmit: (input: ShippingAddressInput) => void;
  readonly onCancel?: () => void;
}

export function AddressForm({ initial, submitLabel, busy = false, serverError, onSubmit, onCancel }: AddressFormProps) {
  const [input, setInput] = useState(initial);
  const [errors, setErrors] = useState<AddressErrors>({});
  const countries = useGeoCountries();
  const set = <K extends keyof ShippingAddressInput>(key: K, value: ShippingAddressInput[K]) => setInput((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const country = countries.data?.find((candidate) => candidate.id === input.countryId) ?? null;
    const found = validateAddressInput(input, country);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(input);
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className={styles.row}>
        <TextField label="Recipient name" autoComplete="name" value={input.fullName} error={errors.fullName} onChange={(event) => set("fullName", event.target.value)} />
        <TextField label="Phone" type="tel" autoComplete="tel" value={input.phone} error={errors.phone} onChange={(event) => set("phone", event.target.value)} />
      </div>
      <AddressGeoFields
        value={{ countryId: input.countryId, stateId: input.stateId, lgaId: input.lgaId, cityId: input.cityId }}
        onChange={(next) => setInput((current) => ({ ...current, ...next }))}
        errors={errors}
      />
      <TextField label="Street address" autoComplete="address-line1" value={input.line1} error={errors.line1} onChange={(event) => set("line1", event.target.value)} />
      <div className={styles.row}>
        <TextField label="Postal code" autoComplete="postal-code" value={input.postalCode} onChange={(event) => set("postalCode", event.target.value)} />
        <TextField label="Details" hint="Landmark, floor or gate code" value={input.details} onChange={(event) => set("details", event.target.value)} />
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={input.isDefault} onChange={(event) => set("isDefault", event.target.checked)} />
        Make this my default address
      </label>
      {serverError ? (
        <p className={styles.error} role="alert">
          {serverError}
        </p>
      ) : null}
      <div className={styles.actions}>
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
