import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactRoot = path.join(repositoryRoot, "dist/cloudflare/product-marketing");
const expected = {
  ads: "ads.nantty.com",
  creator: "creator.nantty.com",
  studio: "studio.nantty.com",
};

test("product marketing artifact contains only the approved root routes and excludes app/API paths", async (context) => {
  const manifest = JSON.parse(await readFile(path.join(artifactRoot, "export-manifest.json"), "utf8"));
  assert.deepEqual(manifest.routes, { ads: ["/"], creator: ["/"], studio: ["/"] });
  assert.deepEqual(manifest.hosts, expected);
  assert.ok(manifest.excludedApps.includes("apps/admin"));

  for (const product of Object.keys(expected)) {
    await context.test(`${product} static HTML has a locked, inert sign-in control`, async () => {
      const html = await readFile(path.join(artifactRoot, product, "index.html"), "utf8");
      assert.match(html, /data-prelaunch-locked="true"/);
      assert.match(html, /disabled/);
      assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=|\/_next\/static\/chunks\/[^"']+\.m?js(?:[?#][^"']*)?["']/i, "prelaunch HTML must not load executable app bundles");
      const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
      const hasServerSuspense = /<template\s+id="B:0"/.test(html);
      assert.equal(scripts.length, hasServerSuspense ? 1 : 0, "only the bounded reveal script may remain when streamed HTML needs it");
      if (hasServerSuspense) {
        assert.equal(scripts[0][1].trim(), "");
        assert.match(scripts[0][2], /\$RC\("B:0","S:0"\)/);
        const hash = createHash("sha256").update(scripts[0][2]).digest("base64");
        const headers = await readFile(path.join(artifactRoot, "_headers"), "utf8");
        assert.ok(headers.includes(`'sha256-${hash}'`), "CSP must allow only the exact reveal script");
      }
      assert.doesNotMatch(html, /href="\/(?:login|bff|accounts|home|settings)(?:[/?#"])/i);
      assert.doesNotMatch(html, /\/_next\/image(?:\?|["'])/i);
      const files = await readdir(path.join(artifactRoot, product), { recursive: true });
      assert.ok(files.includes("index.html"));
      assert.ok(files.includes("404.html"));
      assert.ok(!files.some((entry) => typeof entry === "string" && (/\.(?:m?js)$/i.test(entry) || (/\.txt$/i.test(entry) && entry !== "robots.txt"))), "the static bundle must not include executable chunks or RSC payloads");
      assert.ok(!files.some((entry) => typeof entry === "string" && /(?:^|\/)(?:login|bff|accounts|home|settings|admin)(?:\/|\.|$)/i.test(entry)));
      assert.ok(!files.some((entry) => typeof entry === "string" && /(?:^|\/)(?:screenshots|screens)(?:\/|$)/i.test(entry)), "legacy-branded screenshot assets must not be uploaded with the prelaunch pages");
    });
  }
});

test("static roots serve without exposing a login route", async (context) => {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const product = pathname.split("/").filter(Boolean)[0];
    const relative = pathname.split("/").slice(2).join("/");
    if (!Object.hasOwn(expected, product)) {
      response.writeHead(404).end();
      return;
    }
    const candidate = path.join(artifactRoot, product, relative || "index.html");
    const info = await stat(candidate).catch(() => null);
    if (!info?.isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": candidate.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
    response.end(await readFile(candidate));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;

  for (const product of Object.keys(expected)) {
    const home = await fetch(`${origin}/${product}/`);
    assert.equal(home.status, 200, `${product} root response`);
    const login = await fetch(`${origin}/${product}/login`);
    assert.equal(login.status, 404, `${product} login route must not be exported`);
    const bff = await fetch(`${origin}/${product}/bff/session`);
    assert.equal(bff.status, 404, `${product} BFF path must not be exported`);
  }
});
