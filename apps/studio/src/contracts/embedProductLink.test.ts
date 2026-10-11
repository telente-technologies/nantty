import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readProductIdFromZudomartLink } from "../components/embed/embedProductLink.util";

describe("embed product links", () => {
  it("reads product ids from Zudomart product links only", () => {
    assert.equal(readProductIdFromZudomartLink("https://zudomart.com/p/adire-two-piece-0191a2b3-c4d5-7e6f-8a9b-0c1d2e3f4a5b"), "0191a2b3-c4d5-7e6f-8a9b-0c1d2e3f4a5b");
    assert.equal(readProductIdFromZudomartLink("https://app.zudomart.com/p/shea-kit-p42"), "p42");
    assert.equal(readProductIdFromZudomartLink("https://evil.example/p/x-p1"), null);
    assert.equal(readProductIdFromZudomartLink("https://zudomart.com/settings"), null);
    assert.equal(readProductIdFromZudomartLink("javascript:alert(1)"), null);
    assert.equal(readProductIdFromZudomartLink(""), null);
  });
});
