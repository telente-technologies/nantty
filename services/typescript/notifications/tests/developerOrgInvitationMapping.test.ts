import { describe, expect, it } from "vitest";

import { developerOrgInvitationCreated } from "../src/modules/eventIngestion/mappings/identity.mapping.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { makeEvent } from "./fakes/testHarness.fake.js";

const context = {
  webBaseUrl: "https://nantty.com",
  sellerDashboardUrl: "https://dashboard.nantty.com",
  developerPortalUrl: "https://developers.nantty.com",
};

describe("developerOrganization.invitationCreated mapping", () => {
  it("routes transactional invitation email and in-app alert only to inviteeAccountId", () => {
    const data = {
      invitationId: "inv-1",
      organizationId: "org-1",
      organizationName: "Nantty Commerce Labs",
      inviteeAccountId: "acct-invitee-1",
      role: "developer",
      expiresAt: "2026-11-24T12:00:00.000Z",
    };
    const intents = developerOrgInvitationCreated(
      makeEvent("developerOrganization.invitationCreated", data),
      new EventDataReader(data),
      context,
    );
    expect(intents).toHaveLength(1);
    expect(intents[0]?.recipientUserId).toBe("acct-invitee-1");
    expect(intents[0]?.inApp?.data?.url).toBe("https://developers.nantty.com/invitations/inv-1");
    const email = intents[0]?.email?.({ firstName: "Amaka", email: "amaka@example.com", userId: "acct-invitee-1" } as never);
    expect(email?.templateKey).toBe("developerOrgInvitation");
    expect((email?.props as { invitationUrl?: string } | undefined)?.invitationUrl).toBe("https://developers.nantty.com/invitations/inv-1");
  });
});
