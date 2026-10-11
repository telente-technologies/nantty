"use client";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { ButtonLink } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList, TwoColumnLayout } from "@/components/ui/surfaces";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchCopyrightClaimDetail } from "@/services/trustApi.service";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import { AudioMatchHints } from "./audioMatchHints";
import { AudioMatchRunButton } from "./audioMatchRunButton";
import styles from "./copyrightClaim.module.css";
import { CopyrightDecisionCard } from "./copyrightDecisionCard";
import { CopyrightEvidenceCard, CopyrightRemedyBanner } from "./copyrightEvidenceCard";
import { CounterNoticeList } from "./counterNoticeList";
import { ModeratedTargetPreviewCard } from "./moderatedTargetPreview";

export function CopyrightClaimDetailWorkspace({ claimId }: { readonly claimId: string }) {
  const { data: claim, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchCopyrightClaimDetail(claimId, signal), claimId);
  if (errorMessage) return <ErrorBlock variant="section" message={errorMessage} onRetry={reload} />;
  if (isLoading || !claim) return <LoadingBlock lines={8} />;

  return (
    <>
      <PageHeader
        area="Trust & safety · Copyright"
        title={claim.workTitle}
        description={`Claim ${claim.id} filed ${formatDateTime(claim.filedAt)} by ${claim.claimant.organization ?? claim.claimant.name}.`}
        meta={<><StatusBadge status={claim.status} /><StatusBadge label={`Target ${humanizeConstantName(claim.targetFlag).toLowerCase()}`} tone={claim.targetFlag === "TAKEN_DOWN" ? "danger" : claim.targetFlag === "LIMITED" || claim.targetFlag === "WARNED" || claim.targetFlag === "MUTED" ? "caution" : "success"} /></>}
        actions={<ButtonLink href="/moderation/copyright" iconName="arrowLeft24">All claims</ButtonLink>}
      />
      <TwoColumnLayout
        main={
          <>
            <CopyrightRemedyBanner claim={claim} />
            <Card title="Target">
              <ModeratedTargetPreviewCard target={claim.target} />
            </Card>
            <Card title="Audio match hints (advice only)" actions={<AudioMatchRunButton claim={claim} onClaimUpdated={(updated) => replaceData(() => updated)} />}>
              <AudioMatchHints matches={claim.audioMatches} />
            </Card>
            <Card title="Claim">
              <KeyValueList columns={2} items={[
                { label: "Claimant", value: claim.claimant.name },
                { label: "Organisation", value: claim.claimant.organization ?? "Individual" },
                { label: "Acting for", value: claim.claimant.representativeOf ?? "Themselves" },
                { label: "Contact", value: claim.claimant.email, isMono: true },
                { label: "Work type", value: humanizeConstantName(claim.workType) },
                { label: "Rights basis", value: claim.rightsBasis },
              ]} />
              <p className={styles.muted}>Sworn statement</p>
              <p className={styles.statement}>{claim.swornStatement}</p>
              <p className={styles.muted}>Claimed URLs</p>
              <ul className={styles.urlList}>
                {claim.claimedUrls.map((url) => <li key={url}>{url}</li>)}
              </ul>
            </Card>
            <CopyrightEvidenceCard claim={claim} />
            <Card title="Counter-notices">
              <CounterNoticeList claim={claim} onClaimUpdated={(updated) => replaceData(() => updated)} />
            </Card>
          </>
        }
        aside={
          <>
            <CopyrightDecisionCard claim={claim} onClaimUpdated={(updated) => replaceData(() => updated)} />
            <Card title="History">
              <AuditHistoryList entries={claim.history} />
            </Card>
          </>
        }
      />
    </>
  );
}
