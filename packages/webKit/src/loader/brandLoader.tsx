/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { ZudomartLogoMark } from "../zudomartWordmark";
import styles from "./brandLoader.module.css";

export type BrandLoaderSize = "sm" | "md" | "lg";

export const brandLoaderSizes: Readonly<Record<BrandLoaderSize, number>> = { sm: 24, md: 40, lg: 64 };

export interface BrandLoaderProps {
  readonly size?: BrandLoaderSize;
  readonly label?: string;
  readonly showLabel?: boolean;
  readonly fill?: "none" | "section" | "page";
  readonly className?: string;
}

export function BrandLoader({ size = "md", label = "Loading…", showLabel = false, fill = "none", className }: BrandLoaderProps) {
  return (
    <span className={[styles.loader, styles[fill], className].filter(Boolean).join(" ")} role="status" aria-live="polite" data-size={size}>
      <span className={styles.mark} aria-hidden="true">
        <ZudomartLogoMark size={brandLoaderSizes[size]} />
      </span>
      <span className={showLabel ? styles.label : styles.visuallyHidden}>{label}</span>
    </span>
  );
}
