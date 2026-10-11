import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSettingsLinkGroups } from "./settingsLinks.util";

describe("settings home", () => {
  for (const isSeller of [true, false]) {
    it(`gives every row its own icon and link (seller: ${isSeller})`, () => {
      const links = buildSettingsLinkGroups(isSeller).flatMap((group) => group.links);
      assert.equal(new Set(links.map((link) => link.icon)).size, links.length);
      assert.equal(new Set(links.map((link) => link.href)).size, links.length);
    });
  }

  it("does not repeat the profile ⋯ menu shortcuts", () => {
    const hrefs = buildSettingsLinkGroups(false).flatMap((group) => group.links.map((link) => link.href));
    for (const shortcut of ["/saved", "/orders", "/wallet", "/verification", "/me"]) assert.ok(!hrefs.includes(shortcut), shortcut);
  });
});
