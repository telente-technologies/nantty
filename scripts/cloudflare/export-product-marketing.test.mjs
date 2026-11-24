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
const expectedAdsScreenshots = [
  "screenshots/billing.webp",
  "screenshots/campaignsList.webp",
  "screenshots/overview.webp",
  "screenshots/reportsPlacement.webp",
  "screenshots/wizardAudience.webp",
  "screenshots/wizardObjective.webp",
];
const expectedCreatorScreenshots = ["screenshots/liveDashboard.webp", "screenshots/liveEscrowStatus.webp"];

function extractScriptElements(html) {
  const lower = html.toLowerCase();
  const scripts = [];
  let cursor = 0;
  while (cursor < lower.length) {
    const open = lower.indexOf("<script", cursor);
    if (open === -1) break;
    const afterName = lower[open + 7];
    if (afterName !== undefined && afterName !== ">" && !/\s/.test(afterName)) {
      cursor = open + 7;
      continue;
    }
    const openEnd = lower.indexOf(">", open + 7);
    if (openEnd === -1) break;
    const closeStart = lower.indexOf("</script", openEnd + 1);
    if (closeStart === -1) break;
    const closeEnd = lower.indexOf(">", closeStart + 8);
    if (closeEnd === -1) break;
    scripts.push([html.slice(open, closeEnd + 1), html.slice(open + 7, openEnd), html.slice(openEnd + 1, closeStart)]);
    cursor = closeEnd + 1;
  }
  return scripts;
}

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
      assert.match(html, /data-theme-switcher="true"/);
      assert.match(html, /data-nantty-static-theme="true"/);
      assert.match(html, /rel="canonical" href="https:\/\/[^"]+\/?"/);
      assert.match(html, /property="og:title"/);
      assert.match(html, /name="twitter:card"/);
      assert.match(html, /name="robots" content="index, follow"/);
      assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=|\/_next\/static\/chunks\/[^"']+\.m?js(?:[?#][^"']*)?["']/i, "prelaunch HTML must not load executable app bundles");
      const scripts = extractScriptElements(html);
      const hasServerSuspense = /<template\s+id="B:0"/.test(html);
      const themeScripts = scripts.filter(([, attributes]) => /\bdata-nantty-static-theme(?:\s|=|$)/i.test(attributes));
      const revealScripts = scripts.filter(([, attributes]) => !/\bdata-nantty-static-theme(?:\s|=|$)/i.test(attributes));
      assert.equal(themeScripts.length, 1, "the minimal theme controller must remain for static light/dark controls");
      assert.equal(revealScripts.length, hasServerSuspense ? 1 : 0, "only the bounded reveal script may remain when streamed HTML needs it");
      if (themeScripts.length) {
        assert.match(themeScripts[0][2], /document\.addEventListener\("change"/);
        assert.match(themeScripts[0][2], /document\.cookie/);
        const hash = createHash("sha256").update(themeScripts[0][2]).digest("base64");
        const headers = await readFile(path.join(artifactRoot, "_headers"), "utf8");
        assert.ok(headers.includes(`'sha256-${hash}'`), "CSP must allow only the exact theme controller");
      }
      if (hasServerSuspense) {
        assert.equal(revealScripts[0][1].trim(), "");
        assert.match(revealScripts[0][2], /\$RC\("B:0","S:0"\)/);
        const hash = createHash("sha256").update(revealScripts[0][2]).digest("base64");
        const headers = await readFile(path.join(artifactRoot, "_headers"), "utf8");
        assert.ok(headers.includes(`'sha256-${hash}'`), "CSP must allow only the exact reveal script");
      }
      assert.doesNotMatch(html, /href="\/(?:login|bff|accounts|home|settings)(?:[/?#"])/i);
      assert.doesNotMatch(html, /\/_next\/image(?:\?|["'])/i);
      const files = await readdir(path.join(artifactRoot, product), { recursive: true });
      assert.ok(files.includes("index.html"));
      assert.ok(files.includes("404.html"));
      for (const page of ["index.html", "404.html"]) {
        const markup = await readFile(path.join(artifactRoot, product, page), "utf8");
        for (const match of markup.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g)) {
          const asset = new URL(match[1], "https://nantty.invalid").pathname.slice(1);
          assert.ok(await stat(path.join(artifactRoot, product, asset)).catch(() => null), `${product}/${page} references missing ${asset}`);
        }
      }
      assert.ok(!files.some((entry) => typeof entry === "string" && (/\.(?:m?js)$/i.test(entry) || (/\.txt$/i.test(entry) && entry !== "robots.txt"))), "the static bundle must not include executable chunks or RSC payloads");
      assert.ok(!files.some((entry) => typeof entry === "string" && /(?:^|\/)(?:login|bff|accounts|home|settings|admin)(?:\/|\.|$)/i.test(entry)));
      for (const cssFile of files.filter((entry) => typeof entry === "string" && entry.endsWith(".css"))) {
        const css = await readFile(path.join(artifactRoot, product, cssFile), "utf8");
        for (const match of css.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) {
          const assetReference = match[2]?.trim();
          if (!assetReference || assetReference.startsWith("data:") || assetReference.startsWith("http:") || assetReference.startsWith("https:")) continue;
          const assetUrl = new URL(assetReference, "https://nantty.invalid/" + product + "/" + cssFile);
          const staticPrefix = "/" + product + "/_next/static/";
          if (!assetUrl.pathname.startsWith(staticPrefix)) continue;
          const assetRelativePath = assetUrl.pathname.slice(("/" + product + "/").length);
          assert.ok(await stat(path.join(artifactRoot, product, assetRelativePath)).catch(() => null), cssFile + " references missing " + assetRelativePath);
        }
      }
      const screenshotFiles = files.filter((entry) => typeof entry === "string" && entry !== "screenshots" && /(?:^|\/)(?:screenshots|screens)(?:\/|$)/i.test(entry));
      if (product === "ads") {
        assert.deepEqual(screenshotFiles.sort(), expectedAdsScreenshots, "only freshly verified Ads Manager screenshots may be uploaded");
      } else if (product === "studio") {
        assert.ok(files.includes("photos/creatorMicPortrait.webp"), "Studio social preview photo should be included");
        assert.deepEqual(screenshotFiles, [], "Studio screenshot directories remain excluded");
      } else {
        assert.deepEqual(screenshotFiles.sort(), expectedCreatorScreenshots, "Dashboard export includes only current, app-captured Nantty screens");
      }
    });
  }
});

test("Ads static page references only the included, current app screenshots", async () => {
  const html = await readFile(path.join(artifactRoot, "ads", "index.html"), "utf8");
  for (const screenshot of expectedAdsScreenshots) {
    assert.ok(html.includes(`src="/${screenshot}"`), `Ads landing page should show ${screenshot}`);
    assert.ok((await stat(path.join(artifactRoot, "ads", screenshot))).isFile(), `${screenshot} must be present in the upload artifact`);
  }
});

test("Studio social-preview image, canonical metadata and sitemap use the Studio host", async () => {
  const html = await readFile(path.join(artifactRoot, "studio", "index.html"), "utf8");
  assert.match(html, /https:\/\/studio\.nantty\.com\//);
  assert.match(html, /creatorMicPortrait\.webp/);
  const sitemap = await readFile(path.join(artifactRoot, "studio", "sitemap.xml"), "utf8");
  assert.match(sitemap, /<loc>https:\/\/studio\.nantty\.com\/<\//);
  const robots = await readFile(path.join(artifactRoot, "studio", "robots.txt"), "utf8");
  assert.match(robots, /Sitemap: https:\/\/studio\.nantty\.com\/sitemap\.xml/);
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
