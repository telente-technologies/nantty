"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useDeveloperContext } from "./developerContextProvider";
import styles from "./developerCredentialsWorkspace.module.css";

type Webhook = {
  readonly id: string;
  readonly url: string;
  readonly description?: string;
  readonly events: string[];
  readonly active: boolean;
  readonly verifiedAt?: string | null;
  readonly signingSecretPreview?: string;
  readonly createdAt: string;
};

type Delivery = {
  readonly id: string;
  readonly webhookId: string;
  readonly eventId: string;
  readonly event: string;
  readonly status: string;
  readonly attempts: number;
  readonly lastHttpStatus: number | null;
  readonly lastErrorCode: string | null;
  readonly createdAt: string;
  readonly deliveredAt: string | null;
};

const sandboxEvents = ["message.received", "message.delivered", "message.read", "message.failed"] as const;
const prodEvents = ["business.message.queued", "business.message.delivered", "business.message.failed"] as const;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? payload?.message ?? "The webhook service could not complete this request.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DeveloperWebhooksWorkspace() {
  const { environment, organizations, organizationId, setOrganizationId, applications, applicationId, setApplicationId, loading, authError } = useDeveloperContext();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["message.received"]);
  const [signingSecret, setSigningSecret] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setSelectedEvents(environment === "production" ? ["business.message.queued"] : ["message.received"]);
  }, [environment]);

  const refresh = useCallback(async () => {
    if (!organizationId || !applicationId) {
      setWebhooks([]);
      setDeliveries([]);
      return;
    }
    if (environment === "production") {
      const result = await request<{ webhooks: Webhook[] }>(
        `/api/developer/organizations/${encodeURIComponent(organizationId)}/applications/${encodeURIComponent(applicationId)}/webhooks`,
      );
      setWebhooks(result.webhooks ?? []);
      setDeliveries([]);
      return;
    }
    const query = new URLSearchParams({ organizationId, applicationId });
    const [webhookResult, deliveryResult] = await Promise.all([
      request<{ webhooks: Webhook[] }>(`/api/developer/webhooks?${query}`),
      request<{ deliveries: Delivery[] }>(`/api/developer/webhooks/deliveries?${query}`),
    ]);
    setWebhooks(webhookResult.webhooks ?? []);
    setDeliveries(deliveryResult.deliveries ?? []);
  }, [applicationId, environment, organizationId]);

  useEffect(() => {
    let active = true;
    setError("");
    setNotice("");
    setSigningSecret("");
    void refresh().catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load webhook records.");
    });
    return () => { active = false; };
  }, [refresh]);

  async function run(action: "create" | "update" | "delete" | "test" | "retry" | "verify" | "rotate-secret", webhook?: Webhook, delivery?: Delivery) {
    if (!organizationId || !applicationId || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setSigningSecret("");
    setCopiedSecret(false);
    setConfirmDeleteId("");
    try {
      if (environment === "production") {
        const base = `/api/developer/organizations/${encodeURIComponent(organizationId)}/applications/${encodeURIComponent(applicationId)}/webhooks`;
        if (action === "create") {
          const res = await request<{ webhook: Webhook; signingSecret: string }>(base, {
            method: "POST",
            body: JSON.stringify({ url, events: selectedEvents }),
          });
          setSigningSecret(res.signingSecret);
          setUrl("");
          setNotice("Production webhook created. Verify ownership before live deliveries will be dispatched.");
        } else if (action === "verify" && webhook) {
          await request(`${base}/${encodeURIComponent(webhook.id)}/verify`, { method: "POST" });
          setNotice("Endpoint ownership verified.");
        } else if (action === "rotate-secret" && webhook) {
          const res = await request<{ signingSecret: string }>(`${base}/${encodeURIComponent(webhook.id)}/rotate-secret`, { method: "POST" });
          setSigningSecret(res.signingSecret);
          setNotice("Signing secret rotated. Copy the new secret now.");
        } else if (action === "delete" && webhook) {
          await request(`${base}/${encodeURIComponent(webhook.id)}`, { method: "DELETE" });
          setNotice("Production webhook deleted.");
        }
        await refresh();
        return;
      }

      const payload = { organizationId, applicationId, ...(webhook ? { webhookId: webhook.id } : {}), ...(delivery ? { deliveryId: delivery.id } : {}) };
      const path = action === "test" ? "/api/developer/webhooks/test" : action === "retry" ? "/api/developer/webhooks/retry" : "/api/developer/webhooks";
      if (action === "create") {
        const result = await request<{ webhook: Webhook; signingSecret: string }>(path, {
          method: "POST",
          body: JSON.stringify({ ...payload, url, description, events: selectedEvents }),
        });
        setSigningSecret(result.signingSecret);
        setUrl("");
        setDescription("");
        setNotice("Sandbox webhook created. Copy its signing secret now; it will not be shown again.");
      } else if (action === "update" && webhook) {
        await request(path, { method: "PATCH", body: JSON.stringify({ ...payload, active: !webhook.active }) });
        setNotice(webhook.active ? "Webhook paused." : "Webhook enabled.");
      } else if (action === "delete" && webhook) {
        await request(path, { method: "DELETE", body: JSON.stringify(payload) });
        setNotice("Webhook deleted.");
      } else if (action === "test" && webhook) {
        const result = await request<{ status: string }>("/api/developer/webhooks/test", { method: "POST", body: JSON.stringify(payload) });
        setNotice(`Test event queued (${result.status}).`);
      } else if (action === "retry" && webhook && delivery) {
        const result = await request<{ status: string }>("/api/developer/webhooks/retry", { method: "POST", body: JSON.stringify(payload) });
        setNotice(`Delivery retry queued (${result.status}).`);
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Webhook management failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(signingSecret);
      setCopiedSecret(true);
      setNotice("Signing secret copied.");
      window.setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      setError("Clipboard access is unavailable.");
    }
  }

  const eventOptions = environment === "production" ? prodEvents : sandboxEvents;

  return (
    <section className={styles.page} aria-labelledby="webhooks-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Developer workspace / Operate · {environment === "production" ? "Production" : "Sandbox"}</p>
          <h1 id="webhooks-title">{environment === "production" ? "Production webhooks" : "Sandbox webhooks"}</h1>
          <p>Receive signed HMAC-SHA256 events (`nantty-signature`) over HTTPS with DNS & connect-time SSRF validation.</p>
        </div>
        <div className={styles.selectors}>
          <label>Organization<select aria-label="Organization" value={organizationId} disabled={loading || organizations.length === 0} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.length ? organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No organizations</option>}</select></label>
          <label>Application<select aria-label="Application" value={applicationId} disabled={!applications.length} onChange={(event) => setApplicationId(event.target.value)}>{applications.length ? applications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No applications</option>}</select></label>
        </div>
      </header>
      <div className={styles.callout} role="note">
        <strong>{environment === "production" ? "Challenge verification required" : "Sandbox only"}</strong>
        <span>{environment === "production" ? "Endpoints must return 2xx with JSON {\"challenge\":\"...\"} on Verify before production deliveries start." : "Endpoints must use HTTPS and resolve to public addresses."}</span>
      </div>
      {error || authError ? <p className={styles.error} role="alert">{error || authError}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {signingSecret ? <section className={styles.secretPanel} aria-labelledby="webhook-secret-title"><h2 id="webhook-secret-title">Signing secret — shown once</h2><p>Use this secret to verify the nantty-signature header on each event.</p><div className={styles.secretValue}><code>{signingSecret}</code><button type="button" onClick={() => void copySecret()}>{copiedSecret ? "Copied!" : "Copy secret"}</button></div><button className={styles.secondaryButton} type="button" onClick={() => setSigningSecret("")}>Hide secret</button></section> : null}

      <section className={styles.records} aria-labelledby="endpoint-list-title">
        <div className={styles.recordsHeading}>
          <div><h2 id="endpoint-list-title">Endpoints</h2><p>Signing secrets are never returned by list operations.</p></div>
          <div className={styles.listTools}><span>{webhooks.filter((item) => item.active).length} active</span><button type="button" disabled={busy || !applicationId} onClick={() => void refresh()}>Refresh</button></div>
        </div>
        <form className={styles.webhookForm} onSubmit={(event) => { event.preventDefault(); void run("create"); }}>
          <div className={styles.webhookFormFields}>
            <label>HTTPS endpoint<input type="url" required maxLength={512} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/nantty-events" /></label>
            {environment === "sandbox" ? <label>Description<input maxLength={80} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional label" /></label> : null}
          </div>
          <fieldset className={styles.webhookEventsFieldset}><legend>Subscribed events</legend>{eventOptions.map((eventName) => <label key={eventName}><input type="checkbox" checked={selectedEvents.includes(eventName)} onChange={() => setSelectedEvents((current) => current.includes(eventName) ? current.filter((item) => item !== eventName) : [...current, eventName])} />{eventName}</label>)}</fieldset>
          <div className={styles.webhookFormActions}>
            <span className={styles.eyebrow}>{selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"} selected</span>
            <button type="submit" disabled={busy || !organizationId || !applicationId || selectedEvents.length === 0}>{busy ? "Working…" : "Add endpoint"}</button>
          </div>
        </form>
        {loading ? <p className={styles.empty}>Loading organizations…</p> : authError ? <p className={styles.empty}>Sign in with your Nantty account to manage webhook endpoints.</p> : !organizations.length ? <p className={styles.empty}>Create or join a developer organization first. <Link href="/organization">Manage organizations</Link></p> : !applications.length ? <p className={styles.empty}>Register an application first. <Link href="/applications">Register application</Link></p> : webhooks.length === 0 ? <p className={styles.empty}>No {environment} webhook endpoints yet.</p> : (
          <div className={styles.tableScroll}>
            <table>
              <thead><tr><th>Endpoint</th><th>Events</th><th>Status</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead>
              <tbody>
                {webhooks.map((webhook) => (
                  <tr key={webhook.id}>
                    <td><strong>{webhook.description || webhook.signingSecretPreview || "Webhook endpoint"}</strong><br /><code>{webhook.url}</code></td>
                    <td>{webhook.events.join(", ")}</td>
                    <td>
                      <span className={`${styles.badge} ${webhook.active ? styles.badgeSuccess : styles.badgeWarn}`}>{webhook.active ? "Active" : "Paused"}</span>
                      {environment === "production" ? <span className={`${styles.badge} ${webhook.verifiedAt ? styles.badgeSuccess : styles.badgeNeutral}`} style={{ marginLeft: 6 }}>{webhook.verifiedAt ? "Verified" : "Unverified"}</span> : null}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {confirmDeleteId === webhook.id ? (
                          <><button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void run("delete", webhook)}>Confirm delete</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setConfirmDeleteId("")}>Cancel</button></>
                        ) : environment === "production" ? (
                          <>
                            <button type="button" disabled={busy} onClick={() => void run("verify", webhook)}>Verify</button>
                            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void run("rotate-secret", webhook)}>Rotate secret</button>
                            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setConfirmDeleteId(webhook.id)}>Delete</button>
                          </>
                        ) : (
                          <>
                            <button type="button" disabled={busy || !webhook.active} onClick={() => void run("test", webhook)}>Send test</button>
                            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void run("update", webhook)}>{webhook.active ? "Pause" : "Enable"}</button>
                            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setConfirmDeleteId(webhook.id)}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {environment === "sandbox" ? (
        <section className={styles.records} aria-labelledby="delivery-list-title">
          <div className={styles.recordsHeading}><div><h2 id="delivery-list-title">Delivery history</h2><p>Delivery is asynchronous; retries use bounded backoff.</p></div><span>{deliveries.length} recent</span></div>
          {deliveries.length === 0 ? <p className={styles.empty}>No deliveries have been queued.</p> : (
            <div className={styles.tableScroll}>
              <table>
                <thead><tr><th>Event</th><th>Status</th><th>Attempts</th><th>Last result</th><th>Time</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead>
                <tbody>
                  {deliveries.map((delivery) => {
                    const webhook = webhooks.find((item) => item.id === delivery.webhookId);
                    const statusTone = delivery.status === "delivered" ? styles.badgeSuccess : delivery.status === "failed" ? styles.badgeDanger : styles.badgeWarn;
                    return (
                      <tr key={delivery.id}>
                        <td><code>{delivery.event}</code><br /><small>{delivery.eventId}</small></td>
                        <td><span className={`${styles.badge} ${statusTone}`}>{delivery.status}</span></td>
                        <td>{delivery.attempts}</td>
                        <td>{delivery.lastHttpStatus ?? delivery.lastErrorCode ?? "—"}</td>
                        <td>{formatDate(delivery.deliveredAt ?? delivery.createdAt)}</td>
                        <td>{delivery.status === "failed" && webhook ? <button type="button" className={styles.secondaryButton} disabled={busy || !webhook.active} onClick={() => void run("retry", webhook, delivery)}>Retry</button> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
