import { afterAll, describe, expect, it } from "vitest";

import { createMediaTestApplication } from "../media/mediaSetup.fixture.js";

const app = createMediaTestApplication();
afterAll(() => app.close());

function buildOggBytes(totalBytes: number): Uint8Array {
  const bytes = new Uint8Array(totalBytes).fill(0x11);
  bytes.set(new TextEncoder().encode("OggS"));
  return bytes;
}

async function startDirectConversation(fromToken: string, toUserId: string): Promise<string> {
  const response = await app.client.post("/api/v1/conversations").auth(fromToken).send({ userId: toUserId }).expect(200);
  return response.json<{ id: string }>().id;
}

describe("voice notes", () => {
  it("plays a voice note only for conversation participants", async () => {
    const [ada, bola, eve] = await Promise.all([app.registerUser(), app.registerUser(), app.registerUser()]);
    const voiceBytes = buildOggBytes(1500);
    const mediaId = await app.uploadWholeFile(ada.accessToken, voiceBytes, { fileName: "note.ogg", mimeType: "audio/ogg", purpose: "voice" });
    await app.processingQueue.waitUntilIdle();
    const conversationId = await startDirectConversation(ada.accessToken, bola.userId);

    const sent = await app.client
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .auth(ada.accessToken)
      .send({ kind: "voice", mediaId, durationSeconds: 7, text: "" })
      .expect(201);
    const message = sent.json<{ id: string; kind: string; media: { id: string; type: string; url: string; durationSeconds: number } }>();
    expect(message.kind).toBe("voice");
    expect(message.media).toMatchObject({ id: mediaId, type: "voice", durationSeconds: 7 });
    expect(message.media.url).toContain(`/api/v1/conversations/${conversationId}/messages/${message.id}/voice`);

    const played = await app.client.get(`/api/v1/conversations/${conversationId}/messages/${message.id}/voice`).auth(bola.accessToken).expect(200);
    expect(new Uint8Array(played.body as Uint8Array).byteLength).toBe(voiceBytes.byteLength);
    await app.client.get(`/api/v1/conversations/${conversationId}/messages/${message.id}/voice`).auth(eve.accessToken).expect(404);
    await app.client.get(`/api/v1/media/${mediaId}/original`).auth(bola.accessToken).expect(404);

    const eveConversation = await startDirectConversation(eve.accessToken, bola.userId);
    await app.client.post(`/api/v1/conversations/${eveConversation}/messages`).auth(eve.accessToken).send({ kind: "voice", mediaId, durationSeconds: 7 }).expect(422);
  });
});

describe("disappearing messages", () => {
  it("hides expired messages on read and purges them with the scheduled job", async () => {
    const [ada, bola] = await Promise.all([app.registerUser(), app.registerUser()]);
    const conversationId = await startDirectConversation(ada.accessToken, bola.userId);
    const updated = await app.client.patch(`/api/v1/conversations/${conversationId}`).auth(bola.accessToken).send({ disappearingMessagesSeconds: 60 }).expect(200);
    expect(updated.json<{ disappearingMessagesSeconds: number }>().disappearingMessagesSeconds).toBe(60);
    app.clock.advanceBySeconds(1);
    const sent = await app.client.post(`/api/v1/conversations/${conversationId}/messages`).auth(ada.accessToken).send({ text: "This will vanish" }).expect(201);
    const message = sent.json<{ id: string; expiresAt: string | null }>();
    expect(message.expiresAt).not.toBeNull();

    const readTexts = async () =>
      (await app.client.get(`/api/v1/conversations/${conversationId}/messages`).auth(bola.accessToken).expect(200)).json<{ data: { text: string }[] }>().data.map((item) => item.text);
    expect(await readTexts()).toContain("This will vanish");
    app.clock.advanceBySeconds(61);
    expect(await readTexts()).not.toContain("This will vanish");
    await app.client.post(`/api/v1/messages/${message.id}/reactions`).auth(bola.accessToken).send({ emoji: "👍" }).expect(404);

    const purgeJob = app.dependencies.scheduledJobs.find((job) => job.id === "messages.purgeExpiredMessages");
    expect(purgeJob).toBeDefined();
    await purgeJob?.run();
    await app.client.post("/api/v1/reports").auth(bola.accessToken).send({ targetType: "message", targetId: message.id, reason: "spam" }).expect(404);
  });
});
