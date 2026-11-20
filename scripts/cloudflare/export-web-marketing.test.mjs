import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactRoot = path.join(repositoryRoot, "dist/cloudflare/web-marketing");
let server;
let origin;

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function artifactPathForRequest(requestPath) {
  const pathname = decodeURIComponent(new URL(requestPath, "http://localhost").pathname);
  const safePath = path.resolve(artifactRoot, `.${pathname}`);
  if (safePath !== artifactRoot && !safePath.startsWith(`${artifactRoot}${path.sep}`)) return null;
  return safePath;
}

describe("static web marketing artifact", () => {
  before(async () => {
    assert.ok(await stat(artifactRoot).catch(() => null), "run scripts/cloudflare/export-web-marketing.mjs before this test");
    server = http.createServer(async (request, response) => {
      const requestedPath = artifactPathForRequest(request.url ?? "/");
      let target = requestedPath;
      if (target && (await stat(target).catch(() => null))?.isDirectory()) target = path.join(target, "index.html");
      if (target && !(await stat(target).catch(() => null))?.isFile()) {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        const routeHtml = path.join(artifactRoot, `${pathname.replace(/^\/+|\/+$/g, "") || "index"}.html`);
        if ((await stat(routeHtml).catch(() => null))?.isFile()) target = routeHtml;
      }
      if (!target || !(await stat(target).catch(() => null))?.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, { "content-type": target.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
      createReadStream(target).pipe(response);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("serves every allowlisted page and returns 404 for app/session/auth endpoints", async () => {
    const manifest = JSON.parse(await readFile(path.join(artifactRoot, "export-manifest.json"), "utf8"));
    assert.equal(manifest.source, "apps/web");
    assert.equal(manifest.routes.length, 16);
    for (const route of manifest.routes) {
      const response = await fetch(`${origin}${route}`);
      assert.equal(response.status, 200, `${route} should be served from the static artifact`);
      assert.match(response.headers.get("content-type") ?? "", /text\/html/);
      const html = await response.text();
      assert.match(html, /Nantty/);
      assert.doesNotMatch(html, new RegExp(["zu", "do", "mart"].join(""), "i"), `${route} must not expose the legacy brand in rendered content`);
    }
    for (const deniedPath of ["/api/v1/locale", "/bff/session", "/login"]) {
      assert.equal((await fetch(`${origin}${deniedPath}`)).status, 404, `${deniedPath} must not be an exported route`);
    }
  });

  it("contains no app API/BFF calls or login destinations in HTML or JavaScript", async () => {
    const files = await collectFiles(artifactRoot);
    const textFiles = files.filter((file) => file.endsWith(".html") || file.endsWith(".js"));
    const unsafe = [
      /\/api\//i,
      /\/bff\//i,
      /(?:https?:)?[^\s"'`]*\/login(?:[/?#]|["'`])/i,
    ];
    for (const file of textFiles) {
      const contents = await readFile(file, "utf8");
      assert.equal(unsafe.some((pattern) => pattern.test(contents)), false, `${path.relative(artifactRoot, file)} contains an app endpoint/login reference`);
      assert.equal(contents.includes("SHOULD_NOT_BE_INCLUDED"), false, `${path.relative(artifactRoot, file)} contains a configured waitlist endpoint`);
    }
  });

  it("publishes square Nantty favicons and consistent site-name structured data", async () => {
    const response = await fetch(origin);
    const html = await response.text();
    assert.match(html, /<link rel="icon" href="\/brand\/favicon\.ico" type="image\/x-icon" sizes="48x48"/);
    assert.match(html, /<link rel="icon" href="\/brand\/icon192\.png" type="image\/png" sizes="192x192"/);
    assert.match(html, /<link rel="icon" href="\/brand\/icon512\.png" type="image\/png" sizes="512x512"/);
    assert.match(html, /"@type":"WebSite","name":"Nantty","alternateName":"nantty\.com","url":"https:\/\/nantty\.com"/);
    for (const iconPath of ["/brand/favicon.ico", "/brand/icon192.png", "/brand/icon512.png"]) {
      assert.equal((await fetch(`${origin}${iconPath}`)).status, 200, `${iconPath} should be available to crawlers`);
    }
  });

  it("preserves both countdown targets, the inline status, and disabled waitlist UX", async () => {
    const response = await fetch(origin);
    const html = await response.text();
    assert.match(html, /data-countdown-target="2027-01-15T09:00:00\+01:00"/);
    assert.match(html, /data-countdown-label="early beta"/);
    assert.match(html, /data-countdown-target="2027-03-01T09:00:00\+01:00"/);
    assert.match(html, /data-countdown-label="public launch"/);
    assert.match(html, /Preparing countdown/);
    assert.match(html, /Join the waitlist/);
    const manifest = JSON.parse(await readFile(path.join(artifactRoot, "export-manifest.json"), "utf8"));
    if (manifest.waitlistEnabled) {
      assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Join the waitlist/);
      const scripts = (await collectFiles(artifactRoot)).filter((file) => file.endsWith(".js"));
      const scriptText = await Promise.all(scripts.map((file) => readFile(file, "utf8")));
      assert.ok(
        scriptText.some((contents) => /(?:^|["'`\s])https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+/.test(contents)),
        "enabled export includes the public Apps Script endpoint",
      );
    } else {
      assert.match(html, /<button[^>]*disabled=""[^>]*>Join the waitlist/);
      assert.match(html, /preparing the waitlist|check back soon/i);
    }
    assert.match(html, /waitlist-privacy/);
  });

  it("serves the dedicated waitlist explainer with the launch timeline and product details", async () => {
    const response = await fetch(`${origin}/waitlist`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /A social marketplace built around[\s\S]{0,80}people you trust/i);
    assert.match(html, /posts, clips and stories/i);
    assert.match(html, /licensed payment partner/i);
    assert.match(html, /funds in the buyer.{0,8} own account with the licensed payment partner.{0,20}not with Nantty/i);
    assert.match(html, /data-countdown-label="early beta"/);
    assert.match(html, /data-countdown-label="public launch"/);
    const manifest = JSON.parse(await readFile(path.join(artifactRoot, "export-manifest.json"), "utf8"));
    assert.equal(/<button[^>]*disabled=""[^>]*>Join the waitlist/.test(html), !manifest.waitlistEnabled);
    assert.match(html, /waitlist-privacy/);
  });

  it("keeps prelaunch actions on the waitlist instead of linking to unavailable apps", async () => {
    const response = await fetch(origin);
    const html = await response.text();
    assert.match(html, /<a[^>]*href="\/waitlist"[^>]*>[\s\S]*?Join the waitlist/i);
    assert.doesNotMatch(html, /<a[^>]*href="https:\/\/web\.nantty\.com"[^>]*>/i);
    assert.doesNotMatch(html, /Live now: shop while you watch/i);
    assert.match(html, /still in development/i);
  });
});
