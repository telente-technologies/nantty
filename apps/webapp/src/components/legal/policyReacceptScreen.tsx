"use client";

import { useMutation } from "@tanstack/react-query";
import { trapTabKey, NanttyWordmark } from "@nantty/web-kit";
import { useEffect, useId, useRef, useState, type RefObject } from "react";

import { DeleteAccountDialog } from "@/components/settings/deleteAccountDialog";
import { Button } from "@/components/ui/button";
import { ChevronRightIcon, DownloadIcon, ShieldIcon, TrashIcon } from "@/components/ui/icons";
import { privacyService } from "@/services/privacy.service";
import type { PolicyVersionSummary } from "@/types/policyUpdate.type";

import { PolicyDocumentCard } from "./policyDocumentCard";
import { joinPolicyTitles } from "./policyHighlights.util";
import styles from "./policyUpdate.module.css";

interface PolicyReacceptScreenProps {
  readonly versions: readonly PolicyVersionSummary[];
  readonly onAccept: () => Promise<void>;
  readonly isAccepting: boolean;
  readonly errorMessage: string | null;
}

function useLockPageWhileMounted(containerRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.overflow = "hidden";
    containerRef.current?.querySelector<HTMLElement>("h1")?.focus();
    return () => {
      root.style.overflow = "";
    };
  }, [containerRef]);
}

export function PolicyReacceptScreen({ versions, onAccept, isAccepting, errorMessage }: PolicyReacceptScreenProps) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const deletion = useMutation({ mutationFn: () => privacyService.requestAccountDeletion(confirmation.trim()) });
  useLockPageWhileMounted(containerRef);

  async function requestExport() {
    try {
      await privacyService.requestMyDataExport();
      setExportMessage("We're preparing your data. We'll email you when it's ready.");
    } catch {
      setExportMessage("We couldn't start the export. Try again in a moment.");
    }
  }

  return (
    <div ref={containerRef} className={styles.reaccept} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={(event) => trapTabKey(event, containerRef.current)}>
      <div className={styles.reacceptScroll}>
        <div className={styles.reacceptColumn}>
          <div className={styles.reacceptBrand}>
            <NanttyWordmark height={26} />
          </div>
          <span className={styles.reacceptBadge} aria-hidden="true">
            <ShieldIcon size={30} />
          </span>
          <h1 id={titleId} className={styles.reacceptTitle} tabIndex={-1}>
            We&apos;ve updated our {joinPolicyTitles(versions)}
          </h1>
          <p className={styles.reacceptLead}>
            Here&apos;s a short summary of what changed. Please read it, then accept the update to keep using Nantty. Your account, orders and messages are safe either way.
          </p>
          <div className={styles.documentStack}>
            {versions.map((version) => (
              <PolicyDocumentCard key={version.policyVersionId} version={version} />
            ))}
          </div>
          <h2 className={styles.choicesHeading}>Not ready to agree?</h2>
          <div className={styles.choices}>
            <button type="button" className={styles.choiceRow} onClick={() => void requestExport()}>
              <span className={styles.choiceIcon} aria-hidden="true"><DownloadIcon size={19} /></span>
              <span className={styles.choiceText}>
                <span className={styles.choiceLabel}>Download my data</span>
                <span className={styles.choiceDetail}>Get a copy of everything we hold about you</span>
              </span>
              <ChevronRightIcon size={18} />
            </button>
            <button type="button" className={styles.choiceRow} onClick={() => setIsDeleteOpen(true)}>
              <span className={styles.choiceIcon} aria-hidden="true"><TrashIcon size={19} /></span>
              <span className={styles.choiceText}>
                <span className={styles.choiceLabel}>Delete my account</span>
                <span className={styles.choiceDetail}>See what&apos;s deleted and what the law requires us to keep</span>
              </span>
              <ChevronRightIcon size={18} />
            </button>
          </div>
          {exportMessage ? <p className={styles.statusText} role="status">{exportMessage}</p> : null}
        </div>
      </div>
      <div className={styles.reacceptFooter}>
        <div className={styles.reacceptFooterInner}>
          <label className={styles.agreeRow}>
            <input type="checkbox" className={styles.agreeCheckbox} checked={hasAgreed} onChange={(event) => setHasAgreed(event.target.checked)} />
            <span>I have read and agree to the updated Terms and Privacy Policy</span>
          </label>
          {errorMessage ? <p className={styles.errorText} role="alert">{errorMessage}</p> : null}
          <Button size="lg" fullWidth disabled={!hasAgreed} busy={isAccepting} onClick={() => void onAccept().catch(() => undefined)}>
            Accept and continue
          </Button>
        </div>
      </div>
      <DeleteAccountDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        confirmation={confirmation}
        onConfirmationChange={setConfirmation}
        deletion={{ isPending: deletion.isPending, isSuccess: deletion.isSuccess, errorMessage: deletion.error?.message ?? null, confirm: () => deletion.mutate() }}
      />
    </div>
  );
}
