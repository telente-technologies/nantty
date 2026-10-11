"use client";

import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import type { WalletBalances } from "@/types/wallet.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";

import styles from "./wallet.module.css";

export function WalletBalanceCards({ balances }: { readonly balances: WalletBalances }) {
  const { formatMoney } = useMoneyFormatter();
  return (
    <div className={styles.balanceGrid}>
      <section className={styles.balanceCard} aria-label="Escrow balance">
        <p className={styles.balanceLabel}>In escrow</p>
        <p className={styles.balanceAmount}>{formatMoney(balances.escrow)}</p>
        <p className={styles.balanceExplanation}>
          Buyers paid for these app orders. The money stays locked in the buyer's own wallet, held by our licensed payment partner, until they confirm delivery
          {balances.nextEscrowReleaseAt ? `; the next release is due ${formatDateTimeForDisplay(balances.nextEscrowReleaseAt)}` : ""}.
        </p>
      </section>
      <section className={styles.balanceCard} aria-label="Pending balance">
        <p className={styles.balanceLabel}>Pending settlement</p>
        <p className={styles.balanceAmount}>{formatMoney(balances.pending)}</p>
        <p className={styles.balanceExplanation}>Released from escrow and clearing before you can withdraw it.</p>
      </section>
      <section className={`${styles.balanceCard} ${styles.balanceCardAvailable}`} aria-label="Available balance">
        <p className={styles.balanceLabel}>Available</p>
        <p className={styles.balanceAmount}>{formatMoney(balances.available)}</p>
        <p className={styles.balanceExplanation}>Yours to withdraw to a payout account now.</p>
      </section>
    </div>
  );
}
