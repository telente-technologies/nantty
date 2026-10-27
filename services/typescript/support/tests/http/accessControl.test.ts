import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { requesterId, otherRequesterId } from "../fakes/supportHarness.fake.js";
import { internalToken, startSupportTestServer } from "../fakes/httpTestServer.fake.js";

let server: Awaited<ReturnType<typeof startSupportTestServer>>;
const asUser = (accountId: string) => ({ "x-nantty-account-id": accountId, "content-type": "application/json" });
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(`${server.baseUrl}${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });

beforeAll(async () => {
  server = await startSupportTestServer();
  const category = await server.harness.helpStore.findCategoryBySlug("buying-and-orders");
  await server.harness.helpStore.createTopic({ categoryId: category!.id, slug: "how-escrow-protects-you", locale: "en", title: "How escrow protects you", summary: "Payments wait in escrow.", bodyMarkdown: "## Escrow\n\nYour payment waits in escrow until you confirm delivery.", tags: ["escrow"], status: "published", origin: "seed", sourceTicketId: null, seedKey: null, seedHash: null, editorName: "Nantty", relatedTopicIds: [] });
  await server.harness.helpStore.createTopic({ categoryId: category!.id, slug: "draft-topic", locale: "en", title: "A draft topic nobody sees", summary: "", bodyMarkdown: "Not ready for readers yet at all.", tags: [], status: "draft", origin: "editorial", sourceTicketId: null, seedKey: null, seedHash: null, editorName: "Nantty", relatedTopicIds: [] });
});

afterAll(async () => server.stop());

describe("public help content", () => {
  it("lets guests read categories, search and open published topics", async () => {
    const categories = (await (await fetch(`${server.baseUrl}/api/v1/help/categories`)).json()) as { items: { slug: string; topicCount: number }[] };
    expect(categories.items).toEqual([expect.objectContaining({ slug: "buying-and-orders", topicCount: 1 })]);
    const search = (await (await fetch(`${server.baseUrl}/api/v1/help/topics?q=escrow`)).json()) as { items: { slug: string }[] };
    expect(search.items.map((item) => item.slug)).toEqual(["how-escrow-protects-you"]);
    const topic = await fetch(`${server.baseUrl}/api/v1/help/topics/how-escrow-protects-you`);
    expect(topic.status).toBe(200);
    expect(await topic.json()).toMatchObject({ title: "How escrow protects you", viewerVote: null, categorySlug: "buying-and-orders" });
  });

  it("hides drafts and unknown topics from everyone", async () => {
    expect((await fetch(`${server.baseUrl}/api/v1/help/topics/draft-topic`)).status).toBe(404);
    expect((await fetch(`${server.baseUrl}/api/v1/help/topics/nope`)).status).toBe(404);
  });

  it("serves old help slugs through canonical topics", async () => {
    const category = await server.harness.helpStore.findCategoryBySlug("buying-and-orders");
    for (const [canonical, legacy] of [["what-is-nantty", "what-is-nantty"], ["owed-to-nantty", "owed-to-nantty"]] as const) {
      const created = await server.harness.helpStore.createTopic({ categoryId: category!.id, slug: canonical, locale: "en", title: canonical, summary: "Brand help topic.", bodyMarkdown: "This is the current help topic content.", tags: [], status: "published", origin: "seed", sourceTicketId: null, seedKey: null, seedHash: null, editorName: "Nantty", relatedTopicIds: [] });
      const response = await fetch(`${server.baseUrl}/api/v1/help/topics/${legacy}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ id: created.id, slug: canonical, redirectedFromSlug: legacy });
    }
  });

  it("requires sign-in to vote and counts one vote per person", async () => {
    const topic = (await (await fetch(`${server.baseUrl}/api/v1/help/topics/how-escrow-protects-you`)).json()) as { id: string };
    expect((await post(`/api/v1/help/topics/${topic.id}/votes`, { helpful: true })).status).toBe(401);
    await post(`/api/v1/help/topics/${topic.id}/votes`, { helpful: true }, asUser(requesterId));
    const second = await post(`/api/v1/help/topics/${topic.id}/votes`, { helpful: true }, asUser(requesterId));
    expect(await second.json()).toMatchObject({ helpfulCount: 1, notHelpfulCount: 0, viewerVote: true });
  });
});

