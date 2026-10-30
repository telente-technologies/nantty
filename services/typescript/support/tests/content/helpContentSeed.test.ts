import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { helpCategorySeeds } from "../../src/constants/helpCategories.constant.js";
import { readSeedArticles, seedHelpContent } from "../../src/loaders/helpContentSeed.loader.js";
import { findResidualPersonalData } from "../../src/modules/autoFaq/services/personalDataScrubber.service.js";
import { InMemoryHelpContentStore } from "../fakes/inMemoryHelpContentStore.fake.js";

const contentDirectory = fileURLToPath(new URL("../../content/help", import.meta.url));
const silentLogger = { warn: () => undefined, info: () => undefined, error: () => undefined, debug: () => undefined } as never;

describe("seeded help content", async () => {
  const articles = await readSeedArticles(contentDirectory);
  const slugs = new Set(articles.map((article) => article.slug));
  const categorySlugs = new Set(helpCategorySeeds.map((category) => category.slug));

  it("covers every help category with unique slugs", () => {
    expect(slugs.size).toBe(articles.length);
    for (const category of categorySlugs) expect(articles.some((article) => article.categorySlug === category), category).toBe(true);
    for (const article of articles) expect(categorySlugs.has(article.categorySlug), article.slug).toBe(true);
  });

  it("only links to topics and categories that exist", () => {
    for (const article of articles) {
      for (const related of article.related) expect(slugs.has(related), `${article.slug} -> ${related}`).toBe(true);
      for (const match of article.bodyMarkdown.matchAll(/\]\(\/help\/([a-z-]+)(?:\/([a-z0-9-]+))?\)/g)) {
        expect(categorySlugs.has(match[1] ?? ""), `${article.slug} links category ${match[1]}`).toBe(true);
        if (match[2] !== undefined) expect(articles.some((other) => other.categorySlug === match[1] && other.slug === match[2]), `${article.slug} links ${match[1]}/${match[2]}`).toBe(true);
      }
    }
  });

  it("has a summary, no emoji and no personal data in any article", () => {
    for (const article of articles) {
      expect(article.summary.length, article.slug).toBeGreaterThan(20);
      expect(/\p{Extended_Pictographic}/u.test(article.bodyMarkdown + article.title), article.slug).toBe(false);
      expect(findResidualPersonalData(article.bodyMarkdown.replace(/@all\b/g, "all").replace(/[\w.+-]*@(mail\.)?(?:nantty|nantty)\.com\b/g, "our team")).filter((label) => label !== "money"), article.slug).toEqual([]);
    }
  });

  it("seeds once, keeps staff edits and refreshes untouched seed topics", async () => {
    const store = new InMemoryHelpContentStore();
    expect((await seedHelpContent(store, articles, silentLogger)).created).toBe(articles.length);
    expect(await seedHelpContent(store, articles, silentLogger)).toEqual({ created: 0, updated: 0 });
    const [first, second] = articles;
    const edited = await store.findTopicBySeedKey(`${first!.categorySlug}/${first!.slug}`);
    await store.updateTopic(edited!.id, { bodyMarkdown: "Edited by staff with care.", editorName: "Tolu", changeNote: "edit", markEditedByStaff: true });
    const changed = [{ ...first!, hash: "new", bodyMarkdown: "Fresh seed text that is long enough." }, { ...second!, hash: "new2", bodyMarkdown: "Refreshed seed text that is long enough." }];
    expect(await seedHelpContent(store, changed, silentLogger)).toEqual({ created: 0, updated: 1 });
    expect((await store.findTopicById(edited!.id))?.bodyMarkdown).toBe("Edited by staff with care.");
  });

  it("preserves canonical topic identities and staff edits during reseeding", async () => {
    const store = new InMemoryHelpContentStore();
    const article = articles.find((entry) => entry.slug === "what-is-nantty")!;
    const category = await store.createCategory({ ...helpCategorySeeds.find((entry) => entry.slug === article.categorySlug)!, position: 0 });
    const oldTopic = await store.createTopic({ categoryId: category.id, slug: "what-is-nantty", locale: "en", title: "Staff edited title", summary: article.summary, bodyMarkdown: "Staff edited this topic with more detail.", tags: article.tags, status: "published", origin: "seed", sourceTicketId: null, seedKey: "getting-started/what-is-nantty", seedHash: "old", editorName: "Tolu", relatedTopicIds: [] });
    await store.updateTopic(oldTopic.id, { bodyMarkdown: "Staff edited this topic with more detail.", editorName: "Tolu", changeNote: "edit", markEditedByStaff: true });
    expect(await seedHelpContent(store, [article], silentLogger)).toEqual({ created: 0, updated: 0 });
    const moved = await store.findTopicBySlug("what-is-nantty", "en");
    expect(moved).toMatchObject({ id: oldTopic.id, seedKey: "getting-started/what-is-nantty", editedByStaff: true, bodyMarkdown: "Staff edited this topic with more detail.", updatedByName: "Tolu" });
    expect(await store.findTopicBySlug("what-is-nantty", "en")).toMatchObject({ id: oldTopic.id });

    const owed = articles.find((entry) => entry.slug === "owed-to-nantty")!;
    const payments = await store.createCategory({ ...helpCategorySeeds.find((entry) => entry.slug === owed.categorySlug)!, position: 1 });
    const oldOwed = await store.createTopic({ categoryId: payments.id, slug: "owed-to-nantty", locale: "en", title: "Old heading", summary: owed.summary, bodyMarkdown: "Old content that is long enough.", tags: owed.tags, status: "published", origin: "seed", sourceTicketId: null, seedKey: "payments-and-wallet/owed-to-nantty", seedHash: "old", editorName: "Nantty", relatedTopicIds: [] });
    expect(await seedHelpContent(store, [owed], silentLogger)).toEqual({ created: 0, updated: 1 });
    expect(await store.findTopicBySlug("owed-to-nantty", "en")).toMatchObject({ id: oldOwed.id, seedKey: "payments-and-wallet/owed-to-nantty", title: owed.title });
  });
});
