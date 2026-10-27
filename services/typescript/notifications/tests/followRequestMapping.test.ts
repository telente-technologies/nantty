import { describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { createTestHarness, makeEvent, silentLogger } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };
const requester = { id: "requester", name: "Ada" };
const owner = { id: "owner", name: "Grace" };

async function setup() {
  const harness = createTestHarness();
  for (const userId of ["requester", "owner"]) await harness.deviceTokens.register(userId, `ExponentPushToken[${userId}]`, "android");
  return { harness, handler: new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger) };
}

const followIds = { followId: "f1", followerId: "requester", followeeId: "owner" };

describe("private account follow request notifications", () => {
  it("tells the private owner about a new request and links to the requests screen", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("followRequest.created", { ...followIds, recipientUserId: "owner", actor: requester, url: "/user/requester" }, "e1") });
    expect(harness.notifications.rows.map((row) => [row.userId, row.title, row.body, row.kind, row.data["url"]])).toEqual([["owner", "Ada", "requested to follow you.", "followRequest", "/me/follow-requests"]]);
    expect(harness.pushSender.sent).toHaveLength(1);
  });

  it("tells the requester once the owner accepts, linking to the owner's profile", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("followRequest.accepted", { ...followIds, recipientUserId: "requester", actor: owner, url: "/user/owner" }, "e2") });
    expect(harness.notifications.rows.map((row) => [row.userId, row.title, row.body, row.kind, row.data["url"]])).toEqual([["requester", "Grace", "accepted your follow request.", "followRequestAccepted", "/user/owner"]]);
  });

  it("does not tell the owner 'started following you' for a follow they just accepted", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("follow.created", { ...followIds, state: "accepted", recipientUserId: "owner", actor: requester, viaRequest: true }, "e3") });
    expect(harness.notifications.rows).toHaveLength(0);
    expect(harness.pushSender.sent).toHaveLength(0);
  });

  it("still tells a public account about a direct follow", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("follow.created", { ...followIds, state: "accepted", recipientUserId: "owner", actor: requester }, "e4") });
    expect(harness.notifications.rows.map((row) => [row.userId, row.body])).toEqual([["owner", "started following you."]]);
  });

  it("never notifies anyone about a declined request", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("follow.rejected", followIds, "e5") });
    expect(harness.notifications.rows).toHaveLength(0);
    expect(harness.pushSender.sent).toHaveLength(0);
  });
});
