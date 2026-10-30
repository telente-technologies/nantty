import { NotFoundScreen } from "@nantty/web-kit";

import styles from "@/components/errors/errorPage.module.css";

export default function InviteNotFound() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.experience}>
      <NotFoundScreen kind="inviteInvalid" />
    </main>
  );
}
