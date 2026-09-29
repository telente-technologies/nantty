"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Customer } from "@/types/customer.type";
import type { CursorPage } from "@/types/pagination.type";
import type { PosCartCustomer } from "@/types/posExtra.type";
import type { LoyaltyRules } from "@/types/store.type";
import { convertIssuesToFieldErrorMap, fieldChecks, validateObjectAgainstChecks } from "@/utils/formValidation.util";

import styles from "./posDialogs.module.css";

interface PosCustomerDialogProps {
  readonly isOpen: boolean;
  readonly currentCustomer: PosCartCustomer | null;
  readonly loyaltyPointsToRedeem: number;
  readonly loyalty: LoyaltyRules | null;
  readonly onChooseCustomer: (customer: PosCartCustomer | null) => void;
  readonly onRedeemPoints: (points: number) => void;
  readonly onClose: () => void;
}

export function convertCustomerToCartCustomer(customer: Customer): PosCartCustomer {
  return { id: customer.id, name: customer.name, phone: customer.phone, loyaltyPoints: customer.loyaltyPoints };
}

export function PosCustomerDialog({ isOpen, currentCustomer, loyaltyPointsToRedeem, loyalty, onChooseCustomer, onRedeemPoints, onClose }: PosCustomerDialogProps) {
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pointsText, setPointsText] = useState("");

  useEffect(() => {
    const timeoutHandle = window.setTimeout(() => setDebouncedSearchText(searchText.trim()), 250);
    return () => window.clearTimeout(timeoutHandle);
  }, [searchText]);
  useEffect(() => setPointsText(loyaltyPointsToRedeem ? String(loyaltyPointsToRedeem) : ""), [loyaltyPointsToRedeem, isOpen]);

  const customersQuery = useSellerQuery<CursorPage<Customer>>(isOpen && !isCreating ? "/seller/customers" : null, { q: debouncedSearchText, limit: 8 });

  async function createCustomerAndChoose() {
    const payload = { name: newCustomer.name.trim(), phone: newCustomer.phone.trim() || undefined, email: newCustomer.email.trim() || undefined };
    const issues = validateObjectAgainstChecks(payload, { name: fieldChecks.text({ label: "Name", min: 2, max: 80 }), phone: fieldChecks.optional(fieldChecks.phone()), email: fieldChecks.optional(fieldChecks.email()) });
    setFieldErrors(convertIssuesToFieldErrorMap(issues));
    if (issues.length > 0) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const customer = await sendSellerApiRequest<Customer>("/seller/customers", { method: "POST", body: payload });
      onChooseCustomer(convertCustomerToCartCustomer(customer));
      setIsCreating(false);
      setNewCustomer({ name: "", phone: "", email: "" });
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsSaving(false);
    }
  }

  const canRedeem = Boolean(loyalty?.enabled && currentCustomer && currentCustomer.loyaltyPoints >= (loyalty?.minimumPointsToRedeem ?? 0));

  function applyLoyaltyRedemption() {
    if (!currentCustomer || !loyalty) return;
    const points = Number(pointsText || "0");
    if (!Number.isInteger(points) || points < 0 || points > currentCustomer.loyaltyPoints || (points > 0 && points < loyalty.minimumPointsToRedeem)) {
      setErrorMessage(`Redeem between ${loyalty.minimumPointsToRedeem} and ${currentCustomer.loyaltyPoints} points, or 0.`);
      return;
    }
    setErrorMessage(null);
    onRedeemPoints(points);
    onClose();
  }

  return (
    <ModalDialog isOpen={isOpen} onClose={onClose} title={isCreating ? "Add a customer" : "Customer"} width="medium" footer={currentCustomer && !isCreating ? <Button variant="ghost" onClick={() => { onChooseCustomer(null); onClose(); }}>Remove customer from sale</Button> : undefined}>
      <div className={styles.formStack}>
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
        {currentCustomer && canRedeem && !isCreating ? (
          <form className={styles.formRow} onSubmit={(event) => { event.preventDefault(); applyLoyaltyRedemption(); }}>
            <TextField label={`Redeem points (${currentCustomer.loyaltyPoints} available)`} inputMode="numeric" value={pointsText} onChange={(event) => setPointsText(event.target.value.replace(/\D/g, ""))} hint={`Minimum ${loyalty?.minimumPointsToRedeem ?? 0} points`} />
            <Button type="submit" variant="primary" style={{ alignSelf: "center" }}>Apply points</Button>
          </form>
        ) : null}
        {isCreating ? (
          <form className={styles.formStack} onSubmit={(event) => { event.preventDefault(); void createCustomerAndChoose(); }}>
            <TextField label="Full name" value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} errorMessage={fieldErrors.name} maxLength={80} autoFocus />
            <div className={styles.formRow}>
              <TextField label="Phone (optional)" type="tel" value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })} errorMessage={fieldErrors.phone} maxLength={20} />
              <TextField label="Email (optional)" type="email" value={newCustomer.email} onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })} errorMessage={fieldErrors.email} maxLength={254} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button onClick={() => setIsCreating(false)}>Back to search</Button>
              <Button type="submit" variant="primary" isBusy={isSaving}>Add and use for this sale</Button>
            </div>
          </form>
        ) : (
          <>
            <TextField label="Search by name, phone or email" type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} autoFocus maxLength={80} />
            {customersQuery.isLoading ? <LoadingBlock label="Searching" /> : null}
            {customersQuery.errorMessage ? <Callout tone="error">{customersQuery.errorMessage}</Callout> : null}
            <ul className={styles.resultList}>
              {(customersQuery.data?.data ?? []).map((customer) => (
                <li key={customer.id}>
                  <button type="button" className={styles.resultButton} onClick={() => { onChooseCustomer(convertCustomerToCartCustomer(customer)); onClose(); }}>
                    <span>
                      <strong>{customer.name}</strong>
                      <br />
                      <span className={styles.resultSecondary}>{customer.phone ?? customer.email ?? "No contact details"}</span>
                    </span>
                    <span className={styles.resultSecondary}>{customer.loyaltyPoints} pts</span>
                  </button>
                </li>
              ))}
            </ul>
            <Button iconName="plus16" onClick={() => { setIsCreating(true); setNewCustomer({ name: searchText.trim(), phone: "", email: "" }); }}>
              Add a new customer
            </Button>
          </>
        )}
      </div>
    </ModalDialog>
  );
}
