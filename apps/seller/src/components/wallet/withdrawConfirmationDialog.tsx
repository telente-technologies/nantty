"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { MoneyField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { KeyValueList } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { Money } from "@/types/money.type";
import type { PayoutAccount } from "@/types/wallet.type";

import styles from "./wallet.module.css";

interface WithdrawConfirmationDialogProps {
  readonly isOpen: boolean;
  readonly amount: Money;
  readonly fee: Money;
  readonly account: PayoutAccount;
  readonly isSubmitting: boolean;
  readonly errorMessage: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function WithdrawConfirmationDialog({ isOpen, amount, fee, account, isSubmitting, errorMessage, onCancel, onConfirm }: WithdrawConfirmationDialogProps) {
  const { formatMoney } = useMoneyFormatter();
  const [retypedAmountText, setRetypedAmountText] = useState("");
  const [retypedAmountMinor, setRetypedAmountMinor] = useState<number | null>(null);
  const doesRetypedAmountMatch = retypedAmountMinor === amount.amountMinor;

  return (
    <ModalDialog intent="naira"
      isOpen={isOpen}
      title="Confirm withdrawal"
      description="Money sent to a bank cannot be pulled back. Check the details."
      onClose={onCancel}
      width="small"
      footer={
        <>
          <Button onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} isBusy={isSubmitting} disabled={!doesRetypedAmountMatch}>
            Withdraw {formatMoney(amount)}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <p className={styles.confirmAmount}>{formatMoney(amount)}</p>
        <KeyValueList
          items={[
            { label: "To", value: `${account.bankName} ${account.accountNumberMasked}` },
            { label: "Account name", value: account.accountNameMasked },
            { label: "Payout fee", value: formatMoney(fee) },
            { label: "Taken from your wallet", value: formatMoney({ amountMinor: amount.amountMinor + fee.amountMinor, currency: amount.currency }) },
          ]}
        />
        <MoneyField
          label="Type the amount again to confirm"
          currency={amount.currency}
          valueText={retypedAmountText}
          onValueTextChange={setRetypedAmountText}
          onMinorAmountChange={setRetypedAmountMinor}
          errorMessage={retypedAmountText !== "" && !doesRetypedAmountMatch ? "This does not match the amount above." : null}
          autoFocus
        />
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
      </div>
    </ModalDialog>
  );
}
