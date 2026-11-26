"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { PeoplePicker, togglePerson } from "@/components/messages/peoplePicker";
import { Button } from "@/components/ui/button";
import { createIdempotencyKey, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { coinsService } from "@/services/webActions.service";
import type { UserSummary } from "@/types";

import styles from "./coinTransferForm.module.css";

const balanceKey = ["coins", "balance"] as const;
const activityKey = ["coins", "activity"] as const;

function isFeeChanged(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "COIN_TRANSFER_FEE_CHANGED";
}

export function CoinTransferForm() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<UserSummary[]>([]);
  const [amountInput, setAmountInput] = useState("");
  const [feeChanged, setFeeChanged] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const coins = Number(amountInput);
  const validAmount = Number.isSafeInteger(coins) && coins > 0 && coins <= 100_000_000;
  const quote = useQuery({
    queryKey: ["coin-transfer-quote", coins],
    queryFn: () => coinsService.fetchCoinTransferQuote(coins),
    enabled: selected.length === 1 && validAmount,
    retry: false,
  });
  const transfer = useMutation({
    mutationFn: () => {
      const recipient = selected[0];
      if (!recipient || !quote.data) throw new Error("Choose a recipient and refresh the transfer quote.");
      idempotencyKey.current ??= createIdempotencyKey("coin-transfer");
      return coinsService.transferCoins(recipient.id, coins, quote.data.feeBasisPoints, idempotencyKey.current);
    },
    onSuccess: (receipt) => {
      idempotencyKey.current = null;
      setFeeChanged(false);
      queryClient.setQueryData(balanceKey, { coins: receipt.balance });
      void queryClient.invalidateQueries({ queryKey: activityKey });
    },
    onError: (error) => {
      if (isFeeChanged(error)) {
        idempotencyKey.current = null;
        setFeeChanged(true);
        void queryClient.invalidateQueries({ queryKey: ["coin-transfer-quote", coins] });
      }
    },
  });
  const onToggle = (person: UserSummary) => {
    setSelected((current) => togglePerson(current, person).slice(-1));
    setFeeChanged(false);
    idempotencyKey.current = null;
    transfer.reset();
  };
  const onAmountChange = (value: string) => {
    setAmountInput(value);
    setFeeChanged(false);
    idempotencyKey.current = null;
    transfer.reset();
  };

  return (
    <section className={styles.section} aria-labelledby="coin-transfer-heading">
      <h2 id="coin-transfer-heading" className={styles.heading}>Send coins to a person</h2>
      <p className={styles.note}>Choose a Nantty user, enter an amount, and review the live fee quote before confirming.</p>
      <PeoplePicker selected={selected} onToggle={onToggle} maximum={1} />
      <label className={styles.field}>
        <span>Coins to send</span>
        <input className={styles.input} type="number" min={1} max={100_000_000} step={1} inputMode="numeric" value={amountInput} onChange={(event) => onAmountChange(event.target.value)} />
      </label>
      {quote.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(quote.error)}</p> : null}
      {quote.data ? (
        <dl className={styles.quote} aria-label="Transfer quote">
          <div><dt>You send</dt><dd>{quote.data.coins.toLocaleString()} coins</dd></div>
          <div><dt>Transfer fee ({quote.data.feePercent.toFixed(2)}%)</dt><dd>{quote.data.feeCoins.toLocaleString()} coins</dd></div>
          <div><dt>Recipient receives</dt><dd>{quote.data.netCoins.toLocaleString()} coins</dd></div>
        </dl>
      ) : null}
      {feeChanged ? <p className={styles.notice} role="status">The fee changed. Review the refreshed quote before confirming again.</p> : null}
      {transfer.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(transfer.error)}</p> : null}
      {transfer.data ? (
        <p className={styles.success} role="status">Sent {transfer.data.coins.toLocaleString()} coins to @{selected[0]?.username}. They receive {transfer.data.netCoins.toLocaleString()} coins; your new balance is {transfer.data.balance.toLocaleString()} coins.</p>
      ) : null}
      <p className={styles.note}>Review the amount and recipient carefully. Coin transfers are recorded immediately.</p>
      <Button onClick={() => transfer.mutate()} busy={transfer.isPending} disabled={selected.length !== 1 || !validAmount || !quote.data || quote.isFetching || transfer.isSuccess}>
        Confirm transfer
      </Button>
    </section>
  );
}
