import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { QueryClient } from "@tanstack/react-query";

import { WebappRequestError } from "@/services/clientApi.service";

import { removePostEverywhere, restoreCacheSnapshot } from "./postEngagementCache.util";
import { deleteConfirmationCopy, isAlreadyDeleted } from "./postDeletion.util";

const post = (id: string, extra: Record<string, unknown> = {}) => ({ id, liked: false, likes: 1, author: { id: "me" }, ...extra });

function seeded() {
  const client = new QueryClient();
  client.setQueryData(["feed"], { pages: [{ data: [post("p1"), post("p2")] }], pageParams: [null] });
  client.setQueryData(["profile", "posts", "me"], { data: [post("p1")] });
  client.setQueryData(["post", "p1"], post("p1"));
  client.setQueryData(["post", "q1"], post("q1", { resharedFrom: post("p1") }));
  client.setQueryData(["stories", "me"], [{ id: "p1" }, { id: "s2" }]);
  return client;
}

describe("post deletion", () => {
  it("removes the post from every list, drops its detail and marks quotes unavailable", () => {
    const client = seeded();
    removePostEverywhere(client, "p1");
    assert.deepEqual(client.getQueryData<{ pages: { data: { id: string }[] }[] }>(["feed"])?.pages[0]?.data.map((item) => item.id), ["p2"]);
    assert.deepEqual(client.getQueryData<{ data: unknown[] }>(["profile", "posts", "me"])?.data, []);
    assert.equal(client.getQueryData(["post", "p1"]), undefined);
    assert.deepEqual(client.getQueryData<Record<string, unknown>>(["post", "q1"])?.resharedFromUnavailable, true);
    assert.deepEqual(client.getQueryData<{ id: string }[]>(["stories", "me"])?.map((item) => item.id), ["s2"]);
  });

  it("rolls back every touched query", () => {
    const client = seeded();
    const snapshot = removePostEverywhere(client, "p1");
    restoreCacheSnapshot(client, snapshot);
    assert.equal(client.getQueryData<{ id: string }>(["post", "p1"])?.id, "p1");
    assert.equal(client.getQueryData<{ pages: { data: unknown[] }[] }>(["feed"])?.pages[0]?.data.length, 2);
    assert.equal(removePostEverywhere(new QueryClient(), "p1").length, 0);
  });

  it("uses kind-specific confirm copy and treats 404 as already deleted", () => {
    assert.equal(deleteConfirmationCopy("post").title, "Delete post?");
    assert.equal(deleteConfirmationCopy("clip").title, "Delete clip?");
    assert.equal(deleteConfirmationCopy("story").title, "Delete story?");
    assert.equal(deleteConfirmationCopy(undefined).message, "This can't be undone.");
    assert.equal(isAlreadyDeleted(new WebappRequestError(404, "POST_NOT_FOUND", "gone")), true);
    assert.equal(isAlreadyDeleted(new WebappRequestError(403, "NOT_POST_OWNER", "no")), false);
  });
});
