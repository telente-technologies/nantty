"use client";

import { useCallback, useEffect, useState } from "react";

import styles from "./sandboxWorkspace.module.css";
import { formatTimestamp, sandboxFetch, useSandboxContext } from "./useSandboxContext";

type SandboxMessage = { readonly id: string; readonly sender: string; readonly text: string; readonly status: string; readonly createdAt: string };
type SandboxConversation = { readonly id: string; readonly status: string; readonly customerName: string; readonly customerReference: string; readonly updatedAt: string; readonly messages: SandboxMessage[] | null };

export function SandboxMessagingWorkspace() {
  const ctx = useSandboxContext();
  const [conversations, setConversations] = useState<SandboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [customerName, setCustomerName] = useState("Synthetic Customer");
  const [sender, setSender] = useState<"customer" | "business">("customer");
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadConversations = useCallback(async (signal?: AbortSignal) => {
    if (!ctx.organizationId || !ctx.applicationId) { setConversations([]); return; }
    setLoading(true); setError("");
    const qs = new URLSearchParams({ organizationId: ctx.organizationId, applicationId: ctx.applicationId });
    try {
      const data = await sandboxFetch<{ conversations: SandboxConversation[] }>(`/api/sandbox/conversations?${qs}`, { signal });
      if (!signal?.aborted) {
        setConversations(data.conversations);
        setSelectedId((prev) => data.conversations.some((c) => c.id === prev) ? prev : (data.conversations[0]?.id ?? ""));
      }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load sandbox conversations.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [ctx.organizationId, ctx.applicationId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadConversations(controller.signal);
    return () => controller.abort();
  }, [loadConversations]);

  async function createConversation() {
    if (!ctx.organizationId || !ctx.applicationId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const created = await sandboxFetch<{ id: string }>("/api/sandbox/conversations", {
        method: "POST",
        body: JSON.stringify({ organizationId: ctx.organizationId, applicationId: ctx.applicationId, customerName }),
      });
      setSelectedId(created.id);
      setNotice("Created synthetic customer and sandbox conversation.");
      await loadConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create synthetic conversation.");
    } finally {
      setBusy(false);
    }
  }

  async function sendSimulatedMessage() {
    if (!ctx.organizationId || !ctx.applicationId || !selectedId || !messageText.trim() || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await sandboxFetch("/api/sandbox/messaging", {
        method: "POST",
        body: JSON.stringify({ organizationId: ctx.organizationId, applicationId: ctx.applicationId, conversationId: selectedId, sender, text: messageText.trim() }),
      });
      setMessageText("");
      setNotice(`Simulated ${sender} message and queued matching webhook event.`);
      await loadConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not simulate message.");
    } finally {
      setBusy(false);
    }
  }

  async function transitionMessage(messageId: string, status: "delivered" | "read" | "failed") {
    if (!ctx.organizationId || !ctx.applicationId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await sandboxFetch("/api/sandbox/messaging", {
        method: "PATCH",
        body: JSON.stringify({ organizationId: ctx.organizationId, applicationId: ctx.applicationId, messageId, status }),
      });
      setNotice(`Message transitioned to ${status} and webhook event enqueued.`);
      await loadConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not transition message state.");
    } finally {
      setBusy(false);
    }
  }

  const activeConversation = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <section className={styles.page} aria-labelledby="messaging-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Sandbox <span aria-hidden="true">/</span> Messaging scenarios</p>
          <h1 id="messaging-title">Messaging scenarios</h1>
          <p>Simulate synthetic customer conversations, outbound business replies (quota-checked), and deterministic delivery state transitions.</p>
        </div>
        <div className={styles.selectors}>
          <label>
            Organization
            <select value={ctx.organizationId} onChange={(e) => ctx.setOrganizationId(e.target.value)} disabled={ctx.loadingOrgs || !ctx.organizations.length}>
              {ctx.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label>
            Application
            <select value={ctx.applicationId} onChange={(e) => ctx.setApplicationId(e.target.value)} disabled={!ctx.applications.length}>
              {ctx.applications.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        </div>
      </header>

      {(ctx.contextError || error) ? <p className={styles.error} role="alert">{ctx.contextError || error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <div className={styles.formGrid}>
        <div className={styles.toolbar}>
          <input aria-label="Synthetic customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Synthetic customer name" />
          <button type="button" className={styles.primaryBtn} disabled={busy || !ctx.applicationId} onClick={() => void createConversation()}>New synthetic conversation</button>
          <button type="button" className={styles.secondaryBtn} disabled={loading || !ctx.applicationId} onClick={() => void loadConversations()}>Refresh</button>
        </div>
      </div>

      <div className={styles.split}>
        <section className={styles.panel} aria-label="Synthetic conversations">
          <div className={styles.panelHeading}><h2>Conversations ({conversations.length})</h2></div>
          {conversations.length ? (
            <div className={styles.cardList}>
              {conversations.map((conv) => (
                <button key={conv.id} type="button" className={styles.cardBtn} aria-pressed={conv.id === selectedId} onClick={() => setSelectedId(conv.id)}>
                  <strong>{conv.customerName}</strong>
                  <span>{conv.customerReference} · {formatTimestamp(conv.updatedAt)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{loading ? "Loading conversations..." : "No synthetic conversations yet. Create one above or run a scenario."}</p>
          )}
        </section>

        <section className={styles.panel} aria-label="Conversation transcript">
          <div className={styles.panelHeading}><h2>Transcript {activeConversation ? `— ${activeConversation.customerName}` : ""}</h2></div>
          {activeConversation ? (
            <>
              <div className={styles.tableScroll}>
                <table>
                  <thead>
                    <tr><th scope="col">Sender</th><th scope="col">Text</th><th scope="col">State</th><th scope="col">Transitions</th></tr>
                  </thead>
                  <tbody>
                    {(activeConversation.messages ?? []).map((msg) => (
                      <tr key={msg.id}>
                        <td>{msg.sender}</td>
                        <td>{msg.text}</td>
                        <td><code>{msg.status}</code></td>
                        <td>
                          {msg.sender === "business" ? (
                            <div className={styles.actions}>
                              <button type="button" className={styles.secondaryBtn} disabled={busy || msg.status !== "sent"} onClick={() => void transitionMessage(msg.id, "delivered")}>Deliver</button>
                              <button type="button" className={styles.secondaryBtn} disabled={busy || msg.status !== "delivered"} onClick={() => void transitionMessage(msg.id, "read")}>Read</button>
                              <button type="button" className={styles.secondaryBtn} disabled={busy || msg.status === "read" || msg.status === "failed"} onClick={() => void transitionMessage(msg.id, "failed")}>Fail</button>
                            </div>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.formGrid}>
                <label>
                  Simulate message sender
                  <select value={sender} onChange={(e) => setSender(e.target.value as "customer" | "business")}>
                    <option value="customer">Customer (inbound message.received)</option>
                    <option value="business">Business (outbound message.sent, uses quota)</option>
                  </select>
                </label>
                <label>
                  Message text
                  <input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type synthetic message..." />
                </label>
                <div className={styles.toolbar}>
                  <button type="button" className={styles.primaryBtn} disabled={busy || !messageText.trim()} onClick={() => void sendSimulatedMessage()}>Simulate message</button>
                </div>
              </div>
            </>
          ) : (
            <p className={styles.empty}>Select a synthetic conversation to inspect messages and trigger delivery states.</p>
          )}
        </section>
      </div>
    </section>
  );
}
