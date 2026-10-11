import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

import { buildEmbedLoaderScript } from "./embedLoader.util";
import { embedResizeScript } from "./embedMarkup.util";
import { buildEmbedContentSecurityPolicy, buildEmbedResponseHeaders, EmbedRateLimiter, EmbedResponseCache, hashInlineScriptForCsp, readEmbedResizeHeight } from "./embedSecurity.util";

const origin = "https://app.zudomart.com";

describe("embed response headers", () => {
  it("allow framing anywhere but lock everything else down, with no cookies", () => {
    const headers = buildEmbedResponseHeaders(embedResizeScript, 300);
    const csp = headers["Content-Security-Policy"] ?? "";
    assert.match(csp, /frame-ancestors \*/);
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /connect-src 'none'/);
    assert.match(csp, /form-action 'none'/);
    assert.ok(csp.includes(`script-src ${hashInlineScriptForCsp(embedResizeScript)}`));
    assert.ok(!csp.includes("unsafe-eval") && !/script-src[^;]*unsafe-inline/.test(csp));
    assert.equal(headers["X-Frame-Options"], undefined);
    assert.equal(Object.keys(headers).some((name) => name.toLowerCase() === "set-cookie"), false);
    assert.match(headers["Cache-Control"] ?? "", /^public, max-age=300/);
  });

  it("only the exact resize script is allowed to run", () => {
    assert.notEqual(buildEmbedContentSecurityPolicy(embedResizeScript), buildEmbedContentSecurityPolicy(`${embedResizeScript};alert(1)`));
  });
});

describe("resize messages", () => {
  it("accept only the matching frame from the embed origin or the sandboxed null origin", () => {
    const message = { type: "zudomart:embed:resize", frame: "abc12345", height: 321.4 };
    assert.equal(readEmbedResizeHeight(message, "abc12345", "null", origin), 321);
    assert.equal(readEmbedResizeHeight(message, "abc12345", origin, origin), 321);
    assert.equal(readEmbedResizeHeight(message, "abc12345", "https://evil.example", origin), null);
    assert.equal(readEmbedResizeHeight(message, "other-frame", "null", origin), null);
    assert.equal(readEmbedResizeHeight({ ...message, height: 1e9 }, "abc12345", "null", origin), 2400);
    assert.equal(readEmbedResizeHeight({ ...message, type: "something" }, "abc12345", "null", origin), null);
  });
});

describe("loader script", () => {
  function runLoader() {
    const listeners: ((event: { source: unknown; origin: string; data: unknown }) => void)[] = [];
    const contentWindow = {};
    const iframe = { src: "", style: { cssText: "", height: "" }, attributes: {} as Record<string, string>, contentWindow, setAttribute(name: string, value: string) { this.attributes[name] = value; } };
    const element = { attributes: { "data-type": "products", "data-store": "store-1", "data-theme": "dark" } as Record<string, string>, child: null as unknown,
      getAttribute(name: string) { return this.attributes[name] ?? null; }, setAttribute(name: string, value: string) { this.attributes[name] = value; }, appendChild(node: unknown) { this.child = node; } };
    const sandbox = {
      URLSearchParams, crypto: globalThis.crypto, isFinite, Math, Uint8Array, Array,
      document: { readyState: "complete", querySelectorAll: () => [element], createElement: () => iframe, addEventListener: () => undefined },
      window: { addEventListener: (_type: string, listener: (event: { source: unknown; origin: string; data: unknown }) => void) => listeners.push(listener) },
    };
    runInNewContext(buildEmbedLoaderScript(origin), sandbox);
    const frame = /#frame=([0-9a-f]+)$/.exec(iframe.src)?.[1] ?? "";
    const send = (source: unknown, from: string, data: unknown) => listeners.forEach((listener) => listener({ source, origin: from, data }));
    return { iframe, frame, contentWindow, send };
  }

  it("builds a sandboxed iframe without same-origin access", () => {
    const { iframe } = runLoader();
    assert.ok(iframe.src.startsWith(`${origin}/embed/products/store-1?theme=dark#frame=`));
    assert.equal(iframe.attributes["sandbox"], "allow-scripts allow-popups allow-popups-to-escape-sandbox");
    assert.ok(!iframe.attributes["sandbox"]?.includes("allow-same-origin"));
  });

  it("ignores resize messages from a wrong origin, another window or a guessed frame id", () => {
    const { iframe, frame, contentWindow, send } = runLoader();
    send(contentWindow, "https://evil.example", { type: "zudomart:embed:resize", frame, height: 999 });
    send({}, "null", { type: "zudomart:embed:resize", frame, height: 999 });
    send(contentWindow, "null", { type: "zudomart:embed:resize", frame: "guess", height: 999 });
    assert.equal(iframe.style.height, "");
    send(contentWindow, "null", { type: "zudomart:embed:resize", frame, height: 412 });
    assert.equal(iframe.style.height, "412px");
  });
});

describe("rate limit and cache", () => {
  it("limits each client per minute and resets after the window", () => {
    let now = 0;
    const limiter = new EmbedRateLimiter(2, 10, () => now);
    assert.deepEqual([limiter.allow("a"), limiter.allow("a"), limiter.allow("a"), limiter.allow("b")], [true, true, false, true]);
    now = 61_000;
    assert.equal(limiter.allow("a"), true);
  });

  it("serves cached embeds until they expire", () => {
    let now = 0;
    const cache = new EmbedResponseCache(1_000, 10, () => now);
    cache.write("k", "<html>", 200);
    assert.equal(cache.read("k")?.body, "<html>");
    now = 2_000;
    assert.equal(cache.read("k"), null);
  });
});
