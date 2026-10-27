import { describe, expect, it } from "vitest";

import { accountBanned, accountRestricted, accountSuspended, accountWarned, appealDecided } from "../src/modules/eventIngestion/mappings/identity.mapping.js";
import type { EventMapping } from "../src/modules/eventIngestion/mappings/mappingHelpers.js";
import { checkmarkRevoked } from "../src/modules/eventIngestion/mappings/verification.mapping.js";
import { toInAppPath } from "../src/modules/inbox/dtos/notification.dto.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { makeEvent } from "./fakes/testHarness.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };
const caseAction = { accountId: "u1", caseId: "CASE-1", reason: "Counterfeit listings", policy: "Marketplace policy", policyUrl: "https://nantty.com/policy", appealUrl: "https://nantty.com/settings/account-status" };

const trustCases: readonly { readonly type: string; readonly mapping: EventMapping; readonly data: Record<string, unknown> }[] = [
  { type: "account.warned", mapping: accountWarned, data: caseAction },
  { type: "account.restricted", mapping: accountRestricted, data: { ...caseAction, restrictions: ["Cannot post"], until: "2026-10-20T00:00:00.000Z" } },
  { type: "account.suspended", mapping: accountSuspended, data: { ...caseAction, appealBy: "2026-10-20T00:00:00.000Z", deletionAt: "2026-11-20T00:00:00.000Z" } },
  { type: "account.banned", mapping: accountBanned, data: caseAction },
  { type: "appeal.decided", mapping: appealDecided, data: { accountId: "u1", caseId: "CASE-1", outcome: "upheld", explanation: "The restriction stands." } },
];

describe("in-product appeal links", () => {
  it("points every trust decision at the account status page", () => {
    for (const { type, mapping, data } of trustCases) {
      const [intent] = mapping(makeEvent(type, data), new EventDataReader(data), context);
      expect(intent?.inApp?.data).toMatchObject({ url: "https://nantty.com/settings/account-status", screen: "AccountStatus" });
    }
  });

  it("normalises the account status link into an in-app path", () => {
    const data = { ...caseAction };
    const [intent] = accountWarned(makeEvent("account.warned", data), new EventDataReader(data), context);
    expect(toInAppPath(intent?.inApp?.data?.["url"], context.webBaseUrl)).toBe("/settings/account-status");
  });

  it("points a revoked checkmark at verification settings", () => {
    const data = { accountId: "u1", checkmark: "gold", accountName: "Adire", reason: "Impersonation", appealUrl: "https://nantty.com/settings/verification" };
    const [intent] = checkmarkRevoked(makeEvent("checkmark.revoked", data), new EventDataReader(data), context);
    expect(intent?.inApp?.data).toMatchObject({ url: "https://nantty.com/settings/verification", screen: "Verification" });
  });
});
