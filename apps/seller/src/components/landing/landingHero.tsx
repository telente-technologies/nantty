import styles from "./landingHero.module.css";
import { NanttyIcon } from "@/components/ui/nanttyIcon";
import { PrelaunchLoginAction } from "./prelaunchLoginAction";
import { LandingProductPreview } from "./landingProductPreview";

export function LandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="landing-hero-heading">
      <div className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Nantty Dashboard · free for every seller</p>
          <h1 id="landing-hero-heading" className={styles.heading}>
            Sell from anywhere with the app. Run your business <span className={styles.receiptTag}>here.</span>
          </h1>
          <p className={styles.lede}>
            Your seller operating system: manage products and stock, fulfil the orders customers place in the Nantty app, see what sells, run promotions, track your payouts and bring your team in — with the same account as your app. Free for every Nantty seller; upgrade to Pro or Business when you grow.
          </p>
          {process.env.NEXT_PUBLIC_NANTTY_STATIC_PRELAUNCH === "1" ? (
            <div className={styles.signInPill}>
              <PrelaunchLoginAction className={styles.signInButton}>Sign in with your Nantty account</PrelaunchLoginAction>
            </div>
          ) : (
            <form action="/login" method="get" className={styles.signInPill}>
              <label htmlFor="hero-identifier" className="visuallyHidden">Email or username</label>
              <input id="hero-identifier" name="identifier" type="text" autoComplete="username" placeholder="Email or username" maxLength={254} className={styles.signInInput} />
              <button type="submit" className={styles.signInButton}>Sign in with your Nantty account</button>
            </form>
          )}
          <ul className={styles.proofList}>
            <li>Same account as the app</li>
            <li>Free plan, no card needed</li>
            <li>Payouts to your bank, escrow-protected in Nigeria</li>
          </ul>
        </div>
        <div className={styles.stage}>
          <div className={styles.stagePanel} aria-hidden="true" />
          <figure className={styles.browserFrame}>
            <div className={styles.browserBar} aria-hidden="true">
              <span />
              <span />
              <span />
              <p>creator.nantty.com</p>
            </div>
            {process.env.NEXT_PUBLIC_NANTTY_STATIC_PRELAUNCH === "1" ? <LandingProductPreview title="Your business at a glance" /> : <img src="/screenshots/dashboardOverview.webp" alt="The dashboard home: sales today, a 30-day revenue chart, wallet balances and online orders by status" width={1440} height={900} className={styles.browserScreenshot} />}
          </figure>
          <figure className={styles.tabletFrame}>
            {process.env.NEXT_PUBLIC_NANTTY_STATIC_PRELAUNCH === "1" ? <LandingProductPreview title="Orders protected by escrow" /> : <img src="/screenshots/orderEscrow.webp" alt="An app order with escrow status and the mark-as-shipped form" width={1180} height={820} className={styles.tabletScreenshot} />}
          </figure>
          <p className={`${styles.chip} ${styles.offlineChip}`}>
            <span className={styles.chipDot} aria-hidden="true" />
            App orders land here the moment customers pay.
          </p>
          <p className={`${styles.chip} ${styles.escrowChip}`}>
            <span className={styles.chipBadge} aria-hidden="true">
              <NanttyIcon name="check16" size={14} />
            </span>
            Escrow released to your wallet after delivery
          </p>
        </div>
      </div>
    </section>
  );
}
