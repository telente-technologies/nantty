"use client";

import { useState } from "react";

import styles from "./sandboxWorkspace.module.css";
import { sandboxFetch } from "./useSandboxContext";

const operations = [
  { id: "create_customer", label: "POST /v1/customers — Create synthetic customer", needsConversation: false, needsIdempotency: false, template: '{\n  "externalReference": "cust-sandbox-001",\n  "displayName": "Ada Sandbox"\n}' },
  { id: "create_conversation", label: "POST /v1/conversations — Open synthetic conversation", needsConversation: false, needsIdempotency: false, template: '{\n  "customerId": "00000000-0000-4000-8000-000000000000"\n}' },
  { id: "list_messages", label: "GET /v1/conversations/:id/messages — List conversation messages", needsConversation: true, needsIdempotency: false, template: "{}" },
  { id: "send_message", label: "POST /v1/conversations/:id/messages — Send business message", needsConversation: true, needsIdempotency: true, template: '{\n  "text": "Hello from the Nantty Sandbox API Explorer"\n}' },
  { id: "send_test_event", label: "POST /v1/webhooks/test-events — Emit synthetic test event", needsConversation: false, needsIdempotency: false, template: '{\n  "event": "message.delivered",\n  "data": { "sample": true }\n}' },
] as const;

type OperationId = (typeof operations)[number]["id"];

export function SandboxExplorerWorkspace() {
  const [operation, setOperation] = useState<OperationId>("create_customer");
  const [token, setToken] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("explorer-key-001");
  const [payloadText, setPayloadText] = useState<string>(operations[0].template);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<{ readonly status: number; readonly requestId: string | null; readonly idempotentReplayed: boolean; readonly body: unknown } | null>(null);

  const selected = operations.find((op) => op.id === operation) ?? operations[0];

  function selectOperation(next: OperationId) {
    setOperation(next);
    const found = operations.find((op) => op.id === next);
    if (found) setPayloadText(found.template);
    setError("");
  }

  async function executeRequest() {
    if (busy) return;
    setError("");
    let parsedPayload: unknown = {};
    if (operation !== "list_messages") {
      try {
        parsedPayload = JSON.parse(payloadText);
      } catch {
        setError("Request payload must be valid JSON.");
        return;
      }
    }
    setBusy(true);
    try {
      const res = await sandboxFetch<{ status: number; requestId: string | null; idempotentReplayed: boolean; body: unknown }>("/api/sandbox/explorer", {
        method: "POST",
        body: JSON.stringify({
          operation,
          token,
          conversationId,
          idempotencyKey: selected.needsIdempotency ? idempotencyKey : undefined,
          payload: parsedPayload,
        }),
      });
      setResponse(res);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not execute sandbox API request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="explorer-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Sandbox <span aria-hidden="true">/</span> API explorer</p>
          <h1 id="explorer-title">API explorer</h1>
          <p>Execute documented Sandbox API calls using an in-memory <code>ntsb_test_</code> credential. Tokens are never saved in browser storage.</p>
        </div>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <div className={styles.split}>
        <section className={styles.formGrid} aria-label="Request builder">
          <label>
            Documented operation
            <select value={operation} onChange={(e) => selectOperation(e.target.value as OperationId)}>
              {operations.map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
            </select>
          </label>
          <label>
            Sandbox bearer token (in-memory only)
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ntsb_test_..." autoComplete="off" />
          </label>
          {selected.needsConversation ? (
            <label>
              Conversation ID (UUID)
              <input value={conversationId} onChange={(e) => setConversationId(e.target.value)} placeholder="00000000-0000-4000-8000-000000000000" />
            </label>
          ) : null}
          {selected.needsIdempotency ? (
            <label>
              Idempotency-Key header
              <input value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} />
            </label>
          ) : null}
          {operation !== "list_messages" ? (
            <label>
              JSON body
              <textarea value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
            </label>
          ) : null}
          <div className={styles.toolbar}>
            <button type="button" className={styles.primaryBtn} disabled={busy || !token.trim()} onClick={() => void executeRequest()}>
              {busy ? "Sending..." : "Send sandbox request"}
            </button>
          </div>
        </section>

        <section className={styles.panel} aria-label="Response inspector">
          <div className={styles.panelHeading}>
            <h2>Response</h2>
            {response ? <span>HTTP {response.status} · Request ID: <code>{response.requestId ?? "—"}</code>{response.idempotentReplayed ? " · Idempotent replay" : ""}</span> : null}
          </div>
          <pre className={styles.codeBox}>
            {response ? JSON.stringify(response.body, null, 2) : "No request has been sent yet."}
          </pre>
        </section>
      </div>
    </section>
  );
}
