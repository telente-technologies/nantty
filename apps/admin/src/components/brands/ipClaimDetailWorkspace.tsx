"use client";

import Link from "next/link";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { ButtonLink } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList, TwoColumnLayout } from "@/components/ui/surfaces";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchIpClaimDetail } from "@/services/brandsApi.service";
import type { IpClaimDetail } from "@/types/ipClaims.type";
import { formatDateOnly, formatDateTime, formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { BrandNameCell, OfficialStatusBadge } from "./brandLabels";
import styles from "./brands.module.css";
import { IpClaimDecisionPanel } from "./ipClaimDecisionPanel";
import { isIpClaimPastSla } from "./ipClaimColumns";

function ListingPreviewCard({ claim }: { readonly claim: IpClaimDetail }) {
  return (
    <Card title="Accused listing">
      <div className={styles.listingPreview}>
        <img src={claim.listing.imageUrl} alt="" className={styles.listingImage} referrerPolicy="no-referrer" />
        <div>
          <p className={styles.listingTitle}>{claim.listing.title}</p>
          <p className={styles.listingPrice}>{formatMoneyForDisplay(claim.listing.price)}</p>
          <p className={styles.muted}>
            {claim.listing.storeName} · <code>{claim.listing.id}</code> · <StatusBadge label={claim.listing.status === "LIVE" ? "Live" : "Delisted"} tone={claim.listing.status === "LIVE" ? "caution" : "neutral"} />
          </p>
          <p className={styles.muted}>{claim.listing.listingUrl}</p>
        </div>
      </div>
    </Card>
  );
}

function EvidenceCard({ claim }: { readonly claim: IpClaimDetail }) {
  return (
    <Card title="Claimant's statement and evidence">
      <div className={styles.layoutStack}>
        <p className={styles.quote}>{claim.statement}</p>
        <div className={styles.evidenceGrid}>
          {claim.evidence.map((item) => (
            <figure key={item.id} className={styles.evidenceItem}>
              {item.imageUrl ? <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" /> : null}
              <StatusBadge label={humanizeConstantName(item.kind)} tone="info" hasDot={false} />
              <figcaption>{item.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function IpClaimDetailWorkspace({ claimId }: { readonly claimId: string }) {
  const detail = useAdminQuery((signal) => fetchIpClaimDetail(claimId, signal), claimId);
  const claim = detail.data;
  if (detail.errorMessage) return <ErrorBlock variant="section" error={detail.error} message={detail.errorMessage} onRetry={detail.reload} />;
  if (!claim) return <LoadingBlock lines={6} />;
  return (
    <>
      <PageHeader
        area="Trust & safety · trademark claims"
        title={`${humanizeConstantName(claim.type)} claim ${claim.id}`}
        meta={<><StatusBadge status={claim.status} /><span className={isIpClaimPastSla(claim) ? styles.slaBreached : styles.muted}>Filed {formatRelativeTimeFromNow(claim.filedAt)} · due {formatRelativeTimeFromNow(claim.slaDueAt)}</span></>}
        actions={<ButtonLink href="/ip-claims" variant="ghost" iconName="arrowLeft24">All claims</ButtonLink>}
      />
      <TwoColumnLayout
        main={
          <>
            <ListingPreviewCard claim={claim} />
            <EvidenceCard claim={claim} />
            <Card title="Seller's response">
              {claim.sellerResponse ? (
                <div className={styles.layoutStack}>
                  <p className={styles.quote}>{claim.sellerResponse.statement}</p>
                  <p className={styles.muted}>Sent {formatDateTime(claim.sellerResponse.submittedAt)}</p>
                </div>
              ) : (
                <p className={styles.muted}>The seller has not responded yet.</p>
              )}
            </Card>
            <Card title="Admin history">
              <AuditHistoryList entries={claim.history} />
            </Card>
          </>
        }
        aside={
          <>
            <IpClaimDecisionPanel claim={claim} onDecided={(updated) => detail.replaceData(() => updated)} />
            <Card title="Claimant">
              <div className={styles.layoutStack}>
                <Link href={`/brands/${encodeURIComponent(claim.claimantBrand.id)}`}>
                  <BrandNameCell name={claim.claimantBrand.name} logoUrl={claim.claimantBrand.logoUrl} />
                </Link>
                <p><OfficialStatusBadge status={claim.claimantBrand.officialStatus} /></p>
                <KeyValueList items={[{ label: "Trademark reference", value: claim.trademarkReference ?? "None given", isMono: true }]} />
              </div>
            </Card>
            <Card title="Accused seller">
              <div className={styles.layoutStack}>
                <Link href={`/users/${encodeURIComponent(claim.accusedSeller.id)}`}>
                  <UserIdentity user={claim.accusedSeller} />
                </Link>
                <KeyValueList items={[{ label: "Current strikes", value: claim.priorStrikeCount }]} />
                {claim.sellerPriorStrikes.length > 0 ? (
                  <ul className={styles.documentList}>
                    {claim.sellerPriorStrikes.map((strike) => (
                      <li key={`${strike.policy}-${strike.issuedAt}`}>
                        <span>{strike.policy}</span>
                        <span className={styles.muted}>{formatDateOnly(strike.issuedAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Card>
          </>
        }
      />
    </>
  );
}
