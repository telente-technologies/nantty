"use client";

import { useState, type ReactNode } from "react";

import { AddPayoutAccountDialog } from "@/components/wallet/addPayoutAccountDialog";
import { WalletTabs } from "@/components/wallet/walletTabs";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { StepUpCancelledError, useStepUpPrompt } from "@/components/wallet/stepUpDialog";
import { stepUpHeaders } from "@/services/stepUp.service";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { PayoutAccount } from "@/types/wallet.type";

import styles from "./wallet.module.css";

export function PayoutAccountsView({ embedded = false }: { readonly embedded?: boolean }) {
  const { can } = useSellerSession();
  const { showToast } = useToast();
  const { withStepUp, stepUpDialog } = useStepUpPrompt();
  const accountsQuery = useSellerQuery<CursorPage<PayoutAccount>>("/seller/wallet/payout-accounts");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [accountPendingRemoval, setAccountPendingRemoval] = useState<PayoutAccount | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const canManageAccounts = can("wallet:withdraw");
  const accounts = accountsQuery.data?.data ?? null;

  async function makeAccountTheDefault(account: PayoutAccount) {
    setBusyAccountId(account.id);
    try {
      await withStepUp((token) => sendSellerApiRequest(`/seller/wallet/payout-accounts/${encodeURIComponent(account.id)}`, { method: "PATCH", body: { isDefault: true }, headers: stepUpHeaders(token) }));
      showToast(`${account.bankName} ${account.accountNumberMasked} is now your default payout account.`);
      accountsQuery.reload();
    } catch (error) {
      if (!(error instanceof StepUpCancelledError)) showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyAccountId(null);
    }
  }

  async function removePayoutAccount(account: PayoutAccount) {
    setBusyAccountId(account.id);
    try {
      await withStepUp((token) => sendSellerApiRequest(`/seller/wallet/payout-accounts/${encodeURIComponent(account.id)}`, { method: "DELETE", headers: stepUpHeaders(token) }));
      showToast("Payout account removed.");
      setAccountPendingRemoval(null);
      accountsQuery.reload();
    } catch (error) {
      if (!(error instanceof StepUpCancelledError)) showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setBusyAccountId(null);
    }
  }

  const addAccountButton = canManageAccounts ? <Button variant="primary" iconName="plus16" onClick={() => setIsAddDialogOpen(true)}>Add account</Button> : null;
  const Wrapper = embedded ? EmbeddedFragment : PageStack;
  return (
    <Wrapper>
      {stepUpDialog}
      {embedded ? null : <PageHeader title="Payout accounts" description="Account numbers are always partly hidden. Zudomart stores them encrypted." actions={addAccountButton} />}
      {embedded ? null : <WalletTabs />}
      {!canManageAccounts ? <Callout tone="info">Only the store owner can add or remove payout accounts.</Callout> : null}
      <Panel title={embedded ? "Payout accounts" : undefined} description={embedded ? "Where withdrawals are sent. Account numbers are always partly hidden." : undefined} actions={embedded ? addAccountButton : undefined}>
        {accountsQuery.errorMessage ? <ErrorCallout error={accountsQuery.error} message={accountsQuery.errorMessage} onRetry={accountsQuery.reload} /> : null}
        {!accounts && accountsQuery.isLoading ? <LoadingBlock /> : null}
        {accounts && accounts.length === 0 ? <EmptyState iconName="creditCard24" title="No payout accounts yet" description="Add the bank account you want withdrawals sent to." /> : null}
        {accounts && accounts.length > 0 ? (
          <ul className={styles.accountList}>
            {accounts.map((account) => (
              <li key={account.id} className={styles.accountRow}>
                <div className={styles.accountMain}>
                  <span className={styles.accountBank}>{account.bankName}</span>
                  <span className={styles.accountNumber}>
                    {account.accountNumberMasked} · {account.accountNameMasked}
                  </span>
                </div>
                {account.isDefault ? <StatusBadge tone="info">Default</StatusBadge> : null}
                {account.verified ? <StatusBadge tone="success">Verified</StatusBadge> : <StatusBadge tone="caution">Checking</StatusBadge>}
                {canManageAccounts ? (
                  <div className={styles.accountActions}>
                    {!account.isDefault ? (
                      <Button size="small" onClick={() => void makeAccountTheDefault(account)} isBusy={busyAccountId === account.id}>
                        Make default
                      </Button>
                    ) : null}
                    <Button size="small" variant="ghost" iconName="trash24" onClick={() => setAccountPendingRemoval(account)} disabled={busyAccountId === account.id}>
                      Remove
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
      <AddPayoutAccountDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAccountAdded={(account) => {
          setIsAddDialogOpen(false);
          showToast(`${account.bankName} ${account.accountNumberMasked} added.`);
          accountsQuery.reload();
        }}
      />
      <ModalDialog intent="delete"
        isOpen={accountPendingRemoval !== null}
        title="Remove payout account?"
        onClose={() => setAccountPendingRemoval(null)}
        width="small"
        footer={
          <>
            <Button onClick={() => setAccountPendingRemoval(null)}>Keep it</Button>
            <Button variant="danger" onClick={() => accountPendingRemoval && void removePayoutAccount(accountPendingRemoval)} isBusy={busyAccountId === accountPendingRemoval?.id}>
              Remove account
            </Button>
          </>
        }
      >
        <p>
          {accountPendingRemoval?.bankName} {accountPendingRemoval?.accountNumberMasked} will no longer receive payouts. You can add it again later.
        </p>
      </ModalDialog>
    </Wrapper>
  );
}

function EmbeddedFragment({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}
