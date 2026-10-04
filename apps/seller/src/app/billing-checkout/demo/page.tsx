import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Panel, PageHeader } from "@/components/ui/panel";
import { isMockBackendEnabled } from "@/config/sellerEnvironment.config";

export const metadata: Metadata = { title: "Demo payment" };

export default async function DemoHostedCheckoutPage({ searchParams }: { readonly searchParams: Promise<{ reference?: string }> }) {
  if (!isMockBackendEnabled()) notFound();
  const { reference = "" } = await searchParams;
  const safeReference = /^[A-Z0-9_]{6,64}$/.test(reference) ? reference : "";
  return (
    <>
      <PageHeader eyebrow="Demo only" title="Payment partner page" description="With the real backend this is the Paystack payment window. No money moves in demo mode." />
      <Callout tone="info">Reference {safeReference || "missing"}</Callout>
      {safeReference.startsWith("TRL_") || safeReference.startsWith("GLD_") ? <Callout tone="caution" title="Saving a card">We make a small charge to check the card and refund it automatically. Your account email is used for receipts, so we never ask for one here.</Callout> : null}
      <Panel title="Approve the demo payment">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ButtonLink variant="primary" href={`/billing-checkout/callback?reference=${safeReference}`}>
            Pay and return to the dashboard
          </ButtonLink>
          <ButtonLink href="/settings/billing">Cancel</ButtonLink>
        </div>
      </Panel>
    </>
  );
}
