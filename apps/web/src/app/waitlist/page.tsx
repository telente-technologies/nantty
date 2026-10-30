import Image from "next/image";
import Link from "next/link";

import { NanttyCountdown } from "@/components/nantty/nanttyCountdown";
import { NanttyWaitlistForm } from "@/components/nantty/nanttyWaitlistForm";
import { nanttyLaunchTargets } from "@/components/nantty/nantty.config";
import landingStyles from "@/components/nantty/nanttyLanding.module.css";
import { createPublicPageMetadata } from "@/lib/pageMetadata.util";

import styles from "./waitlistPage.module.css";

const productMoments = [
  {
    number: "01",
    title: "Find things through people",
    description: "The planned feed brings together seller and creator posts, clips and stories so discovery can begin with people you follow.",
    image: "/screens/homeFeedScreen.webp",
    alt: "Nantty mobile feed showing a creator post and shoppable product video",
  },
  {
    number: "02",
    title: "Ask, compare and decide",
    description: "The planned product flow connects product details with seller conversations, so shoppers can ask questions before deciding.",
    image: "/screens/productDetailScreen.webp",
    alt: "Nantty product detail screen from the mobile app",
  },
  {
    number: "03",
    title: "Know where your payment stands",
    description: "For eligible Nigerian orders, the planned escrow flow keeps funds in the buyer’s own account with the licensed payment partner—not with Nantty—until delivery confirmation or a dispute outcome.",
    image: "/screens/escrowStatusScreen.webp",
    alt: "Nantty mobile order screen showing escrow and delivery status",
  },
];

export const metadata = createPublicPageMetadata({
  title: "Join the Nantty waitlist",
  description: "See what Nantty is building: a Nigerian social marketplace where posts, clips and stories connect shoppers with sellers, with escrow for eligible orders.",
  path: "/waitlist",
});

export default function WaitlistPage() {
  return (
    <div className={`${landingStyles.nanttyPage} ${styles.page}`}>
      <section className={styles.hero} aria-labelledby="waitlist-title">
        <div className={`${landingStyles.pageContainer} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <span className={landingStyles.eyebrow}>NANTTY · EARLY ACCESS</span>
            <h1 id="waitlist-title">A social marketplace built around <em>people you trust.</em></h1>
            <p>Nantty is still in development. We’re building for shoppers, independent businesses and creators in Nigeria, bringing product discovery and shopping into one experience.</p>
            <div className={styles.heroActions}>
              <a className={landingStyles.primaryButton} href="#join-waitlist">Get launch updates</a>
              <a className={landingStyles.secondaryButton} href="#what-is-nantty">See what’s coming</a>
            </div>
            <p className={styles.statusNote}>Nantty is still being built. Beta and public-launch dates below are planning targets, not a promise of availability.</p>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.visualGlow} aria-hidden="true" />
            <div className={styles.phoneFrame}>
              <Image src="/screens/homeFeedScreen.webp" alt="A real screen from the Nantty mobile app showing the social shopping feed" width={393} height={852} priority sizes="(max-width: 760px) 75vw, 340px" />
            </div>
            <div className={styles.floatNote}><span className={styles.liveDot} /> Shopping starts with discovery</div>
          </div>
        </div>
      </section>

      <section className={styles.promise} aria-label="What Nantty brings together">
        <div className={`${landingStyles.pageContainer} ${styles.promiseGrid}`}>
          <p><strong>Discover</strong><span>Posts, clips and stories</span></p>
          <p><strong>Connect</strong><span>Creators, sellers and shoppers</span></p>
          <p><strong>Shop with clarity</strong><span>Order updates and escrow for eligible orders</span></p>
        </div>
      </section>

      <section id="what-is-nantty" className={styles.productSection} aria-labelledby="product-title">
        <div className={landingStyles.pageContainer}>
          <div className={styles.sectionIntro}>
            <span className={landingStyles.eyebrow}>WHAT YOU’RE WAITING FOR</span>
            <h2 id="product-title">More than a product listing.</h2>
            <p>These real app screens illustrate the product direction, not a promise that the app is already available. Nantty is designed around discovering items in posts, hearing about them from creators, and asking sellers questions.</p>
          </div>
          <div className={styles.momentList}>
            {productMoments.map((moment, index) => (
              <article className={`${styles.moment} ${index % 2 ? styles.momentReverse : ""}`} key={moment.number}>
                <div className={styles.momentCopy}>
                  <span className={styles.momentNumber}>{moment.number} / THE EXPERIENCE</span>
                  <h3>{moment.title}</h3>
                  <p>{moment.description}</p>
                </div>
                <div className={styles.screenCard}>
                  <Image src={moment.image} alt={moment.alt} width={393} height={852} loading="lazy" sizes="(max-width: 760px) 78vw, 360px" />
                </div>
              </article>
            ))}
          </div>
          <div className={styles.sellerLink}><p>Building a business on Nantty? The seller page explains the current store setup and fees.</p><Link href="/sellers">Explore selling on Nantty <span aria-hidden="true">↗</span></Link></div>
        </div>
      </section>

      <section className={styles.timeline} aria-labelledby="timeline-title">
        <div className={landingStyles.pageContainer}>
          <div className={styles.sectionIntro}>
            <span className={landingStyles.eyebrow}>THE ROAD AHEAD</span>
            <h2 id="timeline-title">We’re building toward two milestones.</h2>
            <p>These dates are planning targets. We’ll share confirmed timing and access details as development progresses.</p>
          </div>
          <div className={landingStyles.milestoneGrid}>
            <article className={landingStyles.milestoneCard}>
              <div><span>EARLY BETA TARGET</span><h3>{nanttyLaunchTargets.earlyBeta.displayDate}</h3><p>Small-scale product testing; access is not yet open.</p></div>
              <NanttyCountdown target={nanttyLaunchTargets.earlyBeta.date} label="early beta" />
            </article>
            <article className={`${landingStyles.milestoneCard} ${landingStyles.milestoneDark}`}>
              <div><span>PUBLIC LAUNCH TARGET</span><h3>{nanttyLaunchTargets.publicLaunch.displayDate}</h3><p>Target timing only; the exact date will be confirmed later.</p></div>
              <NanttyCountdown target={nanttyLaunchTargets.publicLaunch.date} label="public launch" />
            </article>
          </div>
        </div>
      </section>

      <section id="join-waitlist" className={styles.joinSection} aria-labelledby="join-title">
        <div className={`${landingStyles.pageContainer} ${styles.joinPanel}`}>
          <div className={styles.joinIntro}>
            <span className={landingStyles.eyebrow}>STAY IN THE LOOP</span>
            <h2 id="join-title">Be first to hear when it’s ready.</h2>
            <p>Join with your email and choose whether you’re here as a shopper, seller or creator. You can withdraw consent or request deletion at any time through our privacy contact.</p>
            <Link href="/waitlist-privacy">Read the waitlist privacy notice</Link>
          </div>
          <NanttyWaitlistForm />
        </div>
      </section>
    </div>
  );
}
