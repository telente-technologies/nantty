import Link from "next/link";

import { BookOpenIcon, ChatCircleTextIcon, LockIcon, WarningCircleIcon } from "@/components/ui/icons";
import { readDeveloperDocsHref, readDeveloperSupportUrl, readSandboxPortalUrl, readSandboxPublicApiUrl } from "@/config/site.config";

import styles from "./businessMessagingDocs.module.css";

const sandboxEndpoints = [
  ["POST", "/v1/customers", "Create or update a synthetic Sandbox customer"],
  ["POST", "/v1/customers/{customerId}/conversations", "Open a synthetic conversation for a Sandbox customer"],
  ["POST", "/v1/conversations/{conversationId}/messages", "Send an idempotent synthetic business message (monthly quota enforced)"],
  ["GET", "/v1/conversations/{conversationId}/messages", "List up to 100 latest messages in a Sandbox conversation"],
  ["GET", "/v1/events", "List up to 100 latest Sandbox events for this application"],
] as const;

const sandboxErrors = [
  ["400", "IDEMPOTENCY_KEY_REQUIRED / INVALID_REQUEST", "Missing valid Idempotency-Key or invalid JSON body"],
  ["401", "INVALID_SANDBOX_CREDENTIAL", "Missing, invalid, revoked, or expired ntsb_test_ bearer credential"],
  ["404", "CUSTOMER_NOT_FOUND / CONVERSATION_NOT_FOUND", "Target resource does not exist under this Sandbox application"],
  ["409", "IDEMPOTENCY_CONFLICT", "Idempotency-Key reused with a different message payload"],
  ["429", "SANDBOX_QUOTA_EXCEEDED", "Monthly Sandbox message quota exhausted; includes resetAt details"],
] as const;

const changelogEntries = [
  ["2026-11-16", "Published OpenAPI 3.1.0 specification (/openapi.json), Sandbox monthly quota error contract (429 SANDBOX_QUOTA_EXCEEDED), and HMAC-SHA256 webhook verification docs."],
  ["2026-11-15", "Added Sandbox credential rotation/revocation, signed webhook delivery worker with SSRF defenses, and synthetic conversation controls."],
] as const;

const endpointGroups = [
  {
    title: "Conversations and messages",
    rows: [
      ["POST", "/v1/business/messages", "Send an authorized business message"],
      ["GET", "/v1/business/messages/{message_id}", "Read one message and its delivery state"],
      ["GET", "/v1/business/conversations", "List conversations for the authorized business"],
      ["GET", "/v1/business/conversations/{conversation_id}", "Read one business-authorized conversation"],
      ["GET", "/v1/business/conversations/{conversation_id}/messages", "Read a cursor-paginated conversation"],
      ["PATCH", "/v1/business/conversations/{conversation_id}", "Update allowed business conversation state"],
      ["POST", "/v1/business/conversations/{conversation_id}/read", "Advance the business read position"],
      ["POST", "/v1/business/conversations/{conversation_id}/typing", "Publish a short-lived typing state"],
      ["GET", "/v1/business/customers", "List only customers in authorized business relationships"],
      ["GET", "/v1/business/customers/{customer_id}", "Read one business-scoped customer"],
    ],
  },
  {
    title: "Media and approved templates",
    rows: [
      ["POST", "/v1/business/media", "Upload media under business policy and limits"],
      ["GET", "/v1/business/media/{media_id}", "Read an authorized media reference"],
      ["DELETE", "/v1/business/media/{media_id}", "Delete business-owned media"],
      ["POST", "/v1/business/templates", "Submit a template for review"],
      ["GET", "/v1/business/templates", "List business-owned templates"],
      ["GET", "/v1/business/templates/{template_id}", "Read a template and approval state"],
      ["PATCH", "/v1/business/templates/{template_id}", "Update an eligible template"],
      ["DELETE", "/v1/business/templates/{template_id}", "Delete a business-owned template"],
    ],
  },
  {
    title: "Integration operations",
    rows: [
      ["POST", "/v1/business/webhooks", "Register an HTTPS webhook and event subscriptions"],
      ["GET", "/v1/business/webhooks", "List business-owned webhook endpoints"],
      ["GET", "/v1/business/webhooks/{webhook_id}", "Inspect a business-owned webhook"],
      ["PATCH", "/v1/business/webhooks/{webhook_id}", "Update endpoint or event subscriptions"],
      ["DELETE", "/v1/business/webhooks/{webhook_id}", "Revoke a webhook endpoint"],
      ["POST", "/v1/business/webhooks/{webhook_id}/test", "Send a controlled verification event"],
      ["GET", "/v1/business/analytics/messages", "Read authorized message metrics"],
      ["GET", "/v1/business/analytics/usage", "Read authorized, server-recorded usage"],
    ],
  },
] as const;

