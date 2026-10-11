import { QueryClient } from "@tanstack/react-query";

import { removePostEverywhere, restoreCacheSnapshot } from "../postEngagementCache.util";
import { deleteConfirmationCopy, isAlreadyGone } from "@/components/feed/useDeleteOwnPost.hook";
import { ApiError } from "@/errors/api.error";

jest.mock("@/services/content/posts.service", () => ({ postsService: {} }));
jest.mock("@/store/toast.store", () => ({ showToast: jest.fn() }));
jest.mock("@/utils/crossPlatformAlert.util", () => ({ showAlertWithButtons: jest.fn() }));

const post = (id: string, extra: Record<string, unknown> = {}) => ({ id, liked: false, likes: 1, author: { id: "me" }, ...extra });

function seededClient() {
  const client = new QueryClient();
  client.setQueryData(["feed", "for-you"], { pages: [{ data: [post("p1"), post("p2")], nextCursor: null }], pageParams: [null] });
  client.setQueryData(["users", "me", "posts"], { data: [post("p1"), post("p3")] });
  client.setQueryData(["post", "p1"], post("p1"));
  client.setQueryData(["post", "q1"], post("q1", { resharedFrom: post("p1"), isQuote: true }));
  client.setQueryData(["stories", "me"], [{ id: "p1", media: {} }, { id: "s2", media: {} }]);
  client.setQueryData(["saves", "post"], { data: [{ id: "save-1", post: post("p9") }] });
  return client;
}

describe("removePostEverywhere", () => {
  it("drops the post from feeds, profiles, stories and detail, and marks quotes unavailable", () => {
    const client = seededClient();
    removePostEverywhere(client, "p1");
    expect(client.getQueryData<{ pages: { data: { id: string }[] }[] }>(["feed", "for-you"])?.pages[0]?.data.map((item) => item.id)).toEqual(["p2"]);
    expect(client.getQueryData<{ data: { id: string }[] }>(["users", "me", "posts"])?.data.map((item) => item.id)).toEqual(["p3"]);
    expect(client.getQueryData(["post", "p1"])).toBeUndefined();
    expect(client.getQueryData(["post", "q1"])).toMatchObject({ resharedFrom: null, resharedFromUnavailable: true });
    expect(client.getQueryData<{ id: string }[]>(["stories", "me"])?.map((item) => item.id)).toEqual(["s2"]);
  });

  it("leaves unrelated queries untouched and restores everything on rollback", () => {
    const client = seededClient();
    const saves = client.getQueryData(["saves", "post"]);
    const snapshot = removePostEverywhere(client, "p1");
    expect(client.getQueryData(["saves", "post"])).toBe(saves);
    restoreCacheSnapshot(client, snapshot);
    expect(client.getQueryData<{ data: { id: string }[] }>(["users", "me", "posts"])?.data.map((item) => item.id)).toEqual(["p1", "p3"]);
    expect(client.getQueryData(["post", "p1"])).toMatchObject({ id: "p1" });
    expect(client.getQueryData(["post", "q1"])).toMatchObject({ resharedFrom: { id: "p1" } });
  });

  it("is a no-op the second time", () => {
    const client = seededClient();
    removePostEverywhere(client, "p1");
    expect(removePostEverywhere(client, "p1")).toHaveLength(0);
  });
});

describe("delete copy", () => {
  it("uses the confirm copy per kind", () => {
    expect(deleteConfirmationCopy("post")).toMatchObject({ title: "Delete post?", message: "This can't be undone." });
    expect(deleteConfirmationCopy("clip").title).toBe("Delete clip?");
    expect(deleteConfirmationCopy("story").title).toBe("Delete story?");
  });

  it("treats an already-deleted post as success but not a forbidden one", () => {
    expect(isAlreadyGone(new ApiError(404, "gone"))).toBe(true);
    expect(isAlreadyGone(new ApiError(403, "no"))).toBe(false);
  });
});
