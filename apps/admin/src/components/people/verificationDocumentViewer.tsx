"use client";

import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { openVerificationDocument } from "@/services/peopleReviewsApi.service";
import type { VerificationApplicationDetail, VerificationDocumentSummary } from "@/types/verification.type";
import { formatDateTime } from "@/utils/formatting.util";

import { VerificationDocumentArtwork } from "./verificationDocumentArtwork";
import styles from "./verificationDocumentViewer.module.css";

export function VerificationDocumentViewer({ application, document, onClose }: { readonly application: VerificationApplicationDetail; readonly document: VerificationDocumentSummary; readonly onClose: () => void }) {
  const { data: access, errorMessage, error: queryError, isLoading, reload } = useAdminQuery(() => openVerificationDocument(application.id, document.id), document.id);
  const watermarkLines = Array.from({ length: 14 }, (_, index) => index);

  return (
    <ModalDialog isOpen title={document.label} description={access ? `Private link expires ${formatDateTime(access.expiresAt)}. This view is logged.` : "Opening a short-lived private link…"} onClose={onClose} width="wide" tone="secure">
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !access ? <LoadingBlock lines={5} /> : null}
      {access ? (
        <div className={styles.viewer} onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()} onCopy={(event) => event.preventDefault()} aria-label={`${document.label} with confidential watermark`}>
          <VerificationDocumentArtwork kind={access.kind} application={application} />
          <div className={styles.watermark} aria-hidden>
            {watermarkLines.map((line) => (
              <span key={line}>{access.watermarkText} · {access.watermarkText}</span>
            ))}
          </div>
        </div>
      ) : null}
    </ModalDialog>
  );
}
