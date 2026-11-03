import type { Metadata } from "next";

import { GateStep } from "@/components/billing/gateFrame";
import { Panel, PageHeader } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Start selling" };

export default function ApplyToSellPage() {
  return (
    <>
      <PageHeader eyebrow="Nantty Dashboard" title="Start selling in Nigeria" description="Seller stores are currently available to businesses operating in Nigeria. The dashboard is free for every approved seller and their team." />
      <Panel title="Apply for a seller store">
        <ol>
          <GateStep state="current" title="Apply in the Nantty app">Open Profile › Start selling and submit your business details for your Nigerian store, contact phone, identity details and payout bank account.</GateStep>
          <GateStep state="todo" title="Get approved">Our team reviews your store, usually within 1–2 working days.</GateStep>
          <GateStep state="todo" title="Sign in here for free">Free for every Nantty seller — upgrade to Pro or Business when you grow.</GateStep>
        </ol>
      </Panel>
      <Panel title="Creator applications are separate">
        <p>Creators outside Nigeria may still be considered for the Creator Program. That application is separate from opening a seller store and does not grant seller access.</p>
      </Panel>
      <Panel title="Working for a store?">
        <p>Ask the store owner to add you from Team in their dashboard by searching your Nantty username. Accept the request in the app, then sign in here with your own Nantty account.</p>
      </Panel>
    </>
  );
}
