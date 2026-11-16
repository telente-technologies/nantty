import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { hashSandboxCredential } from "../src/credentials.js";
import { createSandboxApp } from "../src/sandboxApp.js";

const controlToken = "sandbox-control-token-that-is-longer-than-thirty-two-characters";
const credentialControlUrl = "/v1/control/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/applications/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738/credentials";
const managedCredentialId = "a2d7f00d-9587-4cb8-91d4-592f43301f36";
const actorAccountId = "3fbcd9fc-dab8-4e3e-a832-209ae7ffbb5d";
const controlHeaders = { authorization: `Bearer ${controlToken}`, "x-nantty-actor-account-id": actorAccountId };

function createCredentialManagementDatabase() {
  const active = new Set([managedCredentialId]);
  const insertedCredentials: (readonly unknown[])[] = [];
  const revokedIds: string[] = [];
  const audits: string[] = [];
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    if (sql.includes("SELECT id FROM sandbox_applications WHERE organization_id=$1")) return { rows: [{ id: "sandbox-app-1" }], rowCount: 1 };
    if (sql.includes("SELECT id, token_prefix, created_at, last_used_at, expires_at, revoked_at FROM sandbox_credentials")) return { rows: [{ id: managedCredentialId, token_prefix: "ntsb_test_abc", created_at: new Date("2026-11-01T00:00:00.000Z"), last_used_at: null, expires_at: null, revoked_at: null }], rowCount: 1 };
    if (sql.includes("INSERT INTO sandbox_applications")) return { rows: [{ id: "sandbox-app-1" }], rowCount: 1 };
    if (sql.includes("UPDATE sandbox_credentials SET revoked_at=now()")) {
      const credentialId = String(values?.[0]);
      const applicationId = String(values?.[1]);
      if (active.has(credentialId) && applicationId === "sandbox-app-1") {
        active.delete(credentialId);
        revokedIds.push(credentialId);
        return { rows: [{ id: credentialId }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("INSERT INTO sandbox_credentials")) {
      insertedCredentials.push([...(values ?? [])]);
      active.add(String(values?.[0]));
    }
    if (sql.includes("INSERT INTO sandbox_control_audit")) audits.push(String(values?.[2]));
    return { rows: [], rowCount: 1 };
  });
  const client = { query, release: vi.fn() };
  return { database: { query, connect: vi.fn(async () => client) } as unknown as Pool, query, insertedCredentials, revokedIds, audits };
}

describe("Sandbox credential control routes", () => {
  it("rejects malformed control-plane resource IDs without database access", async () => {
    const state = createCredentialManagementDatabase();
    const app = createSandboxApp({ database: state.database, controlToken });
    const credential = await app.inject({ method: "POST", url: "/v1/control/organizations/not-a-uuid/applications/not-a-uuid/credentials", headers: { authorization: `Bearer ${controlToken}` } });
    const revoke = await app.inject({ method: "DELETE", url: "/v1/control/organizations/6de1c79a-00fd-4bed-ae23-fbfb678c0a19/applications/19a6e03c-d5ce-40c9-a9d2-8aa8657e5738/credentials/not-a-uuid", headers: { authorization: `Bearer ${controlToken}` } });
    expect(credential.statusCode).toBe(400);
    expect(revoke.statusCode).toBe(400);
    expect(state.query.mock.calls.every(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO sandbox_api_requests"))).toBe(true);
    await app.close();
  });

  it("lists credential metadata only and never returns a stored token digest", async () => {
    const state = createCredentialManagementDatabase();
    const app = createSandboxApp({ database: state.database, controlToken });
    const response = await app.inject({ method: "GET", url: credentialControlUrl, headers: controlHeaders });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ credentials: [{ id: managedCredentialId, prefix: "ntsb_test_abc", revokedAt: null }] });
    expect(response.body).not.toContain("token_hash");
    expect(response.body).not.toContain("token");
    await app.close();
  });

  it("requires an Identity-authorized actor for credential control operations", async () => {
    const state = createCredentialManagementDatabase();
    const app = createSandboxApp({ database: state.database, controlToken });
    const response = await app.inject({ method: "POST", url: credentialControlUrl, headers: { authorization: `Bearer ${controlToken}` }, payload: { name: "CRM integration" } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_ACTOR" } });
    expect(state.database.connect).not.toHaveBeenCalled();
    await app.close();
  });

  it("issues sandbox credentials as hashes and reveals the secret only in the issue response", async () => {
    const state = createCredentialManagementDatabase();
    const app = createSandboxApp({ database: state.database, controlToken });
    const response = await app.inject({ method: "POST", url: credentialControlUrl, headers: controlHeaders, payload: { name: "CRM integration" } });
    const issued = response.json() as { readonly token: string; readonly prefix: string };
    expect(response.statusCode).toBe(201);
    expect(issued.token).toMatch(/^ntsb_test_/);
    expect(state.insertedCredentials[0]?.[2]).toBe(hashSandboxCredential(issued.token));
    expect(state.insertedCredentials[0]?.[2]).not.toBe(issued.token);
    expect(response.headers["cache-control"]).toContain("no-store");
    await app.close();
  });

  it("rotates in one transaction, revokes only within the app, and audits the new credential", async () => {
    const state = createCredentialManagementDatabase();
    const app = createSandboxApp({ database: state.database, controlToken });
    const response = await app.inject({ method: "POST", url: `${credentialControlUrl}/${managedCredentialId}/rotate`, headers: controlHeaders, payload: { expiresAt: null } });
    const issued = response.json() as { readonly id: string; readonly token: string };
    expect(response.statusCode).toBe(201);
    expect(issued.id).not.toBe(managedCredentialId);
    expect(state.revokedIds).toContain(managedCredentialId);
    expect(state.audits).toContain("credential.rotated");
    const statements = state.query.mock.calls.map(([sql]) => String(sql));
    expect(statements.indexOf("BEGIN")).toBeLessThan(statements.findIndex((sql) => sql.includes("UPDATE sandbox_credentials SET revoked_at")));
    expect(statements.findIndex((sql) => sql.includes("INSERT INTO sandbox_credentials"))).toBeLessThan(statements.indexOf("COMMIT"));
    await app.close();
  });

  it("revokes a credential only when it belongs to the requested organization application", async () => {
    const state = createCredentialManagementDatabase();
    const app = createSandboxApp({ database: state.database, controlToken });
    const response = await app.inject({ method: "DELETE", url: `${credentialControlUrl}/${managedCredentialId}`, headers: controlHeaders });
    expect(response.statusCode).toBe(204);
    expect(state.revokedIds).toContain(managedCredentialId);
    expect(state.query.mock.calls.some(([sql, values]) => String(sql).includes("WHERE id=$1 AND application_id=$2") && values?.[0] === managedCredentialId && values?.[1] === "sandbox-app-1")).toBe(true);
    expect(state.audits).toContain("credential.revoked");
    await app.close();
  });
});
