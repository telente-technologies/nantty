import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { afterAll, expect, it } from "vitest";
import { Pool } from "pg";

import { createSandboxApp } from "../src/sandboxApp.js";
import { decryptWebhookSecret } from "../src/webhookControlSupport.js";
import { WebhookDeliveryError, WebhookTargetError } from "../src/webhookSecurity.js";
import { processDueWebhookDeliveries } from "../src/webhookOutbox.js";

const databaseUrl = process.env.SANDBOX_TEST_DATABASE_URL;
const controlToken = "sandbox-control-integration-token-with-sufficient-entropy";
const actorAccountId = "3fbcd9fc-dab8-4e3e-a832-209ae7ffbb5d";
const organizationId = "6de1c79a-00fd-4bed-ae23-fbfb678c0a19";
const applicationId = "19a6e03c-d5ce-40c9-a9d2-8aa8657e5738";
const headers = { authorization: `Bearer ${controlToken}`, "x-nantty-actor-account-id": actorAccountId };
const encryptionKey = Buffer.alloc(32, 11);
const adminPool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

afterAll(async () => { await adminPool?.end(); });

it.skipIf(!databaseUrl)("persists sandbox webhook CRUD, protects the signing secret, scopes records, and audits actors", async () => {
  const schema = `sandbox_webhook_${randomUUID().replaceAll("-", "")}`;
  const schemaIdentifier = `"${schema}"`;
  const migration = await readFile(new URL("../prisma/migrations/20261115120000_sandbox_core/migration.sql", import.meta.url), "utf8");
  const schemaClient = await adminPool!.connect();
  let database: Pool | null = null;
  let app: ReturnType<typeof createSandboxApp> | null = null;
  try {
    await schemaClient.query(`CREATE SCHEMA ${schemaIdentifier}`);
    await schemaClient.query(`SET search_path TO ${schemaIdentifier}, public`);
    await schemaClient.query(migration);
    database = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema},public` });
    const sandboxAppId = randomUUID();
    const otherSandboxAppId = randomUUID();
    const customerId = randomUUID();
    const conversationId = randomUUID();
    await database.query(
      "INSERT INTO sandbox_applications (id, organization_id, external_application_id, name, status) VALUES ($1,$2,$3,'Webhook test app','active'),($4,$2,$5,'Other app','active')",
      [sandboxAppId, organizationId, applicationId, otherSandboxAppId, "f3770eb7-42a6-48ec-a606-174c03c54c50"],
    );
    await database.query("INSERT INTO sandbox_customers (id,application_id,external_reference,display_name) VALUES ($1,$2,'customer-1','Sandbox customer')", [customerId, sandboxAppId]);
    await database.query("INSERT INTO sandbox_conversations (id,application_id,customer_id,status) VALUES ($1,$2,$3,'open')", [conversationId, sandboxAppId, customerId]);
    app = createSandboxApp({
      database,
      controlToken,
      secretEncryptionKey: encryptionKey,
      resolveWebhookTarget: async (value) => {
        if (value.includes("reject")) throw new WebhookTargetError("WEBHOOK_HOST_NOT_PUBLIC");
        return { url: new URL(value), hostname: new URL(value).hostname, address: "8.8.8.8", family: 4 };
      },
    });

    const collection = `/v1/control/organizations/${organizationId}/applications/${applicationId}/webhooks`;
    const missingActor = await app.inject({ method: "GET", url: collection, headers: { authorization: `Bearer ${controlToken}` } });
    expect(missingActor.statusCode).toBe(400);
    const rejectedTarget = await app.inject({ method: "POST", url: collection, headers, payload: { url: "https://reject.example/hook", events: ["message.received"] } });
    expect(rejectedTarget.statusCode).toBe(422);

    const createdResponse = await app.inject({
      method: "POST",
      url: collection,
      headers,
      payload: { url: "https://hooks.example.org/nantty", description: "Integration receiver", events: ["message.received", "message.read"] },
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json() as { readonly webhook: { readonly id: string; readonly active: boolean }; readonly signingSecret: string };
    expect(created.signingSecret).toMatch(/^whsec_[A-Za-z0-9_-]{40,}$/);
    expect(created.webhook.active).toBe(true);

    const newApplicationId = randomUUID();
    const newApplicationCollection = `/v1/control/organizations/${organizationId}/applications/${newApplicationId}/webhooks`;
    const firstWebhookForApplication = await app.inject({
      method: "POST",
      url: newApplicationCollection,
      headers,
      payload: { applicationName: "Fresh Nantty integration", url: "https://fresh.example.org/events", events: ["message.failed"] },
    });
    expect(firstWebhookForApplication.statusCode).toBe(201);
    const provisionedApplication = await database.query<{ readonly name: string }>("SELECT name FROM sandbox_applications WHERE organization_id=$1 AND external_application_id=$2", [organizationId, newApplicationId]);
    expect(provisionedApplication.rows[0]?.name).toBe("Fresh Nantty integration");

    const stored = await database.query<{ readonly secret_nonce: Buffer; readonly secret_ciphertext: Buffer; readonly secret_tag: Buffer }>(
      "SELECT secret_nonce, secret_ciphertext, secret_tag FROM sandbox_webhook_endpoints WHERE id=$1",
      [created.webhook.id],
    );
    expect(decryptWebhookSecret(encryptionKey, {
      nonce: stored.rows[0]!.secret_nonce,
      ciphertext: stored.rows[0]!.secret_ciphertext,
      tag: stored.rows[0]!.secret_tag,
    })).toBe(created.signingSecret);
    expect(stored.rows[0]!.secret_ciphertext.toString()).not.toContain(created.signingSecret);

    const listed = await app.inject({ method: "GET", url: collection, headers });
    expect(listed.statusCode).toBe(200);
    expect(listed.body).not.toContain(created.signingSecret);
    expect(listed.json()).toMatchObject({ webhooks: [{ id: created.webhook.id, description: "Integration receiver", events: ["message.received", "message.read"] }] });

    const inbound = await app.inject({
      method: "POST",
      url: `/v1/control/conversations/${conversationId}/inbound`,
      headers: { authorization: `Bearer ${controlToken}`, "idempotency-key": "webhook-inbound-1" },
      payload: { text: "An isolated sandbox message" },
    });
    expect(inbound.statusCode).toBe(201);
    const queued = await database.query<{ readonly event_type: string; readonly status: string }>(
      "SELECT v.event_type,d.status FROM sandbox_webhook_deliveries d JOIN sandbox_events v ON v.id=d.event_id WHERE d.endpoint_id=$1 ORDER BY d.created_at,d.id",
      [created.webhook.id],
    );
    expect(queued.rows).toEqual([{ event_type: "message.received", status: "pending" }]);

    const testDelivery = await app.inject({ method: "POST", url: `${collection}/${created.webhook.id}/test`, headers });
    expect(testDelivery.statusCode).toBe(202);
    expect(testDelivery.json()).toMatchObject({ status: "pending" });
    const deliveryLog = await app.inject({ method: "GET", url: `${collection}/deliveries`, headers });
    expect(deliveryLog.statusCode).toBe(200);
    expect(deliveryLog.json().deliveries).toHaveLength(2);
    expect(deliveryLog.body).not.toContain("An isolated sandbox message");

    const firstDelivery = await database.query<{ readonly id: string }>("SELECT id FROM sandbox_webhook_deliveries WHERE endpoint_id=$1 ORDER BY created_at,id LIMIT 1", [created.webhook.id]);
    await database.query("UPDATE sandbox_webhook_deliveries SET attempts=7,available_at=now() WHERE id=$1", [firstDelivery.rows[0]!.id]);
    await database.query("UPDATE sandbox_webhook_deliveries SET available_at=now()+interval '1 day' WHERE id<>$1", [firstDelivery.rows[0]!.id]);
    await expect(processDueWebhookDeliveries(database, {
      secretEncryptionKey: encryptionKey,
      batchSize: 1,
      resolveTarget: async (url) => ({ url: new URL(url), hostname: new URL(url).hostname, address: "8.8.8.8", family: 4 }),
      send: async () => { throw new WebhookDeliveryError("ENDPOINT_REJECTED"); },
    })).resolves.toBe(1);
    const failed = await database.query<{ readonly status: string }>("SELECT status FROM sandbox_webhook_deliveries WHERE id=$1", [firstDelivery.rows[0]!.id]);
    expect(failed.rows[0]?.status).toBe("failed");

    const retried = await app.inject({ method: "POST", url: `${collection}/${created.webhook.id}/deliveries/${firstDelivery.rows[0]!.id}/retry`, headers });
    expect(retried.statusCode).toBe(202);
    await expect(processDueWebhookDeliveries(database, {
      secretEncryptionKey: encryptionKey,
      batchSize: 1,
      resolveTarget: async (url) => ({ url: new URL(url), hostname: new URL(url).hostname, address: "8.8.8.8", family: 4 }),
      send: async () => ({ statusCode: 204, durationMilliseconds: 4 }),
    })).resolves.toBe(1);
    const delivered = await database.query<{ readonly status: string; readonly attempts: number }>("SELECT status,attempts FROM sandbox_webhook_deliveries WHERE id=$1", [firstDelivery.rows[0]!.id]);
    expect(delivered.rows[0]).toEqual({ status: "succeeded", attempts: 1 });

    const otherCollection = `/v1/control/organizations/${organizationId}/applications/f3770eb7-42a6-48ec-a606-174c03c54c50/webhooks`;
    expect((await app.inject({ method: "DELETE", url: `${otherCollection}/${created.webhook.id}`, headers })).statusCode).toBe(404);
    const updated = await app.inject({ method: "PATCH", url: `${collection}/${created.webhook.id}`, headers, payload: { active: false, description: "Paused receiver" } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ webhook: { active: false, description: "Paused receiver" } });
    expect((await app.inject({ method: "DELETE", url: `${collection}/${created.webhook.id}`, headers })).statusCode).toBe(204);

    const audits = await database.query<{ readonly actor: string; readonly action: string }>("SELECT actor, action FROM sandbox_control_audit ORDER BY created_at, id");
    expect(audits.rows.map((row) => row.action).sort()).toEqual(["webhook.created", "webhook.created", "webhook.deleted", "webhook.delivery_retried", "webhook.test_queued", "webhook.updated"]);
    expect(audits.rows.every((row) => row.actor === actorAccountId)).toBe(true);
  } finally {
    await app?.close();
    await database?.end();
    await schemaClient.query("RESET search_path");
    await schemaClient.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`);
    schemaClient.release();
  }
});
