"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import styles from "@/components/escrow/escrow.module.css";
import { ArrowLeftIcon, CloseIcon, ImageIcon } from "@/components/ui/icons";
import { pickLargestDisplayableImageUrl, waitForProcessedMediaAsset } from "@/services/mediaAssets.service";
import { mediaUploadService } from "@/services/mediaUpload.service";
import type { CatalogProductImage } from "@/types/sellerCatalog.type";
import { MediaValidationError, validatePickedMediaBeforeUpload } from "@/utils/mediaUploadRules.util";
import { MAXIMUM_PRODUCT_IMAGES } from "@/utils/sellerProductForm.util";

interface PendingPhoto {
  readonly key: string;
  readonly file: File;
  readonly previewUrl: string;
  readonly status: "uploading" | "failed";
  readonly error: string | null;
}

function toSafeBlobPreviewUrl(candidate: string): string {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "blob:" ? parsed.href : "";
  } catch {
    return "";
  }
}

export interface ProductImagesFieldProps {
  readonly images: readonly CatalogProductImage[];
  readonly onChangeImages: (update: (current: readonly CatalogProductImage[]) => readonly CatalogProductImage[]) => void;
  readonly onUploadingChange: (uploading: boolean) => void;
  readonly disabled?: boolean;
}

export function ProductImagesField({ images, onChangeImages, onUploadingChange, disabled = false }: ProductImagesFieldProps) {
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [pickError, setPickError] = useState<string | null>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => onUploadingChange(pending.some((photo) => photo.status === "uploading")), [pending, onUploadingChange]);
  useEffect(() => {
    const active = controllers.current;
    return () => active.forEach((controller) => controller.abort());
  }, []);

  const startUpload = (photo: PendingPhoto) => {
    const controller = new AbortController();
    controllers.current.set(photo.key, controller);
    setPending((current) => current.map((candidate) => (candidate.key === photo.key ? { ...candidate, status: "uploading", error: null } : candidate)));
    void (async () => {
      try {
        const { mediaId } = await mediaUploadService.uploadFile(photo.file, "product", () => undefined, controller.signal);
        const asset = await waitForProcessedMediaAsset(mediaId, controller.signal);
        const url = pickLargestDisplayableImageUrl(asset) ?? photo.previewUrl;
        onChangeImages((current) => [...current, { mediaId, url }]);
        setPending((current) => current.filter((candidate) => candidate.key !== photo.key));
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error && error.message ? error.message : "Upload failed. Try again.";
        setPending((current) => current.map((candidate) => (candidate.key === photo.key ? { ...candidate, status: "failed", error: message } : candidate)));
      } finally {
        controllers.current.delete(photo.key);
      }
    })();
  };

  const addPickedFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    setPickError(null);
    const room = MAXIMUM_PRODUCT_IMAGES - images.length - pending.length;
    if (picked.length > room) setPickError(`You can add up to ${MAXIMUM_PRODUCT_IMAGES} photos.`);
    for (const file of picked.slice(0, Math.max(0, room))) {
      try {
        if (validatePickedMediaBeforeUpload({ mimeType: file.type, sizeBytes: file.size, durationSeconds: null }, "product") !== "image") throw new MediaValidationError("Only photos can be used here.");
      } catch (error) {
        setPickError(error instanceof Error ? error.message : "That file can't be used.");
        continue;
      }
      const photo: PendingPhoto = { key: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), status: "uploading", error: null };
      setPending((current) => [...current, photo]);
      startUpload(photo);
    }
  };

  const discardPending = (photo: PendingPhoto) => {
    controllers.current.get(photo.key)?.abort();
    URL.revokeObjectURL(photo.previewUrl);
    setPending((current) => current.filter((candidate) => candidate.key !== photo.key));
  };

  const moveEarlier = (index: number) =>
    onChangeImages((current) => {
      if (index <= 0) return current;
      const reordered = [...current];
      [reordered[index - 1], reordered[index]] = [reordered[index]!, reordered[index - 1]!];
      return reordered;
    });

  return (
    <div className={styles.actions}>
      <ul className={styles.thumbs} aria-label="Product photos">
        {images.map((image, index) => (
          <li key={image.mediaId} className={styles.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={index === 0 ? "Cover photo" : `Product photo ${index + 1}`} />
            {index > 0 ? (
              <button type="button" className={styles.moveEarlier} aria-label={`Move photo ${index + 1} earlier`} disabled={disabled} onClick={() => moveEarlier(index)}><ArrowLeftIcon size={12} /></button>
            ) : <span className={styles.coverTag}>Cover</span>}
            <button type="button" className={styles.remove} aria-label={`Remove photo ${index + 1}`} disabled={disabled} onClick={() => onChangeImages((current) => current.filter((candidate) => candidate.mediaId !== image.mediaId))}><CloseIcon size={12} /></button>
          </li>
        ))}
        {pending.map((photo) => {
          const safePreviewUrl = toSafeBlobPreviewUrl(photo.previewUrl);
          return (
            <li key={photo.key} className={styles.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {safePreviewUrl ? <img src={safePreviewUrl} alt="New product photo" /> : null}
              {photo.status === "uploading" ? <span className={styles.thumbOverlay} role="status">Uploading…</span> : (
                <span className={styles.thumbOverlay}><button type="button" onClick={() => startUpload(photo)}>Retry</button></span>
              )}
              <button type="button" className={styles.remove} aria-label="Remove new photo" onClick={() => discardPending(photo)}><CloseIcon size={12} /></button>
            </li>
          );
        })}
        {images.length + pending.length < MAXIMUM_PRODUCT_IMAGES ? (
          <li>
            <button type="button" className={styles.addPhoto} disabled={disabled} onClick={() => inputRef.current?.click()} aria-label="Add product photo">
              <ImageIcon size={22} />
              Add photo
            </button>
          </li>
        ) : null}
      </ul>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden onChange={addPickedFiles} />
      {pending.filter((photo) => photo.error).map((photo) => <p key={photo.key} className={styles.error} role="alert">{photo.error}</p>)}
      {pickError ? <p className={styles.error} role="alert">{pickError}</p> : null}
    </div>
  );
}
