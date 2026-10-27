import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webRoot = path.join(repositoryRoot, "apps/web");
const nextOutput = path.join(webRoot, "out");
const artifactRoot = path.join(repositoryRoot, "dist/cloudflare/web-marketing");

// Exact existing public-web routes. Product portals (ads, seller, studio and
// admin) are intentionally not included in this static artifact.
const routes = [
  "/",
  "/about",
  "/ads-policy",
  "/community-guidelines",
  "/contact",
  "/cookies",
  "/copyright-policy",
  "/creator-terms",
  "/data-rights",
  "/privacy",
  "/refund-escrow-policy",
  "/seller-terms",
  "/sellers",
  "/terms",
  "/waitlist-privacy",
];
const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nantty.com").origin;

const sourcePages = [
  "src/app/page.tsx",
  ...routes.filter((route) => route !== "/").map((route) => `src/app${route}/page.tsx`),
  "src/app/not-found.tsx",
];

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

function routeFile(route, extension) {
  const routePath = route === "/" ? "index" : route.slice(1);
  return path.join(nextOutput, `${routePath}.${extension}`);
}

function artifactRouteFile(route, extension) {
  const routePath = route === "/" ? "index" : route.slice(1);
  return path.join(artifactRoot, `${routePath}.${extension}`);
}

async function copyRequiredFile(from, to) {
  await stat(from).catch(() => {
    throw new Error(`Expected static-export file is missing: ${path.relative(repositoryRoot, from)}`);
  });
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to);
}

async function assertStaticHtmlIsSafe(filePath, route) {
  const html = await readFile(filePath, "utf8");
  const unsafeReferences = [
    /(?:href|src)=["'](?:\/bff\/|\/login(?:[/?#]|$))/i,
    /\/_next\/image(?:\?|["'])/i,
    /(?:api[_-]?key|client[_-]?secret|private[_-]?key)\s*[:=]/i,
  ];
  for (const pattern of unsafeReferences) {
    if (pattern.test(html)) throw new Error(`Unsafe app endpoint, server image optimizer, or secret-like value in ${route}`);
  }
  if (/nantty/i.test(html)) throw new Error(`Legacy brand is visible in public static HTML on ${route}`);
  if (!html.includes("Nantty")) throw new Error(`Expected Nantty branding was not rendered on ${route}`);
}

async function assertStaticJavaScriptIsSafe(directory) {
  const unsafeReferences = [
    /\/api\//i,
    /\/bff\//i,
    /(?:https?:)?[^\s"'`]*\/login(?:[/?#]|["'`])/i,
    /\/api\/v1\/locale/i,
  ];
  async function visit(currentDirectory) {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      const fullPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const source = await readFile(fullPath, "utf8");
        if (unsafeReferences.some((pattern) => pattern.test(source))) {
          throw new Error(`Unsafe app API, BFF, or login reference in ${path.relative(artifactRoot, fullPath)}`);
        }
      }
    }
  }
  await visit(directory);
}

async function assertInternalLinksResolve(htmlFile, route) {
  const html = await readFile(htmlFile, "utf8");
  const internalPaths = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)]
    .map((match) => match[1].replaceAll("&amp;", "&"))
    .filter((value) => value.startsWith("/") && !value.startsWith("//"));
  for (const value of internalPaths) {
    const pathname = new URL(value, "https://nantty.invalid").pathname;
    if (routes.includes(pathname.replace(/\/$/, "") || "/")) continue;
    const publicAsset = ["/_next/", "/brand/", "/screens/", "/storeBadges/", "/icons/", "/.well-known/"]
      .some((prefix) => pathname.startsWith(prefix));
    if (pathname === "/manifest.webmanifest") continue;
    if (!publicAsset) throw new Error(`Unexpected internal link ${pathname} rendered on ${route}`);
    const assetPath = path.resolve(artifactRoot, `.${pathname}`);
    if (!assetPath.startsWith(`${artifactRoot}${path.sep}`) || !(await stat(assetPath).catch(() => null))) {
      throw new Error(`Referenced static asset is missing: ${pathname} (from ${route})`);
    }
  }
}

async function copyDirectoryContents(from, to) {
  await mkdir(to, { recursive: true });
  await cp(from, to, { recursive: true, force: true });
}

