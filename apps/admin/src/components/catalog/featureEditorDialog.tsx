"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextAreaField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { createMartHomeFeature, updateMartHomeFeature, type MartHomeFeatureInput } from "@/services/catalogApi.service";
import type { MartHomeFeature, MartHomeFeatureKind, MartHomeFeatureTargetType, MartHomeImageOption } from "@/types/catalog.type";

import styles from "./catalogForms.module.css";
import { FeaturePreviewCard } from "./featurePreviewCard";
import { convertIsoToLocalDateTimeInputValue, convertLocalDateTimeInputValueToIso } from "./featureScheduleText.util";

const kindOptions: { value: MartHomeFeatureKind; label: string }[] = [
  { value: "HERO_BANNER", label: "Hero banner (top carousel)" },
  { value: "PROMO_BANNER", label: "Promo banner" },
  { value: "FEATURED_COLLECTION", label: "Featured collection" },
  { value: "FEATURED_STORE", label: "Featured store" },
];

const targetOptions: { value: MartHomeFeatureTargetType; label: string; placeholder: string }[] = [
  { value: "CATEGORY", label: "Category", placeholder: "Category ID, e.g. cat_01_03" },
  { value: "COLLECTION", label: "Collection", placeholder: "Collection slug, e.g. daily-deals" },
  { value: "STORE", label: "Store", placeholder: "Store username, e.g. kemi.kitchen" },
  { value: "PRODUCT", label: "Product", placeholder: "Product ID" },
  { value: "URL", label: "Zudomart link", placeholder: "https://zudomart.com/…" },
];

interface FeatureEditorDialogProps {
  readonly editingFeature: MartHomeFeature | null;
  readonly imageLibrary: readonly MartHomeImageOption[];
  readonly supportedCountries: readonly string[];
  readonly onClose: () => void;
  readonly onSaved: (feature: MartHomeFeature) => void;
}

export function FeatureEditorDialog({ editingFeature, imageLibrary, supportedCountries, onClose, onSaved }: FeatureEditorDialogProps) {
  const [title, setTitle] = useState(editingFeature?.title ?? "");
  const [subtitle, setSubtitle] = useState(editingFeature?.subtitle ?? "");
  const [kind, setKind] = useState<MartHomeFeatureKind>(editingFeature?.kind ?? "PROMO_BANNER");
  const [imageId, setImageId] = useState(editingFeature?.imageId ?? imageLibrary[0]?.id ?? "");
  const [targetType, setTargetType] = useState<MartHomeFeatureTargetType>(editingFeature?.targetType ?? "COLLECTION");
  const [targetValue, setTargetValue] = useState(editingFeature?.targetValue ?? "");
  const [countries, setCountries] = useState<readonly string[]>(editingFeature?.countries ?? ["NG"]);
  const [startsAt, setStartsAt] = useState(convertIsoToLocalDateTimeInputValue(editingFeature?.startsAt ?? new Date(Date.now() + 3_600_000).toISOString()));
  const [endsAt, setEndsAt] = useState(convertIsoToLocalDateTimeInputValue(editingFeature?.endsAt ?? null));
  const [reason, setReason] = useState("");
  const saveMutation = useAdminMutation((input: MartHomeFeatureInput) => (editingFeature ? updateMartHomeFeature(editingFeature.id, input) : createMartHomeFeature(input)));
  const issue = (fieldName: string) => readIssueMessageForField(saveMutation.validationIssues, fieldName);
  const selectedImageUrl = imageLibrary.find((option) => option.id === imageId)?.url ?? "";

  function toggleCountry(country: string, isChecked: boolean) {
    setCountries((current) => (isChecked ? [...current, country] : current.filter((candidate) => candidate !== country)));
  }

  async function submitFeature(event: FormEvent) {
    event.preventDefault();
    const result = await saveMutation.run({ title: title.trim(), subtitle: subtitle.trim() || null, kind, imageId, targetType, targetValue: targetValue.trim(), countries, startsAt: convertLocalDateTimeInputValueToIso(startsAt) ?? "", endsAt: convertLocalDateTimeInputValueToIso(endsAt), reason: reason.trim() });
    if (result) onSaved(result.item);
  }

  return (
    <ModalDialog intent="edit" isOpen width="wide" title={editingFeature ? `Edit “${editingFeature.title}”` : "New Mart home feature"} description={editingFeature?.isPublished ? "This feature is published. Saved changes reach buyers within a few minutes." : "New features start as drafts. Publish when the schedule and preview look right."} onClose={onClose}>
      <form className={styles.form} onSubmit={submitFeature}>
        <FeaturePreviewCard feature={{ title, subtitle: subtitle || null, kind, imageUrl: selectedImageUrl }} />
        <div className={styles.twoColumns}>
          <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} required error={issue("title")} />
          <TextField label="Subtitle" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} maxLength={90} error={issue("subtitle")} />
        </div>
        <SelectField label="Placement" options={kindOptions} value={kind} onChange={(event) => setKind(event.target.value as MartHomeFeatureKind)} />
        <fieldset className={styles.imagePicker}>
          <legend>Image (approved library)</legend>
          {imageLibrary.map((option) => (
            <label key={option.id} className={styles.imageOption}>
              <input type="radio" name="feature-image" value={option.id} checked={imageId === option.id} onChange={() => setImageId(option.id)} />
              <img src={option.url} alt="" referrerPolicy="no-referrer" loading="lazy" />
              {option.label}
            </label>
          ))}
        </fieldset>
        {issue("imageId") ? <InlineError message={issue("imageId") ?? ""} /> : null}
        <div className={styles.twoColumns}>
          <SelectField label="Opens" options={targetOptions} value={targetType} onChange={(event) => setTargetType(event.target.value as MartHomeFeatureTargetType)} />
          <TextField label="Target" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} placeholder={targetOptions.find((option) => option.value === targetType)?.placeholder} required error={issue("targetValue")} />
        </div>
        <fieldset className={styles.countryList}>
          <legend>Show in</legend>
          {supportedCountries.map((country) => (
            <CheckboxField key={country} label={country} checked={countries.includes(country)} onChange={(event) => toggleCountry(country, event.target.checked)} />
          ))}
        </fieldset>
        {issue("countries") ? <InlineError message={issue("countries") ?? ""} /> : null}
        <div className={styles.twoColumns}>
          <TextField label="Starts" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required error={issue("startsAt")} />
          <TextField label="Ends (optional)" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} error={issue("endsAt")} />
        </div>
        <TextAreaField label="Reason (saved to the audit log)" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={1000} required />
        {saveMutation.errorMessage && saveMutation.validationIssues.length === 0 ? <InlineError message={saveMutation.errorMessage} /> : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isBusy={saveMutation.isRunning} disabled={title.trim().length < 3 || reason.trim().length < 5 || countries.length === 0}>
            {editingFeature ? "Save feature" : "Save as draft"}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
