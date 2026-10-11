"use client";

import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { openBrandDocument } from "@/services/brandsApi.service";
import type { BrandDocumentSummary, OfficialStoreRequest } from "@/types/brands.type";
import { formatDateTime } from "@/utils/formatting.util";

import { BrandDocumentArtwork } from "./brandDocumentArtwork";
import styles from "./brands.module.css";

export function BrandDocumentViewer({ brandId, request, document, onClose }: { readonly brandId: string; readonly request: OfficialStoreRequest; readonly document: BrandDocumentSummary; readonly onClose: () => void }) {
  const { data: access, errorMessage, error: queryError, isLoading, reload } = useAdminQuery((signal) => openBrandDocument(brandId, document.id, signal), document.id);
  const watermarkLines = Array.from({ length: 14 }, (_, index) => index);
  return (
    <ModalDialog isOpen title={document.label} description={access ? `Private link expires ${formatDateTime(access.expiresAt)}. This view is logged.` : "Opening a short-lived private link…"} onClose={onClose} width="wide" tone="secure">
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !access ? <LoadingBlock lines={5} /> : null}
      {access ? (
        <div className={styles.viewer} onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()} onCopy={(event) => event.preventDefault()} aria-label={`${document.label} with confidential watermark`}>
          <BrandDocumentArtwork kind={access.kind} request={request} />
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
