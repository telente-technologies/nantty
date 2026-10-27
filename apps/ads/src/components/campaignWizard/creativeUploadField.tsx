"use client";

import { useId, useState, type ChangeEvent } from "react";

import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { describeWhyCreativeFileIsNotAccepted, uploadCreativeFile, acceptedCreativeMimeTypes } from "@/services/mediaUpload.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { CreativeMedia } from "@/types/creative.type";

import styles from "./creativeEditor.module.css";

interface CreativeUploadFieldProps {
  readonly accountId: string;
  readonly uploadedMedia: readonly CreativeMedia[];
  readonly onUploadedMediaChange: (media: CreativeMedia[]) => void;
  readonly error?: string;
}

export function CreativeUploadField({ accountId, uploadedMedia, onUploadedMediaChange, error }: CreativeUploadFieldProps) {
  const inputId = useId();
  const [progressFraction, setProgressFraction] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function uploadChosenFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const rejectionReason = describeWhyCreativeFileIsNotAccepted(file);
    if (rejectionReason) {
      setUploadError(rejectionReason);
      return;
    }
    setUploadError(null);
    setProgressFraction(0);
    try {
      const uploaded = await uploadCreativeFile(accountId, file, setProgressFraction);
      if (uploaded.status === "failed" || !uploaded.media) {
        setUploadError(uploaded.status === "processing" ? "Your file is still processing. Try again in a minute." : "We could not process that file. Try another one.");
      } else {
        onUploadedMediaChange([...uploadedMedia, uploaded.media].slice(0, 10));
      }
    } catch (uploadFailure) {
      setUploadError(readErrorMessageForDisplay(uploadFailure));
    } finally {
      setProgressFraction(null);
    }
  }

  return (
    <div className={styles.upload}>
      <div className={styles.uploadedList}>
        {uploadedMedia.map((media) => (
          <figure key={media.id} className={styles.uploadedItem}>
            {media.kind === "video" ? <video src={media.url} muted aria-label="Uploaded video" /> : <img src={media.url} alt="Uploaded creative" />}
            <button type="button" className={styles.removeUpload} aria-label="Remove this file" onClick={() => onUploadedMediaChange(uploadedMedia.filter((candidate) => candidate.id !== media.id))}>
              <NanttyIcon name="cancel20" size={14} />
            </button>
          </figure>
        ))}
        <label htmlFor={inputId} className={styles.dropZone} aria-disabled={progressFraction !== null}>
          <NanttyIcon name="plus24" size={20} />
          <span>{progressFraction === null ? "Add image or video" : "Uploading…"}</span>
          <input id={inputId} type="file" accept={acceptedCreativeMimeTypes.join(",")} className="visuallyHidden" onChange={uploadChosenFile} disabled={progressFraction !== null} />
        </label>
      </div>
      {progressFraction !== null ? (
        <div className={styles.progressTrack} role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressFraction * 100)}>
          <span className={styles.progressFill} style={{ width: `${Math.round(progressFraction * 100)}%` }} />
        </div>
      ) : null}
      <p className={styles.muted}>JPG, PNG, WebP or AVIF images, MP4 or MOV videos up to 500 MB. Large files upload in parts and resume if the connection drops.</p>
      {uploadError || error ? (
        <p className={styles.error} role="alert">
          {uploadError ?? error}
        </p>
      ) : null}
    </div>
  );
}
