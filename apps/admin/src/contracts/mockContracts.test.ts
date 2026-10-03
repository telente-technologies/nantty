import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { paginateItems } from "@/mocks/mockResponses.mock";
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
});
