"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/formFields";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { StaffMember } from "@/types/staff.type";
import { isPinCurrentlyLocked, validatePosPinPair } from "@/utils/staffEditingRules.util";
import { formatTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./staff.module.css";

export function StaffPinForm({ member, onChanged }: { readonly member: StaffMember; readonly onChanged: (member: StaffMember) => void }) {
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"set" | "unlock" | null>(null);
  const { showToast } = useToast();

  async function saveStaffPin() {
    const validationMessage = validatePosPinPair(pin, confirmation);
    setErrorMessage(validationMessage);
    if (validationMessage) return;
    setBusyAction("set");
    try {
      const updated = await sendSellerApiRequest<StaffMember>(`/seller/staff/${encodeURIComponent(member.id)}/pin`, { method: "POST", body: { pin } });
      setPin("");
      setConfirmation("");
      showToast(`${member.hasPosPin ? "Reset" : "Set"} ${member.name}'s register PIN.`);
      onChanged(updated);
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function unlockStaffPin() {
    setBusyAction("unlock");
    try {
      const updated = await sendSellerApiRequest<StaffMember>(`/seller/staff/${encodeURIComponent(member.id)}/unlock-pin`, { method: "POST" });
      showToast(`${member.name} can use their PIN again.`);
      onChanged(updated);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className={styles.stack}>
      <p className={styles.sectionTitle}>Register PIN</p>
      <p className={styles.muted}>
        {member.hasPosPin ? "Used to unlock the register on shared devices. We store it scrambled, so nobody can read it back." : "No PIN yet. Set one so this person can unlock a shared register."}
      </p>
      {isPinCurrentlyLocked(member) ? (
        <div className={styles.actionsRow}>
          <span className={styles.muted}>Locked after too many wrong tries until {formatTimeForDisplay(member.pinLockedUntil)}.</span>
          <Button size="small" isBusy={busyAction === "unlock"} onClick={() => void unlockStaffPin()}>
            Unlock PIN
          </Button>
        </div>
      ) : null}
      <div className={styles.twoColumns}>
        <TextField label={member.hasPosPin ? "New PIN" : "PIN"} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} errorMessage={errorMessage} hint="4 to 6 digits" />
        <TextField label="Type the PIN again" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, ""))} />
      </div>
      <div>
        <Button size="small" isBusy={busyAction === "set"} onClick={() => void saveStaffPin()}>
          {member.hasPosPin ? "Reset PIN" : "Set PIN"}
        </Button>
      </div>
    </div>
  );
}