describe("tickets need an account", () => {
  it("rejects guests and hides other people's tickets", async () => {
    expect((await fetch(`${server.baseUrl}/api/v1/support/tickets`)).status).toBe(401);
    expect((await post("/api/v1/support/tickets", { category: "order", subject: "Late order", message: "My order is late by a week now." })).status).toBe(401);
    const created = await post("/api/v1/support/tickets", { category: "order", subject: "Late order", message: "My order is late by a week now." }, { ...asUser(requesterId), "idempotency-key": "http-create-0001" });
    expect(created.status).toBe(201);
    const ticket = (await created.json()) as { id: string; status: string; reference: string };
    expect(ticket.status).toBe("open");
    expect((await fetch(`${server.baseUrl}/api/v1/support/tickets/${ticket.id}`, { headers: asUser(otherRequesterId) })).status).toBe(404);
    const mine = (await (await fetch(`${server.baseUrl}/api/v1/support/tickets`, { headers: asUser(requesterId) })).json()) as unknown[];
    expect(mine).toHaveLength(1);
    expect((await (await fetch(`${server.baseUrl}/api/v1/support/tickets/unread-count`, { headers: asUser(requesterId) })).json())).toEqual({ count: 0 });
  });

  it("validates the ticket form", async () => {
    expect((await post("/api/v1/support/tickets", { category: "nonsense", subject: "x", message: "y" }, asUser(requesterId))).status).toBe(400);
  });
});

describe("staff endpoints", () => {
  it("reject missing, wrong-audience and under-privileged tokens", async () => {
    expect((await fetch(`${server.baseUrl}/api/v1/admin/support/tickets`)).status).toBe(401);
    const wrongAudience = await server.signStaffToken("adm_9", "Mallory", ["support:tickets"], "nantty-api");
    expect((await fetch(`${server.baseUrl}/api/v1/admin/support/tickets`, { headers: { authorization: `Bearer ${wrongAudience}` } })).status).toBe(401);
    const marketing = await server.signStaffToken("adm_8", "Mark", ["marketing:email"]);
    expect((await fetch(`${server.baseUrl}/api/v1/admin/support/tickets`, { headers: { authorization: `Bearer ${marketing}` } })).status).toBe(403);
    const agent = await server.signStaffToken("adm_3", "Ngozi Eze", ["support:tickets"]);
    expect((await post("/api/v1/admin/help/topics", {}, { authorization: `Bearer ${agent}` })).status).toBe(403);
  });

  it("let agents answer tickets and help editors manage topics", async () => {
    const agent = await server.signStaffToken("adm_3", "Ngozi Eze", ["support:tickets"]);
    const queue = (await (await fetch(`${server.baseUrl}/api/v1/admin/support/tickets?status=OPEN`, { headers: { authorization: `Bearer ${agent}` } })).json()) as { items: { id: string; status: string }[] };
    expect(queue.items[0]?.status).toBe("OPEN");
    const reply = await post(`/api/v1/admin/support/tickets/${queue.items[0]!.id}/replies`, { body: "We have asked the seller to ship today.", isInternalNote: false }, { authorization: `Bearer ${agent}` });
    expect(reply.status).toBe(201);
    expect(((await reply.json()) as { ticket: { status: string } }).ticket.status).toBe("AWAITING_USER");
    expect(server.harness.ticketStore.events.some((event) => event.eventType === "ticket.replied" && event.data["authorKind"] === "agent")).toBe(true);
    const editor = await server.signStaffToken("adm_1", "Tolu Adeyemi", ["support:helpContent"]);
    const categories = (await (await fetch(`${server.baseUrl}/api/v1/admin/help/categories`, { headers: { authorization: `Bearer ${editor}` } })).json()) as { items: { id: string }[] };
    const created = await post("/api/v1/admin/help/topics", { categoryId: categories.items[0]!.id, title: "Brand new topic", bodyMarkdown: "A full explanation of the brand new thing.", status: "PUBLISHED" }, { authorization: `Bearer ${editor}` });
    expect(created.status).toBe(201);
    const unsafe = await post("/api/v1/admin/help/topics", { categoryId: categories.items[0]!.id, title: "Unsafe topic", bodyMarkdown: "Click <script>alert(1)</script> to continue." }, { authorization: `Bearer ${editor}` });
    expect(unsafe.status).toBe(400);
  });

  it("guards internal endpoints with the internal token", async () => {
    expect((await post("/internal/support/auto-faq/run", {})).status).toBe(401);
    expect((await post("/internal/support/auto-faq/run", {}, { "x-internal-token": internalToken })).status).toBe(200);
  });
});

describe("support macros", () => {
  it("let live chat agents read macros but not change them", async () => {
    const chatAgent = await server.signStaffToken("adm_7", "Chidi Live", ["support:chat"]);
    expect((await fetch(`${server.baseUrl}/api/v1/admin/support/macros`, { headers: { authorization: `Bearer ${chatAgent}` } })).status).toBe(200);
    expect((await post("/api/v1/admin/support/macros", { title: "Hello", body: "Hi {{user.displayName}}" }, { authorization: `Bearer ${chatAgent}` })).status).toBe(403);
    const emailOnly = await server.signStaffToken("adm_6", "Ema Il", ["support:email"]);
    expect((await fetch(`${server.baseUrl}/api/v1/admin/support/macros`, { headers: { authorization: `Bearer ${emailOnly}` } })).status).toBe(403);
  });
});
