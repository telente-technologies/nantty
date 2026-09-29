import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

interface ConversationBody {
  readonly id: string;
  readonly unreadCount: number;
  readonly otherParticipant: { readonly id: string } | null;
  readonly friendship: { readonly following: boolean; readonly followedBy: boolean; readonly areFriends: boolean };
}

describe("direct messages", () => {
  it("lets two users chat, tracks unread counts and shows the friendship state", async () => {
    const ada = await app.registerUser();
    const bola = await app.registerUser();
    const started = await app.client.post("/api/v1/conversations").auth(ada.accessToken).send({ userId: bola.userId }).expect(200);
    const conversation = started.json<ConversationBody>();
    expect(conversation.otherParticipant?.id).toBe(bola.userId);
    expect(conversation.friendship.areFriends).toBe(false);

    app.clock.advanceBySeconds(1);
    await app.client.post(`/api/v1/conversations/${conversation.id}/messages`).auth(ada.accessToken).send({ text: "Hello Bola, is the dress in stock?" }).expect(201);
    await app.client.get("/api/v1/messages/unread-count").auth(bola.accessToken).expect(200).expectJson({ total: 1 });
    const list = await app.client.get("/api/v1/conversations").auth(bola.accessToken).expect(200);
    expect(list.json<{ data: ConversationBody[] }>().data[0]).toMatchObject({ id: conversation.id, unreadCount: 1 });

    const messages = await app.client.get(`/api/v1/conversations/${conversation.id}/messages`).auth(bola.accessToken).expect(200);
    expect(messages.json<{ data: { text: string }[] }>().data.map((message) => message.text)).toEqual(["Hello Bola, is the dress in stock?"]);
    app.clock.advanceBySeconds(1);
    await app.client.post(`/api/v1/conversations/${conversation.id}/read`).auth(bola.accessToken).expect(204);
    await app.client.get("/api/v1/messages/unread-count").auth(bola.accessToken).expect(200).expectJson({ total: 0 });

    const search = await app.client.get("/api/v1/conversations/search").query({ q: "dress" }).auth(bola.accessToken).expect(200);
    expect(search.json<{ messages: unknown[] }>().messages).toHaveLength(1);
    const notifications = await app.client.get("/api/v1/notifications").query({ category: "messages" }).auth(bola.accessToken).expect(200);
    expect(notifications.json<{ data: unknown[] }>().data).toHaveLength(1);
  });

  it("marks followed people as direct conversations", async () => {
    const ada = await app.registerUser();
    const bola = await app.registerUser();
    await app.client.post(`/api/v1/users/${bola.userId}/follow`).auth(ada.accessToken).expect((response) => expect(response.status).toBeLessThan(300));
    const started = await app.client.post("/api/v1/conversations").auth(ada.accessToken).send({ userId: bola.userId }).expect(200);
    expect(started.json<ConversationBody>().friendship).toMatchObject({ following: true, followedBy: false });
    const direct = await app.client.get("/api/v1/conversations").query({ filter: "direct" }).auth(ada.accessToken).expect(200);
    expect(direct.json<{ data: ConversationBody[] }>().data).toHaveLength(1);
    const bolaDirect = await app.client.get("/api/v1/conversations").query({ filter: "direct" }).auth(bola.accessToken).expect(200);
    expect(bolaDirect.json<{ data: ConversationBody[] }>().data).toHaveLength(0);
  });

  it("blocks messaging when either user blocked the other and hides chats from outsiders", async () => {
    const ada = await app.registerUser();
    const bola = await app.registerUser();
    const eve = await app.registerUser();
    const started = await app.client.post("/api/v1/conversations").auth(ada.accessToken).send({ userId: bola.userId }).expect(200);
    const conversationId = started.json<ConversationBody>().id;
    await app.client.get(`/api/v1/conversations/${conversationId}`).auth(eve.accessToken).expect(404);
    await app.client.post(`/api/v1/conversations/${conversationId}/messages`).auth(eve.accessToken).send({ text: "hi" }).expect(404);

    await app.client.post(`/api/v1/users/${ada.userId}/block`).auth(bola.accessToken).expect((response) => expect(response.status).toBeLessThan(300));
    await app.client.post(`/api/v1/conversations/${conversationId}/messages`).auth(ada.accessToken).send({ text: "hello?" }).expect(403);
    await app.client.post("/api/v1/conversations").auth(ada.accessToken).send({ userId: bola.userId }).expect(403);
  });

  it("rejects conversations with yourself or unknown users", async () => {
    const ada = await app.registerUser();
    await app.client.post("/api/v1/conversations").auth(ada.accessToken).send({ userId: ada.userId }).expect(422);
    await app.client.post("/api/v1/conversations").auth(ada.accessToken).send({ userId: "00000000-0000-4000-8000-000000000000" }).expect(404);
  });
});
