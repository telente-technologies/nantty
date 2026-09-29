"use client";

import { AudienceInterestFields } from "@/components/audience/audienceInterestFields";
import { AudienceLocationFields } from "@/components/audience/audienceLocationFields";
import { SegmentedControl, SelectField } from "@/components/ui/formFields";
import type { AudienceSpec, GenderTarget } from "@/types/audience.type";

import styles from "./audienceBuilder.module.css";

interface AudienceBuilderProps {
  readonly accountId: string;
  readonly audience: AudienceSpec;
  readonly onAudienceChange: (audience: AudienceSpec) => void;
  readonly errors?: Partial<Record<"locations" | "age" | "customAudiences", string>>;
}

const ageOptions = Array.from({ length: 48 }, (_, index) => {
  const age = 18 + index;
  return { value: String(age), label: age === 65 ? "65+" : String(age) };
});

const genderOptions: readonly { readonly value: GenderTarget; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "female", label: "Women" },
  { value: "male", label: "Men" },
];

export function AudienceBuilder({ accountId, audience, onAudienceChange, errors = {} }: AudienceBuilderProps) {
  const updateAudienceField = <Field extends keyof AudienceSpec>(field: Field, value: AudienceSpec[Field]) => onAudienceChange({ ...audience, [field]: value });
  return (
    <div className={styles.builder}>
      <section className={styles.section} aria-labelledby="audience-locations-heading">
        <h3 id="audience-locations-heading">Locations</h3>
        <AudienceLocationFields audience={audience} onAudienceChange={onAudienceChange} error={errors.locations} />
      </section>
      <section className={styles.section} aria-labelledby="audience-demographics-heading">
        <h3 id="audience-demographics-heading">Age and gender</h3>
        <div className={styles.row}>
          <SelectField label="Youngest" value={String(audience.ageMin)} options={ageOptions.filter((option) => Number(option.value) <= audience.ageMax)} onValueChange={(value) => updateAudienceField("ageMin", Number(value))} error={errors.age} />
          <SelectField label="Oldest" value={String(audience.ageMax)} options={ageOptions.filter((option) => Number(option.value) >= audience.ageMin)} onValueChange={(value) => updateAudienceField("ageMax", Number(value))} />
          <div className={styles.genderField}>
            <span className={styles.fieldLabel}>Gender</span>
            <SegmentedControl label="Gender" value={audience.gender} options={genderOptions} onValueChange={(value) => updateAudienceField("gender", value)} />
          </div>
        </div>
      </section>
      <section className={styles.section} aria-labelledby="audience-detailed-heading">
        <h3 id="audience-detailed-heading">Interests, behaviours and custom audiences</h3>
        <AudienceInterestFields accountId={accountId} audience={audience} onAudienceChange={onAudienceChange} customAudienceError={errors.customAudiences} />
      </section>
    </div>
  );
}
