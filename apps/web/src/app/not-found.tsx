import type { Metadata } from "next";

import styles from "@/components/errors/errorPage.module.css";
import { NotFoundScreen } from "@nantty/web-kit";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function PageNotFound() {
  return <div className={styles.experience}><NotFoundScreen description="The link may be old or have a typo. The shops are this way." /></div>;
}