const scopes = ["messages:send", "messages:read", "conversations:read", "conversations:write", "customers:read", "media:write", "media:read", "webhooks:manage", "analytics:read"];
const webhookEvents = ["message.received", "message.sent", "message.delivered", "message.read", "message.failed", "message.reaction", "message.updated", "message.deleted", "message.interaction", "conversation.started", "conversation.updated", "conversation.closed", "customer.opted_in", "customer.opted_out"];

export function BusinessMessagingDocs() {
  return (
    <article className={styles.page} aria-labelledby="messaging-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}><BookOpenIcon size={16} /> Developer documentation <span aria-hidden="true">/</span> Business messaging</p>
        <h1 id="messaging-title">Business Messaging API</h1>
        <p>Connect an authorized business inbox to your own support tools, CRM, or external automation. Nantty provides the messaging contract and delivery infrastructure; your integration owns its automation logic.</p>
      </header>

      <section className={styles.status} role="status" aria-labelledby="contract-state-title">
        <span className={styles.statusIcon}><WarningCircleIcon size={20} /></span>
        <div>
          <p className={styles.statusLabel}>SANDBOX AVAILABLE · PRODUCTION DRAFT DISABLED</p>
          <h2 id="contract-state-title">Production Business Messaging API is not live yet</h2>
          <p>Production <code>/v1/business/*</code> routes currently return <code>503 BUSINESS_MESSAGING_UNAVAILABLE</code>; no live message is sent or conversation returned. Synthetic integration testing is available in the <a href={readSandboxPortalUrl()}>Nantty Sandbox</a> using <code>ntsb_test_</code> credentials. The <a href={readDeveloperDocsHref("openapi.json")}>OpenAPI 3.1 JSON</a> marks production paths as unavailable previews.</p>
        </div>
      </section>

      <section className={styles.security} aria-labelledby="trust-title">
        <div className={styles.sectionTitle}><LockIcon size={20} /><div><p className={styles.eyebrow}>Trust boundary</p><h2 id="trust-title">Business access is separate from personal chat</h2></div></div>
        <p>Integrations can only access business conversations where their business is an authorized participant and the customer is eligible for messaging. They do not access personal end-to-end encrypted conversations. Automated handling must be disclosed; customers can withdraw consent, report, or block.</p>
      </section>

      <section className={styles.panel} aria-labelledby="sandbox-quickstart-title">
        <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Sandbox quickstart</p><h2 id="sandbox-quickstart-title">Send a synthetic Sandbox message</h2></div><span className={styles.draftPill}>Sandbox · ntsb_test_</span></div>
        <pre className={styles.code}><code>{`curl -X POST "${readSandboxPublicApiUrl()}/v1/conversations/<conversation-id>/messages" \\
  -H "Authorization: Bearer ntsb_test_<credential-secret>" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: msg-2026-11-16-001" \\
  -d '{"text":"Your order is ready for delivery."}'`}</code></pre>
        <div className={styles.endpointTableScroll}>
          <table className={styles.endpointTable}>
            <thead><tr><th scope="col">Method</th><th scope="col">Sandbox endpoint</th><th scope="col">Purpose</th></tr></thead>
            <tbody>{sandboxEndpoints.map(([method, path, description]) => <tr key={`${method}:${path}`}>
              <td><span className={styles.method}>{method}</span></td><td><code>{path}</code></td><td>{description}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className={styles.note}>Sandbox credentials begin with <code>ntsb_test_</code>, never authorize production requests, and enforce atomic monthly message quotas (<code>429 SANDBOX_QUOTA_EXCEEDED</code>).</p>
      </section>

      <section className={styles.panel} aria-labelledby="webhook-verify-title">
        <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Webhook security</p><h2 id="webhook-verify-title">Verify signed webhook deliveries</h2></div><span className={styles.draftPill}>HMAC-SHA256</span></div>
        <pre className={styles.code}><code>{`// Header: nantty-signature: t=<unix-seconds>,v1=<hex-hmac-sha256>
// Header: nantty-event-id: <uuid> (deduplicate at-least-once deliveries)
const timestampSeconds = Number(timestamp);
if (!Number.isSafeInteger(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) throw new Error("Expired webhook signature");
const signedPayload = \`\${timestamp}.\${rawRequestBody}\`;
const expected = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");
const provided = /^[a-f0-9]{64}$/i.test(v1Signature) ? Buffer.from(v1Signature, "hex") : Buffer.alloc(0);
const valid = provided.length === 32 && timingSafeEqual(provided, Buffer.from(expected, "hex"));`}</code></pre>
        <p className={styles.note}>Reject deliveries whose <code>t=</code> timestamp falls outside your replay window (for example, 300 seconds) and compare digests in constant time.</p>
      </section>

      <section className={styles.panel} aria-labelledby="request-contract-title">
        <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Proposed production contract</p><h2 id="request-contract-title">Send a business text</h2></div><span className={styles.draftPill}>Proposed · v1</span></div>
        <pre className={styles.code}><code>{`POST /v1/business/messages
Authorization: Bearer <business-scoped-access-token>
Content-Type: application/json
Idempotency-Key: <unique-request-id>

{
  "conversation_id": "<authorized-conversation-id>",
  "type": "text",
  "text": { "body": "Your order is ready for delivery." }
}`}</code></pre>
        <p className={styles.note}>A successful acceptance would mean <code>queued</code>, not delivered. Delivery is asynchronous and reported through the message lifecycle/webhook events. The idempotency key must be durable and scoped to the application.</p>
      </section>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="endpoint-title">
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Contract map</p><h2 id="endpoint-title">Proposed endpoints</h2></div></div>
          {endpointGroups.map((group) => <div className={styles.endpointGroup} key={group.title}>
            <h3>{group.title}</h3>
            <div className={styles.endpointTableScroll}>
              <table className={styles.endpointTable}>
                <thead><tr><th scope="col">Method</th><th scope="col">Endpoint</th><th scope="col">Purpose</th></tr></thead>
                <tbody>{group.rows.map(([method, path, description]) => <tr key={`${method}:${path}`}>
                  <td><span className={styles.method}>{method}</span></td><td><code>{path}</code></td><td>{description}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>)}
          <p className={styles.note}>This complete candidate route map is still only a proposal. Commerce routes are intentionally excluded and would require separate scopes, privacy review, and contracts.</p>
        </section>

        <section className={styles.panel} aria-labelledby="scopes-title">
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Least privilege</p><h2 id="scopes-title">Requested scopes</h2></div></div>
          <ul className={styles.scopeList}>{scopes.map((scope) => <li key={scope}><code>{scope}</code></li>)}</ul>
          <h3 className={styles.subheading}>Message lifecycle</h3>
          <ol className={styles.lifecycle}><li>queued</li><li>sent</li><li>delivered</li><li>read</li><li>failed</li></ol>
          <p className={styles.note}>Webhook delivery is at-least-once: consumers must deduplicate event IDs. No exactly-once delivery guarantee is made.</p>
          <h3 className={styles.subheading}>Initial event types</h3>
          <ul className={styles.eventList}>{webhookEvents.map((event) => <li key={event}><code>{event}</code></li>)}</ul>
          <p className={styles.note}>Signatures, timestamp/replay checks, endpoint verification, SSRF defenses, bounded retries, durable event IDs, and dead-letter inspection are release gates—not live capabilities yet.</p>
        </section>
      </div>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="errors-title">
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Error contract</p><h2 id="errors-title">Sandbox error responses</h2></div></div>
          <div className={styles.endpointTableScroll}>
            <table className={styles.endpointTable}>
              <thead><tr><th scope="col">Status</th><th scope="col">Code</th><th scope="col">Meaning</th></tr></thead>
              <tbody>{sandboxErrors.map(([status, code, meaning]) => <tr key={code}>
                <td><span className={styles.method}>{status}</span></td><td><code>{code}</code></td><td>{meaning}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className={styles.note}>Error responses follow <code>{`{"error":{"code","message","details?"}}`}</code>. See <a href={readDeveloperDocsHref("openapi.json")}>OpenAPI 3.1 JSON</a> for full schema definitions.</p>
        </section>

        <section className={styles.panel} aria-labelledby="changelog-title">
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>API changelog</p><h2 id="changelog-title">Contract updates</h2></div></div>
          <div className={styles.endpointTableScroll}>
            <table className={styles.endpointTable}>
              <thead><tr><th scope="col">Date</th><th scope="col">Update</th></tr></thead>
              <tbody>{changelogEntries.map(([date, update]) => <tr key={date}>
                <td><code>{date}</code></td><td>{update}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <ChatCircleTextIcon size={20} />
        <p>Need help with a business messaging integration? <Link href={readDeveloperSupportUrl()}>Contact Developer support</Link> and include the environment, endpoint, request ID, and a redacted error. Never include credentials, message contents, or customer personal data.</p>
      </footer>
    </article>
  );
}
