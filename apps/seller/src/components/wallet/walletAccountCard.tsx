"use client";

import { useEffect, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { MyProviderWallet, MyVerificationLevel } from "@/types/providerWallet.type";

type CardState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly wallet: MyProviderWallet }
  | { readonly kind: "notReady"; readonly country: string | null }
  | { readonly kind: "error"; readonly message: string };

async function loadWalletAccount(): Promise<CardState> {
  try {
    return { kind: "ready", wallet: await sendSellerApiRequest<MyProviderWallet>("/payments/wallet/me") };
  } catch (error) {
    if (!(error instanceof SellerApiRequestError) || error.code !== "WALLET_NOT_READY") return { kind: "error", message: readErrorMessageForDisplay(error) };
    const level = await sendSellerApiRequest<MyVerificationLevel>("/payments/verification/me").catch(() => null);
    return { kind: "notReady", country: level?.country ?? null };
  }
}

export function WalletAccountCard() {
  const { showToast } = useToast();
  const [state, setState] = useState<CardState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void loadWalletAccount().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.kind === "loading") return <LoadingBlock label="Loading your wallet account" />;
  if (state.kind === "error") return <Callout tone="error" title="We couldn't load your wallet account" action={<Button size="small" onClick={() => setAttempt((value) => value + 1)}>Try again</Button>}>{state.message}</Callout>;
  if (state.kind === "notReady") {
    if (state.country && state.country !== "NG") {
      return <Panel title="How you get paid">Outside Nigeria buyers pay you directly at checkout; there&apos;s no stored balance. Payouts go to your verified bank or mobile-money account.</Panel>;
    }
    return (
      <Panel title="Your wallet account">
        <Callout tone="caution" title="No account number yet" action={<ButtonLink href="/settings/payouts" size="small">Finish verification</ButtonLink>}>
          Verify your identity and payout account to get your own account number. Nothing you have earned is lost while you verify.
        </Callout>
      </Panel>
    );
  }

  const { wallet } = state.wallet;
  const copy = (value: string) => void navigator.clipboard.writeText(value).then(() => showToast("Account number copied."), () => showToast("Copy it by hand.", "error"));
  return (
    <Panel title="Your wallet account" description="Earnings and deposits arrive in this account, held in your name by our licensed payment partner.">
      {wallet.status !== "active" ? <Callout tone="caution" title="Wallet on hold">We&apos;re checking your wallet. Contact support if this lasts.</Callout> : null}
      <KeyValueList
        items={[
          { label: "Bank", value: wallet.bankName || "—" },
          { label: "Account number", value: wallet.accountNumber ? <span>{wallet.accountNumber} <Button size="small" iconName="copy16" onClick={() => copy(wallet.accountNumber)}>Copy</Button></span> : "Being set up" },
          { label: "Account name", value: wallet.accountName || "—" },
          ...(wallet.provider === "flutterwave" ? [{ label: "Held by", value: "Flutterwave" }] : []),
        ]}
      />
    </Panel>
  );
}
