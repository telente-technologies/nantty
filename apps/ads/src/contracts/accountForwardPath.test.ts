import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAccountForwardPath } from "@/utils/accountForwardPath.util";

describe("account chooser forward paths", () => {
  it("forwards a relative path inside the chosen ad account, keeping its query", () => {
    assert.equal(buildAccountForwardPath("act_ifelifestyle", "campaigns/new?objective=store_promotion"), "/accounts/act_ifelifestyle/campaigns/new?objective=store_promotion");
    assert.equal(buildAccountForwardPath("act_ifelifestyle", "campaigns/new"), "/accounts/act_ifelifestyle/campaigns/new");
    assert.equal(buildAccountForwardPath("act_ifelifestyle", "campaigns/cmp_ife_spring"), "/accounts/act_ifelifestyle/campaigns/cmp_ife_spring");
  });

  it("falls back to the overview for anything that could leave the account or the site", () => {
    const unsafeForwardPaths = [null, "", "/campaigns/new", "//evil.example", "https://evil.example", "../../login", "campaigns/../../bff/auth", "campaigns\\new", "campaigns/new#x", "javascript:alert(1)", `campaigns/${"a".repeat(220)}`];
    for (const forwardPath of unsafeForwardPaths) assert.equal(buildAccountForwardPath("act_ifelifestyle", forwardPath), "/accounts/act_ifelifestyle/overview", String(forwardPath));
  });
});
