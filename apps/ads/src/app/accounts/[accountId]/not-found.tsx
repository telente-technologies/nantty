import { NotFoundScreen } from "@nantty/web-kit";

import styles from "@/components/errors/errorPage.module.css";

export default function SectionNotFound() {
  return <div className={styles.experience}><NotFoundScreen title="We couldn't find that" description="It may have been deleted, or the link is wrong. Pick up from one of these instead." /></div>;
}
