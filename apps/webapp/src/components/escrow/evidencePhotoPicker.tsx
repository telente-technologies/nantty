"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { CloseIcon, ImageIcon } from "@/components/ui/icons";
import { uploadImageAndReturnPublicUrl } from "@/services/mediaAssets.service";
import type { MediaUploadPurpose } from "@/types";
import { MediaValidationError, validatePickedMediaBeforeUpload } from "@/utils/mediaUploadRules.util";

import styles from "./escrow.module.css";

interface EvidenceEntry {
  readonly key: string;
  readonly file: File;
  readonly previewUrl: string;
  readonly uploadedUrl: string | null;
  readonly status: "uploading" | "ready" | "failed";
  readonly error: string | null;
}

export interface EvidencePhotoPickerProps {
  readonly onChangePhotoUrls: (photoUrls: string[]) => void;
  readonly onUploadingChange: (uploading: boolean) => void;
  readonly maximumPhotos?: number;
  readonly addLabel?: string;
  readonly purpose?: Extract<MediaUploadPurpose, "dispute_evidence" | "identity_document" | "verification_document" | "product">;
  readonly disabled?: boolean;
}

const describeUploadFailure = (error: unknown) => (error instanceof Error && error.message ? error.message : "Upload failed. Try again.");

export function EvidencePhotoPicker({ onChangePhotoUrls, onUploadingChange, maximumPhotos = 5, addLabel = "Add photo", purpose = "dispute_evidence", disabled = false }: EvidencePhotoPickerProps) {
  const [entries, setEntries] = useState<EvidenceEntry[]>([]);
  const [pickError, setPickError] = useState<string | null>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChangePhotoUrls(entries.flatMap((entry) => (entry.uploadedUrl ? [entry.uploadedUrl] : [])));
    onUploadingChange(entries.some((entry) => entry.status === "uploading"));
  }, [entries, onChangePhotoUrls, onUploadingChange]);

  useEffect(() => {
    const active = controllers.current;
    return () => active.forEach((controller) => controller.abort());
  }, []);

  const updateEntry = (key: string, patch: Partial<EvidenceEntry>) => setEntries((current) => current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)));

  const startUpload = (key: string, file: File) => {
    const controller = new AbortController();
    controllers.current.set(key, controller);
    updateEntry(key, { status: "uploading", error: null });
    uploadImageAndReturnPublicUrl(file, purpose, undefined, controller.signal)
      .then((uploadedUrl) => updateEntry(key, { status: "ready", uploadedUrl }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        updateEntry(key, { status: "failed", error: describeUploadFailure(error) });
      })
      .finally(() => controllers.current.delete(key));
  };

  const addPickedFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    setPickError(null);
    const room = maximumPhotos - entries.length;
    if (picked.length > room) setPickError(`You can add up to ${maximumPhotos} photos.`);
    const accepted: EvidenceEntry[] = [];
    for (const file of picked.slice(0, Math.max(0, room))) {
      try {
        if (validatePickedMediaBeforeUpload({ mimeType: file.type, sizeBytes: file.size, durationSeconds: null }, purpose) !== "image") throw new MediaValidationError("Only photos can be used here.");
      } catch (error) {
        setPickError(error instanceof Error ? error.message : "That file can't be used.");
        continue;
      }
      accepted.push({ key: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), uploadedUrl: null, status: "uploading", error: null });
    }
    if (accepted.length === 0) return;
    setEntries((current) => [...current, ...accepted]);
    accepted.forEach((entry) => startUpload(entry.key, entry.file));
  };

  const removeEntry = (entry: EvidenceEntry) => {
    controllers.current.get(entry.key)?.abort();
    URL.revokeObjectURL(entry.previewUrl);
    setEntries((current) => current.filter((candidate) => candidate.key !== entry.key));
  };

  return (
    <div className={styles.actions}>
      <ul className={styles.thumbs} aria-label="Photos">
        {entries.map((entry, index) => (
          <li key={entry.key} className={styles.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.previewUrl} alt={`Evidence photo ${index + 1}`} />
            {entry.status === "uploading" ? <span className={styles.thumbOverlay} role="status">Uploading…</span> : null}
            {entry.status === "failed" ? (
              <span className={styles.thumbOverlay}>
                <button type="button" onClick={() => startUpload(entry.key, entry.file)} aria-label={`Retry photo ${index + 1}`}>Retry</button>
              </span>
            ) : null}
            <button type="button" className={styles.remove} aria-label={`Remove photo ${index + 1}`} onClick={() => removeEntry(entry)}><CloseIcon size={12} /></button>
          </li>
        ))}
        {entries.length < maximumPhotos ? (
          <li>
            <button type="button" className={styles.addPhoto} onClick={() => inputRef.current?.click()} disabled={disabled}>
              <ImageIcon size={22} />
              {addLabel}
            </button>
          </li>
        ) : null}
      </ul>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden onChange={addPickedFiles} />
      {entries.filter((entry) => entry.error).map((entry) => <p key={entry.key} className={styles.error} role="alert">{entry.error}</p>)}
      {pickError ? <p className={styles.error} role="alert">{pickError}</p> : null}
    </div>
  );
}
