import assert from "node:assert/strict";
import test from "node:test";

import { qualifiesAsProductAdImpression } from "./productAdViewability.util";

test("requires the product creative to be ready before counting an impression", () => {
  assert.equal(qualifiesAsProductAdImpression({ productReady: false, pageVisible: true, intersectionRatio: 1, visibleForMs: 2_000 }), false);
  assert.equal(qualifiesAsProductAdImpression({ productReady: true, pageVisible: false, intersectionRatio: 1, visibleForMs: 2_000 }), false);
});

test("requires at least half of the rendered product ad to remain visible for one second", () => {
  assert.equal(qualifiesAsProductAdImpression({ productReady: true, pageVisible: true, intersectionRatio: 0.49, visibleForMs: 2_000 }), false);
  assert.equal(qualifiesAsProductAdImpression({ productReady: true, pageVisible: true, intersectionRatio: 0.5, visibleForMs: 999 }), false);
  assert.equal(qualifiesAsProductAdImpression({ productReady: true, pageVisible: true, intersectionRatio: 0.5, visibleForMs: 1_000 }), true);
});
