import { describe, expect, it } from "vitest";

import { PoisonEventError } from "../../src/errors/social.error.js";
import type { ApplyContentVisibilityCommand } from "../../src/modules/contentEvents/commands/applyContentVisibility/applyContentVisibility.command.js";
import { soundStatusForVisibility } from "../../src/modules/contentEvents/commands/applyContentVisibility/applyContentVisibility.handler.js";
import type { ApplyProcessedMediaCommand } from "../../src/modules/contentEvents/commands/applyProcessedMedia/applyProcessedMedia.command.js";
import { createContentEventRouter } from "../../src/modules/contentEvents/services/contentEventRouter.service.js";
import { choosePrimaryVariant, publicMediaUrl } from "../../src/modules/contentEvents/services/mediaUrls.service.js";

function recordingRouter() {
  const visibility: ApplyContentVisibilityCommand[] = [];
  const media: ApplyProcessedMediaCommand[] = [];
  const route = createContentEventRouter({
    applyContentVisibility: async (command) => (visibility.push(command), true),
    applyProcessedMedia: async (command) => void media.push(command),
  });
  return { route, visibility, media };
}

const envelope = (type: string, data: Record<string, unknown>) => JSON.stringify({ id: "e1", type, source: "test", subject: "s", schemaVersion: 1, occurredAt: "2026-10-04T10:00:00.000Z", data });

describe("social content event router", () => {
  it("applies moderation decisions to the owning content", async () => {
    const { route, visibility } = recordingRouter();
    await route(envelope("content.visibilityChanged", { targetType: "post", targetId: "0192f0a0-0000-7000-8000-000000000001", visibility: "hidden", source: "report", referenceId: "r", reason: "spam" }));
    expect(visibility).toEqual([{ targetType: "post", targetId: "0192f0a0-0000-7000-8000-000000000001", visibility: "hidden", occurredAt: new Date("2026-10-04T10:00:00.000Z") }]);
  });

  it("turns processed and rejected media into ready and failed swaps", async () => {
    const { route, media } = recordingRouter();
    await route(envelope("media.processed", { mediaId: "m1", kind: "video", status: "ready", width: 720, height: 1280, durationSeconds: 12.4, posterKey: "p.jpg", hlsKey: "v/master.m3u8", variants: [{ format: "mp4", width: 720, height: 1280, key: "v.mp4" }] }));
    await route(envelope("media.rejected", { mediaId: "m2", kind: "image", reason: "unsafe" }));
    expect(media.map((command) => [command.mediaId, command.outcome, command.variants.length])).toEqual([["m1", "ready", 1], ["m2", "failed", 0]]);
  });

  it("ignores unrelated events and rejects malformed ones as poison", async () => {
    const { route, visibility, media } = recordingRouter();
    await route(envelope("post.created", { postId: "p" }));
    expect(visibility.length + media.length).toBe(0);
    await expect(route("not json")).rejects.toBeInstanceOf(PoisonEventError);
    await expect(route(envelope("content.visibilityChanged", { targetType: "post", targetId: "x", visibility: "shadowbanned" }))).rejects.toBeInstanceOf(PoisonEventError);
  });

  it("chooses the best variant for each media kind and builds public urls", () => {
    const variants = [{ format: "jpeg", width: 640, height: 640, key: "a.jpg" }, { format: "webp", width: 320, height: 320, key: "small.webp" }, { format: "webp", width: 1080, height: 1080, key: "large.webp" }];
    expect(choosePrimaryVariant("image", variants)?.key).toBe("large.webp");
    expect(publicMediaUrl("https://cdn.example.com/media/", "/large.webp")).toBe("https://cdn.example.com/media/large.webp");
    expect(publicMediaUrl("", "x")).toBeNull();
    expect(soundStatusForVisibility("restricted")).toBe("available");
    expect(soundStatusForVisibility("removed")).toBe("removed");
  });
});
