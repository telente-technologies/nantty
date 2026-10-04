import { normaliseLinkHref, splitTextByUrls } from "@/utils/linkify.util";

describe("splitTextByUrls", () => {
  it("returns a single plain segment when there is no link", () => {
    expect(splitTextByUrls("hello there")).toEqual([{ text: "hello there", href: null }]);
  });

  it("finds https and www links and trims trailing punctuation", () => {
    const segments = splitTextByUrls("See https://example.com/a?b=1. Also www.zudomart.com/p/abc!");
    expect(segments.filter((segment) => segment.href)).toEqual([
      { text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { text: "www.zudomart.com/p/abc", href: "https://www.zudomart.com/p/abc" },
    ]);
    expect(segments.map((segment) => segment.text).join("")).toBe("See https://example.com/a?b=1. Also www.zudomart.com/p/abc!");
  });

  it("keeps balanced parentheses but drops a closing one that wraps the link", () => {
    expect(splitTextByUrls("(https://en.wikipedia.org/wiki/Lagos_(city))")[1]).toEqual({
      text: "https://en.wikipedia.org/wiki/Lagos_(city)",
      href: "https://en.wikipedia.org/wiki/Lagos_(city)",
    });
  });

  it("ignores www inside a word and non-web schemes", () => {
    expect(splitTextByUrls("awww.nice").every((segment) => segment.href === null)).toBe(true);
    expect(normaliseLinkHref("javascript:alert(1)")).toBeNull();
    expect(normaliseLinkHref("www.localhost")).toBe("https://www.localhost");
    expect(normaliseLinkHref("https://nodot")).toBeNull();
  });
});
