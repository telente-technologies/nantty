import { describe, expect, it } from "vitest";

import type { ApplyCopyrightAudioRemedyCommand } from "../../src/modules/contentEvents/commands/applyCopyrightAudioRemedy/applyCopyrightAudioRemedy.command.js";
import { chunkMediaIdsForEvents, createApplyCopyrightAudioRemedyHandler } from "../../src/modules/contentEvents/commands/applyCopyrightAudioRemedy/applyCopyrightAudioRemedy.handler.js";
import { createContentEventRouter } from "../../src/modules/contentEvents/services/contentEventRouter.service.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const id = (suffix: number) => `0192f0a0-0000-7000-8000-${String(suffix).padStart(12, "0")}`;
const soundId = id(900);
const envelope = (type: string, data: Record<string, unknown>) => JSON.stringify({ id: "e1", type, occurredAt: "2026-10-04T10:00:00.000Z", data });

function fakeContext() {
  const posts = [{ id: id(1), soundId }, { id: id(2), soundId }, { id: id(3), soundId: null }];
  const postMedia = [{ postId: id(1), mediaId: id(101), type: "video" }, { postId: id(2), mediaId: id(102), type: "video" }, { postId: id(2), mediaId: id(103), type: "image" }, { postId: id(3), mediaId: id(104), type: "video" }];
  const sounds = new Map([[soundId, { status: "available", allowReuse: true }]]);
  const outbox: { eventType: string; payload: { data: Record<string, unknown> } }[] = [];
  const db = {
    post: {
      findUnique: async ({ where }: { where: { id: string } }) => posts.find((post) => post.id === where.id) ?? null,
      findMany: async ({ where }: { where: { soundId: string } }) => posts.filter((post) => post.soundId === where.soundId),
    },
    sound: { updateMany: async ({ where, data }: { where: { id: string }; data: { status: string; allowReuse: boolean } }) => Object.assign(sounds.get(where.id) ?? {}, data) },
    postMedia: { findMany: async ({ where }: { where: { postId: { in: string[] }; type: string } }) => postMedia.filter((row) => where.postId.in.includes(row.postId) && row.type === where.type) },
    outboxEvent: { createMany: async ({ data }: { data: typeof outbox }) => void outbox.push(...data) },
  };
  const context = { database: { client: { $transaction: async (work: (client: typeof db) => Promise<unknown>) => work(db) } } } as unknown as HandlerContext;
  return { context, sounds, outbox };
}

describe("copyright audio remedies in social", () => {
  it("disables the claimed sound and asks media to mute every clip that used it", async () => {
    const { context, sounds, outbox } = fakeContext();
    const result = await createApplyCopyrightAudioRemedyHandler(context)({ claimId: "c1", targetType: "clip", targetId: id(1), mode: "mute", occurredAt: new Date() });
    expect(result.soundId).toBe(soundId);
    expect([...result.mediaIds].sort()).toEqual([id(101), id(102)]);
    expect(sounds.get(soundId)).toEqual({ status: "removed", allowReuse: false });
    expect(outbox.map((event) => event.eventType)).toEqual(["sound.updated", "clipAudio.muteRequested"]);
    expect(outbox[1]?.payload.data).toMatchObject({ claimId: "c1", soundId });
  });

  it("restores the sound and unmutes the clips when the counter-notice stands", async () => {
    const { context, sounds, outbox } = fakeContext();
    const handler = createApplyCopyrightAudioRemedyHandler(context);
    await handler({ claimId: "c1", targetType: "sound", targetId: soundId, mode: "mute", occurredAt: new Date() });
    await handler({ claimId: "c1", targetType: "sound", targetId: soundId, mode: "restore", occurredAt: new Date() });
    expect(sounds.get(soundId)).toEqual({ status: "available", allowReuse: true });
    expect(outbox.map((event) => event.eventType)).toEqual(["sound.updated", "clipAudio.muteRequested", "sound.updated", "clipAudio.restoreRequested"]);
  });

  it("mutes a clip with original audio even when it has no shared sound", async () => {
    const { context, outbox } = fakeContext();
    const result = await createApplyCopyrightAudioRemedyHandler(context)({ claimId: "c2", targetType: "post", targetId: id(3), mode: "mute", occurredAt: new Date() });
    expect(result).toMatchObject({ soundId: null, mediaIds: [id(104)] });
    expect(outbox.map((event) => event.eventType)).toEqual(["clipAudio.muteRequested"]);
  });

  it("routes the trust events and splits very large sound fan-outs", async () => {
    const commands: ApplyCopyrightAudioRemedyCommand[] = [];
    const route = createContentEventRouter({ applyContentVisibility: async () => true, applyProcessedMedia: async () => undefined, applyCopyrightAudioRemedy: async (command) => void commands.push(command) });
    await route(envelope("copyrightClaim.audioMuteOrdered", { claimId: "c1", targetType: "clip", targetId: id(1) }));
    await route(envelope("copyrightClaim.restored", { claimId: "c1", targetType: "clip", targetId: id(1), remedy: "audio_muted" }));
    await route(envelope("copyrightClaim.restored", { claimId: "c9", targetType: "clip", targetId: id(1), remedy: "taken_down" }));
    expect(commands.map((command) => command.mode)).toEqual(["mute", "restore"]);
    await expect(route(envelope("copyrightClaim.audioMuteOrdered", { targetType: "clip" }))).rejects.toThrow();
    expect(chunkMediaIdsForEvents(Array.from({ length: 1201 }, (_, index) => String(index))).map((chunk) => chunk.length)).toEqual([500, 500, 201]);
  });
});
