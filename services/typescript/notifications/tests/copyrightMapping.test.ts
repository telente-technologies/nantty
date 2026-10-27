import { describe, expect, it } from "vitest";

import { copyrightAudioMuted, copyrightContentRestored, copyrightContentTakenDown, copyrightCounterNoticeReceived, copyrightWarningIssued, hoursUntil, strikeExpired, strikeIssued } from "../src/modules/eventIngestion/mappings/copyright.mapping.js";
import { eventMappings } from "../src/modules/eventIngestion/mappings/eventMappingRegistry.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { makeEvent } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com" };
const remedy = { claimId: "0192f0a1-7c3e-7000-8000-00000000c1a1", targetType: "clip", targetId: "clip-1", infringerId: "u1", workTitle: "Lagos Nights", reason: "proof matches", canSubmitCounterNotice: true };
const run = (mapping: typeof copyrightWarningIssued, type: string, data: Record<string, unknown>) => mapping(makeEvent(type, data), new EventDataReader(data), context);

describe("copyright notifications", () => {
  it("warns the uploader with the deadline in-app, by push and by email", () => {
    const data = { ...remedy, deadlineAt: "2026-10-05T11:59:00.000Z", warningId: "0192f0a1-7c3e-7000-8000-00000000c1a2" };
    const [intent] = run(copyrightWarningIssued, "copyrightClaim.warningIssued", data);
    expect(intent?.recipientUserId).toBe("u1");
    expect(intent?.inApp?.body).toContain("48 hours");
    expect(intent?.push?.data).toMatchObject({ screen: "AccountStatus" });
    const email = intent?.email?.(makeRecipient({ accountId: "u1" }));
    expect(email).toMatchObject({ templateKey: "copyrightWarning", props: { deadlineHours: 48, contentUrl: "https://nantty.com/clips/clip-1" } });
  });

  it("tells the uploader about muted audio, takedowns and restorations", () => {
    expect(run(copyrightAudioMuted, "copyrightClaim.audioMuteOrdered", remedy)[0]?.email?.(makeRecipient({ accountId: "u1" })).templateKey).toBe("audioMuted");
    const takedown = run(copyrightContentTakenDown, "copyrightClaim.contentTakenDown", { ...remedy, strikeId: "0192f0a1-7c3e-7000-8000-00000000c1a3" })[0]?.email?.(makeRecipient({ accountId: "u1" }));
    expect(takedown).toMatchObject({ templateKey: "contentTakenDown", props: { strikeAdded: true } });
    expect(run(copyrightContentTakenDown, "copyrightClaim.contentTakenDown", { ...remedy, infringerId: "" })).toEqual([]);
    const restored = run(copyrightContentRestored, "copyrightClaim.restored", { ...remedy, remedy: "audio_muted" })[0]?.email?.(makeRecipient({ accountId: "u1" }));
    expect(restored).toMatchObject({ templateKey: "contentRestored", props: { audioOnly: true } });
  });

  it("emails the claimant at the address on the claim when a counter-notice arrives", () => {
    const [intent] = run(copyrightCounterNoticeReceived, "copyrightClaim.counterNoticeReceived", { claimId: remedy.claimId, noticeId: "n1", infringerId: "u1", restoreEligibleAt: "2026-10-18T09:00:00Z", claimantUserId: "c1", claimantEmail: "owner@label.com" });
    expect(intent).toMatchObject({ recipientUserId: "c1", emailAddressOverride: "owner@label.com" });
  });

  it("notifies strikes but not warnings, and announces expiry", () => {
    expect(run(strikeIssued, "strike.issued", { strikeId: "s1", accountId: "u1", kind: "warning", source: "copyright", activeStrikeCount: 0 })).toEqual([]);
    expect(run(strikeIssued, "strike.issued", { strikeId: "s1", accountId: "u1", kind: "strike", source: "copyright", policy: "Copyright infringement", expiresAt: "2027-01-02T00:00:00Z", activeStrikeCount: 2 })[0]?.inApp?.body).toBe("You have 2 active strikes.");
    expect(run(strikeExpired, "strike.expired", { strikeId: "s1", accountId: "u1", kind: "strike", source: "copyright", activeStrikeCount: 0 })[0]?.email?.(makeRecipient({ accountId: "u1" })).templateKey).toBe("strikeExpired");
  });

  it("is registered for every copyright event the topology routes", () => {
    for (const type of ["copyrightClaim.warningIssued", "copyrightClaim.audioMuteOrdered", "copyrightClaim.contentTakenDown", "copyrightClaim.counterNoticeReceived", "copyrightClaim.restored", "strike.issued", "strike.expired"]) expect(eventMappings[type]).toBeDefined();
    expect(hoursUntil("not a date", "2026-10-03T00:00:00Z")).toBe(48);
  });
});
