"use client";

import { PlanGate } from "@/components/billing/planGate";
import { DeveloperApiKeysPanel } from "@/components/settings/developerApiKeysPanel";
import { DeveloperWebhooksPanel } from "@/components/settings/developerWebhooksPanel";
import { Callout } from "@/components/ui/feedback";

export function DeveloperSettingsView() {
  return (
    <PlanGate feature="api_webhooks" description="Connect your own warehouse, accounting or delivery tools to your store with API keys and real-time webhooks.">
      <Callout tone="info" title="Keep keys secret">Never put an API key in a website, app or public code. Anyone with a key can act as your store within its scopes.</Callout>
      <DeveloperApiKeysPanel />
      <DeveloperWebhooksPanel />
    </PlanGate>
  );
}
