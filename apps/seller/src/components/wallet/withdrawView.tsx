"use client";

import { useRef, useState, type FormEvent } from "react";

import { PayoutSetupBanner } from "@/components/payouts/payoutSetupBanner";
import { payoutStatusPresentation } from "@/components/wallet/walletPresentation.constant";
import { WalletTabs } from "@/components/wallet/walletTabs";
import { WithdrawConfirmationDialog } from "@/components/wallet/withdrawConfirmationDialog";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout, EmptyState, LoadingBlock } from "@/components/ui/feedback";
import { MoneyField, SelectField } from "@/components/ui/formFields";
import { PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { StepUpCancelledError, useStepUpPrompt } from "@/components/wallet/stepUpDialog";
import { stepUpHeaders } from "@/services/stepUp.service";
import { presentPaymentProblem } from "@/utils/paymentProblem.util";
import { createIdempotencyKey, readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { CursorPage } from "@/types/pagination.type";
import type { Payout, PayoutAccount, WalletBalances } from "@/types/wallet.type";
import type { PayoutFees, PayoutOnboardingState } from "@/types/payoutOnboarding.type";
import type { WalletPayoutSettings } from "@/types/walletExtra.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { convertMinorUnitsToMajorInputText } from "@/utils/money.util";

import styles from "./wallet.module.css";


export function WithdrawView() {
  const { can } = useSellerSession();
  const { formatMoney } = useMoneyFormatter();
  const { showToast } = useToast();
  const { withStepUp, stepUpDialog } = useStepUpPrompt();
  const balancesQuery = useSellerQuery<WalletBalances>("/seller/wallet/balances");
  const settingsQuery = useSellerQuery<WalletPayoutSettings>("/seller/wallet/payout-settings");
  const accountsQuery = useSellerQuery<CursorPage<PayoutAccount>>("/seller/wallet/payout-accounts");
  const onboardingQuery = useSellerQuery<PayoutOnboardingState>("/payments/payout-onboarding/me");
  const feesQuery = useSellerQuery<PayoutFees>("/payments/payout-fees");
  const payoutsQuery = useSellerQuery<CursorPage<Payout>>("/seller/wallet/payouts", { limit: 50 });
  const [amountText, setAmountText] = useState("");
  const [amountMinor, setAmountMinor] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ amount?: string; account?: string }>({});
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const balances = balancesQuery.data;
  const payoutSettings = settingsQuery.data;
  const accounts = accountsQuery.data?.data ?? [];
  const accountId = selectedAccountId || accounts.find((account) => account.isDefault)?.id || accounts[0]?.id || "";
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const canWithdraw = can("wallet:withdraw");
  const isPayoutLocked = !onboardingQuery.data?.withdrawalsEnabled;
  const publishedFee = feesQuery.data?.fee ?? null;

  if (!balances || !payoutSettings || !accountsQuery.data) {
    const errorMessage = balancesQuery.errorMessage ?? settingsQuery.errorMessage ?? accountsQuery.errorMessage;
    return (
      <PageStack>
        <PageHeader title="Withdraw & payouts" />
        <WalletTabs />
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : <LoadingBlock />}
      </PageStack>
    );
  }
  const feeToApply = publishedFee ?? payoutSettings.fee;
  const maximumWithdrawableMinor = Math.max(0, balances.available.amountMinor - feeToApply.amountMinor);

  function validateWithdrawalForm(minimumPayout: WalletPayoutSettings["minimumPayout"], currency: WalletBalances["available"]["currency"]): boolean {
    const errors: { amount?: string; account?: string } = {};
    if (amountMinor === null || amountMinor <= 0) errors.amount = "Enter how much to withdraw.";
    else if (amountMinor < minimumPayout.amountMinor) errors.amount = `The minimum payout is ${formatMoney(minimumPayout)}.`;
    else if (amountMinor > maximumWithdrawableMinor) errors.amount = `You can withdraw up to ${formatMoney({ amountMinor: maximumWithdrawableMinor, currency })} after the fee.`;
    if (!selectedAccount) errors.account = "Add a payout account first.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function openConfirmationStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payoutSettings || !balances || !validateWithdrawalForm(payoutSettings.minimumPayout, balances.available.currency)) return;
    idempotencyKeyRef.current = createIdempotencyKey("payout");
    setSubmitError(null);
    setIsConfirming(true);
  }

  async function submitConfirmedWithdrawal() {
    if (amountMinor === null || !selectedAccount || !idempotencyKeyRef.current) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const idempotencyKey = idempotencyKeyRef.current;
      const payout = await withStepUp((token) => sendSellerApiRequest<Payout>("/seller/wallet/payouts", { method: "POST", body: { amountMinor, accountId: selectedAccount.id }, idempotencyKey, headers: stepUpHeaders(token) }));
      showToast(`Withdrawal of ${formatMoney(payout.amount)} is on its way.`);
      setIsConfirming(false);
      setAmountText("");
      setAmountMinor(null);
      idempotencyKeyRef.current = null;
      balancesQuery.reload();
      payoutsQuery.reload();
    } catch (error) {
      if (error instanceof StepUpCancelledError) return;
      if (await presentPaymentProblem(error)) setIsConfirming(false);
      else setSubmitError(readErrorMessageForDisplay(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageStack>
      {stepUpDialog}
      <PageHeader title="Withdraw & payouts" description={payoutSettings.schedule} actions={<ButtonLink href="/settings/payouts">Payout preferences</ButtonLink>} />
      <WalletTabs />
      {isPayoutLocked ? <PayoutSetupBanner /> : null}
      {!canWithdraw ? <Callout tone="info" title="Only the store owner can withdraw">You can see payouts here, but moving money out needs the owner.</Callout> : null}
      {canWithdraw && accounts.length === 0 ? (
        <Panel>
          <EmptyState iconName="creditCard24" title="Add a payout account first" description="Payouts go to a bank account in your business or owner's name." action={<ButtonLink href="/wallet/accounts" variant="primary">Add payout account</ButtonLink>} />
        </Panel>
      ) : null}
      {canWithdraw && accounts.length > 0 ? (
        <Panel title="Withdraw to your bank" description={`Available: ${formatMoney(balances.available)} · fee ${formatMoney(feeToApply)} flat · minimum ${formatMoney(payoutSettings.minimumPayout)}${feesQuery.data ? ` · ${feesQuery.data.arrivalEstimate}` : ""}`}>
          <form onSubmit={openConfirmationStep} noValidate>
            <div className={styles.formGrid}>
              <MoneyField label="Amount" currency={balances.available.currency} valueText={amountText} onValueTextChange={setAmountText} onMinorAmountChange={setAmountMinor} errorMessage={fieldErrors.amount} hint={`Up to ${formatMoney({ amountMinor: maximumWithdrawableMinor, currency: balances.available.currency })}`} />
              <SelectField label="Payout account" value={accountId} onChange={(event) => setSelectedAccountId(event.target.value)} errorMessage={fieldErrors.account} options={accounts.map((account) => ({ value: account.id, label: `${account.bankName} ${account.accountNumberMasked}${account.isDefault ? " (default)" : ""}` }))} />
            </div>
            <div className={styles.formActions}>
              <Button onClick={() => { setAmountText(convertMinorUnitsToMajorInputText(maximumWithdrawableMinor, balances.available.currency)); setAmountMinor(maximumWithdrawableMinor); }} disabled={isPayoutLocked || maximumWithdrawableMinor < payoutSettings.minimumPayout.amountMinor}>
                Withdraw everything
              </Button>
              {isPayoutLocked ? (
                <ButtonLink href="/settings/payouts" variant="primary">Finish payout setup</ButtonLink>
              ) : (
                <Button type="submit" variant="primary">
                  Continue
                </Button>
              )}
            </div>
          </form>
        </Panel>
      ) : null}
      {isConfirming && selectedAccount && amountMinor !== null ? (
        <WithdrawConfirmationDialog isOpen amount={{ amountMinor, currency: balances.available.currency }} fee={feeToApply} account={selectedAccount} isSubmitting={isSubmitting} errorMessage={submitError} onCancel={() => setIsConfirming(false)} onConfirm={() => void submitConfirmedWithdrawal()} />
      ) : null}
      <Panel padded={false} title="Payout history">
        <DataTable
          caption="Payout history"
          rows={payoutsQuery.data?.data ?? null}
          readRowKey={(payout) => payout.id}
          isLoading={payoutsQuery.isLoading}
          emptyState="No payouts yet."
          columns={[
            { key: "requested", header: "Requested", render: (payout) => formatDateTimeForDisplay(payout.requestedAt) },
            { key: "account", header: "To", render: (payout) => payout.accountSummary },
            { key: "reference", header: "Reference", hideBelowTablet: true, render: (payout) => <span className={styles.muted}>{payout.reference}</span> },
            { key: "status", header: "Status", render: (payout) => <StatusBadge tone={payoutStatusPresentation[payout.status].tone}>{payoutStatusPresentation[payout.status].label}</StatusBadge> },
            { key: "fee", header: "Fee", align: "end", hideBelowTablet: true, render: (payout) => formatMoney(payout.fee) },
            { key: "amount", header: "Amount", align: "end", render: (payout) => formatMoney(payout.amount) },
          ]}
        />
      </Panel>
    </PageStack>
  );
}
