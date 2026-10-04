import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isGuestBrowsablePage, isPublicApiRead } from "../config/guestBrowsing.config";

describe("help centre guest access", () => {
  it("lets guests read the help centre pages", () => {
    for (const path of ["/help", "/help/buying-and-orders", "/help/buying-and-orders/how-escrow-protects-your-order", "/help/views"]) assert.equal(isGuestBrowsablePage(path), true, path);
  });

  it("keeps support tickets behind sign-in", () => {
    for (const path of ["/help/tickets", "/help/tickets/new", "/help/tickets/abc", "/help/tickets/abc/rate"]) assert.equal(isGuestBrowsablePage(path), false, path);
  });

  it("allows anonymous reads of published help content only", () => {
    assert.equal(isPublicApiRead("GET", "/api/v1/help/categories"), true);
    assert.equal(isPublicApiRead("GET", "/api/v1/help/topics/how-escrow-protects-your-order"), true);
    assert.equal(isPublicApiRead("GET", "/api/v1/support/tickets"), false);
  });
});
