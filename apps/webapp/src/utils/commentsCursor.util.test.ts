import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { QueryClient } from "@tanstack/react-query";

import { isCommentsCursorExpiredError, keepOnlyFirstCommentsPage, restartCommentsListFromTop } from "./commentsCursor.util";

const expired = () => Object.assign(new Error("This list changed. Refresh to see the latest comments."), { status: 400, code: "CURSOR_EXPIRED" });

describe("comments cursor expiry", () => {
  it("only treats a 400 CURSOR_EXPIRED as an expired cursor", () => {
    assert.equal(isCommentsCursorExpiredError(expired()), true);
    assert.equal(isCommentsCursorExpiredError({ status: 400, code: "VALIDATION_FAILED" }), false);
    assert.equal(isCommentsCursorExpiredError({ status: 500, code: "CURSOR_EXPIRED" }), false);
    assert.equal(isCommentsCursorExpiredError(null), false);
  });

  it("keeps only the first page", () => {
    assert.deepEqual(keepOnlyFirstCommentsPage({ pages: [1, 2], pageParams: [null, "a"] }), { pages: [1], pageParams: [null] });
    assert.equal(keepOnlyFirstCommentsPage(undefined), undefined);
  });

  it("refetches a paged list from the start, dropping the expired later pages", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ["post-thread", "post-1", "relevant"];
    let firstPageVersion = 0;
    const requestedCursors: (string | null)[] = [];
    const queryFn = async ({ pageParam }: { pageParam: string | null }) => {
      requestedCursors.push(pageParam);
      if (pageParam === null) return { data: [`v${++firstPageVersion}`], nextCursor: "snapshot-old" };
      throw expired();
    };
    await client.fetchInfiniteQuery({ queryKey, queryFn, initialPageParam: null as string | null, getNextPageParam: (page: { nextCursor: string | null }) => page.nextCursor });
    client.setQueryData(queryKey, { pages: [{ data: ["v1"], nextCursor: "snapshot-old" }, { data: ["old-page-2"], nextCursor: null }], pageParams: [null, "snapshot-old"] });

    await restartCommentsListFromTop(client, queryKey);

    const data = client.getQueryData<{ pages: { data: string[] }[]; pageParams: unknown[] }>(queryKey);
    assert.equal(data?.pages.length, 1);
    assert.deepEqual(data?.pages[0]?.data, ["v2"]);
    assert.deepEqual(requestedCursors, [null, null]);
    client.clear();
  });

  it("rejects when the restart itself fails so the normal error shows", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ["comments", "post-2"];
    let shouldFail = false;
    const queryFn = async () => {
      if (shouldFail) throw Object.assign(new Error("Down"), { status: 503 });
      return { data: ["c1"], nextCursor: null };
    };
    await client.fetchInfiniteQuery({ queryKey, queryFn, initialPageParam: null as string | null, getNextPageParam: () => null });
    shouldFail = true;
    await assert.rejects(restartCommentsListFromTop(client, queryKey));
    client.clear();
  });
});
