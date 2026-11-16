"use client";

import { useState } from "react";

import styles from "./sandboxWorkspace.module.css";
import { sandboxFetch, useSandboxContext } from "./useSandboxContext";

const scenarios = [
  { id: "inbound_reply_cycle", title: "Inbound reply cycle", description: "Creates a synthetic customer, simulates an inbound customer message, emits message.received, and logs a delivered business reply." },
  { id: "delivery_receipt_chain", title: "Delivery receipt chain", description: "Simulates inbound inquiry and business reply advancing to message.read with matching signed webhook outbox events." },
  { id: "failed_delivery_webhook", title: "Failed delivery webhook", description: "Simulates a failed outbound delivery producing a message.failed webhook event for retry and dead-letter testing." },
] as const;

export function SandboxScenariosWorkspace() {
  const ctx = useSandboxContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastResult, setLastResult] = useState<unknown>(null);

  async function runScenario(scenario: string) {
    if (!ctx.organizationId || !ctx.applicationId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await sandboxFetch<Record<string, unknown>>("/api/sandbox/scenarios", {
        method: "POST",
        body: JSON.stringify({ organizationId: ctx.organizationId, applicationId: ctx.applicationId, scenario }),
      });
      setLastResult(result);
      setNotice(`Scenario "${scenario}" completed and queued webhook events.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scenario failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resetSandbox() {
    if (!ctx.organizationId || !ctx.applicationId || busy) return;
    if (!window.confirm("Reset synthetic customers, conversations, messages, and events for this application? Billing-period usage counters and request logs are preserved.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await sandboxFetch<Record<string, unknown>>("/api/sandbox/reset", {
        method: "POST",
        body: JSON.stringify({ organizationId: ctx.organizationId, applicationId: ctx.applicationId }),
      });
      setLastResult(result);
      setNotice("Synthetic customers, conversations, and events cleared. Usage counters and request history were preserved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sandbox reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="scenarios-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Sandbox <span aria-hidden="true">/</span> Scenarios</p>
          <h1 id="scenarios-title">Scenarios</h1>
          <p>Run deterministic messaging and webhook fixtures in your isolated sandbox, or reset synthetic data without clearing quota usage.</p>
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

      <section className={styles.panel} aria-label="Deterministic scenarios">
        <div className={styles.panelHeading}>
          <div><h2>Available scenarios</h2><p>Each run creates synthetic records scoped strictly to this sandbox application.</p></div>
          <button type="button" className={styles.secondaryBtn} disabled={busy || !ctx.applicationId} onClick={() => void resetSandbox()}>Reset synthetic data</button>
        </div>
        <div className={styles.tableScroll}>
          <table>
            <thead><tr><th scope="col">Scenario</th><th scope="col">Behavior</th><th scope="col">Run</th></tr></thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.title}</strong><br /><code>{s.id}</code></td>
                  <td>{s.description}</td>
                  <td><button type="button" className={styles.primaryBtn} disabled={busy || !ctx.applicationId} onClick={() => void runScenario(s.id)}>Run scenario</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {lastResult ? (
        <section className={styles.panel} aria-label="Last scenario output">
          <div className={styles.panelHeading}><h2>Last execution result</h2></div>
          <pre className={styles.codeBox}>{JSON.stringify(lastResult, null, 2)}</pre>
        </section>
      ) : null}
    </section>
  );
}
