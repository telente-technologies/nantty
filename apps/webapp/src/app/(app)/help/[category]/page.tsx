import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/help/help.module.css";
import { HelpSearchForm } from "@/components/help/helpSearchForm";
import { fetchHelpCategory } from "@/server/helpCentre.service";
import { buildBreadcrumbJsonLd, serializeJsonLdForScriptTag } from "@/utils/structuredData.util";

interface HelpCategoryPageProps {
  readonly params: Promise<{ readonly category: string }>;
}

export async function generateMetadata({ params }: HelpCategoryPageProps): Promise<Metadata> {
  const found = await fetchHelpCategory((await params).category);
  if (!found) return { title: "Help topic not found", robots: { index: false } };
  const path = `/help/${found.category.slug}`;
  return { title: `${found.category.title} · Help Centre`, description: found.category.description, alternates: { canonical: path }, openGraph: { type: "website", url: path, siteName: "Nantty", title: found.category.title, description: found.category.description } };
}

export default async function HelpCategoryPage({ params }: HelpCategoryPageProps) {
  const found = await fetchHelpCategory((await params).category);
  if (!found) notFound();
  const { category, topics } = found;
  const breadcrumbs = buildBreadcrumbJsonLd([{ name: "Help Centre", path: "/help" }, { name: category.title, path: `/help/${category.slug}` }]);
  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLdForScriptTag([breadcrumbs]) }} />
      <nav aria-label="Breadcrumb"><Link href="/help" className={styles.eyebrow}>Help Centre</Link></nav>
      <h1 className={styles.title}>{category.title}</h1>
      <p className={styles.lead}>{category.description}</p>
      <HelpSearchForm />
      <ul className={styles.list}>
        {topics.map((topic) => (
          <li key={topic.id}>
            <Link href={`/help/${category.slug}/${topic.slug}`} className={styles.card}>
              <span className={styles.cardTitle}>{topic.title}</span>
              <span className={styles.muted}>{topic.summary}</span>
              {topic.fromResolvedQuestion ? <span className={styles.muted}>{topic.sourceLabel}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      {topics.length === 0 ? <p className={styles.muted}>No topics here yet.</p> : null}
    </div>
  );
}
