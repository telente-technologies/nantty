"use client";

import { useState } from "react";

import { SettingsFormFrame, StoreSettingsLoadedGate } from "@/components/settings/settingsFormFrame";
import { TextAreaField, TextField } from "@/components/ui/formFields";
import { useSettingsPatch } from "@/hooks/useSettingsPatch.hook";
import type { StoreSettings } from "@/types/store.type";
import { fieldChecks, validateObjectAgainstChecks } from "@/utils/formValidation.util";

import styles from "./settings.module.css";

const storeProfileChecks = {
  name: fieldChecks.text({ label: "Store name", min: 2, max: 80 }),
  description: fieldChecks.optional(fieldChecks.text({ label: "Description", max: 500 })),
  phone: fieldChecks.phone(),
  email: fieldChecks.email("Store email"),
  address: fieldChecks.text({ label: "Address", min: 5, max: 200 }),
};

function StoreProfileForm({ settings }: { readonly settings: StoreSettings }) {
  const [draft, setDraft] = useState({ name: settings.name, description: settings.description, phone: settings.phone, email: settings.email, address: settings.address });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { isSaving, serverFieldErrors, saveStoreSettingsPatch } = useSettingsPatch();
  const errors = { ...serverFieldErrors, ...fieldErrors };

  function updateDraftField(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveStoreProfile() {
    const issues = validateObjectAgainstChecks(draft, storeProfileChecks);
    setFieldErrors(Object.fromEntries(issues.map((issue) => [issue.path, issue.message])));
    if (issues.length > 0) return;
    await saveStoreSettingsPatch(draft, "Store profile saved.");
  }

  return (
    <SettingsFormFrame title="Store profile" description="Shown on invoices, packing slips and your Nantty store page. Edit your logo, cover and policies in Storefront." errorMessages={Object.values(errors)} isSaving={isSaving} onSubmit={() => void saveStoreProfile()}>
      <div className={styles.twoColumns}>
        <TextField label="Store name" value={draft.name} maxLength={80} onChange={(event) => updateDraftField("name", event.target.value)} errorMessage={errors.name} />
        <TextField label="Store handle" value={`@${settings.handle}`} readOnly hint="Change your handle in the Nantty app." />
        <TextField label="Phone" type="tel" value={draft.phone} maxLength={20} onChange={(event) => updateDraftField("phone", event.target.value)} errorMessage={errors.phone} />
        <TextField label="Email" type="email" value={draft.email} maxLength={254} onChange={(event) => updateDraftField("email", event.target.value)} errorMessage={errors.email} />
      </div>
      <TextField label="Address" value={draft.address} maxLength={200} onChange={(event) => updateDraftField("address", event.target.value)} errorMessage={errors.address} />
      <TextAreaField label="Description" value={draft.description} maxLength={500} onChange={(event) => updateDraftField("description", event.target.value)} errorMessage={errors.description} hint={`${draft.description.length}/500`} />
      <div className={styles.readOnlyGrid} aria-label="Set during verification">
        {[
          { label: "Country", value: settings.country },
          { label: "Currency", value: settings.currency },
          { label: "Time zone", value: settings.timezone },
          { label: "Logo", value: settings.logoUrl ? "Uploaded" : "Not set" },
        ].map((item) => (
          <div key={item.label}>
            <p className={styles.readOnlyLabel}>{item.label}</p>
            <p className={styles.readOnlyValue}>{item.value}</p>
          </div>
        ))}
      </div>
      <p className={styles.mutedText}>Country, currency and time zone come from your verified business details. Change your logo in the Nantty app; contact support to change the others.</p>
    </SettingsFormFrame>
  );
}

export function StoreProfileSettingsView() {
  return <StoreSettingsLoadedGate>{(settings) => <StoreProfileForm key={settings.name + settings.address} settings={settings} />}</StoreSettingsLoadedGate>;
}
