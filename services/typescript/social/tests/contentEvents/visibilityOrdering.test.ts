import { describe, expect, it } from "vitest";

import { createApplyContentVisibilityHandler } from "../../src/modules/contentEvents/commands/applyContentVisibility/applyContentVisibility.handler.js";
import { buildComment, createPinStore, firstId, postId } from "../comments/pinStore.fake.js";

const earlier = new Date("2026-10-04T10:00:00Z");
const later = new Date("2026-10-04T11:00:00Z");
const latest = new Date("2026-10-04T12:00:00Z");

describe("content visibility ordering", () => {
  it("ignores a stale visible event that arrives after a newer removal of a post", async () => {
    const store = createPinStore([]);
    const apply = createApplyContentVisibilityHandler(store.context);
    expect(await apply({ targetType: "post", targetId: postId, visibility: "removed", occurredAt: later })).toBe(true);
    expect(await apply({ targetType: "post", targetId: postId, visibility: "visible", occurredAt: earlier })).toBe(false);
    expect(await apply({ targetType: "post", targetId: postId, visibility: "visible", occurredAt: later })).toBe(false);
    expect(store.posts[0]).toMatchObject({ moderationVisibility: "removed", moderationVisibilityAt: later });
    expect(await apply({ targetType: "post", targetId: postId, visibility: "visible", occurredAt: latest })).toBe(true);
    expect(store.posts[0]).toMatchObject({ moderationVisibility: "visible", moderationVisibilityAt: latest });
  });

  it("ignores a stale visible event for a comment", async () => {
    const store = createPinStore([buildComment({ id: firstId })]);
    const apply = createApplyContentVisibilityHandler(store.context);
    await apply({ targetType: "comment", targetId: firstId, visibility: "hidden", occurredAt: later });
    expect(await apply({ targetType: "comment", targetId: firstId, visibility: "visible", occurredAt: earlier })).toBe(false);
    expect(store.comments[0]).toMatchObject({ moderationVisibility: "hidden" });
  });
});
