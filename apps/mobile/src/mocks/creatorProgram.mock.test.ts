import { creatorApplicationDecision, creatorProgramMocks } from "./creatorProgram.mock";
import { me, mockSession } from "./fixtures.mock";

describe("creator application mock contract", () => {
  it("does not create an application or cooldown while trusted eligibility metrics are unavailable", () => {
    const originalUserId = mockSession.signedInUserId;
    mockSession.signedInUserId = me.id;
    try {
      const submit = creatorProgramMocks.find((route) => route.method === "POST" && route.path === "/api/v1/creators/applications");
      expect(submit).toBeDefined();
      expect(() => submit!.handler({
        params: {},
        query: new URLSearchParams(),
        body: { contentCategories: ["tech"], socialLinks: [], sampleContentUrls: [], acceptedCreatorTermsVersion: "2026-09" },
      })).toThrow("Trusted Creator metrics or moderation standing is temporarily unavailable");
    } finally {
      mockSession.signedInUserId = originalUserId;
    }
  });

  it("routes an eligible applicant without a payout account to manual review", () => {
    expect(creatorApplicationDecision("auto_approve", false)).toBe("manual_review");
  });
});
