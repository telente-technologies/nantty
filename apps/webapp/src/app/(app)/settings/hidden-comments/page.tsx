import type { Metadata } from "next";
import Link from "next/link";

import { HiddenCommentsList } from "@/components/settings/hiddenCommentsList";
import styles from "@/components/settings/settings.module.css";
import { IconLabel } from "@/components/ui/appIcon";

export const metadata: Metadata = { title: "Hidden comments" };

export default function HiddenCommentsPage() {
  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>Hidden comments</h1>
      </div>
      <HiddenCommentsList />
    </div>
  );
}
