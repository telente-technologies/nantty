import { NoticeBanner } from "@/components/ui/feedback";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import type { CopyrightClaimDetail } from "@/types/copyright.type";
import { formatDateTime, humanizeConstantName } from "@/utils/formatting.util";

import styles from "./copyrightClaim.module.css";

const formatSeconds = (total: number) => `${Math.floor(total / 60)}:${String(Math.floor(total % 60)).padStart(2, "0")}`;
const remedyExplanations: Record<string, string> = {
  AUDIO_MUTED: "Audio claim: the soundtrack is replaced with silence on this and every clip using the sound; the video stays up.",
  TAKEDOWN_WARNING: "Video claim: the uploader was warned to remove it. If it is still up at the deadline it is hidden and a strike is recorded.",
  TAKEN_DOWN: "Taken down immediately (live video or unknown uploader).",
};

export function CopyrightRemedyBanner({ claim }: { readonly claim: CopyrightClaimDetail }) {
  if (!claim.remedy || claim.remedy === "NONE") return null;
  return (
    <NoticeBanner tone={claim.remedyState === "TAKEN_DOWN" ? "danger" : claim.remedyState === "AWAITING_REMOVAL" ? "caution" : "info"} title={`${humanizeConstantName(claim.remedy)} · ${humanizeConstantName(claim.remedyState ?? "NONE")}`}>
      {remedyExplanations[claim.remedy]}{claim.takedownDeadlineAt ? ` Deadline ${formatDateTime(claim.takedownDeadlineAt)}.` : ""}
    </NoticeBanner>
  );
}

export function CopyrightEvidenceCard({ claim }: { readonly claim: CopyrightClaimDetail }) {
  const evidence = claim.evidence;
  if (!evidence) return null;
  return (
    <Card title="Evidence and signature">
      <KeyValueList columns={2} items={[
        { label: "Claimed part", value: claim.claimScope === "AUDIO" ? "Audio (mute if upheld)" : "Video (warning, then takedown)" },
        { label: "Original work", value: evidence.originalWorkUrl ? <a href={evidence.originalWorkUrl} target="_blank" rel="noopener noreferrer">{evidence.originalWorkUrl}</a> : evidence.originalWorkMediaId ?? "Not provided" },
        { label: "Infringing segments", value: evidence.segments.length ? evidence.segments.map((segment) => `${formatSeconds(segment.startSeconds)}–${formatSeconds(segment.endSeconds)}`).join(", ") : "Whole work" },
        { label: "Phone", value: evidence.claimantPhone ?? "Not provided" },
        { label: "Accuracy declared", value: evidence.accuracyDeclared ? "Yes" : "No" },
        { label: "Signed", value: evidence.signedAt ? `${evidence.signatureName} · ${formatDateTime(evidence.signedAt)}` : evidence.signatureName || "Not signed" },
      ]} />
      <p className={styles.muted}>Proof of ownership</p>
      <ul className={styles.urlList}>
        {evidence.proofUrls.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}
        {evidence.proofMediaIds.map((mediaId) => <li key={mediaId} className="mono">Uploaded document {mediaId}</li>)}
      </ul>
      <p className={styles.muted}>Audio fingerprint matches are advice only. Decide on the proof above.</p>
    </Card>
  );
}
