import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { countRepliesHiddenFromChain } from "./commentChain.util";
import { findFirstPostLinkInText, readPostIdFromLink } from "./quotedPostLinks.util";

describe("quoted post links", () => {
  it("accepts only our own post links", () => {
    assert.equal(readPostIdFromLink("https://app.zudomart.com/post/post_1"), "post_1");
    assert.equal(readPostIdFromLink("https://web.nantty.com/post/post_2"), "post_2");
    assert.equal(readPostIdFromLink("https://creator.nantty.com/clips/clip_3"), "clip_3");
    assert.equal(readPostIdFromLink("http://www.zudomart.com/clips/clip_2/"), "clip_2");
    assert.equal(readPostIdFromLink("https://zudomart.com.evil.io/post/post_1"), null);
    assert.equal(readPostIdFromLink("https://evil.io/post/post_1"), null);
    assert.equal(readPostIdFromLink("https://zudomart.com/post/post_1?comment=c1"), null);
    assert.equal(readPostIdFromLink("https://zudomart.com@evil.io/post/post_1"), null);
  });

  it("uses the first post link only", () => {
    assert.deepEqual(findFirstPostLinkInText("a https://evil.io/x b https://zudomart.com/post/p2, c https://zudomart.com/post/p3"), { postId: "p2", url: "https://zudomart.com/post/p2" });
  });

  it("counts replies hidden from an inline chain", () => {
    assert.equal(countRepliesHiddenFromChain({ id: "r", replyCount: 2 }, [{ id: "a", parentCommentId: "r", replyCount: 1 }, { id: "b", parentCommentId: "a", replyCount: 0 }]), 1);
  });
});
