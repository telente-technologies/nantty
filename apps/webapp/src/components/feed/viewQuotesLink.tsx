import Link from "next/link";

import type { Post } from "@/types";
import { formatCompactCount } from "@/utils/formatDate.util";

import styles from "./postCard.module.css";

export function ViewQuotesLink({ post }: { readonly post: Post }) {
  const quotes = post.quotes ?? 0;
  if (quotes <= 0) return null;
  return (
    <Link href={`/post/${post.id}/quotes`} className={styles.viewQuotes}>
      View quotes ({formatCompactCount(quotes)})
    </Link>
  );
}
