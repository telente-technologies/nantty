import Link from "next/link";

import { QuotedPostCard } from "@/components/feed/quotedPostCard";
import { QuoteActionIcon } from "@/components/ui/icons";
import type { QuoteThreadItem } from "@/types/postThread.type";

import styles from "./quoteThreadItem.module.css";

export const QUOTED_THIS_POST_LABEL = "Quoted this post";

export function QuoteThreadItemRow({ item }: { readonly item: QuoteThreadItem }) {
  return (
    <article className={styles.item} aria-label={`${item.quotePost.author.name} quoted this post`}>
      <Link href={`/post/${encodeURIComponent(item.id)}`} className={styles.label}>
        <QuoteActionIcon size={14} />
        <span>{QUOTED_THIS_POST_LABEL}</span>
      </Link>
      <QuotedPostCard quoted={item.quotePost} />
    </article>
  );
}
