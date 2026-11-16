"use client";

import { useCallback, useEffect, useState } from "react";

import styles from "./developerCredentialsWorkspace.module.css";

type Organization = { readonly id: string; readonly name: string };
type Application = { readonly id: string; readonly name: string };
type Webhook = { readonly id: string; readonly url: string; readonly description: string; readonly events: string[]; readonly active: boolean; readonly createdAt: string; readonly updatedAt: string };
type Attempt = { readonly attempt: number; readonly outcome: string; readonly httpStatus: number | null; readonly errorCode: string | null; readonly durationMs: number | null };
type Delivery = { readonly id: string; readonly webhookId: string; readonly eventId: string; readonly event: string; readonly status: string; readonly attempts: number; readonly lastHttpStatus: number | null; readonly lastErrorCode: string | null; readonly createdAt: string; readonly deliveredAt: string | null; readonly attempts_history: Attempt[] | null };
type DeliveryResponse = { readonly deliveries: Delivery[] };
type WebhookResponse = { readonly webhooks: Webhook[] };
type CreatedWebhookResponse = { readonly webhook: Webhook; readonly signingSecret: string };

const events = ["message.received", "message.delivered", "message.read", "message.failed"];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store", headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? payload?.message ?? "The webhook service could not complete this request.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DeveloperWebhooksWorkspace() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["message.received"]);
  const [signingSecret, setSigningSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void request<{ organizations: Organization[] }>("/api/developer/organizations")
      .then(({ organizations: items }) => { if (active) { setOrganizations(items); setOrganizationId(items[0]?.id ?? ""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Sign in to load organizations."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    void request<{ applications: Application[] }>(`/api/developer/organizations/${encodeURIComponent(organizationId)}/applications`, { signal: controller.signal })
      .then(({ applications: items }) => { if (!controller.signal.aborted) { setApplicationId(items[0]?.id ?? ""); setApplications(items); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load applications."); });
    return () => controller.abort();
  }, [organizationId]);

  const refresh = useCallback(async () => {
    if (!organizationId || !applicationId) { setWebhooks([]); setDeliveries([]); return; }
    const query = new URLSearchParams({ organizationId, applicationId });
    const [webhookResult, deliveryResult] = await Promise.all([
      request<WebhookResponse>(`/api/developer/webhooks?${query}`),
      request<DeliveryResponse>(`/api/developer/webhooks/deliveries?${query}`),
    ]);
    setWebhooks(webhookResult.webhooks);
    setDeliveries(deliveryResult.deliveries);
  }, [organizationId, applicationId]);

  useEffect(() => {
    if (!organizationId || !applicationId) return;
    let active = true;
    const query = new URLSearchParams({ organizationId, applicationId });
    void Promise.all([
      request<WebhookResponse>(`/api/developer/webhooks?${query}`),
      request<DeliveryResponse>(`/api/developer/webhooks/deliveries?${query}`),
    ]).then(([webhookResult, deliveryResult]) => {
      if (active) { setWebhooks(webhookResult.webhooks); setDeliveries(deliveryResult.deliveries); }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load webhook records."); });
    return () => { active = false; };
  }, [organizationId, applicationId, refresh]);

  async function run(action: "create" | "update" | "delete" | "test" | "retry", webhook?: Webhook, delivery?: Delivery) {
    if (!organizationId || !applicationId || busy) return;
    setBusy(true); setError(""); setNotice(""); setSigningSecret("");
    const payload = { organizationId, applicationId, ...(webhook ? { webhookId: webhook.id } : {}), ...(delivery ? { deliveryId: delivery.id } : {}) };
    const path = action === "test" ? "/api/developer/webhooks/test" : action === "retry" ? "/api/developer/webhooks/retry" : "/api/developer/webhooks";
    try {
      if (action === "create") {
        const result = await request<CreatedWebhookResponse>(path, { method: "POST", body: JSON.stringify({ ...payload, url, description, events: selectedEvents }) });
        setSigningSecret(result.signingSecret); setUrl(""); setDescription(""); setSelectedEvents(["message.received"]); setNotice("Webhook created. Copy its signing secret now; it will not be shown again.");
      } else if (action === "update" && webhook) {
        await request(path, { method: "PATCH", body: JSON.stringify({ ...payload, active: !webhook.active }) });
        setNotice(webhook.active ? "Webhook paused." : "Webhook enabled.");
      } else if (action === "delete" && webhook) {
        if (!window.confirm("Delete this Sandbox webhook? Pending deliveries will be cancelled.")) return;
        await request(path, { method: "DELETE", body: JSON.stringify(payload) }); setNotice("Webhook deleted.");
      } else if (action === "test" && webhook) {
        const result = await request<{ status: string }>("/api/developer/webhooks/test", { method: "POST", body: JSON.stringify(payload) });
        setNotice(`Test event queued (${result.status}). Check delivery history for the result.`);
      } else if (action === "retry" && webhook && delivery) {
        const result = await request<{ status: string }>("/api/developer/webhooks/retry", { method: "POST", body: JSON.stringify(payload) });
        setNotice(`Delivery retry queued (${result.status}).`);
      }
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Webhook management failed. Try again."); }
    finally { setBusy(false); }
  }

  async function copySecret() {
    try { await navigator.clipboard.writeText(signingSecret); setNotice("Signing secret copied. Store it securely; it cannot be retrieved later."); }
    catch { setError("Clipboard access is unavailable. Select and copy the secret manually."); }
  }

  return (
    <section className={styles.page} aria-labelledby="webhooks-title">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Developer workspace / Operate</p><h1 id="webhooks-title">Sandbox webhooks</h1><p>Receive signed events from isolated Sandbox conversations. No production traffic is sent from this workspace.</p></div>
        <div className={styles.selectors}>
          <label>Organization<select aria-label="Organization" value={organizationId} disabled={loading || organizations.length === 0} onChange={(event) => { setOrganizationId(event.target.value); setApplications([]); setApplicationId(""); setWebhooks([]); setDeliveries([]); }} >{organizations.length ? organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No organizations</option>}</select></label>
          <label>Application<select aria-label="Application" value={applicationId} disabled={!applications.length} onChange={(event) => { setApplicationId(event.target.value); setWebhooks([]); setDeliveries([]); }} >{applications.length ? applications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No applications</option>}</select></label>
        </div>
      </header>
      <div className={styles.callout} role="note"><strong>Sandbox only</strong><span>Endpoints must use HTTPS and resolve to public addresses. Requests are signed, retried with bounded backoff, and delivered at least once.</span></div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {signingSecret ? <section className={styles.secretPanel} aria-labelledby="webhook-secret-title"><h2 id="webhook-secret-title">Signing secret — shown once</h2><p>Use this secret to verify the Nantty-Signature header on each event.</p><div className={styles.secretValue}><code>{signingSecret}</code><button type="button" onClick={() => void copySecret()}>Copy secret</button></div><button className={styles.secondaryButton} type="button" onClick={() => setSigningSecret("")}>Hide secret</button></section> : null}
      <section className={styles.records} aria-labelledby="endpoint-list-title">
        <div className={styles.recordsHeading}><div><h2 id="endpoint-list-title">Endpoints</h2><p>Signing secrets are never returned by list operations.</p></div><div className={styles.listTools}><span>{webhooks.filter((item) => item.active).length} active</span><button type="button" disabled={busy || !applicationId} onClick={() => void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not refresh."))}>Refresh</button></div></div>
        <form className={styles.issueControls} onSubmit={(event) => { event.preventDefault(); void run("create"); }}>
          <label>HTTPS endpoint<input type="url" required maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/nantty-events" /></label>
          <label>Description<input maxLength={80} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional label" /></label>
          <fieldset><legend>Events</legend>{events.map((eventName) => <label key={eventName}><input type="checkbox" checked={selectedEvents.includes(eventName)} onChange={() => setSelectedEvents((current) => current.includes(eventName) ? current.filter((item) => item !== eventName) : [...current, eventName])} />{eventName}</label>)}</fieldset>
          <button type="submit" disabled={busy || !organizationId || !applicationId || selectedEvents.length === 0}>{busy ? "Working…" : "Add endpoint"}</button>
        </form>
        {loading ? <p className={styles.empty}>Loading organizations…</p> : !organizations.length ? <p className={styles.empty}>Create or join a developer organization to configure Sandbox webhooks.</p> : !applications.length ? <p className={styles.empty}>Register an application first; webhook endpoints are application-scoped.</p> : webhooks.length === 0 ? <p className={styles.empty}>No Sandbox webhook endpoints yet.</p> : <div className={styles.tableScroll}><table><thead><tr><th>Endpoint</th><th>Events</th><th>Status</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead><tbody>{webhooks.map((webhook) => <tr key={webhook.id}><td><strong>{webhook.description || "Webhook endpoint"}</strong><br /><code>{webhook.url}</code></td><td>{webhook.events.join(", ")}</td><td>{webhook.active ? "Active" : "Paused"}</td><td><div className={styles.actions}><button type="button" disabled={busy || !webhook.active} onClick={() => void run("test", webhook)}>Send test</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void run("update", webhook)}>{webhook.active ? "Pause" : "Enable"}</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void run("delete", webhook)}>Delete</button></div></td></tr>)}</tbody></table></div>}
      </section>
      <section className={styles.records} aria-labelledby="delivery-list-title"><div className={styles.recordsHeading}><div><h2 id="delivery-list-title">Delivery history</h2><p>Delivery is asynchronous; queued does not mean the endpoint accepted the event.</p></div><span>{deliveries.length} recent</span></div>{deliveries.length === 0 ? <p className={styles.empty}>No deliveries have been queued.</p> : <div className={styles.tableScroll}><table><thead><tr><th>Event</th><th>Status</th><th>Attempts</th><th>Last result</th><th>Time</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead><tbody>{deliveries.map((delivery) => { const webhook = webhooks.find((item) => item.id === delivery.webhookId); return <tr key={delivery.id}><td><code>{delivery.event}</code><br /><small>{delivery.eventId}</small></td><td>{delivery.status}</td><td>{delivery.attempts}</td><td>{delivery.lastHttpStatus ?? delivery.lastErrorCode ?? "—"}</td><td>{formatDate(delivery.deliveredAt ?? delivery.createdAt)}</td><td>{delivery.status === "failed" && webhook ? <button type="button" disabled={busy || !webhook.active} onClick={() => void run("retry", webhook, delivery)}>Retry</button> : "—"}</td></tr>; })}</tbody></table></div>}</section>
    </section>
  );
}
