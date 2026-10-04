"use client";

import { VersionedDocumentSection } from "@/components/configuration/shared/versionedDocumentSection";
import { WholeNumberField } from "@/components/configuration/shared/configurationFields";
import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { NoticeBanner } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { hardMaximumCombinedBoostBps, hardMaximumOfficialEditorialBoostBps, hardMaximumTierBoostBps, neutralBoostBps, rankingTierLabels, rankingTierOrderFromLowest } from "@/constants/rankingCaps.constant";
import { feedRankingEndpoint, feedRankingRecordId } from "@/services/rankingApi.service";
import type { FeedRankingPolicy, RankingTier } from "@/types/ranking.type";

import styles from "./ranking.module.css";

const percent = (basisPoints: number) => `${((basisPoints - neutralBoostBps) / 100).toFixed(1).replace(/\.0$/, "")}%`;

function FeedRankingEditor({ policy, canWrite, onChange }: { readonly policy: FeedRankingPolicy; readonly canWrite: boolean; readonly onChange: (updater: (current: FeedRankingPolicy) => FeedRankingPolicy) => void }) {
  const setTier = (tier: RankingTier, value: number) => onChange((current) => ({ ...current, tierBoostBps: { ...current.tierBoostBps, [tier]: value } }));
  return (
    <div className={styles.editor}>
      <div className={styles.grid}>
        {rankingTierOrderFromLowest.map((tier) => (
          <WholeNumberField key={tier} label={`${rankingTierLabels[tier]} (basis points)`} hint={`Now +${percent(policy.tierBoostBps[tier])}. Hard cap +${percent(hardMaximumTierBoostBps[tier])}.`} value={policy.tierBoostBps[tier]} minimum={neutralBoostBps} maximum={hardMaximumTierBoostBps[tier]} isDisabled={!canWrite} onChange={(value) => setTier(tier, value)} />
        ))}
        <WholeNumberField label="Official editorial boost (basis points)" hint={`Now +${percent(policy.officialEditorialBoostBps)}. Hard cap +${percent(hardMaximumOfficialEditorialBoostBps)}.`} value={policy.officialEditorialBoostBps} minimum={neutralBoostBps} maximum={hardMaximumOfficialEditorialBoostBps} isDisabled={!canWrite} onChange={(value) => onChange((current) => ({ ...current, officialEditorialBoostBps: value }))} />
      </div>
      <p className={styles.summary}>
        10,000 basis points means no boost. Boosts multiply a post&apos;s quality score, keep the order Blue Essential ≤ Blue Verified ≤ Premium ≤ Gold Business ≤ Black/Official, and a checkmark plus the Official boost can never exceed +{percent(hardMaximumCombinedBoostBps)}. The servers enforce these caps even if this form is bypassed. Every save needs a reason and is written to the audit log.
      </p>
    </div>
  );
}

export function FeedRankingWorkspace() {
  const { can } = useAdminPermissions();
  return (
    <>
      <PageHeader area="Configuration" title="Feed ranking" description="The disclosed, capped boosts for checkmark and Official accounts. Quality and real engagement always count for more." />
      <div className={styles.stack}>
        <NoticeBanner tone="info" title="No push lever">
          There is no way to push or pin a post or trend. Admins can only lower these boosts here, or remove content and trends for policy reasons under Trust &amp; safety. The public help article &quot;How your feed works&quot; lists the current caps.
        </NoticeBanner>
        <VersionedDocumentSection<FeedRankingPolicy> endpoint={feedRankingEndpoint} recordId={feedRankingRecordId} title="Feed ranking boosts" canWrite={can("config:rules")} renderEditor={(content, updateContent, isWritable) => <FeedRankingEditor policy={content} canWrite={isWritable} onChange={updateContent} />} />
      </div>
    </>
  );
}
