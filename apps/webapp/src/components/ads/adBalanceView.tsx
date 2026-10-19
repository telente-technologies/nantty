"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { useStepUpPrompt } from "@/components/wallet/stepUpDialog";
import { adsHubService } from "@/services/adsHub.service";
import { createIdempotencyKey, readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import type { AdBalance } from "@/types/adsHub.type";
import type { Money } from "@/types/money.type";
import {
  adCreditSourceLabel, adTransactionKindLabel, adTransactionPotLabel, createIdempotencyKeyHolder, describeCreditLotExpiry, formatMinorAsMajorInput, parseMajorAmountToMinor,
} from "@/utils/adsHub.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { openHostedCheckout } from "@/utils/hostedCheckout.util";

import { AdsManagerOptionalLink, formatAdDate } from "./adsHubParts";
import styles from "./adsHub.module.css";

const VERIFY_PAYOUTS_HREF = "/wallet/payouts#payout-accounts";
const format = (money: Money) => formatMoneyForDisplay(money);
const errorText = (error: unknown) => {
  const code = error instanceof WebappRequestError ? error.code : null;
  if (code === "WITHDRAWAL_ABOVE_AVAILABLE") return "That's more than you can withdraw right now.";
  return readErrorMessageForDisplay(error);
};

export function AdBalanceView() {
  const balance = useQuery({ queryKey: ["ads", "balance"], queryFn: () => adsHubService.fetchAdBalance() });
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  if (balance.isLoading) return <ListRowsSkeleton label="Loading your ad balance" rows={4} />;
  if (balance.isError || !balance.data) return <ErrorState description="We couldn't load your ad balance." error={balance.error} onRetry={() => void balance.refetch()} />;
  const data = balance.data;
  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Ad credit and balance</h1>
        <Link className={styles.quietLink} href="/ads">Ads</Link>
      </div>
      <div className={styles.grid}>
        <div className={styles.metric}>
          <span className={styles.label}>Ad balance (withdrawable)</span>
          <span className={styles.metricValue}>{format(data.balance)}</span>
          <span className={styles.rowMeta}>Withdrawable now: {format(data.withdrawable)}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>Ad credit (ads only)</span>
          <span className={styles.metricValue}>{format(data.credit)}</span>
          <span className={styles.rowMeta}>Used first when you pay for ads</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.label}>You can spend on ads</span>
          <span className={styles.metricValue}>{format(data.spendable)}</span>
          {data.committed.amountMinor > 0 ? <span className={styles.rowMeta}>{format(data.committed)} reserved by running ads</span> : null}
        </div>
      </div>
      <p className={styles.note}>Ad credit can only be spent on ads. It can&apos;t be withdrawn.</p>
      {data.pendingSettlement.amountMinor > 0 ? <p className={styles.note}>{format(data.pendingSettlement)} from recent top-ups can be withdrawn 24 hours after it arrives.</p> : null}
      {data.cashback.enabled ? <p className={styles.note}>You get {data.cashback.percent}% of your ad spend back as ad credit.</p> : null}
      <div className={styles.actions}>
        <Button size="sm" disabled={!data.topUp.available} onClick={() => setTopUpOpen(true)}>Top up</Button>
        <Button size="sm" variant="secondary" disabled={!data.withdrawal.available} onClick={() => setWithdrawOpen(true)}>Withdraw</Button>
      </div>
      {!data.topUp.available && data.topUp.reason ? <AvailabilityNote reason={data.topUp.reason} reasonCode={data.topUp.reasonCode} /> : null}
      {!data.withdrawal.available && data.withdrawal.reason ? <AvailabilityNote reason={data.withdrawal.reason} reasonCode={data.withdrawal.reasonCode} /> : null}
      {data.creditLots.length > 0 ? (
        <section className={styles.section} aria-label="Ad credit">
          <h2 className={styles.sectionTitle}>Ad credit</h2>
          <ul className={styles.list}>
            {data.creditLots.map((lot) => (
              <li key={lot.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{adCreditSourceLabel(lot.source)}</span>
                  <span className={styles.rowMeta}>{describeCreditLotExpiry(lot, format, (iso) => formatAdDate(iso))}{lot.reason ? ` · ${lot.reason}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <AdBalanceHistory />
      <AdsManagerOptionalLink />
      {topUpOpen ? <TopUpDialog balance={data} onClose={() => setTopUpOpen(false)} /> : null}
      {withdrawOpen ? <WithdrawDialog balance={data} onClose={() => setWithdrawOpen(false)} /> : null}
    </div>
  );
}

function AvailabilityNote({ reason, reasonCode }: { readonly reason: string; readonly reasonCode: string | null }) {
  return (
    <p className={styles.note}>
      {reason} {reasonCode === "VERIFICATION_REQUIRED" ? <Link href={VERIFY_PAYOUTS_HREF}>Verify payouts</Link> : null}
    </p>
  );
}

function AdBalanceHistory() {
  const history = useInfiniteQuery({
    queryKey: ["ads", "balance", "transactions"],
    queryFn: ({ pageParam }) => adsHubService.listAdBalanceTransactions(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = history.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <section className={styles.section} aria-label="History">
      <h2 className={styles.sectionTitle}>History</h2>
      {history.isLoading ? <ListRowsSkeleton label="Loading history" rows={3} /> : null}
      {history.isError ? <ErrorState description="We couldn't load your history." error={history.error} onRetry={() => void history.refetch()} /> : null}
      {history.isSuccess && items.length === 0 ? <p className={styles.note}>Nothing here yet.</p> : null}
      {items.length > 0 ? (
        <ul className={styles.list}>
          {items.map((entry) => (
            <li key={entry.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{adTransactionKindLabel(entry.kind)}</span>
                <span className={styles.rowMeta}>{adTransactionPotLabel(entry.pot)} · {formatAdDate(entry.createdAt)}{entry.description ? ` · ${entry.description}` : ""}</span>
              </span>
              <span className={[styles.amount, entry.amount.amountMinor > 0 ? styles.amountCredit : ""].filter(Boolean).join(" ")}>{entry.amount.amountMinor > 0 ? "+" : ""}{format(entry.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {history.hasNextPage ? <button type="button" className={styles.linkButton} disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>{history.isFetchingNextPage ? "Loading…" : "Load more"}</button> : null}
    </section>
  );
}

function TopUpDialog({ balance, onClose }: { readonly balance: AdBalance; readonly onClose: () => void }) {
  const { minimum, maximum, suggested } = balance.topUp;
  const [amountText, setAmountText] = useState(formatMinorAsMajorInput(suggested[0] ?? minimum));
  const [error, setError] = useState<string | null>(null);
  const keyHolder = useRef(createIdempotencyKeyHolder(() => createIdempotencyKey("ad-topup")));
  const minor = parseMajorAmountToMinor(amountText);
  const amount: Money | null = minor === null ? null : { amountMinor: minor, currency: minimum.currency };
  const rangeIssue = !amount ? "Enter an amount." : amount.amountMinor < minimum.amountMinor ? `The minimum is ${format(minimum)}.` : amount.amountMinor > maximum.amountMinor ? `The maximum is ${format(maximum)}.` : null;
  const start = useMutation({
    mutationFn: () => adsHubService.startAdBalanceTopUp(amount!, keyHolder.current.keyFor(amount)),
    onSuccess: (checkout) => {
      if (openHostedCheckout({ checkoutUrl: checkout.checkoutUrl, reference: checkout.reference }) === "blocked") setError("We couldn't open the secure payment page. Please try again.");
    },
    onError: (mutationError) => setError(errorText(mutationError)),
  });
  return (
    <ModalDialog isOpen title="Top up ad balance" description="Pay by card or bank transfer in a secure payment window." onClose={onClose} intent="money" busy={start.isPending} errorMessage={error}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={Boolean(rangeIssue)} busy={start.isPending} onClick={() => { setError(null); start.mutate(); }}>{amount && !rangeIssue ? `Pay ${format(amount)}` : "Pay"}</Button></>}>
      <div className={styles.dialogBody}>
        <label className={styles.field}>
          Amount ({minimum.currency})
          <input className={styles.input} inputMode="decimal" value={amountText} onChange={(event) => setAmountText(event.target.value)} aria-invalid={Boolean(rangeIssue) || undefined} />
        </label>
        <div className={styles.chips} role="group" aria-label="Suggested amounts">
          {suggested.map((money) => <button key={money.amountMinor} type="button" className={[styles.chip, amount?.amountMinor === money.amountMinor ? styles.chipActive : ""].filter(Boolean).join(" ")} aria-pressed={amount?.amountMinor === money.amountMinor} onClick={() => setAmountText(formatMinorAsMajorInput(money))}>{formatMoneyForDisplay(money, { showDecimals: false })}</button>)}
        </div>
        <p className={rangeIssue ? styles.error : styles.note}>{rangeIssue ?? "Top-ups go into your ad balance, which you can withdraw 24 hours after it arrives."}</p>
      </div>
    </ModalDialog>
  );
}

function WithdrawDialog({ balance, onClose }: { readonly balance: AdBalance; readonly onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amountText, setAmountText] = useState(formatMinorAsMajorInput(balance.withdrawable));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const keyHolder = useRef(createIdempotencyKeyHolder(() => createIdempotencyKey("ad-withdraw")));
  const { withStepUpIfRequired, stepUpDialog } = useStepUpPrompt();
  const minor = parseMajorAmountToMinor(amountText);
  const amount: Money | null = minor === null || minor <= 0 ? null : { amountMinor: minor, currency: balance.withdrawable.currency };
  const rangeIssue = !amount ? "Enter an amount." : amount.amountMinor > balance.withdrawable.amountMinor ? `You can withdraw up to ${format(balance.withdrawable)}.` : amount.amountMinor < balance.withdrawal.minimum.amountMinor ? `The minimum is ${format(balance.withdrawal.minimum)}.` : null;
  const quote = useQuery({ queryKey: ["ads", "balance", "withdrawalQuote", amount], queryFn: () => adsHubService.quoteAdBalanceWithdrawal(amount!), enabled: Boolean(amount) && !rangeIssue, retry: false });
  const withdraw = useMutation({
    mutationFn: () => {
      const key = keyHolder.current.keyFor(amount);
      return withStepUpIfRequired((stepUpToken) => adsHubService.withdrawAdBalance(amount!, key, stepUpToken));
    },
    onSuccess: (withdrawal) => {
      setDone(`${format(withdrawal.net)} is on its way to your Zudomart wallet.`);
      keyHolder.current.reset();
      void queryClient.invalidateQueries({ queryKey: ["ads", "balance"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (mutationError) => setError(errorText(mutationError)),
  });
  return (
    <>
    {stepUpDialog}
    <ModalDialog isOpen title="Withdraw ad balance" description="Money goes to your Zudomart wallet. Ad credit can't be withdrawn." onClose={onClose} intent="money" busy={withdraw.isPending} errorMessage={error}
      footer={done ? <Button onClick={onClose}>Done</Button> : <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={Boolean(rangeIssue) || !quote.data || quote.isFetching} busy={withdraw.isPending} onClick={() => { setError(null); withdraw.mutate(); }}>{quote.data ? `Withdraw ${format(quote.data.net)}` : "Withdraw"}</Button></>}>
      <div className={styles.dialogBody}>
        {done ? <p className={styles.note} role="status">{done}</p> : (
          <>
            <label className={styles.field}>
              Amount ({balance.withdrawable.currency})
              <input className={styles.input} inputMode="decimal" value={amountText} onChange={(event) => setAmountText(event.target.value)} aria-invalid={Boolean(rangeIssue) || undefined} />
            </label>
            <p className={rangeIssue ? styles.error : styles.note}>{rangeIssue ?? `Withdrawable now: ${format(balance.withdrawable)}`}</p>
            {quote.isError ? <p className={styles.error} role="alert">{errorText(quote.error)}</p> : null}
            {quote.data ? (
              <div className={styles.card} aria-live="polite">
                <span className={styles.cardRow}><span className={styles.label}>Amount</span><span>{format(quote.data.amount)}</span></span>
                <span className={styles.cardRow}><span className={styles.label}>Payment provider fee</span><span>{format(quote.data.fee)}</span></span>
                <span className={styles.cardRow}><span className={styles.label}>You receive in your wallet</span><span className={styles.amount}>{format(quote.data.net)}</span></span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </ModalDialog>
    </>
  );
}
