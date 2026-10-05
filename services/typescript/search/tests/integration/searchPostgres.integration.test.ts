import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { createSearchPrisma } from "../../src/databases/prisma.database.js";
import { createSearchIndexPostgresRepository } from "../../src/modules/indexing/repositories/searchIndex.postgres.repository.js";
import { createSearchQueryPostgresRepository } from "../../src/modules/search/repositories/searchQuery.postgres.repository.js";
import type { SearchDocument } from "../../src/types/searchDocument.type.js";

const enabled = process.env["RUN_INTEGRATION"] === "1" && process.env["DATABASE_URL"] !== undefined;

function document(overrides: Partial<SearchDocument>): SearchDocument {
  return { kind: "product", entityId: randomUUID(), ownerAccountId: null, title: "Red running sneakers", subtitle: null, body: "", tags: [], summary: {}, visibility: "public", available: true, popularity: 1, region: null, version: 1, createdAt: new Date().toISOString(), ...overrides };
}

describe.skipIf(!enabled)("search postgres integration (needs Postgres migrated with prisma migrate deploy)", () => {
  const prisma = createSearchPrisma(process.env["DATABASE_URL"] as string, process.env["DATABASE_SCHEMA"] ?? "public");
  const index = createSearchIndexPostgresRepository(prisma);
  const query = createSearchQueryPostgresRepository(prisma);
  const marker = randomUUID().slice(0, 8).replace(/\d/g, "x");

  afterAll(async () => prisma.$disconnect());

  it("finds a document with a typo, honours the version guard and hides tombstones", async () => {
    const id = randomUUID();
    await index.upsertDocument(document({ entityId: id, title: `${marker} sneakers` }));
    const request = { viewerId: undefined, kinds: ["product" as const], limit: 10, cursor: undefined, region: undefined };
    expect((await query.search({ ...request, normalizedQuery: `${marker} sneekers` })).hits.map((hit) => hit.entityId)).toContain(id);
    expect((await index.upsertDocument(document({ entityId: id, title: "stale", version: 0 }))).applied).toBe(false);
    await index.tombstoneDocument("product", id, 2);
    expect((await query.search({ ...request, normalizedQuery: `${marker} sneakers` })).hits).toEqual([]);
  });

  it("applies block, private profile and suspension rules in SQL", async () => {
    const [viewer, owner] = [randomUUID(), randomUUID()];
    await index.upsertDocument(document({ kind: "user", entityId: owner, ownerAccountId: owner, title: `${marker}_owner`, subtitle: "Owner" }));
    const request = { viewerId: viewer, kinds: ["user" as const], limit: 10, cursor: undefined, region: undefined, normalizedQuery: `${marker}_owner` };
    const found = async () => (await query.search(request)).hits.length;
    expect(await found()).toBe(1);
    await index.patchAccountState(owner, { isPrivate: true }, 1);
    expect(await found()).toBe(0);
    await index.addFollow(viewer, owner);
    expect(await found()).toBe(1);
    await index.addBlock(owner, viewer);
    expect(await found()).toBe(0);
    await index.removeBlock(owner, viewer);
    await index.patchAccountState(owner, { status: "suspended" }, 2);
    expect(await found()).toBe(0);
  });

  it("pages with a stable keyset cursor", async () => {
    for (let index_ = 0; index_ < 5; index_ += 1) await index.upsertDocument(document({ entityId: `${marker}-${index_}`, title: `${marker} pager item` }));
    const first = await query.search({ viewerId: undefined, kinds: ["product"], limit: 3, cursor: undefined, region: undefined, normalizedQuery: `${marker} pager` });
    expect(first.hasMore).toBe(true);
    const last = first.hits.at(-1)!;
    const second = await query.search({ viewerId: undefined, kinds: ["product"], limit: 3, cursor: { score: last.score, key: `${last.kind}:${last.entityId}` }, region: undefined, normalizedQuery: `${marker} pager` });
    const ids = [...first.hits, ...second.hits].map((hit) => hit.entityId);
    expect(new Set(ids).size, "pages must not overlap").toBe(ids.length);
    expect(ids.filter((id) => id.startsWith(`${marker}-`)).sort()).toEqual([0, 1, 2, 3, 4].map((number) => `${marker}-${number}`));
  });

  it("treats quotes and SQL fragments in the query and viewer as plain data", async () => {
    const hostile = ["'; drop table documents; --", "\" or 1=1 --", "a') union select * from account_states --", "%_\\", "x:* | !y & (z"];
    for (const text of hostile) {
      const page = await query.search({ viewerId: "' or 'a'='a", kinds: ["product", "user"], limit: 5, cursor: undefined, region: "NG'; --", normalizedQuery: text });
      expect(Array.isArray(page.hits)).toBe(true);
    }
    const survivors = await query.search({ viewerId: undefined, kinds: ["product"], limit: 1, cursor: undefined, region: undefined, normalizedQuery: `${marker} sneakers` });
    expect(survivors.hits.length).toBeGreaterThanOrEqual(0);
    await index.upsertDocument(document({ entityId: randomUUID(), title: "O'Brien \"quoted\"; select 1" }));
    expect((await query.search({ viewerId: undefined, kinds: ["product"], limit: 5, cursor: undefined, region: undefined, normalizedQuery: "o'brien" })).hits.length).toBeGreaterThan(0);
  });
});
