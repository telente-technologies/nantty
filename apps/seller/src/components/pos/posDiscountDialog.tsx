"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { MoneyField, SelectField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { SegmentedControl } from "@/components/ui/navigationTabs";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CurrencyCode } from "@/types/money.type";
import type { CursorPage } from "@/types/pagination.type";
import type { DiscountInput } from "@/types/pos.type";
import type { DiscountApproval, PinRosterEntry } from "@/types/posExtra.type";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText, formatBasisPointsAsPercent } from "@/utils/money.util";
import { calculateDiscountAmountMinor, doesDiscountNeedManagerApproval } from "@/utils/posCartPricing.util";

import styles from "./posDialogs.module.css";

export interface PosDiscountTarget {
  readonly label: string;
  readonly grossMinor: number;
  readonly currentDiscount: DiscountInput | null;
}

interface PosDiscountDialogProps {
  readonly target: PosDiscountTarget | null;
  readonly currency: CurrencyCode;
  readonly approvalThresholdBasisPoints: number;
  readonly canApproveOwnDiscounts: boolean;
  readonly locationId: string | null;
  readonly onApply: (discount: DiscountInput | null) => void;
  readonly onClose: () => void;
}

const approverRoles = new Set(["owner", "admin", "manager"]);

function convertPercentTextToBasisPoints(percentText: string): number | null {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(percentText.trim())) return null;
  const basisPoints = Math.round(Number(percentText) * 100);
  return basisPoints > 0 && basisPoints <= 10_000 ? basisPoints : null;
}

export function PosDiscountDialog({ target, currency, approvalThresholdBasisPoints, canApproveOwnDiscounts, locationId, onApply, onClose }: PosDiscountDialogProps) {
  const { formatMoney } = useMoneyFormatter();
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [valueText, setValueText] = useState("");
  const [reason, setReason] = useState("");
  const [approverStaffId, setApproverStaffId] = useState("");
  const [approverPin, setApproverPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const rosterQuery = useSellerQuery<CursorPage<PinRosterEntry>>(target && !canApproveOwnDiscounts && locationId ? "/seller/staff/pin-roster" : null, { locationId });
  const approvers = (rosterQuery.data?.data ?? []).filter((entry) => approverRoles.has(entry.role) && !entry.locked);

  useEffect(() => {
    if (!target) return;
    setKind(target.currentDiscount?.kind ?? "percent");
    setValueText(target.currentDiscount ? (target.currentDiscount.kind === "percent" ? String(target.currentDiscount.value / 100) : convertMinorUnitsToMajorInputText(target.currentDiscount.value, currency)) : "");
    setReason(target.currentDiscount?.reason ?? "");
    setApproverPin("");
    setErrorMessage(null);
  }, [target, currency]);

  const discountValue = kind === "percent" ? convertPercentTextToBasisPoints(valueText) : convertMajorInputToMinorUnits(valueText, currency);
  const discountMinor = target && discountValue ? calculateDiscountAmountMinor(target.grossMinor, { kind, value: discountValue }) : 0;
  const needsApproval = Boolean(target) && !canApproveOwnDiscounts && doesDiscountNeedManagerApproval(discountMinor, target?.grossMinor ?? 0, approvalThresholdBasisPoints);

  async function applyDiscountAfterChecks() {
    if (!target) return;
    if (!discountValue || discountMinor <= 0) {
      setErrorMessage(kind === "percent" ? "Enter a percentage between 0.01 and 100." : "Enter an amount above zero.");
      return;
    }
    if (kind === "amount" && discountValue > target.grossMinor) {
      setErrorMessage(`The discount cannot be more than ${formatMoney({ amountMinor: target.grossMinor, currency })}.`);
      return;
    }
    const trimmedReason = reason.trim();
    if (needsApproval && trimmedReason.length < 3) {
      setErrorMessage("Give a reason so the manager knows what they are approving.");
      return;
    }
    let approvedByStaffId: string | null = null;
    if (needsApproval) {
      if (!approverStaffId || !/^\d{4,6}$/.test(approverPin)) {
        setErrorMessage("Choose the approving manager and enter their 4–6 digit PIN.");
        return;
      }
      setIsApproving(true);
      try {
        const approval = await sendSellerApiRequest<DiscountApproval>("/seller/pos/discount-approvals", { method: "POST", body: { staffId: approverStaffId, pin: approverPin, discountMinor, grossMinor: target.grossMinor, reason: trimmedReason } });
        approvedByStaffId = approval.approvedBy.id;
      } catch (error) {
        setErrorMessage(readErrorMessageForDisplay(error));
        setApproverPin("");
        setIsApproving(false);
        return;
      }
      setIsApproving(false);
    }
    onApply({ kind, value: discountValue, reason: trimmedReason || null, approvedByStaffId });
  }

  return (
    <ModalDialog
      isOpen={target !== null}
      onClose={onClose}
      title={`Discount ${target?.label ?? ""}`}
      description={target ? `Before discount: ${formatMoney({ amountMinor: target.grossMinor, currency })}` : undefined}
      footer={
        <>
          {target?.currentDiscount ? <Button variant="ghost" onClick={() => onApply(null)}>Remove discount</Button> : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void applyDiscountAfterChecks()} isBusy={isApproving}>
            {needsApproval ? "Approve and apply" : "Apply discount"}
          </Button>
        </>
      }
    >
      <form className={styles.formStack} onSubmit={(event) => { event.preventDefault(); void applyDiscountAfterChecks(); }}>
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
        <SegmentedControl label="Discount type" value={kind} onValueChange={(nextKind) => { setKind(nextKind); setValueText(""); }} options={[{ value: "percent", label: "Percent" }, { value: "amount", label: "Amount" }]} />
        {kind === "percent" ? (
          <TextField label="Percent off" inputMode="decimal" value={valueText} onChange={(event) => setValueText(event.target.value.replace(/[^\d.]/g, ""))} autoFocus maxLength={6} />
        ) : (
          <MoneyField label="Amount off" currency={currency} valueText={valueText} onValueTextChange={setValueText} autoFocus />
        )}
        <div className={styles.summaryLine}>
          <span>Discount</span>
          <strong>−{formatMoney({ amountMinor: discountMinor, currency })}</strong>
        </div>
        <TextField label={needsApproval ? "Reason (required)" : "Reason (optional)"} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} />
        {needsApproval ? (
          <>
            <Callout tone="caution" title="Manager approval needed">
              Discounts above {formatBasisPointsAsPercent(approvalThresholdBasisPoints)} need a manager&apos;s PIN.
            </Callout>
            <div className={styles.formRow}>
              <SelectField label="Approving manager" value={approverStaffId} onChange={(event) => setApproverStaffId(event.target.value)} options={[{ value: "", label: approvers.length ? "Choose a manager" : "No managers with a PIN here" }, ...approvers.map((entry) => ({ value: entry.staffId, label: entry.name }))]} />
              <TextField label="Manager PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={approverPin} onChange={(event) => setApproverPin(event.target.value.replace(/\D/g, ""))} />
            </div>
          </>
        ) : null}
      </form>
    </ModalDialog>
  );
}
