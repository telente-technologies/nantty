"use client";

import Image from "next/image";
import { useState } from "react";
import { ErrorIcon } from "@nantty/web-kit";

import styles from "./media.module.css";

export function ResilientImage({ src, alt, sizes, className, priority }: { readonly src: string; readonly alt: string; readonly sizes: string; readonly className?: string; readonly priority: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) {
    return (
      <span className={styles.failed} role="img" aria-label={alt ? `${alt}. This image didn't load.` : "This image didn't load."}>
        <ErrorIcon name="imageBroken" size={28} />
      </span>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} className={[styles.fill, className ?? ""].filter(Boolean).join(" ")} priority={priority} onError={() => setFailedSrc(src)} />;
}
