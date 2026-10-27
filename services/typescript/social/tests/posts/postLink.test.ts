import { describe, expect, it } from "vitest";

import { findFirstPostLink, readPostIdFromUrl, stripTrailingPostLink } from "../../src/utils/postLink.util.js";

const id = "0192f0a0-0000-7000-8000-0000000000c1";
const other = "0192f0a0-0000-7000-8000-0000000000c2";

describe("post link parsing", () => {
  it.each([
    `https://nantty.com/post/${id}`,
    `https://www.nantty.com/posts/${id}`,
    `https://app.nantty.com/clip/${id}`,
    `https://app.nantty.com/post/${id}`,
    `http://nantty.com/post/${id}`,
    `https://www.nantty.com/posts/${id}/`,
    `https://APP.NANTTY.COM/clip/${id.toUpperCase()}`,
    `https://nantty.app/clips/${id}?ref=share`,
  ])("accepts our own post link %s", (url) => {
    expect(readPostIdFromUrl(url)).toBe(id);
  });

  it.each([
    [`https://evil.io/post/${id}`, "a foreign domain"],
    [`https://nantty.com.evil.io/post/${id}`, "a Nantty lookalike domain"],
    [`https://nantty.com.evil.io/post/${id}`, "a lookalike suffix domain"],
    [`https://evilnantty.com/post/${id}`, "a lookalike prefix domain"],
    [`https://nantty.com@evil.io/post/${id}`, "credentials pointing elsewhere"],
    [`https://user@nantty.com/post/${id}`, "embedded credentials"],
    [`https://nantty.com:8443/post/${id}`, "a non-default port"],
    [`ftp://nantty.com/post/${id}`, "a non-web scheme"],
    ["https://nantty.com/post/not-a-uuid", "a malformed id"],
    [`https://nantty.com/post/${id}/likes`, "an extra path segment"],
    [`https://nantty.com/post/${id}?comment=${other}`, "a link to a comment"],
    [`https://nantty.com/comments/${id}`, "a comment path"],
    [`https://nantty.com/product/${id}`, "a product link"],
    [`https://nantty.com/post/%E0%A4%A`, "broken percent encoding"],
  ])("ignores %s (%s)", (url) => {
    expect(readPostIdFromUrl(url)).toBeNull();
  });

  it("only counts the first post link and skips non-post links before it", () => {
    const text = `see https://evil.io/post/${id} and https://nantty.com/post/${other} then https://nantty.com/post/${id}`;
    expect(findFirstPostLink(text)?.postId).toBe(other);
  });

  it("drops trailing punctuation from the matched link", () => {
    const text = `wow (https://nantty.com/post/${id}).`;
    const link = findFirstPostLink(text);
    expect(link?.url).toBe(`https://nantty.com/post/${id}`);
    expect(text.slice(link?.start, link?.end)).toBe(link?.url);
  });

  it("strips the link only when it ends the text", () => {
    const trailing = `So true https://nantty.com/post/${id}  `;
    expect(stripTrailingPostLink(trailing, findFirstPostLink(trailing)!)).toBe("So true");
    const middle = `Look https://nantty.com/post/${id} right?`;
    expect(stripTrailingPostLink(middle, findFirstPostLink(middle)!)).toBe(middle);
    const only = `https://nantty.com/post/${id}`;
    expect(stripTrailingPostLink(only, findFirstPostLink(only)!)).toBe("");
  });
});
