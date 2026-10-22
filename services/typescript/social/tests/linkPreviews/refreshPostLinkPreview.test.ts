import { describe, expect, it } from "vitest";

import { createRefreshPostLinkPreviewHandler } from "../../src/modules/linkPreviews/commands/refreshPostLinkPreview/refreshPostLinkPreview.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { createMemoryStore, type Row } from "../comments/memoryDb.fake.js";
import { authorId, buildPostRow, viewerId } from "../posts/socialPostFakes.fake.js";

const postId = "0192f0a0-0000-7000-8000-0000000000f1";
const preview = { url: "https://news.example/a", domain: "news.example", title: "Secret plan", description: null, siteName: null, imageUrl: null, imageMediaId: null };

function setup(overrides: Row = {}) {
  const store = createMemoryStore({ posts: [{ ...buildPostRow({ id: postId, authorId, text: "see https://news.example/a" }), ...overrides } as Row] });
  const attached: string[] = [];
  const context = { ...store.context, linkPreviews: { resolveLinkPreview: async () => preview, attachLinkPreviewToPost: async (id: string) => { attached.push(id); return preview; } } } as unknown as HandlerContext;
  return { store, attached, refresh: createRefreshPostLinkPreviewHandler(context) };
}

describe("SOC-01 refresh post link preview is author-only", () => {
  it("returns the preview to the post author", async () => {
    const { refresh, attached } = setup();
    expect(await refresh({ actorId: authorId, postId })).toMatchObject({ title: "Secret plan" });
    expect(attached).toEqual([postId]);
  });

  it("refuses another viewer even when the post is public", async () => {
    const { refresh, attached } = setup({ linkPreview: preview });
    await expect(refresh({ actorId: viewerId, postId })).rejects.toMatchObject({ status: 403, code: "NOT_POST_OWNER" });
    expect(attached).toEqual([]);
  });

  it("refuses a followers-only post to a non-follower without fetching or leaking the cached preview", async () => {
    const { refresh, attached } = setup({ audience: "followers", linkPreview: preview });
    await expect(refresh({ actorId: viewerId, postId })).rejects.toMatchObject({ status: 403 });
    expect(attached).toEqual([]);
  });

  it("refuses a private account's post and a blocked viewer", async () => {
    const privateCase = setup({ linkPreview: preview });
    privateCase.store.privateAccountIds.add(authorId);
    await expect(privateCase.refresh({ actorId: viewerId, postId })).rejects.toMatchObject({ status: 403 });
    const blockedCase = setup();
    blockedCase.store.blocks.push({ blockerId: authorId, blockedId: viewerId });
    await expect(blockedCase.refresh({ actorId: viewerId, postId })).rejects.toMatchObject({ status: 404 });
    expect(blockedCase.attached).toEqual([]);
  });
});
