import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEmbedFramePath, parseEmbedOptions } from "./embedOptions.util";
import { buildOembedIframeHtml, readOembedTarget } from "./embedOembed.util";
import { escapeHtml, renderBuyButtonMarkup, renderEmbedDocument, renderProductCollectionMarkup, renderStoreCardMarkup, safeImageUrl } from "./embedMarkup.util";

const price = { amountMinor: 1_500_000, currency: "NGN" } as const;

describe("embed options", () => {
  it("rejects unknown kinds and unsafe ids, and clamps limits", () => {
    assert.equal(parseEmbedOptions("admin", "x", new URLSearchParams()), null);
    assert.equal(parseEmbedOptions("store", "../../etc", new URLSearchParams()), null);
    const options = parseEmbedOptions("products", "store-1", new URLSearchParams("limit=500&theme=neon&layout=carousel&products=a,b,<x>"));
    assert.equal(options?.limit, 12);
    assert.equal(options?.theme, "light");
    assert.equal(options?.layout, "carousel");
    assert.deepEqual(options?.productIds, ["a", "b"]);
    assert.equal(buildEmbedFramePath({ kind: "products", id: "store-1", theme: "dark", layout: "grid", limit: 6 }), "/embed/products/store-1?theme=dark&layout=grid&limit=6");
  });
});

describe("embed markup", () => {
  it("escapes seller-provided text so it can't inject markup", () => {
    const html = renderStoreCardMarkup({ name: "<script>alert(1)</script>", handle: "x\" onload=\"y", logoUrl: "javascript:alert(1)", bio: "<img src=x onerror=alert(1)>", verified: true, productsCount: 3, url: "https://zudomart.com/store/s1" });
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("<img src=x"));
    assert.ok(!html.includes("javascript:"));
    assert.ok(html.includes("&#60;script&#62;"));
    assert.equal(escapeHtml("`'\""), "&#96;&#39;&#34;");
  });

  it("only loads https images", () => {
    assert.equal(safeImageUrl("http://cdn.example/a.png"), null);
    assert.equal(safeImageUrl("https://user:pass@cdn.example/a.png"), null);
    assert.equal(safeImageUrl("https://cdn.example/a.png"), "https://cdn.example/a.png");
  });

  it("opens Nantty in a new tab for buying and never embeds checkout", () => {
    const html = renderBuyButtonMarkup({ name: "Adire set", price, imageUrl: null, inStock: true, url: "https://zudomart.com/p/adire-set-p1" }, "button");
    assert.ok(html.includes('target="_blank"') && html.includes('rel="noopener noreferrer"'));
    assert.ok(!/<form|<input/.test(html));
    const soldOut = renderProductCollectionMarkup([{ name: "Gone", price, imageUrl: null, inStock: false, url: "https://zudomart.com/p/gone-p2" }], "grid", "Ada", "https://zudomart.com/store/s1");
    assert.ok(soldOut.includes("Sold out") && !soldOut.includes(">Buy<"));
  });

  it("renders a complete document with the theme", () => {
    const html = renderEmbedDocument("Ada", "dark", "<p>x</p>");
    assert.ok(html.startsWith("<!doctype html>") && html.includes("color-scheme:dark"));
  });
});

describe("oEmbed", () => {
  it("accepts only Nantty store and product links", () => {
    assert.deepEqual(readOembedTarget("https://zudomart.com/store/s1", "https://app.zudomart.com"), { kind: "store", id: "s1" });
  assert.deepEqual(readOembedTarget("https://nantty.com/store/s1", "https://web.nantty.com"), { kind: "store", id: "s1" });
    assert.deepEqual(readOembedTarget("https://zudomart.com/p/adire-set-p1", "https://app.zudomart.com"), { kind: "product", id: "p1" });
    assert.equal(readOembedTarget("https://evil.example/store/s1", "https://app.zudomart.com"), null);
    assert.equal(readOembedTarget("https://zudomart.com/settings", "https://app.zudomart.com"), null);
    assert.equal(readOembedTarget("javascript:alert(1)", "https://app.zudomart.com"), null);
  });

  it("returns a sandboxed iframe", () => {
    const html = buildOembedIframeHtml("https://app.zudomart.com/embed/store/s1", 480, 120, "Ada \"Styles\"");
    assert.ok(html.includes('sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"'));
    assert.ok(html.includes("&#34;Styles&#34;"));
  });
});

describe("embed snippets from the builders", async () => {
  const { buildEmbedFrameUrl, buildEmbedSnippet } = await import("@nantty/web-kit/src/embed/embedSnippet");

  it("produce a loader snippet that points at the embed origin and escapes attributes", () => {
    const snippet = buildEmbedSnippet({ origin: "https://app.zudomart.com", kind: "products", storeId: "s\"1", theme: "dark", layout: "carousel", productIds: ["p1", "p2"] });
    assert.ok(snippet.includes('data-store="s&#34;1"'));
    assert.ok(snippet.includes('data-products="p1,p2"'));
    assert.ok(snippet.endsWith('<script async src="https://app.zudomart.com/embed/loader.js"></script>'));
    assert.equal(buildEmbedFrameUrl({ origin: "https://app.zudomart.com", kind: "button", storeId: "s1", productId: "p9", theme: "light" }), "https://app.zudomart.com/embed/product/p9?theme=light&view=button#frame=preview0000");
  });
});
