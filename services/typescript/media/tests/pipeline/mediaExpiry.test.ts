import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { extractExpiredMediaIds, handleDomainEventForMedia } from "../../src/modules/assets/services/chatMediaExpiryEvent.service.js";
import { deleteExpiredMedia, deleteMediaAssets } from "../../src/modules/assets/services/mediaDeletion.service.js";
import { createHarness } from "../fakes/pipelineHarness.js";

function seedReadyChatMedia(harness: ReturnType<typeof createHarness>, expiresAt: Date | null) {
  const id = harness.seedUpload({ purpose: "chat", mimeType: "image/jpeg", bytes: Buffer.from("x"), isPrivate: true, expiresAt });
  const bucket = harness.context.config.storage.privateBucket;
  harness.storage.seed(bucket, `p/${id}/w640.jpg`, Buffer.from("a"));
  harness.storage.seed(bucket, `p/${id}/w1080.webp`, Buffer.from("b"));
  harness.db.assets.get(id)!["status"] = "ready";
  return { id, bucket };
}

describe("chat media expiry", () => {
  it("deletes every object of expired assets and marks them deleted with an event", async () => {
    const harness = createHarness();
    const expired = seedReadyChatMedia(harness, new Date("2026-10-01T00:00:00Z"));
    const fresh = seedReadyChatMedia(harness, new Date("2026-11-01T00:00:00Z"));
    expect(await deleteExpiredMedia(harness.context)).toBe(1);
    expect(harness.db.assets.get(expired.id)).toMatchObject({ status: "deleted" });
    expect(harness.storage.keysIn(expired.bucket).filter((key) => key.includes(expired.id))).toHaveLength(0);
    expect(harness.db.assets.get(fresh.id)?.["status"]).toBe("ready");
    expect(harness.storage.keysIn(fresh.bucket).filter((key) => key.includes(fresh.id))).toHaveLength(2);
    expect(harness.db.eventTypes()).toEqual(["media.deleted"]);
  });

  it("is idempotent when social marks the same media expired twice", async () => {
    const harness = createHarness();
    const { id } = seedReadyChatMedia(harness, null);
    expect(await deleteMediaAssets(harness.context, [id, randomUUID()], "chatMediaExpired")).toBe(1);
    expect(await deleteMediaAssets(harness.context, [id], "chatMediaExpired")).toBe(0);
    expect(harness.db.eventTypes()).toEqual(["media.deleted"]);
  });

  it("turns a chatMedia.expired envelope into a delete job and ignores other events", async () => {
    const harness = createHarness();
    const mediaId = randomUUID();
    const eventId = randomUUID();
    const envelope = { id: eventId, type: "chatMedia.expired", source: "social", data: { messageIds: [randomUUID()], mediaIds: [mediaId, "not-a-uuid"] } };
    expect(extractExpiredMediaIds(envelope)).toEqual({ eventId, mediaIds: [mediaId] });
    await handleDomainEventForMedia(harness.context, envelope);
    await handleDomainEventForMedia(harness.context, { id: randomUUID(), type: "follow.created", data: {} });
    await handleDomainEventForMedia(harness.context, { id: randomUUID(), type: "chatMedia.expired", data: { mediaIds: [] } });
    expect(harness.enqueued).toEqual([{ queue: "jobs-media", job: { id: eventId, type: "media.delete", payload: { mediaIds: [mediaId], reason: "chatMediaExpired" } } }]);
  });
});
