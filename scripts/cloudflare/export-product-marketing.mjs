import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactRoot = path.join(repositoryRoot, "dist/cloudflare/product-marketing");
const products = [
  // Ads screenshots are freshly captured from the current Nantty Ads Manager
  // and are allowlisted individually; other product screenshot directories
  // remain excluded because they may contain legacy branding.
  { id: "ads", app: "apps/ads", host: "ads.nantty.com", publicDirs: ["brand", "screenshots", "storeBadges"] },
  { id: "creator", app: "apps/seller", host: "creator.nantty.com", publicDirs: ["brand", "photos", "storeBadges"] },
  { id: "studio", app: "apps/studio", host: "studio.nantty.com", publicDirs: ["brand", "photos", "storeBadges"] },
];
const routeAllowlist = ["/"];
const deniedPaths = ["/login", "/bff", "/accounts", "/home", "/settings", "/admin"];
const adsScreenshotAllowlist = new Set([
  "billing.webp",
  "campaignsList.webp",
  "overview.webp",
  "reportsPlacement.webp",
  "wizardAudience.webp",
  "wizardObjective.webp",
]);
const suspenseScriptHashes = new Set();

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

async function copyRequired(from, to) {
  await stat(from).catch(() => { throw new Error(`Expected static-export file is missing: ${path.relative(repositoryRoot, from)}`); });
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true, force: true });
}

function outputFile(product, relative) {
  return path.join(repositoryRoot, product.app, "out", relative);
}

function artifactFile(product, relative) {
  return path.join(artifactRoot, product.id, relative);
}

