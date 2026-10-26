import { NanttyWordmark } from "@nantty/web-kit";
import Link from "next/link";
import type { ReactNode } from "react";

import { CookiesRequiredNotice } from "@/components/errors/browserSupportNotice";
import { AppIcon } from "@/components/ui/appIcon";
import { PhoneFrameWithAppScreen } from "@/components/ui/phoneFrame";

import styles from "./authLayout.module.css";

const escrowPromises = [
  { icon: "shield24" as const, title: "Escrow on every order" },
  { icon: "sealCheck20" as const, title: "Sellers are reviewed before they open" },
  { icon: "truck24" as const, title: "One checkout, many stores" },
];

export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.page}>
      <aside className={styles.aside} aria-hidden="true">
        <div className={styles.asideInner}>
          <p className={styles.eyebrow}>Social Commerce, made for Nigeria</p>
          <p className={styles.headline}>
            Shop the sellers you already <span className={styles.priceTag}>watch.</span>
          </p>
          <p className={styles.lede}>
            Find real sellers through posts, clips, stories and live streams. Pay in your local currency, and your money stays in escrow until you confirm your order arrived.
          </p>
          <ul className={styles.proofList}>
            {escrowPromises.map((promise) => (
              <li key={promise.title}>
                <AppIcon name={promise.icon} size={18} />
                {promise.title}
              </li>
            ))}
          </ul>

          <div className={styles.stage}>
            <div className={styles.stagePanel} />
            <PhoneFrameWithAppScreen
              screen="creatorProfileScreen"
              alt="Seller profile with followers and a View Shop button"
              className={`${styles.phone} ${styles.phoneLeft}`}
            />
            <PhoneFrameWithAppScreen screen="homeFeedScreen" alt="Nantty home feed" className={`${styles.phone} ${styles.phoneCenter}`} priority />
            <PhoneFrameWithAppScreen screen="productDetailScreen" alt="Product page with its naira price and Add to Cart" className={`${styles.phone} ${styles.phoneRight}`} />
          </div>
        </div>
      </aside>

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <div className={styles.panel}>
          <Link href="/welcome" className={styles.wordmark} aria-label="Nantty">
            <NanttyWordmark height={30} />
          </Link>
          <CookiesRequiredNotice />
          {children}
        </div>
      </main>
    </div>
  );
}
