"use client";

import { useCallback, useState } from "react";

import { PosPinPad } from "@/components/pos/posPinPad";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { staffRoleLabels } from "@/constants/roles.constant";
import { usePosRegisterContext } from "@/hooks/usePosRegisterContext.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendRequestToDashboardServer } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { PinRosterEntry } from "@/types/posExtra.type";

import styles from "./posPinLockScreen.module.css";

export function PosPinLockScreen() {
  const { refreshSessionView } = useSellerSession();
  const { locationId, selectedRegister, markRegisterUnlocked, isOnline } = usePosRegisterContext();
  const rosterQuery = useSellerQuery<CursorPage<PinRosterEntry>>(locationId ? "/seller/staff/pin-roster" : null, { locationId });
  const [chosenStaffId, setChosenStaffId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const chosenStaff = rosterQuery.data?.data.find((entry) => entry.staffId === chosenStaffId) ?? null;

  const unlockWithPin = useCallback(async () => {
    if (!chosenStaffId || pin.length < 4) return;
    setIsUnlocking(true);
    setErrorMessage(null);
    try {
      await sendRequestToDashboardServer("/bff/session/operator", { method: "POST", body: { staffId: chosenStaffId, pin, registerId: selectedRegister?.id ?? null } });
      await refreshSessionView();
      setPin("");
      markRegisterUnlocked();
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
      setPin("");
    } finally {
      setIsUnlocking(false);
    }
  }, [chosenStaffId, pin, selectedRegister, refreshSessionView, markRegisterUnlocked]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="pin-lock-title">
      <div className={styles.panel}>
        <h1 id="pin-lock-title" className={styles.title}>
          {chosenStaff ? `Hi ${chosenStaff.name.split(" ")[0]}, enter your PIN` : "Who is selling?"}
        </h1>
        <p className={styles.subtitle}>{selectedRegister ? `${selectedRegister.name} is locked.` : "The register is locked."}</p>
        {!isOnline ? <Callout tone="caution">Switching cashier needs a connection. Reconnect to unlock.</Callout> : null}
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
        {chosenStaff ? (
          <>
            <PosPinPad pin={pin} onPinChange={setPin} onSubmit={() => void unlockWithPin()} isDisabled={isUnlocking || !isOnline} />
            <button type="button" className={styles.switchLink} onClick={() => { setChosenStaffId(null); setPin(""); setErrorMessage(null); }}>
              Not {chosenStaff.name.split(" ")[0]}? Choose someone else
            </button>
          </>
        ) : rosterQuery.isLoading ? (
          <LoadingBlock label="Loading staff" />
        ) : (
          <ul className={styles.roster}>
            {(rosterQuery.data?.data ?? []).map((entry) => (
              <li key={entry.staffId}>
                <button type="button" className={styles.rosterButton} disabled={entry.locked} onClick={() => setChosenStaffId(entry.staffId)}>
                  <span className={styles.initial} aria-hidden="true">{entry.name.slice(0, 1)}</span>
                  <span className={styles.rosterName}>{entry.name}</span>
                  <span className={styles.rosterRole}>{entry.locked ? "Locked — ask a manager" : staffRoleLabels[entry.role]}</span>
                </button>
              </li>
            ))}
            {rosterQuery.data && rosterQuery.data.data.length === 0 ? <li className={styles.subtitle}>No staff at this location have a PIN yet. Set PINs under Staff.</li> : null}
          </ul>
        )}
      </div>
    </div>
  );
}
