"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { CheckboxField } from "@/components/ui/formFields";
import { KeyValueList } from "@/components/ui/surfaces";
import { documentsThatAlwaysNotifyUsers, materialChangeNoticeDays } from "@/constants/legalDocuments.constant";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchLegalNoticePreview, publishLegalVersion } from "@/services/legalApi.service";
import type { LegalVersion } from "@/types/legal.type";
import { formatDateOnly } from "@/utils/formatting.util";

import styles from "./legal.module.css";
import { LegalNoticeEmailFrame } from "./legalNoticeEmailFrame";

interface LegalPublishDialogProps {
  readonly version: LegalVersion;
  readonly onClose: () => void;
  readonly onPublished: (version: LegalVersion) => void;
}

export function LegalPublishDialog({ version, onClose, onPublished }: LegalPublishDialogProps) {
  const [hasAcknowledgedShortNotice, setHasAcknowledgedShortNotice] = useState(false);
  const preview = useAdminQuery((signal) => fetchLegalNoticePreview(version.id, signal), version.id);
  const publishMutation = useAdminMutation((reason: string) => publishLegalVersion(version.id, { reason, acknowledgeShortNotice: hasAcknowledgedShortNotice }));
  const willNotifyUsers = documentsThatAlwaysNotifyUsers.includes(version.documentKey) || version.isMaterialChange;
  const isShortNotice = version.isMaterialChange && Date.parse(version.effectiveAt) < Date.now() + (materialChangeNoticeDays - 1) * 86_400_000;

  async function publish(reason: string) {
    const result = await publishMutation.run(reason);
    if (result) onPublished(result.version);
  }

  return (
    <ConfirmActionDialog intent="publish" isOpen title={`Publish version ${version.versionNumber}`} confirmLabel="Publish" requiresStepUp isBusy={publishMutation.isRunning} errorMessage={publishMutation.errorMessage} isConfirmDisabled={isShortNotice && !hasAcknowledgedShortNotice} onConfirm={publish} onClose={onClose}
      consequences={[`It becomes the version everyone sees on the website and in the apps from ${formatDateOnly(version.effectiveAt)}.`, willNotifyUsers ? "A Policy updated email is queued to all users right away." : "No email is sent for this document. You can still send one from Policy notices.", ...(version.isMaterialChange ? ["Users must accept the new version by the effective date."] : [])]}>
      <div className={styles.stack}>
        {isShortNotice ? <CheckboxField label={<strong>Legal cleared less than {materialChangeNoticeDays} days of notice</strong>} description="Required for a material change with a short notice period." checked={hasAcknowledgedShortNotice} onChange={(event) => setHasAcknowledgedShortNotice(event.target.checked)} /> : null}
        {willNotifyUsers ? (
          <>
            {preview.isLoading ? <LoadingBlock label="Preparing the send preview" lines={3} /> : null}
            {preview.errorMessage ? <ErrorBlock error={preview.error} message={preview.errorMessage} onRetry={preview.reload} /> : null}
            {preview.data ? (
              <>
                <NoticeBanner tone="info" title="Sent through AWS SES, even without marketing consent">Hard bounces and suppressed addresses are skipped. Sending is rate-limited and batched.</NoticeBanner>
                <KeyValueList columns={2} items={[
                  { label: "Recipients", value: `${preview.data.recipientCount.toLocaleString()} of ${preview.data.totalUsers.toLocaleString()} users` },
                  { label: "Skipped", value: `${preview.data.excludedHardBounces.toLocaleString()} hard bounces, ${preview.data.excludedSuppressed.toLocaleString()} suppressed` },
                  { label: "Batches", value: `${preview.data.batchesTotal.toLocaleString()} of ${preview.data.batchSize}` },
                  { label: "Rate and time", value: `${preview.data.ratePerSecond} per second, about ${preview.data.estimatedMinutes} min` },
                ]} />
                <LegalNoticeEmailFrame draft={preview.data.draft} />
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </ConfirmActionDialog>
  );
}
