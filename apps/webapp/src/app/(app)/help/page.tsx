import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/help/help.module.css";
import { HelpSearchForm } from "@/components/help/helpSearchForm";
import { fetchHelpCategories, searchHelpTopics } from "@/server/helpCentre.service";

interface HelpHomeProps {
  readonly searchParams: Promise<{ readonly q?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "Help Centre",
  description: "Answers about every part of Nantty: accounts, posts, chat, live, creators, selling, buying, payments, safety and your data.",
  alternates: { canonical: "/help" },
  openGraph: { type: "website", url: "/help", siteName: "Nantty", title: "Nantty Help Centre", description: "Answers about every part of Nantty." },
};

export default async function HelpHomePage({ searchParams }: HelpHomeProps) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const [categories, results] = await Promise.all([fetchHelpCategories(), searchHelpTopics(query)]);
  return (
    <div className={`${styles.page} ${styles.wide}`}>
      <p className={styles.eyebrow}>Help Centre</p>
      <h1 className={styles.title}>How can we help?</h1>
      <HelpSearchForm defaultQuery={query} />
      <div className={styles.row}>
        <Link href="/help/tickets/new" className={styles.button}>Contact support</Link>
        <Link href="/help/tickets" className={styles.secondaryButton}>My support requests</Link>
      </div>
      {query ? (
        <section aria-labelledby="results-heading" className={styles.page}>
          <h2 id="results-heading" className={styles.cardTitle}>{results.length > 0 ? `Results for "${query}"` : `No topics match "${query}"`}</h2>
          {results.length === 0 ? <p className={styles.muted}>Try other words, browse the topics below, or contact support.</p> : null}
          <ul className={styles.list}>
            {results.map((topic) => (
              <li key={topic.id}>
                <Link href={`/help/${topic.categorySlug}/${topic.slug}`} className={styles.card}>
                  <span className={styles.eyebrow}>{topic.categoryTitle}</span>
                  <span className={styles.cardTitle}>{topic.title}</span>
                  <span className={styles.muted}>{topic.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="browse-heading" className={styles.page}>
        <h2 id="browse-heading" className={styles.cardTitle}>Browse topics</h2>
        <ul className={styles.grid}>
          {categories.map((category) => (
            <li key={category.id}>
              <Link href={`/help/${category.slug}`} className={styles.card}>
                <span className={styles.cardTitle}>{category.title}</span>
                <span className={styles.muted}>{category.description}</span>
                <span className={styles.muted}>{category.topicCount} {category.topicCount === 1 ? "topic" : "topics"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
