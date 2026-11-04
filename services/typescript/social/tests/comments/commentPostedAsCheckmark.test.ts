import { describe, expect, it } from "vitest";

import { buildCommentViews } from "../../src/modules/comments/services/commentView.service.js";
import type { CommentRow } from "../../src/modules/comments/repositories/comment.repository.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { createMemoryStore } from "./memoryDb.fake.js";
import { buildComment } from "./pinStore.fake.js";

const profileId = "0192f0a0-0000-7000-8000-0000000000a1";

describe("comment posted-as checkmark view", () => {
  it.each([
    ["business", "Blue Profile", "blue"],
    ["store", "Gold Store", "gold"],
    ["brand", "Black Institution", "black"],
  ] as const)("includes the active %s checkmark for the selected identity", async (label, name, color) => {
    const store = createMemoryStore();
    const context = { ...store.context, directory: {
      findUserSummaries: async (ids: readonly string[]) => new Map(ids.map((id) => [id, { id, name: "Personal", username: "personal", avatarUrl: null, verified: false, isCreator: false }])),
      findPrivateAccountIds: async () => new Set(),
      findProfilesByIds: async () => new Map([[profileId, { id: profileId, accountId: "owner", kind: label, displayName: name, handle: "profile", avatarUrl: null }]]),
      findProfileCheckmarkColors: async () => new Map([[profileId, color]]),
    } } as unknown as HandlerContext;
    const row = buildComment({ id: "comment-1", authorProfileId: profileId }) as unknown as CommentRow;

    const [view] = await buildCommentViews(context, undefined, [row]);

    expect(view?.postedAs).toEqual({ id: profileId, kind: label, name, handle: "profile", avatarUrl: null, checkmark: color });
    expect(view?.author.verified).toBe(false);
    expect(view?.postedAs).not.toHaveProperty("accountId");
  });

  it("returns null when the profile has no active checkmark", async () => {
    const store = createMemoryStore();
    const context = { ...store.context, directory: {
      findUserSummaries: async (ids: readonly string[]) => new Map(ids.map((id) => [id, { id, name: "Personal", username: "personal", avatarUrl: null, verified: true, isCreator: false }])),
      findPrivateAccountIds: async () => new Set(),
      findProfilesByIds: async () => new Map([[profileId, { id: profileId, accountId: "owner", kind: "business", displayName: "Store", handle: "store", avatarUrl: null }]]),
      findProfileCheckmarkColors: async () => new Map(),
    } } as unknown as HandlerContext;
    const row = buildComment({ id: "comment-1", authorProfileId: profileId }) as unknown as CommentRow;

    const [view] = await buildCommentViews(context, undefined, [row]);

    expect(view?.postedAs?.checkmark).toBeNull();
    expect(view?.author.verified).toBe(true);
  });

  it("does not return a posted-as identity when its active profile is absent from the read model", async () => {
    const store = createMemoryStore();
    const context = { ...store.context, directory: {
      findUserSummaries: async (ids: readonly string[]) => new Map(ids.map((id) => [id, { id, name: "Personal", username: "personal", avatarUrl: null, verified: false, isCreator: false }])),
      findPrivateAccountIds: async () => new Set(),
      findProfilesByIds: async () => new Map(),
      findProfileCheckmarkColors: async () => new Map([[profileId, "gold"]]),
    } } as unknown as HandlerContext;
    const row = buildComment({ id: "comment-1", authorProfileId: profileId }) as unknown as CommentRow;

    const [view] = await buildCommentViews(context, undefined, [row]);

    expect(view?.postedAs).toBeNull();
  });
});
