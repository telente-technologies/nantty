import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readProductIdFromNanttyLink } from "../components/embed/embedProductLink.util";

describe("embed product links", () => {
  it("reads product ids from Nantty product links only", () => {
    assert.equal(readProductIdFromNanttyLink("https://nantty.com/p/adire-two-piece-0191a2b3-c4d5-7e6f-8a9b-0c1d2e3f4a5b"), "0191a2b3-c4d5-7e6f-8a9b-0c1d2e3f4a5b");
    assert.equal(readProductIdFromNanttyLink("https://app.nantty.com/p/shea-kit-p42"), "p42");
    assert.equal(readProductIdFromNanttyLink("https://evil.example/p/x-p1"), null);
    assert.equal(readProductIdFromNanttyLink("https://nantty.com/settings"), null);
    assert.equal(readProductIdFromNanttyLink("javascript:alert(1)"), null);
    assert.equal(readProductIdFromNanttyLink(""), null);
  });
});
