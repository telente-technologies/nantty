"use client";

import { useEffect, useRef, useState } from "react";

import { BrandSellingSwitch } from "@/components/brand/brandSellingSwitch";
import { useBrandWorkspace } from "@/components/brand/brandWorkspace";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { FormErrorSummary, TextAreaField, TextField } from "@/components/ui/formFields";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { acceptedProductImageMimeTypes, describeProductImageProblem, uploadProductImageInChunks } from "@/services/mediaUpload.service";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Brand } from "@/types/brand.type";
import { brandRegistrationLabels, canBrandRoleEditProfile } from "@/utils/brandPresentation.util";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./brand.module.css";

const websitePattern = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i;

function BrandImageUploadButton({ label, onUploaded, disabled }: { readonly label: string; readonly onUploaded: (mediaId: string) => Promise<void>; readonly disabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const { showToast } = useToast();

  async function uploadChosenFile(file: File) {
    const problem = describeProductImageProblem(file);
    if (problem) {
      showToast(problem, "error");
      return;
    }
    setProgressPercent(0);
    try {
      const uploaded = await uploadProductImageInChunks(file, (fraction) => setProgressPercent(Math.round(fraction * 100)));
      await onUploaded(uploaded.mediaId);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setProgressPercent(null);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={acceptedProductImageMimeTypes.join(",")} className="visuallyHidden" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadChosenFile(file); }} />
      <Button size="small" iconName="image24" disabled={disabled || progressPercent !== null} onClick={() => inputRef.current?.click()}>
        {progressPercent !== null ? `Uploading ${progressPercent}%` : label}
      </Button>
    </>
  );
}

export function BrandProfileView() {
  const { brand, myRole, canEditDashboardSettings, replaceBrand } = useBrandWorkspace();
  const { showToast } = useToast();
  const [name, setName] = useState(brand.name);
  const [description, setDescription] = useState(brand.description);
  const [website, setWebsite] = useState(brand.website ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const canEdit = canEditDashboardSettings && canBrandRoleEditProfile(myRole);
  const isNameLocked = brand.registration.status === "registered";

  useEffect(() => {
    setName(brand.name);
    setDescription(brand.description);
    setWebsite(brand.website ?? "");
  }, [brand]);

  async function patchBrand(patch: Record<string, unknown>, successMessage: string) {
    const updated = await sendSellerApiRequest<Brand>(`/seller/brands/${encodeURIComponent(brand.id)}`, { method: "PATCH", body: patch });
    replaceBrand(updated);
    showToast(successMessage);
  }

  async function saveBrandProfile() {
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2 || name.trim().length > 60) nextErrors.name = "Brand name needs 2 to 60 characters.";
    if (description.length > 1000) nextErrors.description = "Description must be 1,000 characters or fewer.";
    if (website.trim() && !websitePattern.test(website.trim())) nextErrors.website = "Website must start with https:// and be a valid address.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setIsSaving(true);
    try {
      await patchBrand({ ...(isNameLocked ? {} : { name: name.trim() }), description: description.trim(), website: website.trim() || null }, "Brand profile saved.");
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues?.length) setErrors(Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])));
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  const registration = brandRegistrationLabels[brand.registration.status];
  return (
    <div className={styles.twoColumns}>
      <Panel title="Profile" description="Shown on your brand page, your Official Store and products tagged with your brand.">
        <div className={styles.coverStage}>
          <div className={styles.cover}>{brand.coverUrl ? <img src={brand.coverUrl} alt={`${brand.name} cover`} className={styles.coverImage} /> : null}</div>
          <div className={styles.logo}>{brand.logoUrl ? <img src={brand.logoUrl} alt={`${brand.name} logo`} /> : brand.name.slice(0, 1)}</div>
        </div>
        <div className={styles.imageActions}>
          <BrandImageUploadButton label="Change logo" disabled={!canEdit} onUploaded={(mediaId) => patchBrand({ logoMediaId: mediaId }, "Logo updated.")} />
          <BrandImageUploadButton label="Change cover" disabled={!canEdit} onUploaded={(mediaId) => patchBrand({ coverMediaId: mediaId }, "Cover updated.")} />
        </div>
        <div className={styles.formStack}>
          <FormErrorSummary messages={Object.values(errors)} />
          <TextField label="Brand name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} errorMessage={errors.name} disabled={!canEdit || isNameLocked} hint={isNameLocked ? "Registered brand names match the trademark. Change it through brand registration in the Zudomart app." : undefined} />
          <TextAreaField label="About the brand" value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} errorMessage={errors.description} disabled={!canEdit} hint={`${description.length}/1000`} />
          <TextField label="Website" type="url" placeholder="https://" value={website} maxLength={200} onChange={(event) => setWebsite(event.target.value)} errorMessage={errors.website} disabled={!canEdit} />
          {canEdit ? (
            <div className={styles.actionsRow}>
              <Button variant="primary" onClick={() => void saveBrandProfile()} isBusy={isSaving}>Save profile</Button>
            </div>
          ) : (
            <Callout tone="info">Only brand owners, admins and editors with settings access can edit the profile.</Callout>
          )}
        </div>
      </Panel>
      <BrandSellingSwitch />
      <Panel title="Registration" actions={<StatusBadge tone={registration.tone}>{registration.label}</StatusBadge>}>
        <KeyValueList
          items={[
            { label: "Handle", value: `@${brand.handle}` },
            { label: "Country", value: brand.country },
            { label: "Trademark number", value: brand.registration.trademarkNumber ?? "—" },
            { label: "Registered on", value: formatDateForDisplay(brand.registration.registeredAt) },
            { label: "Gold verification", value: brand.verification.badgeVisible ? `Gold ${brand.verification.tier === "PREMIUM" ? "Premium" : "Pro"}` : "Not Gold verified" },
          ]}
        />
        {brand.registration.note ? <div style={{ marginTop: 12 }}><Callout tone={brand.registration.status === "rejected" ? "error" : "info"}>{brand.registration.note}</Callout></div> : null}
        {brand.registration.status !== "registered" ? (
          <p className={styles.muted} style={{ marginTop: 12 }}>Register your brand in the Zudomart app (Profile › Your brand › Register) with your trademark certificate or CAC registration. Registration unlocks the Official Store badge and brand protection.</p>
        ) : null}
      </Panel>
    </div>
  );
}
