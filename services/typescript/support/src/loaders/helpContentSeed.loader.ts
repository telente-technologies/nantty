import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Logger } from "@zudojs/logger";

import { helpCategorySeeds } from "../constants/helpCategories.constant.js";
import { defaultLocale } from "../constants/support.constant.js";
import type { HelpContentStore } from "../interfaces/helpContentStore.interface.js";
import { parseFrontMatter, splitList } from "../utils/markdownFrontMatter.util.js";

export interface SeedArticle {
  readonly categorySlug: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly related: readonly string[];
  readonly bodyMarkdown: string;
  readonly hash: string;
}

export async function readSeedArticles(contentDirectory: string): Promise<SeedArticle[]> {
  const articles: SeedArticle[] = [];
  for (const categorySlug of (await readdir(contentDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    for (const file of (await readdir(join(contentDirectory, categorySlug))).filter((name) => name.endsWith(".md")).sort()) {
      const source = await readFile(join(contentDirectory, categorySlug, file), "utf8");
      const { attributes, body } = parseFrontMatter(source);
      if (!attributes["title"] || body.length < 20) throw new Error(`help article ${categorySlug}/${file} needs a title and a body`);
      articles.push({
        categorySlug, slug: file.replace(/\.md$/, ""), title: attributes["title"], summary: attributes["summary"] ?? "", tags: splitList(attributes["tags"]), related: splitList(attributes["related"]),
        bodyMarkdown: body, hash: createHash("sha256").update(source).digest("hex"),
      });
    }
  }
  return articles;
}

export async function seedHelpContent(store: HelpContentStore, articles: readonly SeedArticle[], logger: Logger): Promise<{ readonly created: number; readonly updated: number }> {
  const categoryIds = new Map((await store.listCategories()).map((category) => [category.slug, category.id]));
  for (const [position, seed] of helpCategorySeeds.entries()) {
    if (!categoryIds.has(seed.slug)) categoryIds.set(seed.slug, (await store.createCategory({ ...seed, position })).id);
  }
  let created = 0;
  let updated = 0;
  const touched = new Map<string, readonly string[]>();
  for (const article of articles) {
    const categoryId = categoryIds.get(article.categorySlug);
    if (categoryId === undefined) {
      logger.warn("help article skipped: unknown category", { category: article.categorySlug, slug: article.slug });
      continue;
    }
    const seedKey = `${article.categorySlug}/${article.slug}`;
    const existing = await store.findTopicBySeedKey(seedKey);
    if (existing === null) {
      if ((await store.findTopicBySlug(article.slug, defaultLocale)) !== null) continue;
      const topic = await store.createTopic({
        categoryId, slug: article.slug, locale: defaultLocale, title: article.title, summary: article.summary, bodyMarkdown: article.bodyMarkdown, tags: article.tags,
        status: "published", origin: "seed", sourceTicketId: null, seedKey, seedHash: article.hash, editorName: "Zudomart", relatedTopicIds: [],
      });
      touched.set(topic.id, article.related);
      created += 1;
    } else if (!existing.editedByStaff && existing.seedHash !== article.hash) {
      await store.updateTopic(existing.id, { categoryId, title: article.title, summary: article.summary, bodyMarkdown: article.bodyMarkdown, tags: article.tags, editorName: "Zudomart", changeNote: "Content refresh", markEditedByStaff: false, seedHash: article.hash });
      touched.set(existing.id, article.related);
      updated += 1;
    }
  }
  for (const [topicId, relatedSlugs] of touched) {
    const relatedTopicIds = (await Promise.all(relatedSlugs.map((slug) => store.findTopicBySlug(slug, defaultLocale)))).flatMap((topic) => (topic === null ? [] : [topic.id]));
    if (relatedTopicIds.length > 0) await store.updateTopic(topicId, { relatedTopicIds, editorName: "Zudomart", changeNote: "Related topics", markEditedByStaff: false });
  }
  return { created, updated };
}
