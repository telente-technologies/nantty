import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { afterAll, expect, it } from "vitest";
import { Pool } from "pg";

import { hashSandboxCredential } from "../src/credentials.js";
import { createSandboxApp } from "../src/sandboxApp.js";

const databaseUrl = process.env.SANDBOX_TEST_DATABASE_URL;
const controlToken = "sandbox-control-integration-token-with-sufficient-entropy";
const actorAccountId = "3fbcd9fc-dab8-4e3e-a832-209ae7ffbb5d";
const organizationId = "6de1c79a-00fd-4bed-ae23-fbfb678c0a19";
const applicationId = "19a6e03c-d5ce-40c9-a9d2-8aa8657e5738";
const otherApplicationId = "f3770eb7-42a6-48ec-a606-174c03c54c50";
const requestHeaders = { authorization: `Bearer ${controlToken}`, "x-nantty-actor-account-id": actorAccountId };
const adminPool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

afterAll(async () => { await adminPool?.end(); });

it.skipIf(!databaseUrl)("persists sandbox credential issue, list, rotate, expiry, app scope, and actor audit in an isolated schema", async () => {
  const schema = `sandbox_credential_${randomUUID().replaceAll("-", "")}`;
  const schemaIdentifier = `"${schema}"`;
  const migration = await readFile(new URL("../prisma/migrations/20261115120000_sandbox_core/migration.sql", import.meta.url), "utf8");
  const quotaMigration = await readFile(new URL("../prisma/migrations/20261116130000_sandbox_quotas_and_scenarios/migration.sql", import.meta.url), "utf8");
  const organizationUsageMigration = await readFile(new URL("../prisma/migrations/20261119160000_organization_wide_sandbox_usage/migration.sql", import.meta.url), "utf8");
  const schemaClient = await adminPool!.connect();
  let database: Pool | null = null;
  let app: ReturnType<typeof createSandboxApp> | null = null;
  try {
    await schemaClient.query(`CREATE SCHEMA ${schemaIdentifier}`);
    await schemaClient.query(`SET search_path TO ${schemaIdentifier}, public`);
    await schemaClient.query(migration);
    await schemaClient.query(quotaMigration);
    const legacyOrg = "legacy-shared-org";
    const legacyAppOne = randomUUID();
    const legacyAppTwo = randomUUID();
    await schemaClient.query(
      "INSERT INTO sandbox_applications (id,organization_id,external_application_id,name,status) VALUES ($1,$3,'legacy-app-1','Legacy one','active'),($2,$3,'legacy-app-2','Legacy two','active')",
      [legacyAppOne, legacyAppTwo, legacyOrg],
    );
    await schemaClient.query(
      "INSERT INTO sandbox_usage_periods (application_id,billing_period,messages_sent,requests_count,scenarios_run,quota_limit_messages) VALUES ($1,'2026-11',3,5,1,1000),($2,'2026-11',4,7,2,900)",
      [legacyAppOne, legacyAppTwo],
    );
    await schemaClient.query(organizationUsageMigration);
    const migratedUsage = await schemaClient.query<{ readonly messages_sent: number; readonly requests_count: number; readonly scenarios_run: number; readonly quota_limit_messages: number }>(
      "SELECT messages_sent,requests_count,scenarios_run,quota_limit_messages FROM sandbox_organization_usage_periods WHERE organization_id=$1 AND billing_period='2026-11'",
      [legacyOrg],
    );
    expect(migratedUsage.rows[0]).toEqual({ messages_sent: 7, requests_count: 12, scenarios_run: 3, quota_limit_messages: 900 });
    await schemaClient.query("UPDATE sandbox_usage_periods SET messages_sent=5 WHERE application_id=$1 AND billing_period='2026-11'", [legacyAppOne]);
    const synchronizedUsage = await schemaClient.query<{ readonly messages_sent: number }>("SELECT messages_sent FROM sandbox_organization_usage_periods WHERE organization_id=$1 AND billing_period='2026-11'", [legacyOrg]);
    expect(synchronizedUsage.rows[0]?.messages_sent).toBe(9);
    database = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema},public` });
    app = createSandboxApp({ database, controlToken });

    const credentialUrl = (targetApplicationId: string) => `/v1/control/organizations/${organizationId}/applications/${targetApplicationId}/credentials`;
    const issuedResponse = await app.inject({ method: "POST", url: credentialUrl(applicationId), headers: requestHeaders, payload: { name: "Nantty CRM" } });
    const issued = issuedResponse.json() as { readonly id: string; readonly token: string; readonly prefix: string };
    expect(issuedResponse.statusCode).toBe(201);
    expect(issued.token).toMatch(/^ntsb_test_/);
    const stored = await database.query<{ readonly token_hash: string; readonly token_prefix: string }>("SELECT token_hash, token_prefix FROM sandbox_credentials WHERE id=$1", [issued.id]);
    expect(stored.rows[0]?.token_hash).toBe(hashSandboxCredential(issued.token));
    expect(stored.rows[0]?.token_hash).not.toBe(issued.token);
    expect(stored.rows[0]?.token_prefix).toBe(issued.prefix);

    const listedResponse = await app.inject({ method: "GET", url: credentialUrl(applicationId), headers: requestHeaders });
    expect(listedResponse.statusCode).toBe(200);
    expect(listedResponse.json()).toMatchObject({ credentials: [{ id: issued.id, prefix: issued.prefix, revokedAt: null }] });
    expect(listedResponse.body).not.toContain(issued.token);

    const otherIssuedResponse = await app.inject({ method: "POST", url: credentialUrl(otherApplicationId), headers: requestHeaders, payload: { name: "Other CRM" } });
    const otherIssued = otherIssuedResponse.json() as { readonly id: string; readonly token: string };
    expect(otherIssuedResponse.statusCode).toBe(201);
    const crossApplicationRevoke = await app.inject({ method: "DELETE", url: `${credentialUrl(otherApplicationId)}/${issued.id}`, headers: requestHeaders });
    expect(crossApplicationRevoke.statusCode).toBe(404);

    const rotationResponse = await app.inject({ method: "POST", url: `${credentialUrl(applicationId)}/${issued.id}/rotate`, headers: requestHeaders, payload: { expiresAt: null } });
    const rotated = rotationResponse.json() as { readonly id: string; readonly token: string };
    expect(rotationResponse.statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/v1/customers", headers: { authorization: `Bearer ${issued.token}` }, payload: { externalReference: "old-key", displayName: "Old key" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/customers", headers: { authorization: `Bearer ${rotated.token}` }, payload: { externalReference: "rotated-key", displayName: "Rotated key" } })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/v1/customers", headers: { authorization: `Bearer ${otherIssued.token}` }, payload: { externalReference: "other-key", displayName: "Other key" } })).statusCode).toBe(201);

    const customerResponse = await app.inject({ method: "POST", url: "/v1/customers", headers: { authorization: `Bearer ${rotated.token}` }, payload: { externalReference: "messaging-customer", displayName: "Sandbox customer" } });
    const customer = customerResponse.json() as { readonly id: string };
    expect(customerResponse.statusCode).toBe(201);
    const conversationResponse = await app.inject({ method: "POST", url: `/v1/customers/${customer.id}/conversations`, headers: { authorization: `Bearer ${rotated.token}` } });
    const conversation = conversationResponse.json() as { readonly id: string };
    expect(conversationResponse.statusCode).toBe(201);

    const inboundPath = `/v1/control/conversations/${conversation.id}/inbound`;
    const inboundHeaders = { authorization: `Bearer ${controlToken}`, "idempotency-key": "customer-message-1" };
    const inboundResponse = await app.inject({ method: "POST", url: inboundPath, headers: inboundHeaders, payload: { text: "Hello from the test customer" } });
    const inbound = inboundResponse.json() as { readonly id: string };
    expect(inboundResponse.statusCode).toBe(201);
    const inboundReplay = await app.inject({ method: "POST", url: inboundPath, headers: inboundHeaders, payload: { text: "Hello from the test customer" } });
    expect(inboundReplay.statusCode).toBe(200);
    expect(inboundReplay.json().id).toBe(inbound.id);
    expect((await app.inject({ method: "POST", url: inboundPath, headers: inboundHeaders, payload: { text: "Changed customer content" } })).statusCode).toBe(409);

    const messagePath = `/v1/conversations/${conversation.id}/messages`;
    const history = await app.inject({ method: "GET", url: messagePath, headers: { authorization: `Bearer ${rotated.token}` } });
    expect(history.statusCode).toBe(200);
    expect(history.json().messages).toMatchObject([{ id: inbound.id, sender: "customer", text: "Hello from the test customer", status: "received" }]);
    expect((await app.inject({ method: "GET", url: messagePath, headers: { authorization: `Bearer ${otherIssued.token}` } })).statusCode).toBe(404);

    const outboundHeaders = { authorization: `Bearer ${rotated.token}`, "idempotency-key": "business-reply-1" };
    const outboundResponse = await app.inject({ method: "POST", url: messagePath, headers: outboundHeaders, payload: { text: "Hello from the test business" } });
    const outbound = outboundResponse.json() as { readonly id: string };
    expect(outboundResponse.statusCode).toBe(201);
    const outboundReplay = await app.inject({ method: "POST", url: messagePath, headers: outboundHeaders, payload: { text: "Hello from the test business" } });
    expect(outboundReplay.statusCode).toBe(200);
    expect(outboundReplay.json().id).toBe(outbound.id);
    expect((await app.inject({ method: "POST", url: messagePath, headers: outboundHeaders, payload: { text: "A different retry payload" } })).statusCode).toBe(409);

    const transitionPath = `/v1/control/messages/${outbound.id}/transition`;
    const delivered = await app.inject({ method: "POST", url: transitionPath, headers: { authorization: `Bearer ${controlToken}` }, payload: { status: "delivered" } });
    expect(delivered.statusCode).toBe(200);
    expect(delivered.json()).toMatchObject({ messageId: outbound.id, status: "delivered" });
    const deliveredReplay = await app.inject({ method: "POST", url: transitionPath, headers: { authorization: `Bearer ${controlToken}` }, payload: { status: "delivered" } });
    expect(deliveredReplay.statusCode).toBe(200);
    expect(deliveredReplay.json().eventId).toBeNull();
    const read = await app.inject({ method: "POST", url: transitionPath, headers: { authorization: `Bearer ${controlToken}` }, payload: { status: "read" } });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({ messageId: outbound.id, status: "read" });
    expect((await app.inject({ method: "POST", url: transitionPath, headers: { authorization: `Bearer ${controlToken}` }, payload: { status: "failed" } })).statusCode).toBe(409);

    const eventsResponse = await app.inject({ method: "GET", url: "/v1/events", headers: { authorization: `Bearer ${rotated.token}` } });
    expect(eventsResponse.statusCode).toBe(200);
    expect(eventsResponse.json().events.map((event: { eventType: string }) => event.eventType).sort()).toEqual(["message.delivered", "message.read", "message.received"]);

    const expiry = new Date(Date.now() + 120_000).toISOString();
    const expiringResponse = await app.inject({ method: "POST", url: credentialUrl(applicationId), headers: requestHeaders, payload: { name: "Short lived", expiresAt: expiry } });
    const expiring = expiringResponse.json() as { readonly id: string; readonly token: string };
    expect(expiringResponse.statusCode).toBe(201);
    await database.query("UPDATE sandbox_credentials SET expires_at=now() - interval '1 second' WHERE id=$1", [expiring.id]);
    expect((await app.inject({ method: "POST", url: "/v1/customers", headers: { authorization: `Bearer ${expiring.token}` }, payload: { externalReference: "expired-key", displayName: "Expired key" } })).statusCode).toBe(401);

    const revoke = await app.inject({ method: "DELETE", url: `${credentialUrl(applicationId)}/${rotated.id}`, headers: requestHeaders });
    expect(revoke.statusCode).toBe(204);
    expect((await app.inject({ method: "POST", url: "/v1/customers", headers: { authorization: `Bearer ${rotated.token}` }, payload: { externalReference: "revoked-key", displayName: "Revoked key" } })).statusCode).toBe(401);

    const audits = await database.query<{ readonly actor: string; readonly action: string; readonly application_id: string }>("SELECT actor, action, application_id FROM sandbox_control_audit ORDER BY created_at, id");
    expect(audits.rows.filter((row) => row.actor === actorAccountId)).toHaveLength(5);
    expect(audits.rows.map((row) => row.action)).toEqual(["credential.issued", "credential.issued", "credential.rotated", "message.delivered", "message.read", "credential.issued", "credential.revoked"]);
    expect(new Set(audits.rows.map((row) => row.actor))).toEqual(new Set([actorAccountId, "sandbox-control"]));
  } finally {
    await app?.close();
    await database?.end();
    await schemaClient.query("RESET search_path");
    await schemaClient.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`);
    schemaClient.release();
  }
});
