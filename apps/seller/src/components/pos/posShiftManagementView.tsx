"use client";

import { useState } from "react";

import { PosCashMovementDialog } from "@/components/pos/posCashMovementDialog";
import { PosOpenShiftPrompt, PosRegisterPicker } from "@/components/pos/posRegisterPicker";
import { PosShiftReport } from "@/components/pos/posShiftReport";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { MoneyField, TextAreaField } from "@/components/ui/formFields";
import { Panel, PageHeader } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { usePosRegisterContext } from "@/hooks/usePosRegisterContext.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { PosShift } from "@/types/pos.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { convertMajorInputToMinorUnits } from "@/utils/money.util";

import styles from "./posShiftManagementView.module.css";

export function PosShiftManagementView() {
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const { selectedRegister, catalog, rememberRegisterShift, isOnline, queuedSales } = usePosRegisterContext();
  const currency = catalog?.settings.currency ?? null;
  const openShiftQuery = useSellerQuery<PosShift>(selectedRegister?.openShiftId ? `/seller/pos/shifts/${encodeURIComponent(selectedRegister.openShiftId)}` : null);
  const closedShiftsQuery = useSellerQuery<CursorPage<PosShift>>(selectedRegister ? "/seller/pos/shifts" : null, { registerId: selectedRegister?.id, status: "closed", limit: 8 });
  const [cashMovementKind, setCashMovementKind] = useState<"pay_in" | "pay_out" | null>(null);
  const [countedText, setCountedText] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [justClosedShift, setJustClosedShift] = useState<PosShift | null>(null);
  const [viewedShift, setViewedShift] = useState<PosShift | null>(null);
  const pendingSyncCount = queuedSales.filter((sale) => sale.status === "queued").length;

  if (!selectedRegister) return <PosRegisterPicker />;
  if (!currency) return <LoadingBlock />;
  const openShift = openShiftQuery.data;
  const countedMinor = countedText.trim() === "" ? null : convertMajorInputToMinorUnits(countedText, currency);
  const previewVarianceMinor = openShift && countedMinor !== null ? countedMinor - openShift.expectedCash.amountMinor : null;

  async function closeShiftWithCountedCash() {
    if (!openShift) return;
    if (countedMinor === null || countedMinor < 0) return setErrorMessage("Enter the cash you counted, or 0.");
    if (pendingSyncCount > 0 && !window.confirm(`${pendingSyncCount} offline sales have not synced yet. Close the shift anyway?`)) return;
    setIsClosing(true);
    setErrorMessage(null);
    try {
      const closedShift = await sendSellerApiRequest<PosShift>(`/seller/pos/shifts/${encodeURIComponent(openShift.id)}/close`, { method: "POST", body: { countedCashMinor: countedMinor, note: closingNote.trim() || null } });
      rememberRegisterShift(closedShift.registerId, null);
      setJustClosedShift(closedShift);
      setCountedText("");
      setClosingNote("");
      closedShiftsQuery.reload();
      showToast("Shift closed.");
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsClosing(false);
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Shift and cash drawer" description={`${selectedRegister.name} · open a shift with a float, move cash in or out, and close with a count.`} actions={<Button iconName="textIndent24" onClick={() => window.print()}>Print</Button>} />
      {!isOnline ? <Callout tone="caution">Shift changes need a connection. Sales still work offline.</Callout> : null}
      {justClosedShift ? <PosShiftReport shift={justClosedShift} registerName={selectedRegister.name} /> : null}
      {!selectedRegister.openShiftId ? (
        justClosedShift ? null : <PosOpenShiftPrompt currency={currency} />
      ) : openShiftQuery.isLoading && !openShift ? (
        <LoadingBlock label="Loading the shift" />
      ) : openShift ? (
        <div className={styles.columns}>
          <PosShiftReport shift={openShift} registerName={selectedRegister.name} />
          <div className={styles.sideStack}>
            <Panel title="Cash drawer">
              <div className={styles.buttonRow}>
                <Button onClick={() => setCashMovementKind("pay_in")} disabled={!isOnline}>Pay in</Button>
                <Button onClick={() => setCashMovementKind("pay_out")} disabled={!isOnline}>Pay out</Button>
              </div>
            </Panel>
            <Panel title="Close shift" description="Count every note and coin in the drawer.">
              <form className={styles.closeForm} onSubmit={(event) => { event.preventDefault(); void closeShiftWithCountedCash(); }}>
                {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
                <MoneyField label="Counted cash" currency={currency} valueText={countedText} onValueTextChange={setCountedText} />
                {previewVarianceMinor !== null ? (
                  <p className={styles.variance} role="status">
                    Expected {formatMoney(openShift.expectedCash)} · {previewVarianceMinor === 0 ? "balanced" : `${previewVarianceMinor < 0 ? "short by" : "over by"} ${formatMoney({ amountMinor: Math.abs(previewVarianceMinor), currency })}`}
                  </p>
                ) : null}
                <TextAreaField label="Note (optional)" value={closingNote} onChange={(event) => setClosingNote(event.target.value)} maxLength={500} />
                <Button type="submit" variant="danger" isBusy={isClosing} disabled={!isOnline}>Close shift</Button>
              </form>
            </Panel>
          </div>
          <PosCashMovementDialog kind={cashMovementKind} shiftId={openShift.id} currency={currency} onClose={() => setCashMovementKind(null)} onSaved={() => { setCashMovementKind(null); openShiftQuery.reload(); showToast("Cash movement saved."); }} />
        </div>
      ) : (
        <Callout tone="error">{openShiftQuery.errorMessage ?? "This shift could not be loaded."}</Callout>
      )}
      <Panel title="Recent closed shifts" padded={false}>
        {closedShiftsQuery.data?.data.length ? (
          <ul className={styles.historyList}>
            {closedShiftsQuery.data.data.map((shift) => (
              <li key={shift.id}>
                <button type="button" className={styles.historyButton} onClick={() => setViewedShift(viewedShift?.id === shift.id ? null : shift)} aria-expanded={viewedShift?.id === shift.id}>
                  <span>{formatDateTimeForDisplay(shift.openedAt)} · {shift.openedBy.name}</span>
                  <span>{formatMoney(shift.totals.netSales)}</span>
                  <StatusBadge tone={(shift.cashVariance?.amountMinor ?? 0) === 0 ? "success" : "caution"}>{shift.cashVariance ? formatMoney(shift.cashVariance) : "—"}</StatusBadge>
                </button>
                {viewedShift?.id === shift.id ? <PosShiftReport shift={shift} registerName={selectedRegister.name} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No closed shifts yet" description="Closed shifts on this register appear here with their variance." />
        )}
      </Panel>
    </div>
  );
}
