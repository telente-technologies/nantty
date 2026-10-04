import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { formatTimeRemaining, isValidEvidenceLink, parseTimestampToSeconds, readSegments, splitEvidenceLinks } from "@/services/copyrightAccount.service";
import type { AccountHealth } from "@/types";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe("account status and copyright claims", () => {
  it("serves the health summary and records appeals and counter-notices", async () => {
    const health = (await dispatchMockApiRequest("GET", "/api/v1/account/status", new URLSearchParams(), null)) as AccountHealth;
    assert.equal(health.status, "AT_RISK");
    assert.ok(health.notices.some((notice) => notice.state === "AWAITING_REMOVAL" && notice.deadlineAt));
    await dispatchMockApiRequest("POST", "/api/v1/account/status/strikes/strike-1/appeal", new URLSearchParams(), encode({ message: "The label licensed this track to me in writing." }));
    await dispatchMockApiRequest("POST", "/api/v1/copyright/claims/claim-video-1/counter-notices", new URLSearchParams(), encode({ statement: "This is my own choreography.", contactEmail: "me@example.com", goodFaith: true }));
    const after = (await dispatchMockApiRequest("GET", "/api/v1/account/status", new URLSearchParams(), null)) as AccountHealth;
    assert.equal(after.strikes[0]?.appealStatus, "PENDING");
    assert.equal(after.notices.find((notice) => notice.claimId === "claim-video-1")?.canCounterNotice, false);
  });

  it("requires the accuracy declaration and a matching signature on claims", async () => {
    const claim = { targetType: "clip", targetId: "clip-1", claimScope: "video", claimantName: "Ada Obi", workDescription: "My dance routine", ownershipStatement: "I choreographed it", contactEmail: "a@b.co", originalWorkUrl: "https://x.example/v", proofUrls: ["https://x.example/p"], segments: [{ startSeconds: 0, endSeconds: 10 }], goodFaith: true };
    await assert.rejects(dispatchMockApiRequest("POST", "/api/v1/copyright/claims", new URLSearchParams(), encode({ ...claim, accuracyDeclared: false, signatureName: "Ada Obi" })));
    await assert.rejects(dispatchMockApiRequest("POST", "/api/v1/copyright/claims", new URLSearchParams(), encode({ ...claim, accuracyDeclared: true, signatureName: "Bola" })));
    const receipt = (await dispatchMockApiRequest("POST", "/api/v1/copyright/claims", new URLSearchParams(), encode({ ...claim, accuracyDeclared: true, signatureName: "ADA OBI" }))) as { status: string };
    assert.equal(receipt.status, "received");
  });

  it("parses segments, links and countdowns", () => {
    assert.deepEqual(readSegments([{ start: "0:05", end: "0:30" }, { start: "", end: "" }]), { isValid: true, segments: [{ startSeconds: 5, endSeconds: 30 }] });
    assert.equal(readSegments([{ start: "0:30", end: "0:05" }]).isValid, false);
    assert.equal(parseTimestampToSeconds("2:00:00"), 7200);
    assert.equal(isValidEvidenceLink("ftp://x"), false);
    assert.deepEqual(splitEvidenceLinks("https://a.example\nhttps://b.example"), ["https://a.example", "https://b.example"]);
    assert.equal(formatTimeRemaining(new Date(Date.now() + 5 * 60_000 + 10_000).toISOString()), "5m left");
  });
});
