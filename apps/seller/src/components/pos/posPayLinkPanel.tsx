"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { PosPayLink } from "@/types/posExtra.type";

const payLinkPollIntervalInMilliseconds = 3_000;

export function PosPayLinkPanel({ amountMinor, clientSaleId, onPaid }: { readonly amountMinor: number; readonly clientSaleId: string; readonly onPaid: (payLink: PosPayLink) => void }) {
  const { formatMoney } = useMoneyFormatter();
  const [payLink, setPayLink] = useState<PosPayLink | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function createPayLinkForAmount() {
    setIsCreating(true);
    setErrorMessage(null);
    try {
      setPayLink(await sendSellerApiRequest<PosPayLink>("/seller/pos/pay-links", { method: "POST", body: { amountMinor, clientSaleId } }));
    } catch (error) {
      setErrorMessage(readErrorMessageForDisplay(error));
    } finally {
      setIsCreating(false);
    }
  }

  useEffect(() => {
    if (!payLink || payLink.status !== "pending") return;
    const intervalHandle = window.setInterval(async () => {
      const latest = await sendSellerApiRequest<PosPayLink>(`/seller/pos/pay-links/${encodeURIComponent(payLink.reference)}`).catch(() => null);
      if (!latest) return;
      setPayLink(latest);
      if (latest.status === "paid") onPaid(latest);
    }, payLinkPollIntervalInMilliseconds);
    return () => window.clearInterval(intervalHandle);
  }, [payLink, onPaid]);

  if (!payLink) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {errorMessage ? <Callout tone="error">{errorMessage}</Callout> : null}
        <Button variant="primary" isBusy={isCreating} onClick={() => void createPayLinkForAmount()} disabled={amountMinor <= 0}>
          Create a pay link
        </Button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-live="polite">
      <p>
        Ask the customer to open this link in the Zudomart app and pay {formatMoney(payLink.amount)}.{" "}
        <StatusBadge tone={payLink.status === "paid" ? "success" : payLink.status === "expired" ? "error" : "caution"}>{payLink.status === "paid" ? "Paid" : payLink.status === "expired" ? "Expired" : "Waiting for payment"}</StatusBadge>
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <code style={{ padding: "6px 8px", background: "var(--surface-sunken)", borderRadius: 6, overflowWrap: "anywhere" }}>{payLink.url}</code>
        <Button size="small" iconName="copy16" onClick={() => void navigator.clipboard?.writeText(payLink.url)}>Copy link</Button>
      </div>
    </div>
  );
}
