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
  const [branchCode, setBranchCode] = useState("");
  const [countryCode, setCountryCode] = useState("NG");
  const [accountNumber, setAccountNumber] = useState("");
  const [amountText, setAmountText] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const banks = useQuery({ queryKey: ["banks", countryCode], queryFn: () => walletsService.listPayoutBanks(countryCode), enabled: countryCode === "NG" || countryCode === "GH" });
  const branches = useQuery({ queryKey: ["banks", countryCode, bankCode, "branches"], queryFn: () => walletsService.listBankBranches(countryCode, bankCode), enabled: /^[A-Z]{2}$/.test(countryCode) && bankCode.trim().length > 0 });
  const { withStepUp, stepUpDialog } = useStepUpPrompt();
  const showMutationError = (mutationError: unknown) => {
    if (!(mutationError instanceof StepUpCancelledError)) setError(readErrorMessageForDisplay(mutationError));
  };

  const addAccount = useMutation({
    mutationFn: () => withStepUp((stepUpToken) => walletsService.addPayoutAccount({ bankCode: bankCode.trim(), branchCode: branchCode || undefined, countryCode, accountNumber: accountNumber.trim() }, stepUpToken)),
    onSuccess: () => {
      setBankCode("");
      setBranchCode("");
      setAccountNumber("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["rail", "wallet"] });
      showToast({ text: "Payout account added. You can withdraw to it after 48 hours." });
    },
    onError: showMutationError,
  });
  const removeAccount = useMutation({
    mutationFn: (id: string) => withStepUp((stepUpToken) => walletsService.removePayoutAccount(id, stepUpToken)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallet", "payout-accounts"] });
      showToast({ text: "Payout account removed" });
    },
    onError: showMutationError,
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
  const cancelWithdrawal = useMutation({
    mutationFn: (withdrawalId: string) => walletsService.cancelWithdrawal(withdrawalId, createIdempotencyKey("withdrawal_cancel")),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      showToast({ text: "Withdrawal cancelled; the reserved amount has been returned to your wallet." });
    },
    onError: showMutationError,
  });

  const selectedBankExists = (banks.data ?? []).some((bank) => bank.code === bankCode);

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
            if ((countryCode !== "NG" && countryCode !== "GH") || banks.isLoading || banks.isError || !selectedBankExists) {
              setError("Choose a bank from the current list for a supported payout country.");
              return;
            }
            if (branches.isLoading || branches.isError || branches.data === undefined) {
              setError("Wait for the bank branch check to finish, then try again.");
              return;
            }
            if (branches.data.length > 0 && !branchCode) {
              setError("Choose a bank branch before adding this account.");
              return;
            }
            addAccount.mutate();
          }}
        >
          <label className={styles.field}>Bank country
            <select className={styles.select} value={countryCode} onChange={(event) => { setCountryCode(event.target.value); setBankCode(""); setBranchCode(""); }} required>
              <option value="NG">Nigeria</option>
              <option value="GH">Ghana</option>
            </select>
          </label>
          <label className={styles.field}>Bank
            <select className={styles.select} value={bankCode} onChange={(event) => { setBankCode(event.target.value); setBranchCode(""); }} disabled={banks.isLoading || banks.isError} required>
              <option value="">{banks.isLoading ? "Loading banks…" : "Choose a bank"}</option>
              {(banks.data ?? []).map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
            </select>
          </label>
          {banks.isError ? <p className={styles.error} role="alert">We couldn’t load the bank list. <button type="button" className={styles.linkButton} onClick={() => void banks.refetch()}>Try again</button>.</p> : null}
          {branches.isLoading ? <p className={styles.note}>Checking bank branch requirements…</p> : null}
          {branches.isError ? <p className={styles.error} role="alert">We couldn’t load branch requirements. <button type="button" className={styles.linkButton} onClick={() => void branches.refetch()}>Try again</button> before adding this account.</p> : null}
          {(branches.data ?? []).length > 0 ? (
            <label className={styles.field}>Bank branch
              <select className={styles.select} value={branchCode} onChange={(event) => setBranchCode(event.target.value)} required>
                <option value="">Choose a branch</option>
                {(branches.data ?? []).map((branch) => <option key={branch.code} value={branch.code}>{branch.name} · {branch.code}</option>)}
              </select>
            </label>
          ) : null}
          <label className={styles.field}>Account number
            <input className={styles.input} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="10-digit account number" inputMode="numeric" required />
          </label>
          <button type="submit" className={styles.primary} disabled={addAccount.isPending || banks.isLoading || banks.isError || !selectedBankExists || branches.isLoading || branches.isError || branches.data === undefined || (branches.data.length > 0 && !branchCode)}>{addAccount.isPending ? "Adding…" : "Add account"}</button>
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
                  {entry.failureReason ? <span className={styles.error} role="status">This payout needs attention and may not have been sent. Review the payout account or contact support.</span> : null}
                </span>
                {entry.failureReason && entry.withdrawalStatus === "queued" ? <button type="button" className={styles.linkButton} disabled={cancelWithdrawal.isPending} onClick={() => cancelWithdrawal.mutate(entry.id)}>Cancel withdrawal</button> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
