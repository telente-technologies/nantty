"use client";

import { useRef, useState, type ChangeEvent } from "react";

import type { StorefrontDraft, StorefrontDraftUpdater } from "@/components/storefront/storefrontDraft.util";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/formFields";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { acceptedProductImageMimeTypes, describeProductImageProblem, uploadProductImageInChunks } from "@/services/mediaUpload.service";

import styles from "./storefront.module.css";

type StorefrontImageSlot = "logo" | "cover";

function StorefrontImagePicker({ slot, imageUrl, onImageUploaded, onImageRemoved }: { readonly slot: StorefrontImageSlot; readonly imageUrl: string | null; readonly onImageUploaded: (mediaId: string, url: string) => void; readonly onImageRemoved: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFraction, setUploadFraction] = useState<number | null>(null);
  const { showToast } = useToast();

  async function uploadChosenStorefrontImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = describeProductImageProblem(file);
    if (problem) {
      showToast(problem, "error");
      return;
    }
    setUploadFraction(0);
    try {
      const uploaded = await uploadProductImageInChunks(file, setUploadFraction);
      onImageUploaded(uploaded.mediaId, uploaded.url);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setUploadFraction(null);
    }
  }

  const label = slot === "logo" ? "Logo" : "Cover image";
  return (
    <div className={styles.imagePicker}>
      <span className={styles.imageLabel}>{label}</span>
      <div className={slot === "logo" ? styles.logoBox : styles.coverBox}>{imageUrl ? <img src={imageUrl} alt={`Current ${label.toLowerCase()}`} /> : <span>{slot === "logo" ? "No logo" : "No cover yet"}</span>}</div>
      <input ref={fileInputRef} type="file" accept={acceptedProductImageMimeTypes.join(",")} className="visuallyHidden" onChange={(event) => void uploadChosenStorefrontImage(event)} aria-label={`Upload ${label.toLowerCase()}`} />
      <span className={styles.socialRow}>
        <Button size="small" iconName="image24" isBusy={uploadFraction !== null} onClick={() => fileInputRef.current?.click()}>
          {uploadFraction !== null ? `${Math.round(uploadFraction * 100)}%` : imageUrl ? "Replace" : "Upload"}
        </Button>
        {imageUrl ? (
          <Button size="small" variant="ghost" onClick={onImageRemoved}>
            Remove
          </Button>
        ) : null}
      </span>
    </div>
  );
}

export function StorefrontIdentitySection({ draft, onDraftChange }: { readonly draft: StorefrontDraft; readonly onDraftChange: StorefrontDraftUpdater }) {
  return (
    <Panel title="Name and look" description="What buyers see first on your store page in the Nantty app.">
      <div className={styles.stack}>
        <div className={styles.imagePickers}>
          <StorefrontImagePicker slot="logo" imageUrl={draft.logoUrl} onImageUploaded={(mediaId, url) => onDraftChange({ logoMediaId: mediaId, logoUrl: url })} onImageRemoved={() => onDraftChange({ logoMediaId: null, logoUrl: null })} />
          <StorefrontImagePicker slot="cover" imageUrl={draft.coverUrl} onImageUploaded={(mediaId, url) => onDraftChange({ coverMediaId: mediaId, coverUrl: url })} onImageRemoved={() => onDraftChange({ coverMediaId: null, coverUrl: null })} />
        </div>
        <div className={styles.twoColumns}>
          <TextField label="Store name" value={draft.name} maxLength={80} onChange={(event) => onDraftChange({ name: event.target.value })} />
          <TextField label="Tagline" value={draft.tagline} maxLength={80} placeholder="Handmade leather, delivered nationwide" onChange={(event) => onDraftChange({ tagline: event.target.value })} hint={`${draft.tagline.length}/80`} />
        </div>
        <TextAreaField label="About the store" value={draft.description} maxLength={500} rows={4} onChange={(event) => onDraftChange({ description: event.target.value })} hint={`${draft.description.length}/500`} />
      </div>
    </Panel>
  );
}
