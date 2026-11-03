import { creatorProgramMocks } from "./creatorProgram.mock";
import { me, mockSession } from "./fixtures.mock";

describe("creator application mock contract", () => {
  it("accepts applications without a payout account", () => {
    const originalUserId = mockSession.signedInUserId;
    mockSession.signedInUserId = me.id;
    try {
      const submit = creatorProgramMocks.find((route) => route.method === "POST" && route.path === "/api/v1/creators/applications");
      expect(submit).toBeDefined();
      const application = submit!.handler({
        params: {},
        query: new URLSearchParams(),
        body: { contentCategories: ["tech"], socialLinks: [], sampleContentUrls: [], acceptedCreatorTermsVersion: "2026-09" },
      }) as { readonly status: string; readonly reviewedAt: string | null };
      expect(application.status).toBe("pending");
      expect(application.reviewedAt).toBeNull();
    } finally {
      mockSession.signedInUserId = originalUserId;
    }
  });
});
