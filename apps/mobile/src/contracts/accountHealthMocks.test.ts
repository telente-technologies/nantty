import { resolveMockApiRequest } from "@/mocks";
import { formatTimeRemaining, parseTimestampToSeconds } from "@/services/account/accountHealth.service";
import { isValidEvidenceLink, splitEvidenceLinks } from "@/services/moderation/copyrightClaims.service";
import type { AccountHealth } from "@/types";

describe("account status and copyright claims", () => {
  it("serves an account health summary with a countdown, strikes and counter-notice actions", async () => {
    const health = await resolveMockApiRequest<AccountHealth>("GET", "/api/v1/account/status", undefined);
    expect(health.status).toBe("AT_RISK");
    expect(health.notices.find((notice) => notice.state === "AWAITING_REMOVAL")?.deadlineAt).toBeTruthy();
    await resolveMockApiRequest("POST", "/api/v1/account/status/strikes/strike-1/appeal", { message: "This was licensed by the label in writing." });
    await resolveMockApiRequest("POST", "/api/v1/copyright/claims/claim-audio-1/counter-notices", { statement: "I licensed this track from the label.", contactEmail: "me@example.com", goodFaith: true });
    const after = await resolveMockApiRequest<AccountHealth>("GET", "/api/v1/account/status", undefined);
    expect(after.strikes[0]?.appealStatus).toBe("PENDING");
    expect(after.notices.find((notice) => notice.claimId === "claim-audio-1")?.canCounterNotice).toBe(false);
  });

  it("rejects claims without the accuracy declaration or a matching signature", async () => {
    const claim = { targetType: "clip", targetId: "clip-1", claimScope: "audio", claimantName: "Ada Obi", workDescription: "My song Lagos Nights", ownershipStatement: "I wrote and recorded it", contactEmail: "a@b.co", proofUrls: ["https://x.example/cert"], segments: [{ startSeconds: 1, endSeconds: 9 }], goodFaith: true };
    await expect(resolveMockApiRequest("POST", "/api/v1/copyright/claims", { ...claim, accuracyDeclared: false, signatureName: "Ada Obi" })).rejects.toThrow();
    await expect(resolveMockApiRequest("POST", "/api/v1/copyright/claims", { ...claim, accuracyDeclared: true, signatureName: "Someone" })).rejects.toThrow();
    await expect(resolveMockApiRequest("POST", "/api/v1/copyright/claims", { ...claim, accuracyDeclared: true, signatureName: "ada obi" })).resolves.toMatchObject({ status: "received" });
  });

  it("parses timestamps, evidence links and countdowns", () => {
    expect(parseTimestampToSeconds("1:05")).toBe(65);
    expect(parseTimestampToSeconds("1:02:03")).toBe(3723);
    expect(parseTimestampToSeconds("abc")).toBeNull();
    expect(isValidEvidenceLink("https://registry.example/1")).toBe(true);
    expect(isValidEvidenceLink("javascript:alert(1)")).toBe(false);
    expect(splitEvidenceLinks("https://a.example\n\n https://b.example ")).toEqual(["https://a.example", "https://b.example"]);
    expect(formatTimeRemaining(new Date(Date.now() + 90 * 60_000 + 30_000).toISOString())).toBe("1h 30m left");
    expect(formatTimeRemaining(new Date(Date.now() - 1000).toISOString())).toBe("Deadline passed");
  });
});