async function main() {
  const debugBuildPaths = sourcePages.join(",");
  await run("pnpm", ["exec", "next", "build", "--debug-build-paths", debugBuildPaths], {
    cwd: webRoot,
    env: {
      ...process.env,
      NANTTY_CLOUDFLARE_STATIC_EXPORT: "1",
      NEXT_PUBLIC_WAITLIST_ENABLED: "false",
      NEXT_PUBLIC_WAITLIST_APPS_SCRIPT_URL: "",
    },
  });

  const manifest = JSON.parse(await readFile(path.join(webRoot, ".next/prerender-manifest.json"), "utf8"));
  for (const route of routes) {
    if (!manifest.routes[route] || manifest.routes[route].compute !== "static") {
      throw new Error(`Route ${route} was not generated as static HTML; refusing to stage it.`);
    }
  }

  // Only clean this script's dedicated generated artifact directory.
  const expectedPrefix = path.join(repositoryRoot, "dist/cloudflare");
  if (!artifactRoot.startsWith(`${expectedPrefix}${path.sep}`)) throw new Error("Artifact path escaped dist/cloudflare.");
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });

  for (const route of routes) {
    const htmlSource = routeFile(route, "html");
    const htmlTarget = artifactRouteFile(route, "html");
    await copyRequiredFile(htmlSource, htmlTarget);
    await assertStaticHtmlIsSafe(htmlTarget, route);

    // Next's static payload backs client-side navigation between exported routes.
    await copyRequiredFile(routeFile(route, "txt"), artifactRouteFile(route, "txt"));
    if (route !== "/") {
      const routeSegments = path.join(nextOutput, route.slice(1));
      await copyDirectoryContents(routeSegments, path.join(artifactRoot, route.slice(1))).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
    }
  }

  // Next emits shared root-layout RSC segments alongside the home route.
  for (const entry of await readdir(nextOutput, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith("__next") && entry.name.endsWith(".txt")) {
      await copyRequiredFile(path.join(nextOutput, entry.name), path.join(artifactRoot, entry.name));
    }
  }

  await copyRequiredFile(path.join(nextOutput, "404.html"), path.join(artifactRoot, "404.html"));
  await copyDirectoryContents(path.join(nextOutput, "_next"), path.join(artifactRoot, "_next"));
  await assertStaticJavaScriptIsSafe(path.join(artifactRoot, "_next"));

  // Public assets are copied as files (not app/server output); this preserves the
  // existing Nantty icon, screenshots and store badges exactly as authored.
  for (const name of ["brand", "screens", "storeBadges", "icons", "manifest.webmanifest", ".well-known"]) {
    const source = path.join(nextOutput, name);
    const sourceInfo = await stat(source).catch(() => null);
    if (sourceInfo?.isDirectory()) await copyDirectoryContents(source, path.join(artifactRoot, name));
    else if (sourceInfo?.isFile()) await copyRequiredFile(source, path.join(artifactRoot, name));
  }
  for (const route of routes) await assertInternalLinksResolve(artifactRouteFile(route, "html"), route);

  await writeFile(
    path.join(artifactRoot, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\nHost: ${siteUrl}\n`,
  );
  const sitemapRoutes = routes.filter((route) => route !== "/waitlist-privacy");
  const lastModified = new Date().toISOString();
  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapRoutes.map((route) => `  <url><loc>${siteUrl}${route === "/" ? "/" : route}</loc><lastmod>${lastModified}</lastmod></url>`),
    "</urlset>",
    "",
  ].join("\n");
  await writeFile(path.join(artifactRoot, "sitemap.xml"), sitemapXml);

  await writeFile(
    path.join(artifactRoot, "_headers"),
    `/*\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; worker-src 'self' blob:\n  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n`,
  );

  await writeFile(
    path.join(artifactRoot, "export-manifest.json"),
    `${JSON.stringify({ source: "apps/web", routes, excludedApps: ["apps/ads", "apps/seller", "apps/studio", "apps/admin"], generatedAt: new Date().toISOString() }, null, 2)}\n`,
  );

  console.log(`Staged ${routes.length} existing public Nantty routes at ${path.relative(repositoryRoot, artifactRoot)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
