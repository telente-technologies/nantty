"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { Card, KeyValueList } from "@/components/ui/surfaces";
import { VerificationBadge } from "@/components/ui/verificationBadge";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { revealPlatformUserPersonalData } from "@/services/peopleApi.service";
import type { UserDetail, UserPersonalDataResponse } from "@/types/peopleUsers.type";
import { formatDateOnly, formatDateTime, formatWholeNumber } from "@/utils/formatting.util";

import styles from "./peopleWorkspace.module.css";

export function UserProfilePanel({ detail, canRevealPersonalData }: { readonly detail: UserDetail; readonly canRevealPersonalData: boolean }) {
  const { user } = detail;
  const [isRevealDialogOpen, setIsRevealDialogOpen] = useState(false);
  const [revealed, setRevealed] = useState<UserPersonalDataResponse | null>(null);
  const revealMutation = useAdminMutation((purpose: string) => revealPlatformUserPersonalData(user.id, purpose));

  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(null), revealed.expiresInSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  async function revealPersonalData(purpose: string) {
    const result = await revealMutation.run(purpose);
    if (result) {
      setRevealed(result);
      setIsRevealDialogOpen(false);
    }
  }

  const masked = <span className={styles.faint}>Hidden</span>;
  return (
    <>
      <Card title="Account">
        <KeyValueList
          columns={3}
          items={[
            { label: "User ID", value: user.id, isMono: true },
            { label: "Country · currency", value: `${user.country} · ${user.currency}`, isMono: true },
            { label: "Joined", value: formatDateOnly(user.joinedAt) },
            { label: "Last active", value: formatDateTime(user.lastActiveAt) },
            { label: "Followers", value: formatWholeNumber(user.followerCount) },
            { label: "Risk level", value: user.riskLevel },
            { label: "Verification", value: user.verification ? <VerificationBadge verification={user.verification} isLabelShown /> : "Not verified" },
            { label: "Strikes", value: user.strikeCount },
            { label: "Bio", value: detail.bio ?? "—" },
          ]}
        />
      </Card>
      <Card
        title="Personal data"
        actions={
          canRevealPersonalData ? (
            revealed ? (
              <Button size="small" variant="ghost" onClick={() => setRevealed(null)}>
                Hide now
              </Button>
            ) : (
              <Button size="small" iconName="eye16" onClick={() => setIsRevealDialogOpen(true)}>
                Reveal
              </Button>
            )
          ) : null
        }
      >
        <KeyValueList
          columns={2}
          items={[
            { label: "Email", value: revealed ? <span className={styles.revealed}>{revealed.email}</span> : user.emailMasked },
            { label: "Phone", value: revealed ? <span className={styles.revealed}>{revealed.phone}</span> : user.phoneMasked },
            { label: "Legal name", value: revealed ? revealed.legalName : masked },
            { label: "Date of birth", value: revealed ? revealed.dateOfBirth ?? "—" : masked },
          ]}
        />
        <p className={styles.faint}>
          {revealed ? `Revealed at ${formatDateTime(revealed.revealedAt)}. Hides automatically after ${revealed.expiresInSeconds} seconds.` : canRevealPersonalData ? "Revealing is recorded in the audit log with your purpose." : "You don't have permission to reveal personal data."}
        </p>
      </Card>
      <ConfirmActionDialog intent="lock"
        isOpen={isRevealDialogOpen}
        title="Reveal personal data"
        description={`Show @${user.username}'s email, phone, legal name and date of birth for 60 seconds.`}
        confirmLabel="Reveal for 60 seconds"
        reasonLabel="Purpose (saved to the audit log)"
        reasonHint="At least 5 characters. Say why you need this person's personal data."
        reasonPlaceholder="e.g. Ticket #48213: confirming account ownership"
        isBusy={revealMutation.isRunning}
        errorMessage={revealMutation.errorMessage}
        onConfirm={revealPersonalData}
        onClose={() => setIsRevealDialogOpen(false)}
      />
    </>
  );
}
