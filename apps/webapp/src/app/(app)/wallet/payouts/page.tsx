"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { StepUpCancelledError, useStepUpPrompt } from "@/components/wallet/stepUpDialog";
import { BvnConsentCard } from "@/components/wallet/bvnConsentCard";
import { VerifyToWithdrawBanner } from "@/components/wallet/verifyToWithdrawBanner";
import { createIdempotencyKey, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { walletsService } from "@/services/wallets.service";
import { parseMajorAmountToMinorUnits } from "@/utils/amountInput.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { readVerifyToWithdrawMessage, readWalletVerification, verifyActionForWallet } from "@/utils/walletLines.util";

import styles from "../page.module.css";

export default function WalletPayoutsPage() {
  const queryClient = useQueryClient();
  const summary = useQuery({ queryKey: ["wallet", "summary"], queryFn: () => walletsService.fetchMyWalletSummary() });
  const accounts = useQuery({ queryKey: ["wallet", "payout-accounts"], queryFn: () => walletsService.listMyPayoutAccounts() });
  const withdrawals = useQuery({ queryKey: ["wallet", "withdrawals"], queryFn: () => walletsService.listMyWithdrawals() });
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amountText, setAmountText] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { withStepUp, stepUpDialog } = useStepUpPrompt();
  const showMutationError = (mutationError: unknown) => {
    if (!(mutationError instanceof StepUpCancelledError)) setError(readErrorMessageForDisplay(mutationError));
  };

  const addAccount = useMutation({
    mutationFn: () => withStepUp((stepUpToken) => walletsService.addPayoutAccount({ bankCode: bankCode.trim(), accountNumber: accountNumber.trim() }, stepUpToken)),
    onSuccess: () => {
      setBankCode("");
      setAccountNumber("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["rail", "wallet"] });
      showToast({ text: "Payout account added. You can withdraw to it after 48 hours." });
    },
    onError: showMutationError,
  });
  const removeAccount = useMutation({
    mutationFn: (id: string) => walletsService.removePayoutAccount(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallet", "payout-accounts"] });
      showToast({ text: "Payout account removed" });
    },
    onError: (mutationError) => setError(readErrorMessageForDisplay(mutationError)),
  });
  const withdrawalAccountId = selectedAccountId ?? accounts.data?.[0]?.id ?? null;
  const withdrawalAmountMinor = parseMajorAmountToMinorUnits(amountText) ?? 0;
  const withdraw = useMutation({
    mutationFn: (payoutAccountId: string) => {
      const currency = summary.data?.available.currency ?? "NGN";
      const idempotencyKey = createIdempotencyKey("withdraw");
      return withStepUp((stepUpToken) => walletsService.requestWithdrawal({ payoutAccountId, amount: { amountMinor: withdrawalAmountMinor, currency } }, idempotencyKey, stepUpToken));
    },
    onSuccess: () => {
      setAmountText("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      showToast({ text: "Withdrawal requested" });
    },
    onError: showMutationError,
  });

  const verifyMessage = readVerifyToWithdrawMessage(summary.data);
  const verifyAction = verifyActionForWallet(summary.data, "#payout-accounts");
  const withdrawalsLocked = readWalletVerification(summary.data)?.withdrawalsUnlocked === false;

  if (accounts.isLoading) return <ListRowsSkeleton label="Loading payout accounts" rows={4} />;
  if (accounts.isError) return <ErrorState description="We couldn't load payout accounts." error={accounts.error} onRetry={() => void accounts.refetch()} />;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Payouts & withdraw</h1>
      {stepUpDialog}
      {verifyMessage ? <VerifyToWithdrawBanner message={verifyMessage} href={verifyAction.href} actionLabel={verifyAction.label} /> : null}
      <BvnConsentCard />
      <p className={styles.note}>Available to withdraw: {summary.data ? formatMoneyForDisplay(summary.data.available) : "…"}</p>
      <section id="payout-accounts" className={styles.section} aria-label="Payout accounts">
        <h2 className={styles.sectionTitle}>Payout accounts</h2>
        {(accounts.data ?? []).length === 0 ? (
          <EmptyState title="No payout accounts" description="Add a bank account to receive withdrawals." />
        ) : (
          <ul className={styles.list}>
            {(accounts.data ?? []).map((account) => (
              <li key={account.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{account.bankName}</span>
                  <span className={styles.rowMeta}>{account.accountName} · {account.accountNumberMasked}</span>
                </span>
                <button type="button" className={styles.linkButton} disabled={removeAccount.isPending} onClick={() => removeAccount.mutate(account.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            addAccount.mutate();
          }}
        >
          <label className={styles.field}>Bank code
            <input className={styles.input} value={bankCode} onChange={(event) => setBankCode(event.target.value)} placeholder="e.g. 058" inputMode="numeric" required />
          </label>
          <label className={styles.field}>Account number
            <input className={styles.input} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="10-digit account number" inputMode="numeric" required />
          </label>
          <button type="submit" className={styles.primary} disabled={addAccount.isPending}>{addAccount.isPending ? "Adding…" : "Add account"}</button>
        </form>
      </section>
      <section className={styles.section} aria-label="Withdraw">
        <h2 className={styles.sectionTitle}>Withdraw</h2>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!withdrawalAccountId) return setError("Add a payout account first.");
            if (!Number.isFinite(withdrawalAmountMinor) || withdrawalAmountMinor <= 0) return setError("Enter an amount such as 5000 or 5,000.50.");
            withdraw.mutate(withdrawalAccountId);
          }}
        >
          <label className={styles.field}>To account
            <select className={styles.select} value={selectedAccountId ?? accounts.data?.[0]?.id ?? ""} onChange={(event) => setSelectedAccountId(event.target.value || null)}>
              {(accounts.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>{account.bankName} · {account.accountNumberMasked}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>Amount
            <input className={styles.input} value={amountText} onChange={(event) => setAmountText(event.target.value)} placeholder="0.00" inputMode="decimal" required />
          </label>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {withdrawalsLocked ? <p className={styles.note}>Withdrawals open once your payout details are verified. Your balance stays in your wallet until then.</p> : null}
          <button type="submit" className={styles.primary} disabled={withdraw.isPending || withdrawalsLocked || (accounts.data ?? []).length === 0}>{withdraw.isPending ? "Requesting…" : "Request withdrawal"}</button>
        </form>
      </section>
      <section className={styles.section} aria-label="Withdrawal history">
        <h2 className={styles.sectionTitle}>Withdrawal history</h2>
        {(withdrawals.data ?? []).length === 0 ? (
          <p className={styles.note}>No withdrawals yet.</p>
        ) : (
          <ul className={styles.list}>
            {(withdrawals.data ?? []).map((entry) => (
              <li key={entry.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{formatMoneyForDisplay(entry.amount)}</span>
                  <span className={styles.rowMeta}>{new Date(entry.createdAt).toLocaleDateString()} · {entry.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
