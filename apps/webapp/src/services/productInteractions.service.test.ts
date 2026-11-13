import assert from "node:assert/strict";
import test from "node:test";

import type { ConsentChoice } from "@nantty/web-kit";
import { canRecordProductInteraction } from "./productInteractions.service";

const choice = (analytics: boolean): ConsentChoice => ({
  policyVersion: "1.0",
  decidedAt: "2026-11-12T00:00:00.000Z",
  categories: { analytics, personalization: true, advertising: false },
});

test("allows signed-in interaction submission for server-side consent enforcement", () => {
  assert.equal(canRecordProductInteraction(true, choice(false)), true);
});

test("requires explicit analytics consent for anonymous interaction submission", () => {
  assert.equal(canRecordProductInteraction(false, null), false);
  assert.equal(canRecordProductInteraction(false, choice(false)), false);
  assert.equal(canRecordProductInteraction(false, choice(true)), true);
});
