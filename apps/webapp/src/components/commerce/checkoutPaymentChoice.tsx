"use client";

import Link from "next/link";

import { describePaymentPartner, walletSpendableMinor } from "@/services/providerWallet.service";
import type { PaymentChannel } from "@/types/commerce.type";
import type { Money } from "@/types/money.type";
import type { ProviderWalletResponse } from "@/types/providerWallet.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "@/app/(app)/checkout/page.module.css";

export type CheckoutPaymentSource = "hosted" | "wallet";

const channelLabels: Record<PaymentChannel, { readonly name: string; readonly note: string }> = {
  card: { name: "Card", note: "Debit or credit card" },
  bank: { name: "Bank account", note: "Pay directly from your bank account" },
  bank_transfer: { name: "Bank transfer", note: "Pay from your bank app" },
  ussd: { name: "USSD", note: "Pay with a code from your phone" },
};

interface CheckoutPaymentChoiceProps {
  readonly channels: readonly PaymentChannel[];
  readonly wallet: ProviderWalletResponse | null | undefined;
  readonly total: Money | null;
  readonly source: CheckoutPaymentSource;
  readonly onChoose: (source: CheckoutPaymentSource) => void;
}

export function canPayFromWallet(wallet: ProviderWalletResponse | null | undefined, total: Money | null): boolean {
  if (!wallet || !total || wallet.balances.currency !== total.currency) return false;
  return walletSpendableMinor(wallet) >= total.amountMinor && total.amountMinor > 0;
}

export function CheckoutPaymentChoice({ channels, wallet, total, source, onChoose }: CheckoutPaymentChoiceProps) {
  const walletUsable = canPayFromWallet(wallet, total);
  const spendable = wallet ? { amountMinor: walletSpendableMinor(wallet), currency: wallet.balances.currency as Money["currency"] } : null;
  const row = (active: boolean) => [styles.optionRow, active ? styles.optionRowActive : ""].filter(Boolean).join(" ");
  return (
    <>
      <ul className={styles.optionList}>
        {wallet ? (
          <li>
            <button type="button" className={row(source === "wallet")} aria-pressed={source === "wallet"} disabled={!walletUsable} onClick={() => onChoose("wallet")}>
              <span className={styles.optionText}>
                <span className={styles.optionName}>Pay from your wallet</span>
                <span className={styles.optionMeta}>
                  {spendable ? `${formatMoneyForDisplay(spendable)} available` : ""}
                  {walletUsable ? "" : " · not enough for this order"}
                </span>
              </span>
              {walletUsable ? <span className={styles.tag}>No card needed</span> : null}
            </button>
          </li>
        ) : null}
        <li>
          <button type="button" className={row(source === "hosted")} aria-pressed={source === "hosted"} onClick={() => onChoose("hosted")}>
            <span className={styles.optionText}>
              <span className={styles.optionName}>Card or bank transfer</span>
              <span className={styles.optionMeta}>
                {channels.filter((channel) => channel in channelLabels).map((channel) => channelLabels[channel].name).join(" · ") || "Choose how to pay on the secure payment page"}
              </span>
            </span>
          </button>
        </li>
      </ul>
      {wallet && !walletUsable ? (
        <p className={styles.optionMeta}>
          <Link href="/wallet">Add money to your wallet</Link> to pay without a card.
        </p>
      ) : null}
      <p className={styles.optionMeta}>{describePaymentPartner(wallet?.wallet.provider)} We never see your card details.</p>
    </>
  );
}