function assertSafeHtml(html, product, { requireLockedControls = true } = {}) {
  for (const pathPart of deniedPaths) {
    const routePattern = new RegExp(`(?:href|src)=["']${pathPart.replaceAll("/", "\\/")}(?:[/?#"'])`, "i");
    if (routePattern.test(html)) throw new Error(`${product.id} static root references excluded route ${pathPart}`);
  }
  if (requireLockedControls && !html.includes('data-prelaunch-locked="true"')) throw new Error(`${product.id} static root is missing visibly locked login controls`);
  if (/\/_next\/image(?:\?|["'])/i.test(html)) throw new Error(`${product.id} static root requires Next's runtime image optimizer`);
  if (/(?:api[_-]?key|client[_-]?secret|private[_-]?key)\s*[:=]/i.test(html)) throw new Error(`${product.id} static root contains a secret-like value`);
  if (!html.includes("Nantty")) throw new Error(`${product.id} static root is missing Nantty branding`);
  if (/<script\b[^>]*\bsrc\s*=|\b(?:src|href)=["'][^"']*\/_next\/static\/chunks\/[^"']+\.m?js(?:[?#][^"']*)?["']/i.test(html)) {
    throw new Error(`${product.id} static root must not ship executable Next.js chunks`);
  }
}

function removeRuntimeScripts(html) {
  let suspenseScript = "";
  const withoutScripts = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_match, attributes, body) => {
    if (/\bdata-nantty-static-theme(?:\s|=|$)/i.test(attributes)) {
      suspenseScriptHashes.add(createHash("sha256").update(body).digest("base64"));
      return _match;
    }
    if (!attributes.trim() && body.includes("$RC(") && body.includes("$RV=function")) suspenseScript = body.trim();
    return "";
  });
  if (!suspenseScript && /<template\s+id="B:0"/.test(html)) throw new Error("Static HTML is missing the bounded server-rendered content reveal script.");
  if (suspenseScript) {
    const hash = createHash("sha256").update(suspenseScript).digest("base64");
    suspenseScriptHashes.add(hash);
  }
  const sanitized = withoutScripts
    .replace(/<link\b(?=[^>]*\bhref=["'][^"']+\.js(?:[?#][^"']*)?["'])[^>]*>/gi, "")
    .replace(/<\/body\s*>/i, suspenseScript ? `<script>${suspenseScript}</script></body>` : "</body>");
  return sanitized;
}

async function assertOnlyRootPage(product) {
  const productRoot = artifactFile(product, "");
  const files = await readdir(productRoot, { recursive: true });
  const htmlFiles = files.filter((entry) => typeof entry === "string" && entry.endsWith(".html"));
  const unexpectedHtml = htmlFiles.filter((entry) => entry !== "index.html" && entry !== "404.html");
  if (unexpectedHtml.length > 0) throw new Error(`${product.id} export contains non-allowlisted HTML routes: ${unexpectedHtml.join(", ")}`);
}

async function copyMarkupAssets(product, html) {
  const appRoot = path.join(repositoryRoot, product.app);
  const assetPrefix = "/_next/static/";
  const pending = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
  const visited = new Set();
  while (pending.length > 0) {
    const reference = pending.pop();
    if (!reference) continue;
    const pathname = new URL(reference, "https://nantty.invalid").pathname;
    if (!pathname.startsWith(assetPrefix) || visited.has(pathname)) continue;
    visited.add(pathname);
    // The prelaunch sites are deliberately document-only. Do not publish Next
    // chunks: shared app/error chunks include authenticated product routes.
    if (/\.(?:m?js)$/i.test(pathname)) continue;
    const source = path.resolve(appRoot, "out", `.${pathname}`);
    const outRoot = path.resolve(appRoot, "out");
    if (!source.startsWith(`${outRoot}${path.sep}`)) throw new Error(`Unsafe Next static asset path: ${pathname}`);
    await copyRequired(source, artifactFile(product, pathname.slice(1)));
    if (/\.css$/i.test(pathname)) {
      const css = await readFile(source, "utf8");
      for (const match of css.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) {
        const assetReference = match[2]?.trim();
        if (!assetReference || assetReference.startsWith("data:") || assetReference.startsWith("http:") || assetReference.startsWith("https:")) continue;
        pending.push(new URL(assetReference, "https://nantty.invalid" + pathname).pathname);
      }
    }
  }
}

async function assertExportTreeHasNoAppEndpoints(product) {
  const productRoot = artifactFile(product, "");
  const entries = await readdir(productRoot, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(?:html|js|css|txt)$/i.test(entry.name)) continue;
    const relative = entry.parentPath ? path.relative(productRoot, entry.parentPath) : "";
    const filePath = path.join(productRoot, relative, entry.name);
    const content = await readFile(filePath, "utf8").catch(() => "");
    if (/\/bff\/|(?:href|src)\s*[:=]\s*["'`]\/(?:login|forgot-password|accounts|home|settings)(?:[/?#"'`]|$)|["'`]\/api\/v1\//i.test(content)) {
      throw new Error(`${product.id} static artifact includes app/session endpoint code: ${path.relative(productRoot, filePath)}`);
    }
  }
}

async function stageProduct(product) {
  const appRoot = path.join(repositoryRoot, product.app);
  const env = {
    ...process.env,
    NANTTY_CLOUDFLARE_PRELAUNCH: "1",
    NEXT_PUBLIC_NANTTY_STATIC_PRELAUNCH: "1",
    NEXT_PUBLIC_SITE_URL: `https://${product.host}`,
  };
  await run("pnpm", ["exec", "next", "build", "--debug-build-paths", "src/app/page.tsx"], { cwd: appRoot, env });

  const manifest = JSON.parse(await readFile(path.join(appRoot, ".next/prerender-manifest.json"), "utf8"));
  if (manifest.routes["/"]?.compute !== "static" || manifest.routes["/"]?.initialRevalidateSeconds !== false) {
    throw new Error(`${product.id} root was not generated as static HTML; refusing to stage it.`);
  }

  const destination = artifactFile(product, "");
  await mkdir(destination, { recursive: true });
  await copyRequired(outputFile(product, "index.html"), artifactFile(product, "index.html"));
  await copyRequired(outputFile(product, "404.html"), artifactFile(product, "404.html"));
  await copyRequired(outputFile(product, "manifest.webmanifest"), artifactFile(product, "manifest.webmanifest"));

  for (const publicDir of product.publicDirs) {
    const source = outputFile(product, publicDir);
    if (publicDir === "screenshots" && product.id === "ads") {
      for (const file of adsScreenshotAllowlist) {
        await copyRequired(path.join(source, file), artifactFile(product, `${publicDir}/${file}`));
      }
      const actual = await readdir(source);
      const unexpected = actual.filter((file) => !adsScreenshotAllowlist.has(file));
      if (unexpected.length) throw new Error(`Ads screenshot directory contains non-allowlisted files: ${unexpected.join(", ")}`);
    } else if (await stat(source).catch(() => null)) {
      await copyRequired(source, artifactFile(product, publicDir));
    }
  }
  const html = removeRuntimeScripts(await readFile(artifactFile(product, "index.html"), "utf8"));
  await writeFile(artifactFile(product, "index.html"), html);
  assertSafeHtml(html, product);
  await copyMarkupAssets(product, html);

  const notFoundPath = artifactFile(product, "404.html");
  const notFoundHtml = removeRuntimeScripts(await readFile(notFoundPath, "utf8"));
  await writeFile(notFoundPath, notFoundHtml);
  assertSafeHtml(notFoundHtml, product, { requireLockedControls: false });
  await assertExportTreeHasNoAppEndpoints(product);
  await assertOnlyRootPage(product);

  const origin = `https://${product.host}`;
  await writeFile(artifactFile(product, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  await writeFile(artifactFile(product, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`);
}

async function main() {
  const expectedRoot = path.join(repositoryRoot, "dist/cloudflare");
  if (!artifactRoot.startsWith(`${expectedRoot}${path.sep}`)) throw new Error("Artifact path escaped dist/cloudflare.");

  // This path is dedicated generated output; source apps and other artifacts are untouched.
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });
  for (const product of products) await stageProduct(product);

  const exportManifest = {
    source: "existing product landing pages",
    routes: Object.fromEntries(products.map((product) => [product.id, routeAllowlist])),
    hosts: Object.fromEntries(products.map((product) => [product.id, product.host])),
    excludedPaths: [...deniedPaths, "/api/*", "/admin/*"],
    excludedApps: ["apps/admin"],
    generatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(artifactRoot, "export-manifest.json"), `${JSON.stringify(exportManifest, null, 2)}\n`);
  const scriptPolicy = [...suspenseScriptHashes].map((hash) => `'sha256-${hash}'`).join(" ");
  await writeFile(path.join(artifactRoot, "_headers"), `/*\n  Content-Security-Policy: default-src 'self'; script-src ${scriptPolicy}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; worker-src 'none'\n  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()\n`);
  console.log(`Staged ${products.length} existing prelaunch product landing pages at ${path.relative(repositoryRoot, artifactRoot)}; no deployment performed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
