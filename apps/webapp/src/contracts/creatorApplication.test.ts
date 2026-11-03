import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { creatorProgramMocks } from "@/mocks/creatorProgram.mock";
import { demoFanAccount, mockSession } from "@/mocks/fixtures.mock";

describe("creator application mock contract", () => {
  it("accepts a creator application without a payout account for manual review", () => {
    const originalUserId = mockSession.signedInUserId;
    mockSession.signedInUserId = demoFanAccount.id;
    try {
      const submit = creatorProgramMocks.find((route) => route.method === "POST" && route.path === "/api/v1/creators/applications");
      assert.ok(submit);
      const application = submit.handler({
        params: {},
        query: new URLSearchParams(),
        body: { contentCategories: ["tech"], socialLinks: [], sampleContentUrls: [], acceptedCreatorTermsVersion: "v1" },
      }) as { readonly status: string };
      assert.ok(["pending", "rejected"].includes(application.status));
    } finally {
      mockSession.signedInUserId = originalUserId;
    }
  });
});
