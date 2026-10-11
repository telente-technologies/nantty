import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readSeedArticles } from "../../src/loaders/helpContentSeed.loader.js";

const contentDirectory = fileURLToPath(new URL("../../content/help", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const appSourceDirectories = ["apps/mobile/src", "apps/webapp/src", "apps/web/src", "apps/dashboard/src"].map((path) => join(repositoryRoot, path));

const appLinkedTopics: readonly (readonly [string, string])[] = [
  ["posts-and-feed", "views-and-analytics"],
  ["safety-and-reporting", "copyright-and-account-status"],
  ["live", "live-safety"],
  ["account-and-login", "security-checks"],
  ["contact-support", "contact-support"],
  ["legal-and-data", "download-your-data"],
  ["creators-and-earnings", "creator-earnings"],
  ["buying-and-orders", "disputes-and-refunds"],
  ["buying-and-orders", "how-escrow-protects-your-order"],
];

async function listSourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listSourceFiles(path)));
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) && !path.includes("__tests__") && !path.includes("/mocks/")) files.push(path);
  }
  return files;
}

async function findAppHelpReferences(): Promise<{ readonly paths: Set<string>; readonly slugs: Set<string> }> {
  const paths = new Set<string>();
  const slugs = new Set<string>();
  for (const directory of appSourceDirectories.filter((path) => existsSync(path))) {
    for (const file of await listSourceFiles(directory)) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/["'`]\/help\/([a-z-]+)\/([a-z0-9-]+)["'`]/g)) if (match[1] !== "tickets") paths.add(`${match[1]}/${match[2]}`);
      for (const match of source.matchAll(/(?:topicSlug:\s*|HELP_TOPIC_SLUG\s*=\s*)["']([a-z0-9-]+)["']/g)) slugs.add(match[1] ?? "");
    }
  }
  return { paths, slugs };
}

describe("help content links", async () => {
  const articles = await readSeedArticles(contentDirectory);
  const keys = new Set(articles.map((article) => `${article.categorySlug}/${article.slug}`));
  const slugs = new Set(articles.map((article) => article.slug));

  it("keeps every topic the apps link to under the same category", () => {
    for (const [category, slug] of appLinkedTopics) expect(keys.has(`${category}/${slug}`), `${category}/${slug}`).toBe(true);
  });

  it("resolves every help link and topic slug found in the app sources", async () => {
    const references = await findAppHelpReferences();
    for (const path of references.paths) expect(keys.has(path), `app links /help/${path}`).toBe(true);
    for (const slug of references.slugs) expect(slugs.has(slug), `app opens topic ${slug}`).toBe(true);
  });

  it("gives every article tags and related topics, and never relates an article to itself", () => {
    for (const article of articles) {
      expect(article.tags.length, article.slug).toBeGreaterThan(0);
      expect(article.related.length, article.slug).toBeGreaterThan(0);
      expect(article.related.includes(article.slug), article.slug).toBe(false);
    }
  });

  it("never names the payment provider or describes retired features", () => {
    for (const article of articles) {
      const text = `${article.title}\n${article.summary}\n${article.bodyMarkdown}`;
      expect(/flutterwave|waitlist|wait-list/i.test(text), article.slug).toBe(false);
      expect(/sign in with (?:your )?phone|phone (?:number )?(?:login|sign-in)|sms code/i.test(text), article.slug).toBe(false);
    }
  });
});
