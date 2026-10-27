import { describe, expect, it } from "vitest";

import { ticketReplied } from "../src/modules/eventIngestion/mappings/support.mapping.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { makeEvent } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };
const base = { ticketId: "7b9e2f3a-1111-4222-8333-123456789abc", reference: "SUP-10421", accountId: "u1", subject: "Refund", repliedAt: "2026-10-04T10:00:00.000Z" };

describe("support ticket notifications", () => {
  it("emails, pushes and notifies the user when staff reply, linking to the ticket", () => {
    const data = { ...base, authorKind: "agent", agentName: "Ngozi", message: "The refund left us today." };
    const [intent] = ticketReplied(makeEvent("ticket.replied", data), new EventDataReader(data), context);
    expect(intent?.recipientUserId).toBe("u1");
    expect(intent?.push?.data).toMatchObject({ url: "https://nantty.com/help/tickets/7b9e2f3a-1111-4222-8333-123456789abc", screen: "SupportTicketDetail" });
    const email = intent?.email?.(makeRecipient({ accountId: "u1" }));
    expect(email?.templateKey).toBe("supportAgentReplied");
    expect(email?.deliverIfUnreadAfterMinutes).toBeUndefined();
  });

  it("sends nothing to the user for their own replies", () => {
    const data = { ...base, authorKind: "customer" };
    expect(ticketReplied(makeEvent("ticket.replied", data), new EventDataReader(data), context)).toEqual([]);
  });
});
