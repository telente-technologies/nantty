import type { AffiliateCreator } from "@/types/affiliate.type";
import { formatFollowerCountCompact } from "@/utils/affiliateFormatting.util";

import styles from "./affiliateCreatorIdentity.module.css";

export function AffiliateCreatorIdentity({ creator, showNiche = true }: { readonly creator: AffiliateCreator; readonly showNiche?: boolean }) {
  return (
    <span className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">
        {creator.name.slice(0, 1).toUpperCase()}
      </span>
      <span className={styles.text}>
        <span className={styles.username}>@{creator.username}</span>
        <span className={styles.meta}>
          {creator.name} · {formatFollowerCountCompact(creator.followers)} followers{showNiche ? ` · ${creator.niche}` : ""}
        </span>
      </span>
    </span>
  );
}
