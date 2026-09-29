import { StatusBadge, type BadgeTone } from "@/components/ui/statusBadge";
import type { OfficialStoreStatus } from "@/types/brands.type";

import styles from "./brands.module.css";

const officialStatusPresentation: Record<OfficialStoreStatus, { label: string; tone: BadgeTone }> = {
  NONE: { label: "Not requested", tone: "neutral" },
  PENDING: { label: "Review pending", tone: "caution" },
  NEEDS_INFO: { label: "Needs info", tone: "info" },
  OFFICIAL: { label: "Official Store", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  REVOKED: { label: "Revoked", tone: "night" },
};

export function OfficialStatusBadge({ status }: { readonly status: OfficialStoreStatus }) {
  const presentation = officialStatusPresentation[status];
  return <StatusBadge label={presentation.label} tone={presentation.tone} />;
}

export function BrandLogo({ name, logoUrl, size = 32 }: { readonly name: string; readonly logoUrl: string | null; readonly size?: number }) {
  if (logoUrl) return <img src={logoUrl} alt="" width={size} height={size} className={styles.logo} referrerPolicy="no-referrer" loading="lazy" />;
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  return (
    <span className={styles.logoInitials} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden>
      {initials}
    </span>
  );
}

export function BrandNameCell({ name, logoUrl, subtitle }: { readonly name: string; readonly logoUrl: string | null; readonly subtitle?: string }) {
  return (
    <span className={styles.brandCell}>
      <BrandLogo name={name} logoUrl={logoUrl} />
      <span className={styles.brandCellText}>
        <strong>{name}</strong>
        {subtitle ? <span className={styles.muted}>{subtitle}</span> : null}
      </span>
    </span>
  );
}
