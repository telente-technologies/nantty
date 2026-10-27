import { describe, expect, it } from "vitest";

import { findFirstPostLink, readPostIdFromUrl, stripTrailingPostLink } from "../../src/utils/postLink.util.js";

const id = "0192f0a0-0000-7000-8000-0000000000c1";
const other = "0192f0a0-0000-7000-8000-0000000000c2";

describe("post link parsing", () => {
  it.each([
    `https://nantty.com/post/${id}`,
    `https://www.nantty.com/posts/${id}`,
    `https://app.nantty.com/clip/${id}`,
    `https://app.zudomart.com/post/${id}`,
    `http://zudomart.com/post/${id}`,
    `https://www.zudomart.com/posts/${id}/`,
    `https://APP.ZUDOMART.COM/clip/${id.toUpperCase()}`,
    `https://zudomart.app/clips/${id}?ref=share`,
  ])("accepts our own post link %s", (url) => {
    expect(readPostIdFromUrl(url)).toBe(id);
  });

  it.each([
    [`https://evil.io/post/${id}`, "a foreign domain"],
    [`https://nantty.com.evil.io/post/${id}`, "a Nantty lookalike domain"],
    [`https://zudomart.com.evil.io/post/${id}`, "a lookalike suffix domain"],
    [`https://evilzudomart.com/post/${id}`, "a lookalike prefix domain"],
    [`https://zudomart.com@evil.io/post/${id}`, "credentials pointing elsewhere"],
    [`https://user@zudomart.com/post/${id}`, "embedded credentials"],
    [`https://zudomart.com:8443/post/${id}`, "a non-default port"],
    [`ftp://zudomart.com/post/${id}`, "a non-web scheme"],
    ["https://zudomart.com/post/not-a-uuid", "a malformed id"],
    [`https://zudomart.com/post/${id}/likes`, "an extra path segment"],
    [`https://zudomart.com/post/${id}?comment=${other}`, "a link to a comment"],
    [`https://zudomart.com/comments/${id}`, "a comment path"],
    [`https://zudomart.com/product/${id}`, "a product link"],
    [`https://zudomart.com/post/%E0%A4%A`, "broken percent encoding"],
  ])("ignores %s (%s)", (url) => {
    expect(readPostIdFromUrl(url)).toBeNull();
  });

  it("only counts the first post link and skips non-post links before it", () => {
    const text = `see https://evil.io/post/${id} and https://zudomart.com/post/${other} then https://zudomart.com/post/${id}`;
    expect(findFirstPostLink(text)?.postId).toBe(other);
  });

  it("drops trailing punctuation from the matched link", () => {
    const text = `wow (https://zudomart.com/post/${id}).`;
    const link = findFirstPostLink(text);
    expect(link?.url).toBe(`https://zudomart.com/post/${id}`);
    expect(text.slice(link?.start, link?.end)).toBe(link?.url);
  });

  it("strips the link only when it ends the text", () => {
    const trailing = `So true https://zudomart.com/post/${id}  `;
    expect(stripTrailingPostLink(trailing, findFirstPostLink(trailing)!)).toBe("So true");
    const middle = `Look https://zudomart.com/post/${id} right?`;
    expect(stripTrailingPostLink(middle, findFirstPostLink(middle)!)).toBe(middle);
    const only = `https://zudomart.com/post/${id}`;
    expect(stripTrailingPostLink(only, findFirstPostLink(only)!)).toBe("");
  });
});
