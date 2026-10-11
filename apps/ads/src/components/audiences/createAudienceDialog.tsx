"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { SelectField, TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { supportedAccountCountries } from "@/constants/locale.constant";
import { audiencesApi } from "@/services/audiencesApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { CreateCustomAudienceRequest, CustomAudience, EngagementSource } from "@/types/audience.type";

import { engagementSourceOptions, retentionDayOptions } from "./audienceLabels.constant";
import styles from "./audiencesPage.module.css";

export type CreatableAudienceType = CreateCustomAudienceRequest["type"];

const dialogTitles: Record<CreatableAudienceType, string> = {
  store_customers: "Store customers audience",
  engagers: "Engaged people audience",
  followers: "Followers audience",
  lookalike: "Lookalike audience",
};

interface CreateAudienceDialogProps {
  readonly accountId: string;
  readonly defaultCountryCode: string;
  readonly audienceType: CreatableAudienceType;
  readonly sourceAudiences: readonly CustomAudience[];
  readonly onClose: () => void;
  readonly onCreated: (audience: CustomAudience) => void;
}

export function CreateAudienceDialog({ accountId, defaultCountryCode, audienceType, sourceAudiences, onClose, onCreated }: CreateAudienceDialogProps) {
  const [name, setName] = useState("");
  const [retentionDays, setRetentionDays] = useState("90");
  const [minimumOrders, setMinimumOrders] = useState("1");
  const [engagementSource, setEngagementSource] = useState<EngagementSource>("any_post");
  const eligibleSources = sourceAudiences.filter((audience) => audience.type !== "lookalike" && audience.status === "ready");
  const [sourceAudienceId, setSourceAudienceId] = useState(eligibleSources[0]?.id ?? "");
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [similarityPercent, setSimilarityPercent] = useState(3);
  const [nameError, setNameError] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function buildCreateRequest(trimmedName: string): CreateCustomAudienceRequest {
    const retention = Number(retentionDays);
    switch (audienceType) {
      case "store_customers":
        return { type: "store_customers", name: trimmedName, retentionDays: retention, minimumOrders: Math.max(1, Number(minimumOrders) || 1) };
      case "engagers":
        return { type: "engagers", name: trimmedName, retentionDays: retention, engagementSource };
      case "followers":
        return { type: "followers", name: trimmedName };
      case "lookalike":
        return { type: "lookalike", name: trimmedName, sourceAudienceId, countryCode, similarityPercent };
    }
  }

  async function createAudience() {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setNameError("Name the audience (up to 100 characters).");
      return;
    }
    if (audienceType === "lookalike" && !sourceAudienceId) {
      setErrorMessage("You need a ready audience to base the lookalike on.");
      return;
    }
    setNameError(undefined);
    setIsSaving(true);
    setErrorMessage(null);
    try {
      onCreated(await audiencesApi.createCustomAudience(accountId, buildCreateRequest(trimmedName)));
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setIsSaving(false);
    }
  }

  return (
    <OverlayDialog intent="audience"
      isOpen
      onClose={onClose}
      title={dialogTitles[audienceType]}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isSaving} onClick={createAudience}>
            Create audience
          </Button>
        </>
      }
    >
      <TextField label="Audience name" value={name} onValueChange={setName} error={nameError} maxLength={100} placeholder="e.g. Buyers — last 90 days" />
      {audienceType === "store_customers" ? (
        <div className={styles.fieldRow}>
          <SelectField label="Ordered in" value={retentionDays} onValueChange={setRetentionDays} options={retentionDayOptions} />
          <TextField label="At least this many orders" inputMode="numeric" value={minimumOrders} onValueChange={(value) => setMinimumOrders(value.replace(/\D/g, "").slice(0, 3))} />
        </div>
      ) : null}
      {audienceType === "engagers" ? (
        <>
          <SelectField label="People who" value={engagementSource} onValueChange={setEngagementSource} options={engagementSourceOptions} />
          <SelectField label="In the" value={retentionDays} onValueChange={setRetentionDays} options={retentionDayOptions} />
        </>
      ) : null}
      {audienceType === "followers" ? <InlineNotice tone="info">Everyone who follows your profile or store. The audience updates as people follow or unfollow.</InlineNotice> : null}
      {audienceType === "lookalike" ? (
        <>
          {eligibleSources.length === 0 ? (
            <InlineNotice tone="caution">Create a store customers, engaged people or customer list audience first. Lookalikes are built from one of them.</InlineNotice>
          ) : (
            <SelectField label="Based on" value={sourceAudienceId} onValueChange={setSourceAudienceId} options={eligibleSources.map((audience) => ({ value: audience.id, label: audience.name }))} />
          )}
          <SelectField label="Find people in" value={countryCode} onValueChange={setCountryCode} options={supportedAccountCountries.map((country) => ({ value: country.code, label: country.name }))} />
          <div>
            <label htmlFor="lookalike-similarity" style={{ fontSize: 12.5, fontWeight: 600 }}>
              Audience size: {similarityPercent}% of people in the country
            </label>
            <input id="lookalike-similarity" type="range" min={1} max={10} step={1} value={similarityPercent} onChange={(event) => setSimilarityPercent(Number(event.target.value))} className={styles.slider} aria-valuetext={`${similarityPercent} percent`} />
            <div className={styles.sliderScale} aria-hidden>
              <span>1% · most similar</span>
              <span>10% · broadest reach</span>
            </div>
          </div>
        </>
      ) : null}
      {errorMessage ? <InlineNotice tone="error">{errorMessage}</InlineNotice> : null}
    </OverlayDialog>
  );
}
