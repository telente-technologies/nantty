"use client";

import { PosOpenShiftForm } from "@/components/pos/posOpenShiftForm";
import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { usePosRegisterContext } from "@/hooks/usePosRegisterContext.hook";
import type { CurrencyCode } from "@/types/money.type";

import styles from "./posRegisterPicker.module.css";

export function PosRegisterPicker() {
  const { registers, selectRegister, isOnline } = usePosRegisterContext();
  return (
    <div className={styles.centered}>
      <Panel title="Choose this device's register" description="Each till keeps its own shift and cash drawer. You can change it later.">
        {registers.length === 0 ? (
          <EmptyState title="No registers at this location" description={isOnline ? "An owner or admin can add registers under Settings → Locations." : "Registers load when you are online."} />
        ) : (
          <ul className={styles.registerList}>
            {registers.map((register) => (
              <li key={register.id}>
                <button type="button" className={styles.registerButton} onClick={() => selectRegister(register.id)}>
                  <span className={styles.registerName}>{register.name}</span>
                  <StatusBadge tone={register.openShiftId ? "success" : "neutral"}>{register.openShiftId ? "Shift open" : "Closed"}</StatusBadge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function PosOpenShiftPrompt({ currency }: { readonly currency: CurrencyCode }) {
  const { selectedRegister, rememberRegisterShift, registers, selectRegister } = usePosRegisterContext();
  if (!selectedRegister) return null;
  return (
    <div className={styles.centered}>
      <Panel title={`Open a shift on ${selectedRegister.name}`} description="Count the cash in the drawer to start selling.">
        <PosOpenShiftForm registerId={selectedRegister.id} currency={currency} onShiftOpened={(shift) => rememberRegisterShift(selectedRegister.id, shift.id)} />
        {registers.length > 1 ? (
          <p className={styles.switchRow}>
            Wrong till?{" "}
            {registers.filter((register) => register.id !== selectedRegister.id).map((register) => (
              <button key={register.id} type="button" className={styles.linkButton} onClick={() => selectRegister(register.id)}>
                Use {register.name}
              </button>
            ))}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
