import type { Metadata } from "next";

import { GateStep } from "@/components/billing/gateFrame";
import { Panel, PageHeader } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Start selling" };

export default function ApplyToSellPage() {
  return (
    <>
      <PageHeader eyebrow="Zudomart Dashboard" title="This account does not have a store yet" description="The dashboard is for Gold-verified sellers and their staff. Here is how to get in." />
      <Panel title="Open a store in the Zudomart app">
        <ol>
          <GateStep state="current" title="Apply to sell">Open the Zudomart app, go to Profile → Start selling and submit your business details, ID and payout bank account.</GateStep>
          <GateStep state="todo" title="Get verified">Our team reviews your documents, usually within 1–2 working days.</GateStep>
          <GateStep state="todo" title="Choose Gold Pro or Gold Premium">Your Gold plan adds the gold badge and unlocks this dashboard, including the point of sale.</GateStep>
        </ol>
      </Panel>
      <Panel title="Working for a store?">
        <p>Ask the store owner to invite you from Staff in their dashboard using this account&apos;s email or phone number. Then sign in again.</p>
      </Panel>
    </>
  );
}
