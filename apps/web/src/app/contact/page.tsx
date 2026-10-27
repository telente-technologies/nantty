import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "@/components/ui/figmaIcon";
import { PageHeaderWithTitleAndLede } from "@/components/ui/pageHeader";
import { buildMailtoHref } from "@nantty/web-kit";

import { emailAddresses, siteConfig } from "@/lib/siteConfig.config";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

import styles from "./contact.module.css";

export const metadata = createPublicPageMetadata({ title: "Contact", description: "Contact the Nantty team about shopping, selling, press or privacy.", path: "/contact" });

const contactChannels: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string; readonly email: string }> = [
  { icon: "headset24", title: "Help with an order", description: "Questions about payments, escrow, delivery or a dispute.", email: emailAddresses.support },
  { icon: "buildingStore20", title: "Selling on Nantty", description: "Store applications, listings, payouts and seller fees.", email: emailAddresses.sellers },
  { icon: "paperPlaneTilt24", title: "Press and partnerships", description: "Interviews, media assets and working together.", email: emailAddresses.press },
  { icon: "shield24", title: "Privacy and data", description: "Requests about your personal data and how we use it.", email: emailAddresses.privacy },
];

export default function ContactPage() {
  return (
    <>
      <PageHeaderWithTitleAndLede
        eyebrow="Contact"
        title="Talk to a person at Nantty."
        lede="Pick the inbox that matches your question and the right team will pick it up."
      />
      <section className="pageContainer" aria-label="Ways to contact us">
        <ul className={styles.channelList}>
          {contactChannels.map((contactChannel) => (
            <li key={contactChannel.title} className={styles.channel}>
              <span className={styles.channelIcon}>
                <FigmaIconTintedWithCurrentColor name={contactChannel.icon} size={22} />
              </span>
              <h2 className={styles.channelTitle}>{contactChannel.title}</h2>
              <p className={styles.channelDescription}>{contactChannel.description}</p>
              <a href={buildMailtoHref(contactChannel.email)} className={styles.channelEmail}>
                {contactChannel.email}
                <FigmaIconTintedWithCurrentColor name="arrowUpRight24" size={18} />
              </a>
            </li>
          ))}
        </ul>
        <p className={styles.generalNote}>
          For anything else, write to <a href={buildMailtoHref(emailAddresses.hello)}>{emailAddresses.hello}</a>. Report a security issue to <a href={buildMailtoHref(emailAddresses.security)}>{emailAddresses.security}</a>. We are based in {siteConfig.launchCountry}.
        </p>
      </section>
    </>
  );
}
