import Image from "next/image";
import type { ReactNode } from "react";

import styles from "./media.module.css";
import { ResilientImage } from "./resilientImage";

export function getInitialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

interface MediaImageProps {
  readonly src: string | null | undefined;
  readonly alt: string;
  readonly sizes: string;
  readonly className?: string;
  readonly priority?: boolean;
}

export function MediaImage({ src, alt, sizes, className, priority = false }: MediaImageProps) {
  if (!src) return null;
  return (
    <>
      <ResilientImage src={src} alt={alt} sizes={sizes} className={className} priority={priority} />
      <span aria-hidden className={styles.frame} />
    </>
  );
}

interface AvatarProps {
  readonly name: string;
  readonly src: string | null | undefined;
  readonly size?: "xs" | "sm" | "md" | "lg" | "xl";
  readonly ring?: boolean;
}

export function Avatar({ name, src, size = "md", ring = false }: AvatarProps) {
  return (
    <span className={[styles.avatar, styles[size], ring ? styles.ring : ""].filter(Boolean).join(" ")} aria-hidden={src ? undefined : "true"}>
      {src ? (
        <Image src={src} alt="" fill sizes="96px" className={styles.fill} />
      ) : (
        <span className={styles.avatarFallback}>{getInitialsForName(name)}</span>
      )}
    </span>
  );
}

interface SafeImageProps extends MediaImageProps {
  readonly fallback?: ReactNode;
}

export function SafeImage({ src, alt, sizes, className, priority, fallback }: SafeImageProps) {
  if (!src) return <>{fallback ?? null}</>;
  return <MediaImage src={src} alt={alt} sizes={sizes} className={className} priority={priority} />;
}
