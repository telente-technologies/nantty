"use client";

import { useState } from "react";

import { MediaImage } from "@/components/ui/media";

import styles from "./productGallery.module.css";

export function ProductGallery({ images, name, priority }: { readonly images: readonly string[]; readonly name: string; readonly priority: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const shown = images.filter(Boolean);
  const active = shown[activeIndex];

  if (shown.length === 0) {
    return <div className={styles.galleryEmpty} aria-hidden="true" />;
  }

  return (
    <div className={styles.gallery}>
      <div className={styles.galleryMain}>
        <MediaImage src={active} alt={name} sizes="(max-width: 900px) 100vw, 640px" priority={priority} />
      </div>
      {shown.length > 1 ? (
        <div className={styles.thumbnails} role="group" aria-label="Product images">
          {shown.map((image, index) => (
            <button
              key={image}
              type="button"
                            aria-pressed={index === activeIndex}
              className={[styles.thumbnail, index === activeIndex ? styles.thumbnailActive : ""].filter(Boolean).join(" ")}
              onClick={() => setActiveIndex(index)}
            >
              <MediaImage src={image} alt={`${name}, photo ${index + 1}`} sizes="80px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
