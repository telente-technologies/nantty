import { buildAbsoluteSiteUrl, buildProductPath, buildProfilePath, buildStorePath } from "@/utils/seoPaths.util";

import { fetchSitemapPage, type SitemapEntry, type SitemapKind } from "./publicContent.service";

export const sitemapKinds: readonly SitemapKind[] = ["products", "stores", "profiles"];
export const staticSitemapPaths: readonly string[] = ["/", "/explore", "/mart", "/clips", "/live"];

const xmlHeaders = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" };

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function buildEntryPath(kind: SitemapKind, entry: SitemapEntry): string {
  if (kind === "products") return buildProductPath({ id: entry.id, name: entry.name });
  if (kind === "stores") return buildStorePath(entry.id);
  return buildProfilePath(entry.name);
}

export function respondWithXml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, { headers: xmlHeaders });
}

export async function buildSitemapIndexXml(): Promise<string> {
  const files = ["static"];
  for (const kind of sitemapKinds) {
    const firstPage = await fetchSitemapPage(kind, 0);
    for (let page = 0; page < Math.max(firstPage.totalPages, 0); page += 1) files.push(`${kind}-${page}`);
  }
  const items = files.map((file) => `  <sitemap><loc>${escapeXml(buildAbsoluteSiteUrl(`/sitemaps/${file}.xml`))}</loc></sitemap>`).join("\n");
  return `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>`;
}

function buildUrlElement(path: string, lastModified: string | null, priority: string): string {
  const location = escapeXml(buildAbsoluteSiteUrl(path));
  const alternates = `<xhtml:link rel="alternate" hreflang="en-NG" href="${location}"/><xhtml:link rel="alternate" hreflang="x-default" href="${location}"/>`;
  return `  <url><loc>${location}</loc>${lastModified ? `<lastmod>${escapeXml(lastModified)}</lastmod>` : ""}<priority>${priority}</priority>${alternates}</url>`;
}

export async function buildSitemapFileXml(file: string): Promise<string | null> {
  const urlsetOpen = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`;
  if (file === "static") return `${urlsetOpen}\n${staticSitemapPaths.map((path) => buildUrlElement(path, null, "0.8")).join("\n")}\n</urlset>`;
  const match = file.match(/^(products|stores|profiles)-(\d{1,5})$/);
  if (!match) return null;
  const kind = match[1] as SitemapKind;
  const page = await fetchSitemapPage(kind, Number(match[2]));
  if (page.entries.length === 0) return null;
  const priority = kind === "products" ? "0.9" : kind === "stores" ? "0.7" : "0.5";
  return `${urlsetOpen}\n${page.entries.map((entry) => buildUrlElement(buildEntryPath(kind, entry), entry.updatedAt, priority)).join("\n")}\n</urlset>`;
}
