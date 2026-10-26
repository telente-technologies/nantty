"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { createIdempotencyKey, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { describePaymentPartner, providerWalletQueryKeys, providerWalletService } from "@/services/providerWallet.service";
import type { ProviderWallet } from "@/types/providerWallet.type";
import { presentPaymentProblem } from "@/utils/paymentProblem.util";

import styles from "./walletAccountCard.module.css";
import { describeWalletDailyLimit } from "@/utils/walletLimits.util";

export const walletDepositNotes = [
  "Transfer from any Nigerian bank app to this account. It usually arrives within a few minutes.",
  "You can spend it on Nantty straight away. It can be withdrawn 24 hours after it arrives (72 hours for your first deposit).",
  "Any deposit fee is shown on your receipt. Your bank may also charge for the transfer.",
  "Daily wallet payment limits: ₦50,000 once your payout details are verified, ₦200,000 after identity verification, and ₦5,000,000 for verified businesses.",
] as const;

export function walletAccountShareText(wallet: ProviderWallet): string {
  return `Send money to my Nantty wallet\nBank: ${wallet.bankName}\nAccount number: ${wallet.accountNumber}\nAccount name: ${wallet.accountName}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function AccountDetails({ wallet }: { readonly wallet: ProviderWallet }) {
  const [status, setStatus] = useState<string | null>(null);
  const share = async () => {
    const text = walletAccountShareText(wallet);
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Nantty wallet", text });
        return;
      }
    } catch {
      return;
    }
    setStatus((await copyText(text)) ? "Account details copied. Paste them anywhere to share." : "Couldn't copy. Select the details above instead.");
  };
  const copyNumber = async () => setStatus((await copyText(wallet.accountNumber)) ? "Account number copied." : "Couldn't copy. Select the number instead.");
  return (
    <>
      <dl className={styles.details}>
        <dt>Bank</dt>
        <dd>{wallet.bankName}</dd>
        <dt>Account number</dt>
        <dd className={styles.number}>{wallet.accountNumber}</dd>
        <dt>Account name</dt>
        <dd>{wallet.accountName}</dd>
        {wallet.fundingNumbers.filter((number) => number.accountNumber !== wallet.accountNumber).map((number) => (
          <FundingNumberRow key={number.accountNumber} bankName={number.bankName} accountNumber={number.accountNumber} />
        ))}
      </dl>
      <div className={styles.actions}>
        <Button onClick={copyNumber}>Copy account number</Button>
        <Button variant="secondary" onClick={share}>Share details</Button>
      </div>
      {status ? <p className={styles.status} role="status">{status}</p> : null}
    </>
  );
}

function FundingNumberRow({ bankName, accountNumber }: { readonly bankName: string; readonly accountNumber: string }) {
  return (
    <>
      <dt>Also works</dt>
      <dd>{bankName} · {accountNumber}</dd>
    </>
  );
}

export function WalletAccountCard({ showNotes = true }: { readonly showNotes?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activationKey = useRef(createIdempotencyKey("wallet-activate"));
  const walletQuery = useQuery({ queryKey: providerWalletQueryKeys.wallet, queryFn: providerWalletService.fetchMyWallet, retry: false });
  const levelQuery = useQuery({ queryKey: providerWalletQueryKeys.verification, queryFn: providerWalletService.fetchMyVerificationLevel, retry: false });
  const activate = useMutation({
    mutationFn: () => providerWalletService.activateMyWallet(activationKey.current),
    onSuccess: (created) => queryClient.setQueryData(providerWalletQueryKeys.wallet, created),
    onError: (error) => void presentPaymentProblem(error, (href) => router.push(href)),
  });

  if (walletQuery.isLoading || levelQuery.isLoading) return <Skeleton height={180} />;
  const country = levelQuery.data?.country ?? "NG";
  if (country !== "NG") {
    return (
      <section className={styles.card} aria-label="How you pay">
        <h2 className={styles.title}>Paying outside Nigeria</h2>
        <p className={styles.note}>
          You pay at checkout by card, bank or mobile money, directly to the seller. Nantty doesn&apos;t keep a balance for you, and there&apos;s no escrow outside Nigeria; our dispute process still applies.
        </p>
      </section>
    );
  }
  if (walletQuery.isError) return <p className={styles.note}>{readErrorMessageForDisplay(walletQuery.error)}</p>;
  const wallet = walletQuery.data?.wallet;
  const verified = (levelQuery.data?.level ?? 0) >= 1;
  return (
    <section className={styles.card} aria-label="Add money">
      <h2 className={styles.title}>Add money</h2>
      {wallet ? (
        <>
          <p className={styles.note}>This account is your own wallet, held in your name by our licensed payment partner. Nantty never holds your money.</p>
          {wallet.status !== "active" ? <p className={styles.status} role="alert">Your wallet is on hold while we check it. Deposits still arrive; contact support if this lasts.</p> : null}
          <AccountDetails wallet={wallet} />
        </>
      ) : verified ? (
        <>
          <p className={styles.note}>Your details are verified. Create your wallet account number to add money by bank transfer.</p>
          <div className={styles.actions}>
            <Button busy={activate.isPending} onClick={() => activate.mutate()}>Get my account number</Button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.note}>Finish payout verification to get your own account number. Until then you can still pay by card or bank transfer at checkout.</p>
          <div className={styles.actions}>
            <Link href="/wallet/payouts">Finish verification</Link>
          </div>
        </>
      )}
      {showNotes ? (
        <ul className={styles.notes}>
          {walletDepositNotes.slice(0, -1).map((note) => <li key={note}>{note}</li>)}
          <li>{describeWalletDailyLimit(walletQuery.data?.limits) ?? walletDepositNotes[walletDepositNotes.length - 1]}</li>
          <li>{describePaymentPartner(wallet?.provider)}</li>
        </ul>
      ) : null}
    </section>
  );
}
