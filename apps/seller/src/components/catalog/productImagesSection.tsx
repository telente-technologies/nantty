"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { acceptedProductImageMimeTypes, describeProductImageProblem, uploadProductImageInChunks } from "@/services/mediaUpload.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import type { ProductImage } from "@/types/catalog.type";

import styles from "./productEditor.module.css";

interface UploadInProgress {
  readonly key: string;
  readonly file: File;
  readonly fraction: number;
  readonly errorMessage: string | null;
}

const maximumImages = 10;

export function ProductImagesSection({ images, onImagesChange, onUploadingChange }: { readonly images: ProductImage[]; readonly onImagesChange: (updater: (current: ProductImage[]) => ProductImage[]) => void; readonly onUploadingChange: (isUploading: boolean) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadInProgress[]>([]);

  function updateUpload(key: string, patch: Partial<UploadInProgress>) {
    setUploads((current) => current.map((upload) => (upload.key === key ? { ...upload, ...patch } : upload)));
  }

  async function uploadOneImage(upload: UploadInProgress) {
    updateUpload(upload.key, { errorMessage: null, fraction: 0 });
    try {
      const uploaded = await uploadProductImageInChunks(upload.file, (fraction) => updateUpload(upload.key, { fraction }));
      onImagesChange((current) => [...current, uploaded].slice(0, maximumImages));
      setUploads((current) => current.filter((candidate) => candidate.key !== upload.key));
    } catch (error) {
      updateUpload(upload.key, { errorMessage: error instanceof Error && !("status" in error) ? error.message : readErrorMessageForDisplay(error) });
    }
  }

  async function startUploadsForChosenFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosenFiles = [...(event.target.files ?? [])].slice(0, maximumImages - images.length);
    event.target.value = "";
    const newUploads = chosenFiles.map((file, index) => ({ key: `${Date.now()}_${index}`, file, fraction: 0, errorMessage: describeProductImageProblem(file) }));
    setUploads((current) => [...current, ...newUploads]);
    onUploadingChange(true);
    for (const upload of newUploads) if (!upload.errorMessage) await uploadOneImage(upload);
    onUploadingChange(false);
  }

  function moveImage(index: number, direction: -1 | 1) {
    onImagesChange((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(index + direction, 0, moved);
      return next;
    });
  }

  return (
    <Panel title="Photos" description="The first photo is the cover in the Nantty app. Up to 10 JPEG, PNG, WebP or AVIF photos, 10 MB each.">
      <div className={styles.imageGrid}>
        {images.map((image, index) => (
          <div key={image.mediaId} className={styles.imageTile}>
            <img src={image.url} alt={`Product photo ${index + 1}`} />
            {index === 0 ? <span className={styles.coverLabel}>Cover</span> : null}
            <div className={styles.imageActions}>
              <IconButton iconName="arrowLeft24" label="Move photo earlier" size="small" disabled={index === 0} onClick={() => moveImage(index, -1)} />
              <IconButton iconName="caretRight24" label="Move photo later" size="small" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)} />
              <IconButton iconName="trash24" label="Remove photo" size="small" onClick={() => onImagesChange((current) => current.filter((candidate) => candidate.mediaId !== image.mediaId))} />
            </div>
          </div>
        ))}
        {images.length < maximumImages ? (
          <button type="button" className={styles.uploadDrop} onClick={() => fileInputRef.current?.click()}>
            <NanttyIcon name="imageSquare24" size={22} />
            Add photos
          </button>
        ) : null}
      </div>
      <input ref={fileInputRef} type="file" accept={acceptedProductImageMimeTypes.join(",")} multiple hidden onChange={(event) => void startUploadsForChosenFiles(event)} />
      {uploads.length > 0 ? (
        <div className={styles.uploadProgress} aria-live="polite">
          {uploads.map((upload) => (
            <div key={upload.key} className={styles.progressRow}>
              <span>{upload.file.name}</span>
              {upload.errorMessage ? <span style={{ color: "var(--error-ink)" }}>{upload.errorMessage}</span> : <progress max={1} value={upload.fraction} aria-label={`Uploading ${upload.file.name}`} />}
              {upload.errorMessage ? (
                <span style={{ display: "flex", gap: 4 }}>
                  {describeProductImageProblem(upload.file) ? null : <Button size="small" onClick={() => void uploadOneImage(upload)}>Retry</Button>}
                  <IconButton iconName="cancel20" label="Dismiss" size="small" onClick={() => setUploads((current) => current.filter((candidate) => candidate.key !== upload.key))} />
                </span>
              ) : <span>{Math.round(upload.fraction * 100)}%</span>}
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
