import { describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { createTestHarness, makeEvent, silentLogger } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://nantty.example", sellerDashboardUrl: "https://seller.nantty.example" };
const invitation = { invitationId: "invitation-1", channelId: "channel-1", inviterId: "inviter-1", inviteeId: "invitee-1" };

async function setup() {
  const harness = createTestHarness();
  for (const userId of [invitation.inviterId, invitation.inviteeId]) {
    await harness.deviceTokens.register(userId, `ExponentPushToken[${userId}]`, "android");
  }
  const handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger);
  return { harness, handler };
}

describe("channel invitation notifications", () => {
  it("notifies the invitee and uses the safe invitation target", async () => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent("conversation.channelInvitationCreated", invitation, "created") });

    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.notifications.rows[0]).toMatchObject({
      userId: invitation.inviteeId,
      category: "social",
      kind: "channelInvitation",
      data: { url: "/channels/invitations", screen: "ChannelInvitations", invitationId: invitation.invitationId, channelId: invitation.channelId },
    });
    expect(harness.pushSender.sent).toHaveLength(1);
    expect(harness.pushSender.sent[0]?.tokens).toContain(`ExponentPushToken[${invitation.inviteeId}]`);
    expect(harness.pushSender.sent[0]?.content.data).toEqual({ url: "/channels/invitations", screen: "ChannelInvitations" });
  });

  it.each([
    ["conversation.channelInvitationAccepted", "channelInvitationAccepted", "Invitation accepted", "Your channel invitation was accepted."],
    ["conversation.channelInvitationDeclined", "channelInvitationDeclined", "Invitation declined", "Your channel invitation was declined."],
  ] as const)("notifies the inviter for %s", async (type, kind, title, body) => {
    const { harness, handler } = await setup();
    await handler.execute({ event: makeEvent(type, invitation, type) });

    expect(harness.notifications.rows).toHaveLength(1);
    expect(harness.notifications.rows[0]).toMatchObject({
      userId: invitation.inviterId,
      category: "social",
      kind,
      title,
      body,
      data: { url: "/channels/invitations", screen: "ChannelInvitations", invitationId: invitation.invitationId, channelId: invitation.channelId },
    });
    expect(harness.pushSender.sent).toHaveLength(1);
    expect(harness.pushSender.sent[0]?.tokens).toContain(`ExponentPushToken[${invitation.inviterId}]`);
    expect(harness.pushSender.sent[0]?.content.data).toEqual({ url: "/channels/invitations", screen: "ChannelInvitations" });
  });

  it("respects the recipient's social push preference through the dispatcher", async () => {
    const { harness, handler } = await setup();
    await harness.preferences.upsert(invitation.inviteeId, "social", { push: false });

    await handler.execute({ event: makeEvent("conversation.channelInvitationCreated", invitation, "preference") });

    expect(harness.notifications.rows.map((row) => row.userId)).toEqual([invitation.inviteeId]);
    expect(harness.pushSender.sent).toHaveLength(0);
  });
});
