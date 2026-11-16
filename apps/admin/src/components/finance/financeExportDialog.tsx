"use client";

import { useState } from "react";

import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { useToast } from "@/components/ui/toastProvider";
import { createIdempotencyKey, readErrorMessageForDisplay, saveBlobAsDownloadedFile } from "@/services/adminApiClient.service";
import { exportFinanceReport } from "@/services/financeApi.service";
import type { FinanceRange, FinanceReportKey } from "@/types/finance.type";

interface FinanceExportDialogProps {
  readonly isOpen: boolean;
  readonly reportType: FinanceReportKey;
  readonly range: FinanceRange;
  readonly currency?: string;
  readonly title?: string;
  readonly onClose: () => void;
  readonly onExported?: () => void;
}

export function FinanceExportDialog({
  isOpen,
  reportType,
  range,
  currency,
  title = "Export finance CSV",
  onClose,
  onExported,
}: FinanceExportDialogProps) {
  const { showToast } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm(reason: string) {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const blob = await exportFinanceReport({
        reportType,
        range,
        currency: currency || undefined,
        reason,
        idempotencyKey: createIdempotencyKey(),
      });
      saveBlobAsDownloadedFile(blob, `finance-${reportType}-${range}.csv`);
      showToast("Finance export recorded and downloaded");
      onExported?.();
      onClose();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <ConfirmActionDialog
      isOpen={isOpen}
      title={title}
      description={`Download ${reportType.replaceAll("_", " ")} (${range}${currency ? `, ${currency}` : ""}) as CSV. Every export is saved to the audit log.`}
      confirmLabel="Export CSV"
      requiresReason
      requiresStepUp
      isBusy={isBusy}
      errorMessage={errorMessage}
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  );
}
