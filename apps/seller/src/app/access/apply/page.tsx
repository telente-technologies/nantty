import type { Metadata } from "next";

import { GateStep } from "@/components/billing/gateFrame";
import { Panel, PageHeader } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Start selling" };

export default function ApplyToSellPage() {
  return (
    <>
      <PageHeader eyebrow="Zudomart Dashboard" title="This account does not have a store yet" description="The dashboard is free for every approved Zudomart seller and their team. Here is how to get in." />
      <Panel title="Open a store in the Zudomart app">
        <ol>
          <GateStep state="current" title="Apply to sell">Open the Zudomart app, go to Profile › Start selling and submit your business details, ID and payout bank account.</GateStep>
          <GateStep state="todo" title="Get approved">Our team reviews your store, usually within 1–2 working days.</GateStep>
          <GateStep state="todo" title="Sign in here for free">Free for every Zudomart seller — upgrade to Pro or Business when you grow.</GateStep>
        </ol>
      </Panel>
      <Panel title="Working for a store?">
        <p>Ask the store owner to add you from Team in their dashboard by searching your Zudomart username. Accept the request in the app, then sign in here with your own Zudomart account.</p>
      </Panel>
    </>
  );
}
