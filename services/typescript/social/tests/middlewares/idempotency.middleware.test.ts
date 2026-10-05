import { describe, expect, it } from "vitest";

import { createIdempotencyGuard, hashIdempotentRequest } from "../../src/middlewares/idempotency.middleware.js";
import { decideIdempotencyClaim, type IdempotencyStore, type StoredResponse } from "../../src/repositories/idempotency.repository.js";

interface MemoryRow {
  requestPath: string;
  requestHash: string;
  lockedUntil: Date | null;
  completedAt: Date | null;
  responseStatus: number | null;
  responseBody: unknown;
}

function createMemoryStore(): IdempotencyStore & { readonly rows: Map<string, MemoryRow> } {
  const rows = new Map<string, MemoryRow>();
  return {
    rows,
    async claim(request) {
      const id = `${request.accountId}:${request.key}`;
      const row = rows.get(id);
      if (row === undefined) {
        rows.set(id, { requestPath: request.requestPath, requestHash: request.requestHash, lockedUntil: request.lockedUntil, completedAt: null, responseStatus: null, responseBody: null });
        return { state: "claimed" };
      }
      const decision = decideIdempotencyClaim(row, request);
      if (decision !== "takeOver") return decision;
      row.lockedUntil = request.lockedUntil;
      return { state: "claimed" };
    },
    async complete(accountId, key, response) {
      const row = rows.get(`${accountId}:${key}`);
      if (row !== undefined) Object.assign(row, { completedAt: new Date(), lockedUntil: null, responseStatus: response.status, responseBody: response.body });
    },
    async release(accountId, key) {
      const row = rows.get(`${accountId}:${key}`);
      if (row !== undefined && row.completedAt === null) rows.delete(`${accountId}:${key}`);
    },
  };
}

const request = { accountId: "0192f0a0-0000-7000-8000-00000000a001", key: "key-00000001", method: "POST", requestPath: "/api/v1/posts", body: { text: "hello" } };

describe("idempotency guard", () => {
  it("runs once and replays the stored response for the same body", async () => {
    const guard = createIdempotencyGuard(createMemoryStore());
    let runs = 0;
    const execute = async (): Promise<StoredResponse> => ({ status: 201, body: { id: `post-${++runs}` } });
    expect(await guard.run(request, execute)).toEqual({ status: 201, body: { id: "post-1" }, replayed: false });
    expect(await guard.run({ ...request, body: { text: "hello" } }, execute)).toEqual({ status: 201, body: { id: "post-1" }, replayed: true });
    expect(runs).toBe(1);
  });

  it("returns 422 when the key is reused with a different body or path", async () => {
    const guard = createIdempotencyGuard(createMemoryStore());
    await guard.run(request, async () => ({ status: 201, body: {} }));
    await expect(guard.run({ ...request, body: { text: "changed" } }, async () => ({ status: 201, body: {} }))).rejects.toMatchObject({ status: 422, code: "IDEMPOTENCY_KEY_REUSED" });
    await expect(guard.run({ ...request, requestPath: "/api/v1/comments" }, async () => ({ status: 201, body: {} }))).rejects.toMatchObject({ status: 422 });
  });

  it("returns 409 while the first request is still in flight", async () => {
    const guard = createIdempotencyGuard(createMemoryStore());
    let finish: (value: StoredResponse) => void = () => undefined;
    const first = guard.run(request, () => new Promise<StoredResponse>((resolve) => { finish = resolve; }));
    await Promise.resolve();
    await expect(guard.run(request, async () => ({ status: 201, body: {} }))).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_IN_PROGRESS" });
    finish({ status: 201, body: { id: "a" } });
    expect((await first).replayed).toBe(false);
  });

  it("releases the claim on server errors and thrown errors so a retry can run", async () => {
    const store = createMemoryStore();
    const guard = createIdempotencyGuard(store);
    await guard.run(request, async () => ({ status: 503, body: null }));
    expect(store.rows.size).toBe(0);
    await expect(guard.run(request, async () => { throw Object.assign(new Error("nope"), { status: 403 }); })).rejects.toThrow("nope");
    expect(store.rows.size).toBe(0);
    expect((await guard.run(request, async () => ({ status: 201, body: { id: "b" } }))).body).toEqual({ id: "b" });
  });

  it("lets a retry take over a claim whose lock expired", async () => {
    const store = createMemoryStore();
    let clock = new Date("2026-10-05T10:00:00Z");
    const guard = createIdempotencyGuard(store, () => clock);
    void guard.run(request, () => new Promise<StoredResponse>(() => undefined));
    await Promise.resolve();
    clock = new Date("2026-10-05T10:05:00Z");
    expect((await guard.run(request, async () => ({ status: 201, body: { id: "c" } }))).body).toEqual({ id: "c" });
  });

  it("hashes method, path and body", () => {
    expect(hashIdempotentRequest("post", "/a", { x: 1 })).toBe(hashIdempotentRequest("POST", "/a", { x: 1 }));
    expect(hashIdempotentRequest("POST", "/a", { x: 1 })).not.toBe(hashIdempotentRequest("POST", "/a", { x: 2 }));
  });
});
