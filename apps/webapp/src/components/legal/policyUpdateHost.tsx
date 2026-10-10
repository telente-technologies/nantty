"use client";

import { useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { CloseIcon, ShieldIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import type { PolicyVersionSummary } from "@/types/policyUpdate.type";

import { PolicyDocumentCard } from "./policyDocumentCard";
import { formatPolicyEffectiveDate, joinPolicyTitles } from "./policyHighlights.util";
import { PolicyReacceptScreen } from "./policyReacceptScreen";
import styles from "./policyUpdate.module.css";
import { usePolicyUpdates } from "./usePolicyUpdates.hook";

interface WhatChangedDialogProps {
  readonly versions: readonly PolicyVersionSummary[];
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onRemindLater: () => void;
  readonly onAcknowledge: () => void;
  readonly isAccepting: boolean;
  readonly errorMessage: string | null;
}

function WhatChangedDialog({ versions, isOpen, onClose, onRemindLater, onAcknowledge, isAccepting, errorMessage }: WhatChangedDialogProps) {
  const materialVersions = versions.filter((version) => version.isMaterialChange);
  const actions =
    materialVersions.length > 0
      ? [
          { label: "Accept the update", variant: "primary" as const, busy: isAccepting, onClick: onAcknowledge },
          { label: "Remind me later", variant: "secondary" as const, onClick: onRemindLater },
        ]
      : [{ label: "Got it", variant: "primary" as const, busy: isAccepting, onClick: onAcknowledge }];
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="What changed" description={`Updates to our ${joinPolicyTitles(versions)}`} layout="sheet" size="medium" showCloseButton tone="brand" icon={<ShieldIcon size={24} />} actions={actions}>
      <div className={styles.documentStack}>
        {versions.map((version) => (
          <PolicyDocumentCard key={version.policyVersionId} version={version} />
        ))}
        {materialVersions.map((version) => (
          <p key={version.policyVersionId} className={styles.mutedText}>
            You can keep using Zudomart as normal. From {formatPolicyEffectiveDate(version.effectiveAt)} we&apos;ll ask you to accept the new {version.title} before you continue.
          </p>
        ))}
        {errorMessage ? <p className={styles.errorText} role="alert">{errorMessage}</p> : null}
      </div>
    </Dialog>
  );
}

export function PolicyUpdateHost() {
  const { isSignedIn, pending, blocking, bannerVersions, dismiss, accept, acceptAllPending, isAccepting, acceptErrorMessage } = usePolicyUpdates();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  if (!isSignedIn) return null;
  if (blocking) {
    return <PolicyReacceptScreen versions={pending.length > 0 ? pending : [blocking]} onAccept={acceptAllPending} isAccepting={isAccepting} errorMessage={acceptErrorMessage} />;
  }
  if (bannerVersions.length === 0 && !isDialogOpen) return null;
  const earliest = [...bannerVersions].sort((left, right) => Date.parse(left.effectiveAt) - Date.parse(right.effectiveAt))[0];
  const dismissAll = () => bannerVersions.forEach((version) => dismiss(version.policyVersionId));
  const acknowledgeAll = async () => {
    try {
      for (const version of bannerVersions) await accept(version);
      setIsDialogOpen(false);
      showToast({ text: "Thanks. You're up to date." });
    } catch {
      return;
    }
  };
  return (
    <>
      {earliest ? (
        <section className={styles.banner} aria-label="Policy update">
          <span className={styles.bannerIcon} aria-hidden="true">
            <ShieldIcon size={20} />
          </span>
          <div className={styles.bannerText}>
            <p className={styles.bannerTitle}>We&apos;ve updated our {joinPolicyTitles(bannerVersions)}</p>
            <p className={styles.bannerMeta}>Effective {formatPolicyEffectiveDate(earliest.effectiveAt)}</p>
          </div>
          <button type="button" className={styles.bannerReview} onClick={() => setIsDialogOpen(true)}>
            Review changes
          </button>
          <button type="button" className={styles.bannerDismiss} onClick={dismissAll} aria-label="Dismiss this notice">
            <CloseIcon size={16} />
          </button>
        </section>
      ) : null}
      <WhatChangedDialog
        versions={bannerVersions}
        isOpen={isDialogOpen && bannerVersions.length > 0}
        onClose={() => setIsDialogOpen(false)}
        onRemindLater={() => {
          setIsDialogOpen(false);
          dismissAll();
        }}
        onAcknowledge={() => void acknowledgeAll()}
        isAccepting={isAccepting}
        errorMessage={acceptErrorMessage}
      />
    </>
  );
}
