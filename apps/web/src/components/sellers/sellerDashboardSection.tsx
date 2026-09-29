import { FigmaIconTintedWithCurrentColor, type FigmaIconName } from "../ui/figmaIcon";
import { PhoneFrameWithAppScreen } from "../ui/phoneFrame";
import { SectionIntroWithEyebrowAndHeading } from "../ui/sectionIntro";
import styles from "./sellerDashboardSection.module.css";

const dashboardCapabilities: ReadonlyArray<{ readonly icon: FigmaIconName; readonly title: string; readonly description: string }> = [
  { icon: "boxArrowDown24", title: "Orders", description: "See new, paid, shipped and delivered orders, and what each buyer is waiting on." },
  { icon: "tag24", title: "Products and stock", description: "Edit prices, variants and stock levels. Sold-out items stop showing in the Mart." },
  { icon: "chatCircle24", title: "Buyer chats", description: "Answer questions before and after purchase, with the order details beside the chat." },
  { icon: "speedometer24", title: "Performance", description: "Track views, sales and which posts, clips and lives brought buyers to your store." },
];

export function SellerDashboardSection() {
  return (
    <section id="dashboard" className={styles.section} aria-labelledby="dashboard-heading">
      <div className={`pageContainer ${styles.layout}`}>
        <div className={styles.visual}>
          <PhoneFrameWithAppScreen screen="homeMartScreen" alt="Zudomart Mart tab where your listed products appear to buyers" className={styles.phone} sizes="(min-width: 960px) 300px, 66vw" />
        </div>
        <div className={styles.copyColumn}>
          <SectionIntroWithEyebrowAndHeading
            eyebrow="Seller dashboard"
            headingId="dashboard-heading"
            heading="Run the whole store from your phone."
            description="The seller dashboard lives inside the Zudomart app. No separate website to manage."
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
        </div>
      </div>
    </section>
  );
}
