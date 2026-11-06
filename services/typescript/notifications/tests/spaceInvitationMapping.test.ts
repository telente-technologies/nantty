import { describe, expect, it } from "vitest";

import { eventMappings } from "../src/modules/eventIngestion/mappings/eventMappingRegistry.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import type { DomainEventEnvelope } from "../src/types/domainEvent.type.js";

describe("Space invitation notification mapping", () => {
  it("notifies the invited account and routes to its pending invitation list", () => {
    const event: DomainEventEnvelope = {
      id: "space-invite-event",
      type: "space.invited",
      source: "live",
      subject: "space-1",
      schemaVersion: 1,
      occurredAt: "2026-11-06T12:00:00.000Z",
      data: { spaceId: "space-1", invitationId: "inv-1", accountId: "invitee-1", role: "speaker", title: "Guest speaker", invitedBy: "host-1" },
    };
    const [intent] = eventMappings[event.type]!(event, new EventDataReader(event.data), {
      webBaseUrl: "https://nantty.example",
      sellerDashboardUrl: "https://seller.nantty.example",
    });

    expect(intent?.recipientUserId).toBe("invitee-1");
    expect(intent?.preferenceCategory).toBe("social");
    expect(intent?.inApp?.data).toEqual({ url: "/spaces", screen: "SpaceInvitations", spaceId: "space-1", invitationId: "inv-1" });
    expect(intent?.push?.data).toEqual({ url: "/spaces", screen: "SpaceInvitations", spaceId: "space-1", invitationId: "inv-1" });
    expect(intent?.email).toBeUndefined();
  });
});
