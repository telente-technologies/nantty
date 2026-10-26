"use client";

import { useState } from "react";

import { OneTimeSecretNotice } from "@/components/settings/developerApiKeysPanel";
import { Button } from "@/components/ui/button";
import { CheckboxField, FormErrorSummary, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import { webhookEvents, type CreatedWebhookEndpoint, type WebhookEndpoint, type WebhookEvent } from "@/types/developer.type";

import styles from "./settings.module.css";

const webhookEventDescriptions: Record<WebhookEvent, string> = {
  "order.created": "A customer paid for an order",
  "order.updated": "An order changed status",
  "order.delivered": "The buyer confirmed delivery",
  "order.refunded": "An order was refunded",
  "product.updated": "A product was added or changed",
  "inventory.low_stock": "Stock fell to the reorder level",
  "payout.paid": "A withdrawal reached your bank",
  "review.created": "A customer left a review",
  "message.received": "A customer sent a message",
};

export function DeveloperWebhookDialog({ webhook, onClose, onSaved }: { readonly webhook: WebhookEndpoint | null; readonly onClose: () => void; readonly onSaved: () => void }) {
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [description, setDescription] = useState(webhook?.description ?? "");
  const [events, setEvents] = useState<WebhookEvent[]>(webhook?.events ?? ["order.created", "order.updated"]);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);

  async function saveWebhookEndpoint() {
    const problems = [!/^https:\/\/\S{4,}$/.test(url.trim()) ? "Use a public https:// address." : null, events.length === 0 ? "Pick at least one event." : null].filter((problem): problem is string => problem !== null);
    setErrorMessages(problems);
    if (problems.length > 0) return;
    setIsSaving(true);
    try {
      if (webhook) {
        await sendSellerApiRequest(`/seller/developers/webhooks/${encodeURIComponent(webhook.id)}`, { method: "PATCH", body: { url: url.trim(), events } });
        onSaved();
        onClose();
      } else {
        const created = await sendSellerApiRequest<CreatedWebhookEndpoint>("/seller/developers/webhooks", { method: "POST", body: { url: url.trim(), description: description.trim(), events } });
        onSaved();
        setSigningSecret(created.signingSecret);
      }
    } catch (error) {
      setErrorMessages([readErrorMessageForDisplay(error)]);
    } finally {
      setIsSaving(false);
    }
  }

  if (signingSecret) {
    return (
      <ModalDialog intent="success" isOpen onClose={onClose} title="Webhook added" footer={<Button variant="primary" onClick={onClose}>I have copied it</Button>}>
        <p className={styles.mutedText}>Use this secret to check the Nantty-Signature header on every delivery.</p>
        <OneTimeSecretNotice label="signing secret" secret={signingSecret} />
      </ModalDialog>
    );
  }

  return (
    <ModalDialog intent="webhook" isOpen onClose={onClose} width="large" title={webhook ? "Edit webhook" : "Add webhook"} description="We send a signed POST request to this address when the events you pick happen. Failed deliveries are retried for 24 hours." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" isBusy={isSaving} onClick={() => void saveWebhookEndpoint()}>{webhook ? "Save webhook" : "Add webhook"}</Button></>}>
      <div className={styles.formStack}>
        <FormErrorSummary messages={errorMessages} />
        <TextField label="Endpoint URL" type="url" value={url} maxLength={240} placeholder="https://yourapp.ng/hooks/zudomart" onChange={(event) => setUrl(event.target.value)} />
        {webhook ? null : <TextField label="Description (optional)" value={description} maxLength={80} placeholder="Stock sync" onChange={(event) => setDescription(event.target.value)} />}
        <div className={styles.checkboxGrid} role="group" aria-label="Events">
          {webhookEvents.map((event) => (
            <CheckboxField
              key={event}
              label={
                <span className={styles.rowTitle}>
                  <span className={styles.monospace}>{event}</span>
                  <span className={styles.mutedText}>{webhookEventDescriptions[event]}</span>
                </span>
              }
              checked={events.includes(event)}
              onCheckedChange={(isOn) => setEvents((current) => (isOn ? [...current, event] : current.filter((candidate) => candidate !== event)))}
            />
          ))}
        </div>
      </div>
    </ModalDialog>
  );
}
