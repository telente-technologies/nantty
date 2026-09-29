import { StatusBadge } from "@/components/ui/statusBadge";
import type { DataTableColumn } from "@/components/ui/dataTable";
import { UserIdentity } from "@/components/ui/userIdentity";
import type { IpClaimSummary } from "@/types/ipClaims.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { BrandNameCell } from "./brandLabels";
import styles from "./brands.module.css";

export function isIpClaimPastSla(claim: IpClaimSummary): boolean {
  return (claim.status === "OPEN" || claim.status === "NEEDS_INFO") && new Date(claim.slaDueAt).getTime() < Date.now();
}

export const ipClaimColumns: readonly DataTableColumn<IpClaimSummary>[] = [
  { key: "claim", header: "Claim", render: (claim) => <span><code>{claim.id}</code><br /><span className={styles.muted}>{humanizeConstantName(claim.type)}</span></span>, width: "120px" },
  { key: "brand", header: "Claimant brand", render: (claim) => <BrandNameCell name={claim.claimantBrand.name} logoUrl={claim.claimantBrand.logoUrl} /> },
  { key: "listing", header: "Listing", render: (claim) => <span>{claim.listing.title}<br /><span className={styles.muted}>{formatMoneyForDisplay(claim.listing.price)} · {claim.listing.storeName}</span></span> },
  { key: "seller", header: "Accused seller", render: (claim) => <UserIdentity user={claim.accusedSeller} size={24} /> },
  { key: "strikes", header: "Strikes", render: (claim) => claim.priorStrikeCount, width: "80px", align: "end" },
  { key: "status", header: "Status", render: (claim) => <StatusBadge status={claim.status} />, width: "110px" },
  { key: "sla", header: "Due", render: (claim) => (claim.status === "OPEN" || claim.status === "NEEDS_INFO" ? <span className={isIpClaimPastSla(claim) ? styles.slaBreached : undefined}>{formatRelativeTimeFromNow(claim.slaDueAt)}</span> : "—"), width: "110px" },
];
