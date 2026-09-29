import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication, type SignedInUser } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

interface ConversationBody {
  readonly id: string;
  readonly kind: string;
  readonly title: string | null;
  readonly myRole: string;
  readonly memberCount: number;
  readonly subscriberCount: number;
}

interface MemberBody {
  readonly user: { readonly id: string };
  readonly role: string;
}

async function createGroup(owner: SignedInUser, members: readonly SignedInUser[]): Promise<ConversationBody> {
  const response = await app.client
    .post("/api/v1/conversations/groups")
    .auth(owner.accessToken)
    .send({ name: "Owambe Planning", memberIds: members.map((member) => member.userId) })
    .expect(201);
  return response.json<ConversationBody>();
}

async function listMembers(viewer: SignedInUser, conversationId: string): Promise<readonly MemberBody[]> {
  const response = await app.client.get(`/api/v1/conversations/${conversationId}/members`).auth(viewer.accessToken).expect(200);
  return response.json<{ data: MemberBody[] }>().data;
}

describe("group chats", () => {
  it("lets admins manage members while ordinary members cannot", async () => {
    const [ada, bola, cara, dayo, efe] = await Promise.all([app.registerUser(), app.registerUser(), app.registerUser(), app.registerUser(), app.registerUser()]);
    const group = await createGroup(ada, [bola, cara]);
    expect(group).toMatchObject({ kind: "group", title: "Owambe Planning", myRole: "owner", memberCount: 3 });
    const base = `/api/v1/conversations/${group.id}`;

    await app.client.post(`${base}/members`).auth(bola.accessToken).send({ userIds: [dayo.userId] }).expect(403);
    await app.client.post(`${base}/members`).auth(ada.accessToken).send({ userIds: [dayo.userId] }).expect(200);
    await app.client.post(`${base}/admins`).auth(ada.accessToken).send({ userId: bola.userId }).expect(204);
    await app.client.post(`${base}/members`).auth(bola.accessToken).send({ userIds: [efe.userId] }).expect(200);
    await app.client.delete(`${base}/members/${ada.userId}`).auth(bola.accessToken).expect(403);
    await app.client.delete(`${base}/admins/${bola.userId}`).auth(cara.accessToken).expect(403);
    await app.client.delete(`${base}/members/${dayo.userId}`).auth(bola.accessToken).expect(204);
    await app.client.post(`${base}/messages`).auth(dayo.accessToken).send({ text: "am I still here?" }).expect(404);

    await app.client.patch(base).auth(cara.accessToken).send({ name: "Cara's group" }).expect(403);
    const renamed = await app.client.patch(base).auth(bola.accessToken).send({ name: "Owambe Squad" }).expect(200);
    expect(renamed.json<ConversationBody>().title).toBe("Owambe Squad");

    const roles = new Map((await listMembers(cara, group.id)).map((member) => [member.user.id, member.role]));
    expect(roles.get(ada.userId)).toBe("owner");
    expect(roles.get(bola.userId)).toBe("admin");
    expect(roles.has(dayo.userId)).toBe(false);

    await app.client.post(`${base}/leave`).auth(ada.accessToken).expect(204);
    const afterOwnerLeft = new Map((await listMembers(cara, group.id)).map((member) => [member.user.id, member.role]));
    expect(afterOwnerLeft.get(bola.userId)).toBe("owner");
    await app.client.get(base).auth(ada.accessToken).expect(404);

    const messages = await app.client.get(`${base}/messages`).auth(cara.accessToken).expect(200);
    const notices = messages.json<{ data: { kind: string; text: string }[] }>().data.filter((message) => message.kind === "system");
    expect(notices.map((notice) => notice.text)).toEqual(expect.arrayContaining([expect.stringContaining("created the group"), expect.stringContaining("was removed")]));
  });

  it("lets members react to messages", async () => {
    const [ada, bola] = await Promise.all([app.registerUser(), app.registerUser()]);
    const group = await createGroup(ada, [bola]);
    const sent = await app.client.post(`/api/v1/conversations/${group.id}/messages`).auth(ada.accessToken).send({ text: "Hello squad" }).expect(201);
    const messageId = sent.json<{ id: string }>().id;
    const reacted = await app.client.post(`/api/v1/messages/${messageId}/reactions`).auth(bola.accessToken).send({ emoji: "🔥" }).expect(200);
    expect(reacted.json<unknown[]>()).toEqual([{ emoji: "🔥", count: 1, reactedByMe: true }]);
    const removed = await app.client.delete(`/api/v1/messages/${messageId}/reactions/${encodeURIComponent("🔥")}`).auth(bola.accessToken).expect(200);
    expect(removed.json<unknown[]>()).toEqual([]);
  });
});

describe("broadcast channels", () => {
  it("lets only the owner and admins post while subscribers read", async () => {
    const [owner, reader, outsider] = await Promise.all([app.registerUser(), app.registerUser(), app.registerUser()]);
    const created = await app.client.post("/api/v1/channels").auth(owner.accessToken).send({ name: "Zudomart Deals", description: "Daily deals" }).expect(201);
    const channel = created.json<ConversationBody>();
    expect(channel).toMatchObject({ kind: "channel", myRole: "owner", subscriberCount: 1 });

    const subscribed = await app.client.post(`/api/v1/channels/${channel.id}/subscribe`).auth(reader.accessToken).expect(200);
    expect(subscribed.json<ConversationBody>()).toMatchObject({ myRole: "subscriber", subscriberCount: 2 });
    await app.client.post(`/api/v1/conversations/${channel.id}/messages`).auth(reader.accessToken).send({ text: "Can I post?" }).expect(403);
    await app.client.post(`/api/v1/conversations/${channel.id}/messages`).auth(owner.accessToken).send({ text: "Free delivery today" }).expect(201);
    const feed = await app.client.get(`/api/v1/conversations/${channel.id}/messages`).auth(reader.accessToken).expect(200);
    expect(feed.json<{ data: { text: string }[] }>().data.map((message) => message.text)).toEqual(["Free delivery today"]);
    await app.client.get(`/api/v1/conversations/${channel.id}/messages`).auth(outsider.accessToken).expect(404);

    await app.client.post(`/api/v1/conversations/${channel.id}/admins`).auth(owner.accessToken).send({ userId: reader.userId }).expect(204);
    await app.client.post(`/api/v1/conversations/${channel.id}/messages`).auth(reader.accessToken).send({ text: "Now I can" }).expect(201);
    await app.client.delete(`/api/v1/channels/${channel.id}/subscribe`).auth(owner.accessToken).expect(422);
    await app.client.delete(`/api/v1/channels/${channel.id}/subscribe`).auth(reader.accessToken).expect(204);
    await app.client.get(`/api/v1/conversations/${channel.id}`).auth(reader.accessToken).expect(404);
  });
});
