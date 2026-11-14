import Link from "next/link";

import { BookOpenIcon, ChatCircleTextIcon, LockIcon, WarningCircleIcon } from "@/components/ui/icons";
import { readDeveloperSupportUrl } from "@/config/site.config";

import styles from "./businessMessagingDocs.module.css";

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
          <p className={styles.statusLabel}>DRAFT CONTRACT · REQUESTS DISABLED</p>
          <h2 id="contract-state-title">This public API is not live yet</h2>
          <p>These routes describe the proposed v1 surface from the internal specification. They are not routed by the production API gateway, and this page does not send requests or return simulated success.</p>
        </div>
      </section>

      <section className={styles.security} aria-labelledby="trust-title">
        <div className={styles.sectionTitle}><LockIcon size={20} /><div><p className={styles.eyebrow}>Trust boundary</p><h2 id="trust-title">Business access is separate from personal chat</h2></div></div>
        <p>Integrations can only access business conversations where their business is an authorized participant and the customer is eligible for messaging. They do not access personal end-to-end encrypted conversations. Automated handling must be disclosed; customers can withdraw consent, report, or block.</p>
      </section>

      <section className={styles.panel} aria-labelledby="request-contract-title">
        <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Request contract</p><h2 id="request-contract-title">Send a business text</h2></div><span className={styles.draftPill}>Proposed · v1</span></div>
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

      <footer className={styles.footer}>
        <ChatCircleTextIcon size={20} />
        <p>Need help with a business messaging integration? <Link href={readDeveloperSupportUrl()}>Contact Developer support</Link> and include the environment, endpoint, request ID, and a redacted error. Never include credentials, message contents, or customer personal data.</p>
      </footer>
    </article>
  );
}
