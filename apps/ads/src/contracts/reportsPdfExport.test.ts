import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findRequirementForApiCall } from "@/config/rolePermissions.config";
import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";

describe("PAR-014 ads report PDF export", () => {
  it("allows report viewers to export PDF reports and serves PDF bytes in mock mode", async () => {
    assert.deepEqual(findRequirementForApiCall("GET", "/ads/accounts/act_demo/reports/export.pdf"), {
      kind: "account",
      accountId: "act_demo",
      permission: "reports:view",
    });

    const loginRes = await dispatchMockApiRequest({
      method: "POST",
      path: "/auth/login",
      query: new URLSearchParams(),
      headers: new Headers({ "content-type": "application/json" }),
      body: new TextEncoder().encode(JSON.stringify({ identifier: "blessing@ifelifestyle.ng", password: "Nantty2026!" })),
    });
    const token = String((loginRes.body as { accessToken: string }).accessToken);

    const pdfRes = await dispatchMockApiRequest({
      method: "GET",
      path: "/ads/accounts/act_ifelifestyle/reports/export.pdf",
      query: new URLSearchParams({ breakdown: "campaign", from: "2026-11-01", to: "2026-11-16" }),
      headers: new Headers({ authorization: `Bearer ${token}` }),
      body: null,
    });
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.contentType, "application/pdf");
    assert.match(String(pdfRes.body), /^%PDF-1\.4/);
  });
});
