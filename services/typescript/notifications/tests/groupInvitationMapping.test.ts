import { describe, expect, it } from "vitest";

import { eventMappings } from "../src/modules/eventIngestion/mappings/eventMappingRegistry.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import type { DomainEventEnvelope } from "../src/types/domainEvent.type.js";

const context = { webBaseUrl: "https://nantty.example", sellerDashboardUrl: "https://seller.nantty.example" };

function makeEvent(type: string, data: Readonly<Record<string, unknown>>): DomainEventEnvelope {
  return {
    id: "event-1",
    type,
    source: "social",
    subject: "invitation-1",
    schemaVersion: 1,
    occurredAt: "2026-11-05T12:00:00.000Z",
    data,
  };
}

describe("group invitation notification mappings", () => {
  it("notifies only the invitee and routes to the invitation inbox", () => {
    const event = makeEvent("conversation.groupInvitationCreated", {
      invitationId: "invitation-1",
      conversationId: "conversation-1",
      inviterId: "inviter-1",
      inviteeId: "invitee-1",
    });
    const [intent] = eventMappings[event.type]!(event, new EventDataReader(event.data), context);

    expect(intent?.recipientUserId).toBe("invitee-1");
    expect(intent?.preferenceCategory).toBe("social");
    expect(intent?.inApp?.data).toMatchObject({ url: "/chats/invitations", screen: "GroupInvitations", invitationId: "invitation-1", conversationId: "conversation-1" });
    expect(intent?.push?.data).toEqual({ url: "/chats/invitations", screen: "GroupInvitations" });
    expect(intent?.email).toBeUndefined();
  });

  it("notifies the inviter about consent without implying membership", () => {
    const event = makeEvent("conversation.groupInvitationAccepted", {
      invitationId: "invitation-1",
      conversationId: "conversation-1",
      inviterId: "inviter-1",
      inviteeId: "invitee-1",
    });
    const [intent] = eventMappings[event.type]!(event, new EventDataReader(event.data), context);

    expect(intent?.recipientUserId).toBe("inviter-1");
    expect(intent?.inApp?.body).toContain("Secure key setup is still required before membership begins");
    expect(intent?.push?.body).toContain("before group membership begins");
  });

  it("notifies the inviter when an invitation is declined", () => {
    const event = makeEvent("conversation.groupInvitationDeclined", {
      invitationId: "invitation-1",
      conversationId: "conversation-1",
      inviterId: "inviter-1",
      inviteeId: "invitee-1",
    });
    const [intent] = eventMappings[event.type]!(event, new EventDataReader(event.data), context);

    expect(intent?.recipientUserId).toBe("inviter-1");
    expect(intent?.inApp?.body).toBe("Your group invitation was declined.");
  });
});
