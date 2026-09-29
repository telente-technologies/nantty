"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { PosRegister } from "@/types/store.type";

import styles from "./settings.module.css";

export function LocationRegistersList({ locationId, canEdit }: { readonly locationId: string; readonly canEdit: boolean }) {
  const registersQuery = useSellerQuery<CursorPage<PosRegister>>("/seller/pos/registers", { locationId, includeInactive: true });
  const [newRegisterName, setNewRegisterName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [busyRegisterId, setBusyRegisterId] = useState<string | null>(null);
  const { showToast } = useToast();
  const registers = registersQuery.data?.data.filter((register) => register.locationId === locationId) ?? [];

  async function runRegisterChange(busyKey: string, request: () => Promise<unknown>, successMessage: string) {
    setBusyRegisterId(busyKey);
    try {
      await request();
      showToast(successMessage);
      registersQuery.reload();
      return true;
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
      return false;
    } finally {
      setBusyRegisterId(null);
    }
  }

  async function addRegister() {
    const trimmedName = newRegisterName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      setNameError("Register names are 2 to 40 characters.");
      return;
    }
    setNameError(null);
    const isAdded = await runRegisterChange("new", () => sendSellerApiRequest("/seller/pos/registers", { method: "POST", body: { locationId, name: trimmedName } }), `${trimmedName} added.`);
    if (isAdded) setNewRegisterName("");
  }

  async function renameRegister(register: PosRegister) {
    const nextName = window.prompt("New register name", register.name)?.trim();
    if (!nextName || nextName === register.name) return;
    if (nextName.length < 2 || nextName.length > 40) {
      showToast("Register names are 2 to 40 characters.", "error");
      return;
    }
    await runRegisterChange(register.id, () => sendSellerApiRequest(`/seller/pos/registers/${encodeURIComponent(register.id)}`, { method: "PATCH", body: { name: nextName } }), "Register renamed.");
  }

  return (
    <div className={styles.listReset}>
      <p className={styles.readOnlyLabel}>Registers</p>
      {registersQuery.errorMessage ? <p className={styles.mutedText}>{registersQuery.errorMessage}</p> : null}
      {registersQuery.isLoading && registers.length === 0 ? <p className={styles.mutedText}>Loading registers…</p> : null}
      {!registersQuery.isLoading && registers.length === 0 && !registersQuery.errorMessage ? <p className={styles.mutedText}>No registers yet.</p> : null}
      {registers.map((register) => (
        <div key={register.id} className={styles.registerRow}>
          <span className={styles.rowTitle}>
            {register.name}
            {register.openShiftId ? <StatusBadge tone="success">Shift open</StatusBadge> : null}
            {register.active ? null : <StatusBadge>Inactive</StatusBadge>}
          </span>
          {canEdit ? (
            <span className={styles.inlineActions}>
              <Button size="small" variant="ghost" onClick={() => void renameRegister(register)} disabled={busyRegisterId !== null}>
                Rename
              </Button>
              <Button
                size="small"
                isBusy={busyRegisterId === register.id}
                disabled={busyRegisterId !== null || (register.active && register.openShiftId !== null)}
                title={register.active && register.openShiftId ? "Close the open shift first" : undefined}
                onClick={() => void runRegisterChange(register.id, () => sendSellerApiRequest(`/seller/pos/registers/${encodeURIComponent(register.id)}`, { method: "PATCH", body: { active: !register.active } }), register.active ? "Register deactivated." : "Register activated.")}
              >
                {register.active ? "Deactivate" : "Activate"}
              </Button>
            </span>
          ) : null}
        </div>
      ))}
      {canEdit ? (
        <div className={styles.rowHeader}>
          <TextField label="New register name" hideLabel placeholder="New register name, e.g. Front counter" value={newRegisterName} maxLength={40} onChange={(event) => setNewRegisterName(event.target.value)} errorMessage={nameError} />
          <Button size="small" iconName="plus16" isBusy={busyRegisterId === "new"} onClick={() => void addRegister()}>
            Add register
          </Button>
        </div>
      ) : null}
    </div>
  );
}
