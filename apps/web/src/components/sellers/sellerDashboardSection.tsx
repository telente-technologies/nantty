import { businessAppLinks } from "@/lib/siteConfig.config";

import { ActionLinkStyledAsButton } from "../ui/actionLink";
import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "../ui/figmaIcon";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import styles from "./sellerDashboardSection.module.css";

const dashboardCapabilities: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string }> = [
  { icon: "boxArrowDown24", title: "Orders", description: "See new, paid, shipped and delivered orders, and what each buyer is waiting on." },
  { icon: "tag24", title: "Products and stock", description: "Edit prices, variants and stock levels. Sold-out items stop showing in the Mart." },
  { icon: "chatCircle24", title: "Buyer chats", description: "Answer questions before and after purchase, with the order details beside the chat." },
  { icon: "speedometer24", title: "Performance", description: "Track sales by hour, day and month, and which posts, clips and lives brought buyers to your store." },
];

const webDashboardFeatures = ["App orders, returns and disputes in one place", "Products, variants and stock levels", "Sales and payout reports", "Staff accounts and roles on Pro and Business"] as const;

export function SellerDashboardSection() {
  return (
    <section id="dashboard" className={styles.section} aria-labelledby="dashboard-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.visual}>
          <PhoneFrameWithAppScreen screen="sellerDashboardScreen" alt="Seller dashboard in the Nantty app with today's sales in naira, an hourly chart and recent orders to ship" className={styles.phone} sizes="(min-width: 960px) 300px, 66vw" />
        </div>
        <div className={styles.copyColumn}>
          <SectionIntroWithEyebrowAndHeading
            eyebrow="Seller dashboard"
            headingId="dashboard-heading"
            heading="Run the whole store from your phone."
            description="Every store gets a seller dashboard inside the Nantty app. Growing businesses can add the Nantty Dashboard on the web."
          />
          <ul className={styles.capabilityList}>
            {dashboardCapabilities.map((dashboardCapability) => (
              <li key={dashboardCapability.title} className={styles.capability}>
                <FigmaIconTintedWithCurrentColor name={dashboardCapability.icon} size={24} className={styles.capabilityIcon} />
                <h3 className={styles.capabilityTitle}>{dashboardCapability.title}</h3>
                <p className={styles.capabilityDescription}>{dashboardCapability.description}</p>
              </li>
            ))}
          </ul>
          <aside className={styles.webDashboardCard} aria-labelledby="web-dashboard-heading">
            <p className={styles.webDashboardBadge}>
              <FigmaIconTintedWithCurrentColor name="sealCheck20" size={16} />
              Free for every seller
            </p>
            <h3 id="web-dashboard-heading" className={styles.webDashboardHeading}>
              {businessAppLinks.sellerDashboard.label} on the web
            </h3>
            <p className={styles.webDashboardDescription}>
              Sign in with the same account you use in the Nantty app. Your store, products, orders and wallet are already there.
            </p>
            <ul className={styles.webDashboardFeatureList}>
              {webDashboardFeatures.map((webDashboardFeature) => (
                <li key={webDashboardFeature}>
                  <FigmaIconTintedWithCurrentColor name="check16" size={16} />
                  {webDashboardFeature}
                </li>
              ))}
            </ul>
            <div className={styles.webDashboardActions}>
              <ActionLinkStyledAsButton href={businessAppLinks.sellerDashboard.href} opensInNewTab>
                Open {businessAppLinks.sellerDashboard.label}
              </ActionLinkStyledAsButton>
              <ActionLinkStyledAsButton href={businessAppLinks.adsManager.href} appearance="secondary" opensInNewTab>
                Promote with {businessAppLinks.adsManager.label}
              </ActionLinkStyledAsButton>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
