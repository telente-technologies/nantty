"use client";

import Link from "next/link";

import { Dialog } from "@/components/ui/dialog";
import { ViewsActionIcon } from "@/components/ui/icons";

import styles from "./postActions.module.css";

export const VIEWS_EXPLAINER_TEXT =
  "Times this post was seen. A view counts each time it appears on someone else's screen, including repeat views. The author's own views don't count.";
export const VIEWS_HELP_PATH = "/help/posts-and-feed/views-and-analytics";

export function ViewsExplainerDialog({ isOpen, onClose }: { readonly isOpen: boolean; readonly onClose: () => void }) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Views"
      description={VIEWS_EXPLAINER_TEXT}
      layout="sheet"
      size="small"
      icon={<ViewsActionIcon size={22} />}
      actions={[{ label: "Close", variant: "secondary", onClick: onClose, isInitialFocus: true }]}
    >
      <Link href={VIEWS_HELP_PATH} className={styles.learnMore} onClick={onClose}>
        Learn more about views
      </Link>
    </Dialog>
  );
}
