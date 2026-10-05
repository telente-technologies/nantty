import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import styles from "@/components/help/help.module.css";
import { HelpMarkdown, summariseMarkdown } from "@/components/help/helpMarkdown";
import { HelpVoteButtons } from "@/components/help/helpVoteButtons";
import { fetchHelpTopic } from "@/server/helpCentre.service";
import { buildBreadcrumbJsonLd, serializeJsonLdForScriptTag } from "@/utils/structuredData.util";

interface HelpTopicPageProps {
  readonly params: Promise<{ readonly category: string; readonly slug: string }>;
}

export async function generateMetadata({ params }: HelpTopicPageProps): Promise<Metadata> {
  const topic = await fetchHelpTopic((await params).slug);
  if (!topic) return { title: "Help topic not found", robots: { index: false } };
  const path = `/help/${topic.categorySlug}/${topic.slug}`;
  const description = topic.summary || summariseMarkdown(topic.bodyMarkdown);
  return {
    title: `${topic.title} · Help Centre`,
    description,
    alternates: { canonical: path },
    openGraph: { type: "article", url: path, siteName: "Zudomart", title: topic.title, description, modifiedTime: topic.updatedAt },
    twitter: { card: "summary", title: topic.title, description },
  };
}

export default async function HelpTopicPage({ params }: HelpTopicPageProps) {
  const { category, slug } = await params;
  const topic = await fetchHelpTopic(slug);
  if (!topic) notFound();
  const path = `/help/${topic.categorySlug}/${topic.slug}`;
  if (topic.categorySlug !== category || topic.slug !== slug) permanentRedirect(path);
  const structuredData = [
    { "@context": "https://schema.org", "@type": "Article", headline: topic.title, description: topic.summary, dateModified: topic.updatedAt, ...(topic.publishedAt ? { datePublished: topic.publishedAt } : {}), publisher: { "@type": "Organization", name: "Zudomart" } },
    buildBreadcrumbJsonLd([{ name: "Help Centre", path: "/help" }, { name: topic.categoryTitle, path: `/help/${topic.categorySlug}` }, { name: topic.title, path }]),
  ];
  return (
    <article className={styles.page} aria-labelledby="topic-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLdForScriptTag(structuredData) }} />
      <nav aria-label="Breadcrumb" className={styles.row}>
        <Link href="/help" className={styles.eyebrow}>Help Centre</Link>
        <span className={styles.eyebrow} aria-hidden="true">/</span>
        <Link href={`/help/${topic.categorySlug}`} className={styles.eyebrow}>{topic.categoryTitle}</Link>
      </nav>
      <h1 id="topic-title" className={styles.title}>{topic.title}</h1>
      {topic.fromResolvedQuestion ? <p className={styles.muted}>{topic.sourceLabel}</p> : null}
      <HelpMarkdown markdown={topic.bodyMarkdown} />
      <HelpVoteButtons topicId={topic.id} topicPath={path} helpfulCount={topic.helpfulCount} />
      {topic.related.length > 0 ? (
        <section aria-labelledby="related-heading" className={styles.page}>
          <h2 id="related-heading" className={styles.cardTitle}>Related topics</h2>
          <ul className={styles.list}>
            {topic.related.map((related) => <li key={related.id}><Link href={`/help/${related.categorySlug}/${related.slug}`}>{related.title}</Link></li>)}
          </ul>
        </section>
      ) : null}
      <p className={styles.notice}>Still need help? <Link href="/help/tickets/new">Contact support</Link> and we will reply in My support requests and by email.</p>
    </article>
  );
}
