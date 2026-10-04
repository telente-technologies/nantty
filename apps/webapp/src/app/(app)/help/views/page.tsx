import type { Metadata } from "next";
import Link from "next/link";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "About views",
  description: "How Zudomart counts views on posts and clips, what counts as a view and what stays private.",
  alternates: { canonical: "/help/views" },
};

const sections: readonly { readonly heading: string; readonly paragraphs: readonly string[] }[] = [
  {
    heading: "What a view is",
    paragraphs: ["A view is counted each time a post or clip appears on someone's screen in Zudomart: in a feed, on a profile, in search results, in a list of quotes, or when the post is opened from a link."],
  },
  {
    heading: "What counts as a view",
    paragraphs: [
      "Every appearance counts, including repeat views by the same person and views by people who aren't signed in.",
      "Views from a promotion count too. Watching only part of a video still counts as a view.",
    ],
  },
  {
    heading: "What doesn't count",
    paragraphs: ["The author's own views never count. We also leave out traffic we detect as automated, and views of posts while they are hidden by moderation."],
  },
  {
    heading: "Who sees what",
    paragraphs: ["Everyone sees the total number of views on a post. Only the author can open post analytics, which show impressions by day, unique viewers, profile visits and engagement."],
  },
  {
    heading: "Privacy",
    paragraphs: [
      "Views are counted anonymously. Authors never see who viewed their post, only totals. We don't sell view data.",
      "If you don't want your activity used to personalise your feed, turn off personalisation in Privacy & Data settings.",
    ],
  },
];

export default function AboutViewsHelpPage() {
  return (
    <article className={styles.article} aria-labelledby="about-views-title">
      <p className={styles.topic}>Help centre · Posts &amp; feed</p>
      <h1 id="about-views-title" className={styles.title}>About views</h1>
      <p className={styles.summary}>How views are counted, what counts as a view and what stays private.</p>
      {sections.map((section) => (
        <section key={section.heading} className={styles.section} aria-labelledby={`views-${section.heading}`}>
          <h2 id={`views-${section.heading}`} className={styles.heading}>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className={styles.paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
      <p className={styles.footer}>
        Manage how your activity is used in <Link href="/settings/privacy">Privacy &amp; Data</Link>.
      </p>
    </article>
  );
}
