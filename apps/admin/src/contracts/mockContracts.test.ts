import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { paginateByCursor, paginateItems } from "@/mocks/mockResponses.mock";
import type { MockRequest } from "@/mocks/mockRouter.mock";
import { adaptListEnvelope, toServerListEnvelope } from "@/utils/listEnvelope.util";

import { c, validateAgainstContract } from "./contractSchema.util";

const request = { query: new URLSearchParams("pageSize=2") } as unknown as MockRequest;
const serverTable = c.object({ data: c.array(c.any()), page: c.number(), pageSize: c.number(), total: c.number() });

describe("admin list envelopes", () => {
  it("mock tables are emitted as {data, page, pageSize, total}", () => {
    const body = toServerListEnvelope(paginateItems([1, 2, 3], request));
    assert.deepEqual(validateAgainstContract(serverTable, body), []);
  });

  it("the client adapter restores items for tables and cursor lists", () => {
    const table = adaptListEnvelope(toServerListEnvelope(paginateItems([1, 2, 3], request))) as { items: number[]; total: number };
    assert.deepEqual(table.items, [1, 2]);
    assert.equal(table.total, 3);
    const cursor = adaptListEnvelope<unknown>({ data: [1], nextCursor: "n" }) as { items: number[]; page: number; nextCursor: string };
    assert.deepEqual(cursor.items, [1]);
    assert.equal(cursor.page, 1);
    assert.equal(cursor.nextCursor, "n");
  });

  it("cursor-paged mocks emit {data, nextCursor} and walk every row once", () => {
    const rows = [1, 2, 3, 4, 5];
    const first = toServerListEnvelope(paginateByCursor(rows, { query: new URLSearchParams("limit=2") } as unknown as MockRequest)) as { data: number[]; nextCursor: string | null };
    assert.deepEqual(validateAgainstContract(c.page(c.number()), first), []);
    const seen = [...first.data];
    let cursor = first.nextCursor;
    while (cursor) {
      const next = paginateByCursor(rows, { query: new URLSearchParams(`limit=2&cursor=${cursor}`) } as unknown as MockRequest);
      seen.push(...next.items);
      cursor = next.nextCursor;
    }
    assert.deepEqual(seen, rows);
  });
});
